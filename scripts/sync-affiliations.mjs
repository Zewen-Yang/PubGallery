// Builds src/data/affiliations.json: for every paper, the institutions each author listed on it.
// Source: OpenAlex (by DOI / arXiv id), with src/data/collaborators.js for fixes and fallbacks.
import fs from 'node:fs';
import { parseBib, parseAuthors } from '../src/lib/bib.js';
import { HOME, PAPER_OVERRIDES, PERSON_OVERRIDES, ALIAS, DROP, INSTITUTIONS, GUESS, normName } from '../src/data/collaborators.js';

const root = new URL('..', import.meta.url);
const bib = fs.readFileSync(new URL('src/data/papers.bib', root), 'utf8');
const API = 'https://api.openalex.org';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ISO alpha-2 → [numeric code used by world-atlas, display name]. Hong Kong is filed under China.
const COUNTRY = {
  DE: ['276', 'Germany'], CN: ['156', 'China'], HK: ['156', 'China'], MO: ['156', 'China'], TW: ['156', 'China'],
  GB: ['826', 'United Kingdom'], US: ['840', 'United States'], AU: ['036', 'Australia'], AE: ['784', 'United Arab Emirates'],
  NL: ['528', 'Netherlands'], CH: ['756', 'Switzerland'], SG: ['702', 'Singapore'], FR: ['250', 'France'], IT: ['380', 'Italy'],
  ES: ['724', 'Spain'], SE: ['752', 'Sweden'], DK: ['208', 'Denmark'], NO: ['578', 'Norway'], FI: ['246', 'Finland'],
  AT: ['040', 'Austria'], BE: ['056', 'Belgium'], JP: ['392', 'Japan'], KR: ['410', 'South Korea'], CA: ['124', 'Canada'],
  IN: ['356', 'India'], BR: ['076', 'Brazil'], IL: ['376', 'Israel'], SA: ['682', 'Saudi Arabia'], NG: ['566', 'Nigeria'],
};

const insts = {}; // id → institution record
const oaIds = {}; // id → OpenAlex id (to fetch coordinates)
function manual(key) {
  const m = INSTITUTIONS[key];
  const id = slug(m.name);
  insts[id] ??= { name: m.name, city: m.city, cc: m.cc, lat: m.lat, lon: m.lon };
  return id;
}
const manualByName = Object.fromEntries(Object.entries(INSTITUTIONS).map(([k, m]) => [m.name, k]));
function byName(name, cc, oa) {
  name = ALIAS[name] || name;
  if (manualByName[name]) return manual(manualByName[name]);
  const id = slug(name);
  insts[id] ??= { name, cc };
  if (oa) oaIds[id] = oa;
  return id;
}

const entries = parseBib(bib).map((e) => ({
  key: e.key,
  year: +(e.fields.year || '').replace(/\D/g, '') || 0,
  authors: parseAuthors(e.fields.author).map((a) => a.name),
  ref: e.fields.doi ? `doi:${e.fields.doi.trim()}` : e.fields.arxiv ? `doi:10.48550/arXiv.${e.fields.arxiv.trim()}` : null,
}));

// 1–2. Overrides, then what the paper itself lists.
const papers = {};
for (const e of entries) {
  const row = e.authors.map(() => ({ inst: [], src: null }));
  if (e.ref) {
    const r = await fetch(`${API}/works/${e.ref}?select=id,authorships`);
    if (r.ok) {
      const { authorships } = await r.json();
      if (authorships.length === e.authors.length)
        authorships.forEach((a, i) => {
          const ids = [...new Set(a.institutions.filter((x) => !DROP.includes(x.display_name)).map((x) => byName(x.display_name, x.country_code, x.id.split('/').pop())))];
          if (ids.length) row[i] = { inst: ids, src: 'paper' };
        });
      else console.warn(`! ${e.key}: ${authorships.length} authors on OpenAlex, ${e.authors.length} in the bib; skipped`);
    } else console.warn(`! ${e.key}: not on OpenAlex (${r.status})`);
    await sleep(110);
  }
  const ov = PAPER_OVERRIDES[e.key] || {};
  e.authors.forEach((n, i) => {
    const find = (map) => map[Object.keys(map).find((k) => normName(k) === normName(n))];
    const hit = find(ov) || find(PERSON_OVERRIDES);
    if (hit) row[i] = { inst: hit.map((x) => byName(x)), src: 'override' };
  });
  papers[e.key] = row;
}

