/**
 * Kolejka generowania raportów w pamięci procesu: najwyżej GENERATION_CONCURRENCY (domyślnie 2) naraz,
 * deduplikacja po id raportu, ponowienia z opóźnieniem po błędach przejściowych.
 * Stan trwały jest w bazie (status + attempts), więc po restarcie kolejkę odtwarza `resumeGenerations()`.
 */

export class Semaphore {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((r) => this.waiting.push(r));
    else this.active++;
    try {
      return await fn();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }

  get stats() {
    return { active: this.active, waiting: this.waiting.length };
  }
}

export interface GenerationOutcome {
  /** Ustawione, gdy próba się nie udała, ale można spróbować ponownie po tylu ms. */
  retryInMs?: number;
}

type Runner = (id: string) => Promise<GenerationOutcome>;

interface QueueState {
  sem: Semaphore;
  pending: Map<string, Promise<void>>;
  running: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __sprawdzQueue: QueueState | undefined;
}

function state(): QueueState {
  return (globalThis.__sprawdzQueue ??= {
    sem: new Semaphore(Math.max(1, Number(process.env.GENERATION_CONCURRENCY || 2))),
    pending: new Map(),
    running: new Set(),
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms).unref?.());

async function defaultRunner(id: string): Promise<GenerationOutcome> {
  const { generateNow } = await import("./generate");
  return generateNow(id);
}

/**
 * Dodaje raport do kolejki. Zwraca obietnicę zakończenia (łącznie z ewentualnymi ponowieniami).
 * Wielokrotne wywołanie dla tego samego id zwraca tę samą obietnicę.
 */
export function enqueueGeneration(id: string, opts: { delayMs?: number; runner?: Runner } = {}): Promise<void> {
  const s = state();
  const existing = s.pending.get(id);
  if (existing) return existing;
  const runner = opts.runner ?? defaultRunner;
  const p = (async () => {
    let delay = opts.delayMs ?? 0;
    for (;;) {
      if (delay > 0) await sleep(delay);
      const outcome = await s.sem.run(async () => {
        s.running.add(id);
        try {
          return await runner(id);
        } catch (e) {
          console.error(`[queue] Nieobsłużony błąd generowania ${id}:`, e);
          return {};
        } finally {
          s.running.delete(id);
        }
      });
      if (outcome.retryInMs === undefined) return;
      delay = outcome.retryInMs;
    }
  })().finally(() => s.pending.delete(id));
  s.pending.set(id, p);
  return p;
}

/** Identyfikatory raportów w kolejce lub w trakcie generowania w tym procesie. */
export function queuedGenerationIds(): string[] {
  return [...state().pending.keys()];
}

export function queueStats() {
  const s = state();
  return { ...s.sem.stats, queued: s.pending.size };
}

/**
 * Wznowienie: `generating` starsze niż `staleMin` minut → `paid`, potem wszystkie `paid` do kolejki.
 * Wywoływane przy starcie (instrumentation.ts) i okresowo (watchdog).
 */
export async function resumeGenerations(staleMin = Number(process.env.GENERATION_STALE_MIN || 10)): Promise<{ requeued: number; enqueued: number }> {
  const { listPaidReportIds, requeueStaleGenerating } = await import("./db");
  const requeued = requeueStaleGenerating(staleMin, queuedGenerationIds());
  const ids = listPaidReportIds().filter((id) => !state().pending.has(id));
  for (const id of ids) void enqueueGeneration(id);
  return { requeued, enqueued: ids.length };
}
