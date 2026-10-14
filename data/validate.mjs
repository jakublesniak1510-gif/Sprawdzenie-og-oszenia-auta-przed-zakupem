#!/usr/bin/env node
// Walidacja bazy wiedzy: modele (models/*.json), czerwone flagi (red-flags.json), pytania wg kategorii,
// słowniczek (glossary.json) i próbki Historii Pojazdu (samples/cepik).
// Uruchomienie: cd data && npm install && node validate.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const DIR = dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateModel = ajv.compile(readJson(join(DIR, 'schema/model.schema.json')));
const flagsSchema = readJson(join(DIR, 'schema/red-flags.schema.json'));
const validateFlags = ajv.compile(flagsSchema);
const validateQuestions = ajv.compile(readJson(join(DIR, 'schema/questions-by-category.schema.json')));
const validateGlossary = ajv.compile(readJson(join(DIR, 'schema/glossary.schema.json')));
const validateSample = ajv.compile(readJson(join(DIR, 'schema/cepik-sample.schema.json')));
const FLAG_CATEGORIES = flagsSchema.items.properties.category.enum;

// Progi jakości ustalone dla MVP (ostrzejsze niż schemat).
const MIN = { engines: 3, faultsPerEngine: 3, inspectionTips: 6, questions: 5, redFlags: 80, priceRanges: 3, glossary: 40, cepikSamples: 6 };
const MAX_PRICE_RANGES = 5;

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function checkFault(where, f) {
  if (f.cost_pln[0] > f.cost_pln[1]) err(where, `koszt od > do (${f.cost_pln})`);
  if (f.cost_pln[0] < 0) err(where, 'ujemny koszt');
  if (f.cost_pln[1] > 60000) warn(where, `bardzo wysoki koszt (${f.cost_pln[1]} zł) – sprawdzić`);
}

// ---------- modele ----------
const modelsDir = join(DIR, 'models');
const files = existsSync(modelsDir) ? readdirSync(modelsDir).filter((f) => f.endsWith('.json')).sort() : [];
const ids = new Map();
const aliasOwner = new Map();
const stats = { models: 0, engines: 0, engineFaults: 0, commonFaults: 0, tips: 0, questions: 0, fuel: {}, verdict: {}, makes: new Set(), withPrices: 0, priceRanges: 0, withRunningCosts: 0, withBuyAdvice: 0 };

// Widełki cen, koszty utrzymania i rada zakupowa (pola opcjonalne w schemacie, wymagane progami jakości tej bazy).
function checkMarket(where, m) {
  const [y0, y1] = m.years;
  const inYears = (a, b) => a >= y0 && b <= y1;
  const pr = m.price_ranges;
  if (!pr) err(where, 'brak price_ranges (wymagane w tej bazie – flaga „cena poniżej rynku”)');
  else {
    stats.withPrices++;
    stats.priceRanges += pr.length;
    if (pr.length < MIN.priceRanges || pr.length > MAX_PRICE_RANGES) err(where, `price_ranges: ${pr.length} przedziałów (oczekiwane ${MIN.priceRanges}–${MAX_PRICE_RANGES})`);
    pr.forEach((r, i) => {
      const w = `${where} price_ranges[${i}]`;
      if (r.years[0] > r.years[1]) err(w, `years od > do (${r.years})`);
      if (!inYears(r.years[0], r.years[1])) err(w, `roczniki ${r.years} poza zakresem modelu ${m.years}`);
      if (r.price_pln[0] >= r.price_pln[1]) err(w, `price_pln od >= do (${r.price_pln})`);
      if (r.price_pln[0] < 2000 || r.price_pln[1] > 1000000) err(w, `nierealna cena ${r.price_pln}`);
      if (r.price_pln[1] > r.price_pln[0] * 2.2) warn(w, `bardzo szerokie widełki ${r.price_pln}`);
      if (r.km_max < 10000 || r.km_max > 600000) err(w, `nierealny km_max ${r.km_max}`);
      if (i > 0) {
        const p = pr[i - 1];
        if (r.years[0] <= p.years[1]) err(w, `przedziały roczników nachodzą na siebie lub nie są rosnące (${p.years} → ${r.years})`);
        if (r.price_pln[0] < p.price_pln[0] || r.price_pln[1] < p.price_pln[1]) warn(w, `ceny nowszych roczników niższe niż starszych (${p.price_pln} → ${r.price_pln})`);
      }
    });
  }
  const rc = m.running_costs;
  if (!rc) err(where, 'brak running_costs');
  else {
    stats.withRunningCosts++;
    if (rc.service_interval_km < 5000 || rc.service_interval_km > 40000) err(where, `running_costs.service_interval_km poza zakresem 5–40 tys. (${rc.service_interval_km})`);
  }
  const ba = m.buy_advice;
  if (!ba) err(where, 'brak buy_advice');
  else {
    stats.withBuyAdvice++;
    const [a, b] = ba.sweet_spot_years;
    if (a > b) err(where, `buy_advice.sweet_spot_years od > do (${ba.sweet_spot_years})`);
    if (!inYears(a, b)) err(where, `buy_advice.sweet_spot_years ${ba.sweet_spot_years} poza zakresem modelu ${m.years}`);
  }
}