// 3–5. Fill the gaps: confirmed by hand, else the author's other papers (nearest year), else a guess.
const seen = {}; // normalised author → [{ year, inst }]
for (const e of entries) e.authors.forEach((n, i) => papers[e.key][i].src && (seen[normName(n)] ??= []).push({ year: e.year, inst: papers[e.key][i].inst }));
for (const e of entries)
  e.authors.forEach((n, i) => {
    const cell = papers[e.key][i];
    if (cell.src) return;
    const g = GUESS[normName(n)];
    const near = (seen[normName(n)] || []).slice().sort((a, b) => Math.abs(a.year - e.year) - Math.abs(b.year - e.year))[0];
    if (g && !g.unsure) Object.assign(cell, { inst: [manual(g.inst)], src: 'hand' });
    else if (near) Object.assign(cell, { inst: near.inst, src: 'inferred' });
    else if (g) Object.assign(cell, { inst: [manual(g.inst)], src: 'guess' });
    else console.warn(`! ${e.key}: no affiliation for ${n}`);
  });

// Coordinates for the institutions that came from OpenAlex.
const need = Object.keys(insts).filter((id) => insts[id].lat == null && oaIds[id]);
for (let i = 0; i < need.length; i += 40) {
  const chunk = need.slice(i, i + 40);
  const r = await fetch(`${API}/institutions?filter=openalex:${chunk.map((id) => oaIds[id]).join('|')}&select=id,geo&per-page=50`);
  const { results } = await r.json();
  for (const x of results) {
    const id = chunk.find((c) => oaIds[c] === x.id.split('/').pop());
    Object.assign(insts[id], { city: x.geo.city, lat: +x.geo.latitude.toFixed(3), lon: +x.geo.longitude.toFixed(3), cc: insts[id].cc || x.geo.country_code });
  }
}

const used = new Set(Object.values(papers).flatMap((row) => row.flatMap((c) => c.inst)));
const institutions = {};
for (const id of [...used].sort()) {
  const x = insts[id];
  if (x.lat == null) {
    console.warn(`! no coordinates for ${x.name}; dropped`);
    continue;
  }
  const [iso, country] = COUNTRY[x.cc] || [null, x.cc];
  if (!iso) console.warn(`! add ${x.cc} to COUNTRY in scripts/sync-affiliations.mjs`);
  institutions[id] = { name: x.name, city: x.city, country, iso, lat: x.lat, lon: x.lon };
}
const out = {
  home: slug(HOME),
  institutions,
  // per paper, one entry per author (bib order): [institution ids, source]
  papers: Object.fromEntries(Object.entries(papers).map(([k, row]) => [k, row.map((c) => [c.inst.filter((id) => institutions[id]), c.src])])),
};
fs.writeFileSync(new URL('src/data/affiliations.json', root), JSON.stringify(out, null, 1).replace(/\[\n\s+\[\n\s+/g, '[[').replace(/\n\s+\],\n\s+"(\w+)"\n\s+\]/g, '], "$1"]') + '\n');
const cells = Object.values(papers).flat();
const n = (s) => cells.filter((c) => c.src === s).length;
console.log(`${Object.keys(institutions).length} institutions · authorships: ${n('paper')} from the paper, ${n('override')} overridden, ${n('hand')} by hand, ${n('inferred')} inferred, ${n('guess')} guessed, ${n(null)} unknown`);
