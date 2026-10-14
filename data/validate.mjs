#!/usr/bin/env node
// Walidacja bazy wiedzy: modele (models/*.json) i czerwone flagi (red-flags.json).
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
const validateFlags = ajv.compile(readJson(join(DIR, 'schema/red-flags.schema.json')));

// Progi jakości ustalone dla MVP (ostrzejsze niż schemat).
const MIN = { engines: 3, faultsPerEngine: 3, inspectionTips: 6, questions: 5, redFlags: 40 };

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
const stats = { models: 0, engines: 0, engineFaults: 0, commonFaults: 0, tips: 0, questions: 0, fuel: {}, verdict: {}, makes: new Set() };

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
      if (!f.question_for_seller) warn(w, 'brak question_for_seller');
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

// ---------- raport ----------
const totalFaults = stats.engineFaults + stats.commonFaults;
console.log('=== Statystyki bazy wiedzy ===');
console.log(`Modele:                 ${stats.models} (marki: ${stats.makes.size})`);
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