for (const file of files) {
  const where = `models/${file}`;
  let m;
  try { m = readJson(join(modelsDir, file)); } catch (e) { err(where, `niepoprawny JSON – ${e.message}`); continue; }
  if (!validateModel(m)) {
    for (const e of validateModel.errors) err(where, `schemat ${e.instancePath || '/'} ${e.message}`);
    continue;
  }
  stats.models++;
  stats.makes.add(m.make);
  if (basename(file, '.json') !== m.id) err(where, `nazwa pliku różna od id (${m.id})`);
  if (ids.has(m.id)) err(where, `zduplikowane id ${m.id} (też w ${ids.get(m.id)})`);
  ids.set(m.id, file);
  if (m.years[0] > m.years[1]) err(where, 'years: rok początkowy > końcowy');
  checkMarket(where, m);

  for (const a of m.aliases) {
    if (a !== a.toLowerCase()) err(where, `alias modelu nie jest małymi literami: "${a}"`);
    const k = norm(a);
    if (aliasOwner.has(k) && aliasOwner.get(k) !== m.id) err(where, `alias "${a}" występuje też w ${aliasOwner.get(k)}`);
    else if (aliasOwner.get(k) === m.id) warn(where, `alias "${a}" powtórzony w tym samym modelu`);
    aliasOwner.set(k, m.id);
  }

  if (m.engines.length < MIN.engines) err(where, `za mało silników (${m.engines.length} < ${MIN.engines})`);
  const engAlias = new Map();
  m.engines.forEach((e, i) => {
    const w = `${where} silnik[${i}] ${e.code}`;
    stats.engines++;
    stats.fuel[e.fuel] = (stats.fuel[e.fuel] || 0) + 1;
    if (e.verdict) stats.verdict[e.verdict] = (stats.verdict[e.verdict] || 0) + 1;
    if (e.faults.length < MIN.faultsPerEngine) err(w, `za mało usterek (${e.faults.length} < ${MIN.faultsPerEngine})`);
    for (const a of e.aliases) {
      if (a !== a.toLowerCase()) err(w, `alias silnika nie jest małymi literami: "${a}"`);
      const k = norm(a);
      if (engAlias.has(k) && engAlias.get(k) !== i) warn(w, `alias silnika "${a}" także w silniku[${engAlias.get(k)}] tego modelu`);
      engAlias.set(k, i);
    }
    e.faults.forEach((f, j) => { stats.engineFaults++; checkFault(`${w} usterka[${j}]`, f); });
  });
  m.common_faults.forEach((f, j) => { stats.commonFaults++; checkFault(`${where} common_faults[${j}]`, f); });
  if (m.inspection_tips.length < MIN.inspectionTips) err(where, `za mało inspection_tips (${m.inspection_tips.length} < ${MIN.inspectionTips})`);
  if (m.questions_for_seller.length < MIN.questions) err(where, `za mało questions_for_seller (${m.questions_for_seller.length} < ${MIN.questions})`);
  if (m.common_faults.length < 3) warn(where, `mało common_faults (${m.common_faults.length})`);
  stats.tips += m.inspection_tips.length;
  stats.questions += m.questions_for_seller.length;
  const text = JSON.stringify(m);
  if (/https?:\/\/|www\./i.test(text)) err(where, 'zawiera link – baza nie powinna linkować do stron');
}

