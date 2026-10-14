"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "./summary";

/** Spis treści raportu: przyklejony pasek „chipsów” (przewijany poziomo w sobie – bez poziomego scrolla strony). */
export function ReportToc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = entries.map((e) => document.getElementById(e.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (list) => {
        const vis = list.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-64px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [entries]);

  useEffect(() => {
    if (!active) return;
    document.querySelector(`[data-toc="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav aria-label="Spis treści raportu" className="no-print sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-2">
      <ul className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {entries.map((e) => (
          <li key={e.id} className="shrink-0">
            <a
              href={`#${e.id}`}
              data-toc={e.id}
              aria-current={active === e.id ? "location" : undefined}
              className={`block whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${
                active === e.id ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-brand-600"
              }`}
            >
              {e.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
