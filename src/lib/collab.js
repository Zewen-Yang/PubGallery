// Who I wrote with, and where they were: institutions (sites) and countries.
// Affiliations follow the paper: src/data/affiliations.json lists, for every paper, the institutions
// of each author (built by `npm run sync:aff`; hand fixes live in src/data/collaborators.js).
import { PAPERS } from './papers.js';
import AFF from '../data/affiliations.json';

export const HOME = AFF.home;

function build() {
  const sites = {};
  for (const p of PAPERS) {
    const row = AFF.papers[p.id] || [];
    p.authors.forEach((a, i) => {
      const [ids = [], src = null] = row[i] || [];
      // Each author carries their affiliations on this paper (also shown in the open book).
      a.aff = ids;
      a.unsure = src === 'inferred' || src === 'guess';
      if (a.me) return;
      for (const id of ids) {
        const s = (sites[id] ??= { id, ...AFF.institutions[id], people: new Map(), papers: new Set() });
        const person = s.people.get(a.name) ?? { name: a.name, unsure: false, papers: new Set() };
        person.unsure ||= a.unsure;
        person.papers.add(p.id);
        s.people.set(a.name, person);
        s.papers.add(p.id);
      }
    });
  }

  const list = Object.values(sites)
    .map((s) => ({
      ...s,
      people: [...s.people.values()].sort((a, b) => b.papers.size - a.papers.size || a.name.localeCompare(b.name)),
      papers: [...s.papers],
    }))
    .sort((a, b) => b.papers.length - a.papers.length);

  const countries = {};
  for (const s of list) {
    const c = (countries[s.iso] ??= { iso: s.iso, name: s.country, sites: [], papers: new Set(), names: new Set() });
    c.sites.push(s);
    s.papers.forEach((id) => c.papers.add(id));
    s.people.forEach((x) => c.names.add(x.name));
  }
  const clist = Object.values(countries)
    .map((c) => ({ ...c, papers: [...c.papers], people: c.names.size }))
    .sort((a, b) => b.papers.length - a.papers.length);
  return { list, clist };
}

const { list, clist } = build();
export const SITES = list;
export const SITE_BY_ID = Object.fromEntries(list.map((s) => [s.id, s]));
export const COUNTRIES = clist;
export const COUNTRY_BY_ISO = Object.fromEntries(clist.map((c) => [c.iso, c]));
export const INSTITUTIONS = AFF.institutions;
export const COLLABORATOR_COUNT = new Set(list.flatMap((s) => s.people.map((x) => x.name))).size;

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
