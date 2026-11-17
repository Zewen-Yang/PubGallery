// Who I wrote with, where they were: institutions (sites) and countries, built from the bib authors
// and src/data/collaborators.js.
import { PAPERS } from './papers.js';
import { HOME, INSTITUTIONS, AFFILIATION, normName } from '../data/collaborators.js';

export { HOME };

function build() {
  const sites = {};
  const unknown = new Set();
  for (const p of PAPERS) {
    for (const a of p.authors) {
      if (a.me) continue;
      const aff = AFFILIATION[normName(a.name)];
      if (!aff) {
        unknown.add(a.name);
        continue;
      }
      const inst = INSTITUTIONS[aff.inst];
      const s = (sites[aff.inst] ??= { id: aff.inst, ...inst, people: new Map(), papers: new Set() });
      const person = s.people.get(a.name) ?? { name: a.name, unsure: aff.unsure, papers: new Set() };
      person.papers.add(p.id);
      s.people.set(a.name, person);
      s.papers.add(p.id);
    }
  }
  if (import.meta.env?.DEV && unknown.size) console.warn('[collab] no affiliation for:', [...unknown]);

  const list = Object.values(sites)
    .map((s) => ({
      ...s,
      people: [...s.people.values()].sort((a, b) => b.papers.size - a.papers.size || a.name.localeCompare(b.name)),
      papers: [...s.papers],
    }))
    .sort((a, b) => b.papers.length - a.papers.length);

  const countries = {};
  for (const s of list) {
    const c = (countries[s.iso] ??= { iso: s.iso, name: s.country, sites: [], papers: new Set(), people: 0 });
    c.sites.push(s);
    s.papers.forEach((id) => c.papers.add(id));
    c.people += s.people.length;
  }
  const clist = Object.values(countries)
    .map((c) => ({ ...c, papers: [...c.papers] }))
    .sort((a, b) => b.papers.length - a.papers.length);
  return { list, clist };
}

const { list, clist } = build();
export const SITES = list;
export const SITE_BY_ID = Object.fromEntries(list.map((s) => [s.id, s]));
export const COUNTRIES = clist;
export const COUNTRY_BY_ISO = Object.fromEntries(clist.map((c) => [c.iso, c]));
export const COLLABORATOR_COUNT = list.reduce((n, s) => n + s.people.length, 0);

// Lookups for linking the paper stars and the globe.
export const PAPER_SITES = {};
for (const s of list) for (const id of s.papers) (PAPER_SITES[id] ??= []).push(s.id);
export const SITE_PAPERS = Object.fromEntries(list.map((s) => [s.id, new Set(s.papers)]));
export const COUNTRY_PAPERS = Object.fromEntries(clist.map((c) => [c.iso, new Set(c.papers)]));

// What the globe view is currently pointing at, as a test for papers and for sites.
// Hovered city > hovered star > pinned country.
export function focusOf({ hovered, hoveredSite, country }) {
  if (hoveredSite) return { paper: (id) => SITE_PAPERS[hoveredSite].has(id), site: (s) => s.id === hoveredSite };
  if (hovered) return { paper: (id) => id === hovered, site: (s) => (PAPER_SITES[hovered] || []).includes(s.id) };
  if (country) return { paper: (id) => COUNTRY_PAPERS[country].has(id), site: (s) => s.iso === country };
  return null;
}