// Alias jednego modelu nie powinien „trafiać” w alias innego modelu przy zalecanym dopasowaniu
// z granicami słów (patrz README: alias nie może być kontynuowany literą, cyfrą, „.5”, „,5” ani „x4”).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const aliasMatcher = (a) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(a)}(?![\\p{L}\\p{N}]|[.,]\\d|x\\d)`, 'u');
const aliasList = [...aliasOwner.entries()];
for (const [a, ownerA] of aliasList) {
  const re = aliasMatcher(a);
  for (const [b, ownerB] of aliasList) {
    if (ownerA !== ownerB && re.test(b)) err(`models/${ownerA}.json`, `alias "${a}" pasuje do aliasu "${b}" modelu ${ownerB} – niejednoznaczne rozpoznanie`);
  }
}

// ---------- czerwone flagi ----------
const flagsPath = join(DIR, 'red-flags.json');
const flagStats = { flags: 0, patterns: 0, regex: 0, byCategory: {} };
if (!existsSync(flagsPath)) err('red-flags.json', 'brak pliku');
else {
  let flags;
  try { flags = readJson(flagsPath); } catch (e) { err('red-flags.json', `niepoprawny JSON – ${e.message}`); }
  if (flags && !validateFlags(flags)) {
    for (const e of validateFlags.errors) err('red-flags.json', `schemat ${e.instancePath || '/'} ${e.message}`);
  } else if (flags) {
    const seen = new Set();
    for (const f of flags) {
      const w = `red-flags.json ${f.id}`;
      flagStats.flags++;
      flagStats.byCategory[f.category] = (flagStats.byCategory[f.category] || 0) + 1;
      if (seen.has(f.id)) err(w, 'zduplikowane id');
      seen.add(f.id);
      if (!f.question_for_seller) err(w, 'brak question_for_seller');
      if (!f.neutral_wording?.trim()) err(w, 'pusty neutral_wording');
      for (const p of f.patterns) {
        flagStats.patterns++;
        const re = /^\/(.+)\/([a-z]*)$/.exec(p);
        if (re) {
          flagStats.regex++;
          try { new RegExp(re[1], re[2] || 'iu'); } catch (e) { err(w, `niepoprawny regex ${p}: ${e.message}`); }
        } else if (p !== p.toLowerCase()) err(w, `wzorzec nie jest małymi literami: "${p}"`);
      }
    }
    if (flags.length < MIN.redFlags) err('red-flags.json', `za mało flag (${flags.length} < ${MIN.redFlags})`);
  }
}

// ---------- pytania wg kategorii ----------
const qStats = { categories: 0, questions: 0 };
const qPath = join(DIR, 'questions-by-category.json');
if (!existsSync(qPath)) err('questions-by-category.json', 'brak pliku');
else {
  let q;
  try { q = readJson(qPath); } catch (e) { err('questions-by-category.json', `niepoprawny JSON – ${e.message}`); }
  if (q && !validateQuestions(q)) {
    for (const e of validateQuestions.errors) err('questions-by-category.json', `schemat ${e.instancePath || '/'} ${e.message}`);
  } else if (q) {
    const seenQ = new Map();
    for (const c of Object.keys(q.kategorie)) {
      if (!FLAG_CATEGORIES.includes(c)) err('questions-by-category.json', `kategoria „${c}” spoza red-flags.schema.json`);
      qStats.categories++;
      for (const t of q.kategorie[c].pytania) {
        qStats.questions++;
        const k = norm(t);
        if (seenQ.has(k)) err('questions-by-category.json', `powtórzone pytanie w ${c} i ${seenQ.get(k)}: „${t}”`);
        seenQ.set(k, c);
      }
    }
    for (const c of FLAG_CATEGORIES) if (!q.kategorie[c]) err('questions-by-category.json', `brak kategorii ${c}`);
  }
}

