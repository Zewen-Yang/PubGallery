import { BOOKS, CASE, CASE_BY_ID } from '../lib/papers.js';

export const FOV = 38;
export const TAN = Math.tan((FOV / 2) * (Math.PI / 180));

// Where the camera rests when standing in front of a bookcase (before pointer parallax).
export function focusPose(bc, aspect) {
  const wide = aspect > 1.15;
  const effAspect = wide ? aspect * 0.6 : aspect;
  const dist = Math.max((CASE.height + 1.7) / 2 / TAN, (CASE.width + 0.9) / 2 / (TAN * effAspect));
  const shift = wide ? dist * TAN * aspect * 0.32 : 0;
  const cx = bc.center[0] - bc.right[0] * shift;
  const cz = bc.center[2] - bc.right[2] * shift;
  return {
    wide,
    dist,
    pos: [cx + bc.normal[0] * dist, bc.center[1] + 0.35, cz + bc.normal[2] * dist],
    look: [cx, bc.center[1] + 0.2, cz],
  };
}

const CELL_W = 0.8;
const CELL_H = 1.36;
const cache = new Map();

// The shelf "on display": its books float off the shelf and stand cover-out in a grid that fills
// the free part of the screen. Returns { [paperId]: { pos, scale } } in world space.
export function displaySlots(bcId, shelfId, aspect) {
  const key = `${bcId}|${shelfId}|${aspect.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key);
  const bc = CASE_BY_ID[bcId];
  const pose = focusPose(bc, aspect);
  const books = BOOKS.filter((p) => p.bookcase === bcId && p.shelf === shelfId).sort((a, b) => a.shelfIndex - b.shelfIndex);
  const D = pose.dist - 1.6;
  const hh = D * TAN;
  const hw = hh * aspect;
  // Free region of the view (the heading panel sits left on wide screens, on top on narrow ones).
  const [u0, u1] = pose.wide ? [-0.21 * hw, 0.97 * hw] : [-0.96 * hw, 0.96 * hw];
  const [v0, v1] = pose.wide ? [-0.74 * hh, 0.63 * hh] : [-0.64 * hh, 0.4 * hh];
  const rw = u1 - u0;
  const rh = v1 - v0;

  let best = { s: 0, cols: 1 };
  for (let cols = 1; cols <= books.length; cols++) {
    const rows = Math.ceil(books.length / cols);
    const s = Math.min(rw / (cols * CELL_W), rh / (rows * CELL_H));
    if (s > best.s + 1e-6) best = { s, cols };
  }
  const s = Math.min(best.s, 2.4);
  const cols = best.cols;
  const rows = Math.ceil(books.length / cols);
  const left = u0 + (rw - cols * CELL_W * s) / 2;
  const top = v1 - (rh - rows * CELL_H * s) / 2;

  const out = {};
  books.forEach((p, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const u = left + (c + 0.5) * CELL_W * s;
    const v = top - (r + 1) * CELL_H * s + 0.09 * s + (p.size[1] * s) / 2;
    out[p.id] = {
      scale: s,
      pos: [
        pose.pos[0] - bc.normal[0] * D + bc.right[0] * u,
        pose.pos[1] + v,
        pose.pos[2] - bc.normal[2] * D + bc.right[2] * u,
      ],
    };
  });
  out.__center = [pose.pos[0] - bc.normal[0] * D + bc.right[0] * (u0 + rw / 2), pose.pos[1], pose.pos[2] - bc.normal[2] * D + bc.right[2] * (u0 + rw / 2)];
  cache.set(key, out);
  return out;
}
