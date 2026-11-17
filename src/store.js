import { create } from 'zustand';
import { PAPER_BY_ID, BOOKCASES, CASE_BY_ID, placeFor } from './lib/papers.js';

// Animated values shared by every frame loop (kept outside React to avoid re-renders).
// dragV / dragVy: drag momentum; dYaw / dPitch: what the drag turned this frame (the globe follows both).
export const anim = { map: 0, rotY: 0, dragV: 0, dragVy: 0, dYaw: 0, dPitch: 0 };

function setHash(id) {
  const url = id ? `#${encodeURIComponent(id)}` : window.location.pathname + window.location.search;
  window.history.replaceState(null, '', url);
}

export const useStore = create((set, get) => ({
  ready: false,
  mode: 'library', // 'library' | 'map'
  focus: null, // bookcase id, or null for the room overview
  shelf: null, // shelf id whose books are on display (cover-out) in the focused bookcase
  listOpen: false,
  hovered: null, // paper id
  hoveredCase: null, // bookcase id
  selected: null,
  hoveredSite: null, // institution id on the globe
  country: null, // ISO code of the country pinned on the globe

  setReady: () => set({ ready: true }),
  setMode: (mode) => set({ mode, hovered: null, hoveredCase: null, hoveredSite: null, country: null, listOpen: false, selected: null }),
  setFocus: (focus) =>
    set({ focus, shelf: focus ? CASE_BY_ID[focus].shelves[0].id : null, hovered: null, hoveredCase: null, mode: 'library' }),
  setShelf: (shelf) => set({ shelf, hovered: null }),
  stepShelf: (dir) => {
    const bc = CASE_BY_ID[get().focus];
    if (!bc) return;
    const i = bc.shelves.findIndex((s) => s.id === get().shelf) + dir;
    if (i >= 0 && i < bc.shelves.length) set({ shelf: bc.shelves[i].id, hovered: null });
  },
  stepFocus: (dir) => {
    const i = BOOKCASES.findIndex((b) => b.id === get().focus);
    const next = i < 0 ? (dir > 0 ? 0 : BOOKCASES.length - 1) : i + dir;
    if (next >= 0 && next < BOOKCASES.length) get().setFocus(BOOKCASES[next].id);
  },
  toggleList: (v) => set((s) => ({ listOpen: v ?? !s.listOpen, hovered: null })),
  hover: (id) => set({ hovered: id }),
  hoverCase: (id) => set({ hoveredCase: id }),
  hoverSite: (id) => set({ hoveredSite: id }),
  pickCountry: (iso) => set((s) => ({ country: s.country === iso ? null : iso })),
  // `place` ({ bookcase, shelf }) picks which copy of the book to pull out; by default the one on
  // the shelf in front of you, else the paper's home.
  select: (id, place) => {
    setHash(id);
    const p = PAPER_BY_ID[id];
    const q = p && (place || placeFor(p, get().focus, get().shelf));
    set({ selected: id, hovered: null, ...(q ? { focus: q.bookcase, shelf: q.shelf } : {}) });
  },
  close: () => {
    setHash(null);
    set({ selected: null });
  },
  // From the globe: fly back into the library, walk up to the bookcase, then pull the book out.
  openFromMap: (id) => {
    const p = PAPER_BY_ID[id];
    set({ mode: 'library', hovered: null, hoveredSite: null, country: null, focus: p.bookcase, shelf: p.shelf });
    setTimeout(() => get().mode === 'library' && get().select(id), 1700);
  },
}));

export function initialFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (id && PAPER_BY_ID[id]) {
    useStore.setState({ focus: PAPER_BY_ID[id].bookcase, shelf: PAPER_BY_ID[id].shelf });
    setTimeout(() => useStore.getState().select(id), 2600);
  }
}

if (import.meta.env.DEV) window.__store = useStore;