// ---------- słowniczek ----------
const gStats = { terms: 0 };
const gPath = join(DIR, 'glossary.json');
if (!existsSync(gPath)) err('glossary.json', 'brak pliku');
else {
  let g;
  try { g = readJson(gPath); } catch (e) { err('glossary.json', `niepoprawny JSON – ${e.message}`); }
  if (g && !validateGlossary(g)) {
    for (const e of validateGlossary.errors) err('glossary.json', `schemat ${e.instancePath || '/'} ${e.message}`);
  } else if (g) {
    const terms = new Set();
    const aliasTerm = new Map();
    for (const t of g) {
      gStats.terms++;
      if (terms.has(norm(t.term))) err('glossary.json', `powtórzone pojęcie „${t.term}”`);
      terms.add(norm(t.term));
      for (const a of t.aliases) {
        if (a !== a.toLowerCase()) err('glossary.json', `alias nie jest małymi literami: „${a}” (${t.term})`);
        if (aliasTerm.has(norm(a))) warn('glossary.json', `alias „${a}” w „${t.term}” i „${aliasTerm.get(norm(a))}”`);
        aliasTerm.set(norm(a), t.term);
      }
      if (/https?:\/\/|www\./i.test(JSON.stringify(t))) err('glossary.json', `link w pojęciu „${t.term}”`);
    }
    if (g.length < MIN.glossary) err('glossary.json', `za mało pojęć (${g.length} < ${MIN.glossary})`);
  }
}

// ---------- próbki Historii Pojazdu (CEPiK) ----------
const sStats = { samples: 0, hypothetical: 0, readings: 0 };
const samplesDir = join(DIR, 'samples', 'cepik');
if (!existsSync(samplesDir)) err('samples/cepik', 'brak katalogu z próbkami');
else {
  const all = readdirSync(samplesDir);
  const txts = all.filter((f) => f.endsWith('.txt')).sort();
  for (const f of all.filter((f) => f.endsWith('.expected.json'))) {
    if (!txts.includes(f.replace(/\.expected\.json$/, '.txt'))) err(`samples/cepik/${f}`, 'brak odpowiadającego pliku .txt');
  }
  for (const f of all) if (!f.endsWith('.txt') && !f.endsWith('.expected.json')) warn(`samples/cepik/${f}`, 'nieoczekiwany plik');
  for (const f of txts) {
    const where = `samples/cepik/${f}`;
    sStats.samples++;
    const expPath = join(samplesDir, f.replace(/\.txt$/, '.expected.json'));
    if (!existsSync(expPath)) { err(where, 'brak pliku .expected.json'); continue; }
    let exp;
    try { exp = readJson(expPath); } catch (e) { err(where, `niepoprawny .expected.json – ${e.message}`); continue; }
    if (!validateSample(exp)) { for (const e of validateSample.errors) err(where, `expected: schemat ${e.instancePath || '/'} ${e.message}`); continue; }
    const txt = readFileSync(join(samplesDir, f), 'utf8');
    if (exp.plik !== f) err(where, `pole plik (${exp.plik}) różne od nazwy pliku`);
    const hyp = f.includes('.hipotetyczny.');
    if (hyp) sStats.hypothetical++;
    if (exp.hipotetyczny_format !== hyp) err(where, 'hipotetyczny_format niezgodny z nazwą pliku (.hipotetyczny.)');
    if (!/DANE FIKCYJNE/i.test(txt)) err(where, 'próbka powinna zawierać oznaczenie „DANE FIKCYJNE”');
    if (exp.vin && !exp.vin.startsWith('TEST')) err(where, 'VIN w próbce musi być fikcyjny (zaczynać się od TEST)');
    if (exp.vin && !txt.includes(exp.vin)) err(where, `VIN ${exp.vin} nie występuje w tekście próbki`);
    sStats.readings += exp.odczyty.length;
    for (let i = 1; i < exp.odczyty.length; i++) if (exp.odczyty[i].data < exp.odczyty[i - 1].data) err(where, 'odczyty nieposortowane po dacie');
    const cof = [];
    for (let i = 1; i < exp.odczyty.length; i++) if (exp.odczyty[i].km < exp.odczyty[i - 1].km) cof.push({ z: exp.odczyty[i - 1], na: exp.odczyty[i] });
    if (JSON.stringify(cof) !== JSON.stringify(exp.cofniecia)) err(where, 'cofniecia niezgodne z odczytami');
    if ((cof.length > 0) !== exp.sygnaly.includes('cofniecie_przebiegu')) err(where, 'sygnał cofniecie_przebiegu niezgodny z odczytami');
    if (exp.pierwszaRejestracja && exp.pierwszaRejestracjaPl && exp.pierwszaRejestracja > exp.pierwszaRejestracjaPl) err(where, 'pierwszaRejestracja późniejsza niż pierwszaRejestracjaPl');
    const plain = txt.replace(/ /g, ' ');
    for (const r of exp.odczyty) {
      const digits = String(r.km);
      const re = new RegExp(digits.replace(/\B(?=(\d{3})+$)/g, '[ .]?'));
      if (!re.test(plain)) err(where, `odczyt ${r.km} km nie występuje w tekście próbki`);
    }
  }
  if (sStats.samples < MIN.cepikSamples) err('samples/cepik', `za mało próbek (${sStats.samples} < ${MIN.cepikSamples})`);
}

