import bibSource from '../data/papers.bib?raw';
import chineseSource from '../data/chinese.bib?raw';
import { parseBib, cleanLatex, parseAuthors, cleanBibtex } from './bib.js';
import { BOOKCASES, placePaper } from '../data/taxonomy.js';

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function rand(seed) {
  let s = Math.floor(hash(seed) * 1e9) || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function pageCount(p = '') {
  const m = /(\d+)\s*[-–]+\s*(\d+)/.exec(p);
  if (!m) return null;
  const n = +m[2] - +m[1] + 1;
  return n > 0 && n < 200 ? n : null;
}

function cleanKeywords(s = '') {
  const seen = new Set();
  return cleanLatex(s)
    .split(/[;,]/)
    .map((k) => k.trim())
    .filter((k) => k && k.length < 60)
    .filter((k) => {
      const low = k.toLowerCase();
      if (seen.has(low)) return false;
      seen.add(low);
      return true;
    })
    .slice(0, 8);
}

// Only keep a few harmless tags from the bib `note` field.
function safeNote(s = '') {
  return s.replace(/<(?!\/?(strong|b|em|i)>)[^>]*>/gi, '').trim();
}

function shortTitle(title) {
  const head = title.split(/[:?]/)[0].trim();
  const base = head.length >= 6 && head.length <= 42 ? head : title;
  return base.length > 34 ? base.slice(0, 32).trimEnd() + '…' : base;
}

// English papers first, then the Chinese journal papers (chinese.bib on the homepage).
function buildPapers() {
  const entries = [...parseBib(bibSource), ...parseBib(chineseSource).map((e) => ({ ...e, chinese: true }))];
  return entries.map((e) => {
    const f = e.fields;
    const title = cleanLatex(f.title);
    const links = [];
    if (f.doi) links.push({ label: 'Paper', href: `https://doi.org/${f.doi.trim()}` });
    else if (f.url) links.push({ label: 'Paper', href: f.url.trim() });
    if (f.pdf) links.push({ label: 'PDF', href: f.pdf.trim() });
    if (f.arxiv) links.push({ label: 'arXiv', href: `https://arxiv.org/abs/${f.arxiv.trim()}` });
    if (f.code) links.push({ label: 'Code', href: f.code.trim() });
    if (f.website) links.push({ label: 'Project', href: f.website.trim() });
    if (f.html) links.push({ label: 'Web', href: f.html.trim() });
    const places = placePaper(e.key, title, f.category).map(([bookcase, shelf]) => ({ bookcase, shelf }));
    return {
      id: e.key,
      title,
      spine: shortTitle(title),
      authors: parseAuthors(f.author),
      year: +(f.year || '').replace(/\D/g, '') || 0,
      venue: cleanLatex(f.journal || f.booktitle || f.publisher || f.institution || ''),
      // The cover font is Latin only, so Chinese journal papers get a Latin badge.
      abbr: e.chinese ? 'Chinese' : cleanLatex(f.abbr || ''),
      chinese: !!e.chinese,
      isJournal: e.type === 'article' && !/arxiv/i.test(f.journal || ''),
      selected: /true/i.test(f.selected || ''),
      note: safeNote(f.note),
      annotation: cleanLatex(f.annotation || ''),
      abstract: cleanLatex(f.abstract || ''),
      keywords: cleanKeywords(f.keywords),
      pages: pageCount(f.pages),
      links,
      bibtex: cleanBibtex(e),
      places,
      // Home placement (first listed): star map cluster and deep links.
      bookcase: places[0].bookcase,
      shelf: places[0].shelf,
    };
  });
}

// ---- Room layout ----------------------------------------------------------
// Bookcases stand on an arc facing the room centre (origin).
export const CASE = { width: 3.3, rowH: 1.58, rows: Math.max(3, ...BOOKCASES.map((b) => b.shelves.length)), board: 0.1, depth: 0.85, plinth: 0.3, side: 0.14, crown: 0.52 };
CASE.height = CASE.plinth + CASE.rows * CASE.rowH + CASE.board + CASE.crown;
export const ROOM = { radius: 7.2, spread: 0.56 };

// Local (bookcase space) → world.
export function toWorld(bc, [x, y, z]) {
  const c = Math.cos(bc.yaw);
  const s = Math.sin(bc.yaw);
  return [bc.pos[0] + x * c + z * s, bc.pos[1] + y, bc.pos[2] - x * s + z * c];
}

export function boardY(k) {
  return CASE.plinth + CASE.board / 2 + k * CASE.rowH;
}

export function isOn(p, bookcase, shelf) {
  return p.places.some((q) => q.bookcase === bookcase && (shelf == null || q.shelf === shelf));
}

// One physical book per placement. A book carries its paper's fields; `id` is the book's own id
// and `key` the paper's citation key.
function buildBooks(papers) {
  return papers.flatMap((p) =>
    p.places.map((q, i) => ({ ...p, id: `${p.id}@${q.bookcase}/${q.shelf}`, key: p.id, bookcase: q.bookcase, shelf: q.shelf, home: i === 0 })),
  );
}

function layoutRoom(papers, books) {
  BOOKCASES.forEach((bc, i) => {
    const phi = (i - (BOOKCASES.length - 1) / 2) * ROOM.spread;
    bc.index = i;
    bc.pos = [ROOM.radius * Math.sin(phi), 0, -ROOM.radius * Math.cos(phi)];
    bc.yaw = -phi;
    bc.normal = [Math.sin(bc.yaw), 0, Math.cos(bc.yaw)];
    bc.right = [Math.cos(bc.yaw), 0, -Math.sin(bc.yaw)];
    bc.center = toWorld(bc, [0, CASE.height / 2, 0]);
    bc.count = papers.filter((p) => isOn(p, bc.id)).length;
    bc.rows = [];

    for (let r = 0; r < CASE.rows; r++) {
      const shelf = bc.shelves[r];
      const base = boardY(CASE.rows - 1 - r) + CASE.board / 2;
      const row = { shelf, base, end: -CASE.width / 2 + 0.08 };
      bc.rows.push(row);
      if (!shelf) continue;
      shelf.count = 0;
      const onShelf = books
        .filter((p) => p.bookcase === bc.id && p.shelf === shelf.id)
        .sort((a, b) => b.year - a.year || Number(b.selected) - Number(a.selected));
      onShelf.forEach((p, j) => {
        const rnd = rand(p.id);
        const thick = 0.115 + Math.min(Math.max(p.pages ?? 8, 4), 20) * 0.0035 + (p.isJournal ? 0.015 : 0);
        const height = (p.isJournal ? 1.18 : 1.03) + (rnd() - 0.5) * 0.1 + (p.selected ? 0.06 : 0);
        const depth = 0.68 + rnd() * 0.06;
        p.size = [thick, height, depth];
        p.color = bc.palette[Math.floor(rnd() * bc.palette.length)];
        const local = [row.end + thick / 2, base + height / 2, -CASE.depth / 2 + depth / 2 + 0.07];
        p.shelfPos = toWorld(bc, local);
        p.yaw = bc.yaw;
        p.normal = bc.normal;
        p.shelfIndex = j;
        row.end += thick + 0.008;
        shelf.count++;
      });
    }
  });
}

// ---- Star map -------------------------------------------------------------------
// Each bookcase becomes a cluster of stars on a ring above MAP_CENTER; the collaborators globe
// hangs below them (see scene/Globe.jsx).
export const MAP_CENTER = [0, 2.8, -4.2];
const RING = 4.4;
const STAR_LIFT = 2.3;
const CLUSTER_Y = [0.7, -0.5, 0.5, -0.7];

function layoutStars(papers) {
  BOOKCASES.forEach((bc, ci) => {
    const a = (ci / BOOKCASES.length) * Math.PI * 2 + Math.PI / 4;
    const center = [MAP_CENTER[0] + Math.cos(a) * RING, MAP_CENTER[1] + STAR_LIFT + CLUSTER_Y[ci], MAP_CENTER[2] + Math.sin(a) * RING];
    bc.starCenter = center;
    const group = papers.filter((p) => p.bookcase === bc.id);
    const R = 0.75 + group.length * 0.045;
    bc.starRadius = R;
    const golden = Math.PI * (3 - Math.sqrt(5));
    group.forEach((p, i) => {
      const rnd = rand(p.id + 'star');
      const y = 1 - (i / Math.max(group.length - 1, 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      const k = R * (0.55 + rnd() * 0.45);
      p.starPos = [center[0] + Math.cos(th) * rad * k, center[1] + y * k * 0.8, center[2] + Math.sin(th) * rad * k];
      p.starColor = bc.star;
      p.starSize = p.selected ? 0.1 : 0.06;
    });
  });
}

// Each paper links to the (up to) two papers it shares the most co-authors with (at least two).
function buildLinks(papers) {
  const others = papers.map((p) => new Set(p.authors.filter((a) => !a.me).map((a) => a.name.toLowerCase())));
  const pairs = new Map();
  papers.forEach((_, i) => {
    const scored = [];
    papers.forEach((__, j) => {
      if (i === j) return;
      let s = 0;
      others[i].forEach((n) => others[j].has(n) && s++);
      if (s >= 2) scored.push([j, s]);
    });
    scored
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .forEach(([j, s]) => {
        const k = i < j ? `${i}-${j}` : `${j}-${i}`;
        pairs.set(k, { a: Math.min(i, j), b: Math.max(i, j), w: s });
      });
  });
  return [...pairs.values()];
}

export const PAPERS = buildPapers();
layoutStars(PAPERS);
export const BOOKS = buildBooks(PAPERS);
layoutRoom(PAPERS, BOOKS);
for (const p of PAPERS) p.color = BOOKS.find((b) => b.key === p.id && b.home).color;
export const LINKS = buildLinks(PAPERS);
export const PAPER_BY_ID = Object.fromEntries(PAPERS.map((p) => [p.id, p]));
export const CASE_BY_ID = Object.fromEntries(BOOKCASES.map((b) => [b.id, b]));
export function shelfOf(p, bookcase = p.bookcase, shelf = p.shelf) {
  return CASE_BY_ID[bookcase].shelves.find((s) => s.id === shelf);
}
// Papers on one shelf, in shelf order.
export function shelfPapers(bookcase, shelf) {
  return BOOKS.filter((b) => b.bookcase === bookcase && b.shelf === shelf)
    .sort((a, b) => a.shelfIndex - b.shelfIndex)
    .map((b) => PAPER_BY_ID[b.key]);
}
// Where a paper is being read: the shelf in front of you if it sits there, else its home.
export function placeFor(p, focus, shelf) {
  return p.places.find((q) => q.bookcase === focus && q.shelf === shelf) || p.places[0];
}
export { BOOKCASES };