// ---------- wszystkie pliki JSON w data/ muszą się parsować ----------
let jsonFiles = 0;
(function walk(d, rel) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(d, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(p, r);
    else if (e.name.endsWith('.json')) {
      jsonFiles++;
      try { readJson(p); } catch (err2) { err(r, `niepoprawny JSON – ${err2.message}`); }
    }
  }
})(DIR, '');

// ---------- raport ----------
const totalFaults = stats.engineFaults + stats.commonFaults;
console.log('=== Statystyki bazy wiedzy ===');
console.log(`Modele:                 ${stats.models} (marki: ${stats.makes.size})`);
console.log(`Modele z widełkami cen: ${stats.withPrices} (przedziałów: ${stats.priceRanges}); z kosztami: ${stats.withRunningCosts}; z radą zakupową: ${stats.withBuyAdvice}`);
console.log(`Silniki:                ${stats.engines}  ${JSON.stringify(stats.fuel)}`);
console.log(`Ocena silników:         ${JSON.stringify(stats.verdict)}`);
console.log(`Usterki silnikowe:      ${stats.engineFaults}`);
console.log(`Usterki ogólne modelu:  ${stats.commonFaults}`);
console.log(`Usterki razem:          ${totalFaults}`);
console.log(`Wskazówki oględzin:     ${stats.tips}`);
console.log(`Pytania do sprzedawcy:  ${stats.questions}`);
console.log(`Aliasy modeli:          ${aliasOwner.size}`);
console.log(`Czerwone flagi:         ${flagStats.flags} (wzorce: ${flagStats.patterns}, w tym regex: ${flagStats.regex})`);
console.log(`Flagi wg kategorii:     ${JSON.stringify(flagStats.byCategory)}`);
console.log(`Pytania wg kategorii:   ${qStats.questions} (kategorie: ${qStats.categories})`);
console.log(`Słowniczek:             ${gStats.terms} pojęć`);
console.log(`Próbki CEPiK:           ${sStats.samples} (hipotetyczne: ${sStats.hypothetical}, odczytów: ${sStats.readings})`);
console.log(`Pliki JSON sparsowane:  ${jsonFiles}`);
if (warnings.length) {
  console.log(`\nOstrzeżenia (${warnings.length}):`);
  for (const w of warnings) console.log('  ! ' + w);
}
if (errors.length) {
  console.log(`\nBŁĘDY (${errors.length}):`);
  for (const e of errors) console.log('  x ' + e);
  console.log('\nWalidacja NIE przeszła.');
  process.exit(1);
}
console.log('\nWalidacja OK.');
