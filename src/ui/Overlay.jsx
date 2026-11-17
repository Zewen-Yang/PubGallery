import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { PAPERS, PAPER_BY_ID, BOOKCASES, CASE_BY_ID, shelfOf, shelfPapers, placeFor, isOn } from '../lib/papers.js';
import { COUNTRIES, COUNTRY_BY_ISO, SITE_BY_ID, PAPER_SITES, INSTITUTIONS, COLLABORATOR_COUNT, HOME as HOME_SITE } from '../lib/collab.js';

const HOME = 'https://zewen-yang.github.io';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function Authors({ authors }) {
  return authors.map((a, i) => (
    <span key={i}>
      {a.me ? <b>{a.name}</b> : a.name}
      {a.mark}
      {i < authors.length - 1 ? ', ' : ''}
    </span>
  ));
}

// Authors with numbered affiliations, as printed on the paper: every institution each author
// listed on this particular paper. A "?" marks an affiliation that is not confirmed.
function AuthorsWithAffiliations({ authors }) {
  const order = [];
  authors.forEach((a) => (a.aff || []).forEach((id) => order.includes(id) || order.push(id)));
  if (!order.length)
    return (
      <p className="authors">
        <Authors authors={authors} />
      </p>
    );
  return (
    <>
      <p className="authors">
        {authors.map((a, i) => (
          <span key={i}>
            {a.me ? <b>{a.name}</b> : a.name}
            {a.mark}
            {a.aff?.length > 0 && (
              <sup className="aff-n">
                {a.aff.map((id) => order.indexOf(id) + 1).join(',')}
                {a.unsure ? '?' : ''}
              </sup>
            )}
            {i < authors.length - 1 ? ', ' : ''}
          </span>
        ))}
      </p>
      <ol className="affs">
        {order.map((id, i) => (
          <li key={id}>
            <sup>{i + 1}</sup>
            {INSTITUTIONS[id].name}, {INSTITUTIONS[id].city}
          </li>
        ))}
      </ol>
    </>
  );
}

// ---------------------------------------------------------------------------
export function Intro() {
  const ready = useStore((s) => s.ready);
  const [n, setN] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1500);
      setN(Math.round((1 - Math.pow(1 - k, 3)) * PAPERS.length));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const done = ready && n === PAPERS.length;
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 1400);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return (
    <div className={`intro ${done ? 'out' : ''}`}>
      <div className="intro-inner">
        <div className="intro-kicker">The Library of</div>
        <div className="intro-name">Zewen Yang</div>
        <div className="intro-count">
          <span>{String(n).padStart(2, '0')}</span> volumes
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function TopBar() {
  const mode = useStore((s) => s.mode);
  const listOpen = useStore((s) => s.listOpen);
  const setMode = useStore((s) => s.setMode);
  const setFocus = useStore((s) => s.setFocus);
  const toggleList = useStore((s) => s.toggleList);
  const active = listOpen ? 'list' : mode;
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-name">Zewen Yang</div>
        <div className="brand-sub">
          <a href={HOME}>← Homepage</a>
          <span>· {PAPERS.length} papers</span>
        </div>
      </div>
      <nav className="seg" aria-label="View">
        <button className={active === 'library' ? 'on' : ''} onClick={() => setMode('library')}>
          Library
        </button>
        <button className={active === 'map' ? 'on' : ''} onClick={() => setMode('map')}>
          Star Map
        </button>
        <button className={active === 'list' ? 'on' : ''} onClick={() => toggleList(true)}>
          List
        </button>
      </nav>
    </header>
  );
}

// Bottom index of bookcases (the room's table of contents).
export function IndexNav() {
  const mode = useStore((s) => s.mode);
  const focus = useStore((s) => s.focus);
  const hoveredCase = useStore((s) => s.hoveredCase);
  const setFocus = useStore((s) => s.setFocus);
  const hoverCase = useStore((s) => s.hoverCase);
  const country = useStore((s) => s.country);
  const pickCountry = useStore((s) => s.pickCountry);
  if (mode === 'map')
    return (
      <footer className="indexnav">
        <div className="index-items compact">
          <span className="index-lead">
            <b>{COLLABORATOR_COUNT}</b> co-authors · <b>{COUNTRIES.length}</b> countries
          </span>
          {COUNTRIES.map((c) => (
            <button key={c.iso} className={country === c.iso ? 'on' : ''} onClick={() => pickCountry(c.iso)}>
              <span className="nm">{c.name}</span>
              <span className="ct">{c.papers.length}</span>
              <i style={{ background: 'var(--ink)' }} />
            </button>
          ))}
        </div>
        <div className="index-hint">Drag to turn · drag up/down to tip the globe · hover a star or a city</div>
      </footer>
    );
  return (
    <footer className="indexnav">
      <div className="index-items">
        <button className={`all ${!focus && mode === 'library' ? 'on' : ''}`} onClick={() => setFocus(null)}>
          <span className="nm">All Bookcases</span>
          <span className="ct">{PAPERS.length}</span>
          <i />
        </button>
        {BOOKCASES.map((bc, i) => (
          <button
            key={bc.id}
            className={`${focus === bc.id && mode === 'library' ? 'on' : ''} ${hoveredCase === bc.id ? 'hot' : ''}`}
            onClick={() => setFocus(bc.id)}
            onMouseEnter={() => mode === 'library' && hoverCase(bc.id)}
            onMouseLeave={() => hoverCase(null)}
          >
            <span className="num">{ROMAN[i]}</span>
            <span className="nm">{bc.name}</span>
            <span className="ct">{bc.count}</span>
            <i style={{ background: bc.palette[1] }} />
          </button>
        ))}
      </div>
      <div className="index-hint">{focus ? '↑ ↓ shelves · ← → bookcases · Esc room' : 'Choose a bookcase'}</div>
    </footer>
  );
}

// Editorial heading for the bookcase in front of you. Its shelves (sub-topics) are the navigation:
// the active one has its books laid out cover-first.
export function FocusPanel() {
  const focus = useStore((s) => s.focus);
  const shelf = useStore((s) => s.shelf);
  const mode = useStore((s) => s.mode);
  const listOpen = useStore((s) => s.listOpen);
  const stepFocus = useStore((s) => s.stepFocus);
  const setShelf = useStore((s) => s.setShelf);
  const [shown, setShown] = useState(focus);
  useEffect(() => {
    setShown(null);
    const t = setTimeout(() => setShown(focus), 120);
    return () => clearTimeout(t);
  }, [focus]);
  const bc = shown && CASE_BY_ID[shown];
  const listRef = useRef();
  // Keep the active shelf chip in view on narrow screens.
  useEffect(() => {
    listRef.current?.querySelector('button.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [shelf, shown]);
  if (!bc || mode !== 'library' || listOpen) return null;
  const years = PAPERS.filter((p) => isOn(p, bc.id)).map((p) => p.year);
  const active = bc.shelves.find((s) => s.id === shelf) || bc.shelves[0];
  return (
    <>
      <div className="scrim" />
      <aside className="focuspanel" key={bc.id}>
        <div className="fp-num">
          {ROMAN[bc.index]} <span>/ {ROMAN[BOOKCASES.length - 1]}</span>
        </div>
        <h1>{bc.name}</h1>
        <div className="fp-meta">
          {bc.count} papers · {Math.min(...years)}–{Math.max(...years)}
        </div>
        <ol className="fp-shelves" ref={listRef}>
          {bc.shelves.map((s, i) => (
            <li key={s.id} style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
              <button className={s.id === active.id ? 'on' : ''} onClick={() => setShelf(s.id)}>
                <span className="sh-i">{String(i + 1).padStart(2, '0')}</span>
                <span className="sh-n">{s.name}</span>
                <span className="sh-c">{s.count}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="fp-arrows">
          <button onClick={() => stepFocus(-1)} disabled={bc.index === 0} aria-label="Previous bookcase">
            ←
          </button>
          <button onClick={() => stepFocus(1)} disabled={bc.index === BOOKCASES.length - 1} aria-label="Next bookcase">
            →
          </button>
        </div>
      </aside>
      <div className="shelftitle" key={bc.id + active.id}>
        <span className="st-i">Shelf {String(bc.shelves.indexOf(active) + 1).padStart(2, '0')}</span>
        <span className="st-n">{active.name}</span>
        <span className="st-c">
          {active.count} {active.count === 1 ? 'paper' : 'papers'}
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
export function HoverCard() {
  const id = useStore((s) => s.hovered);
  const siteId = useStore((s) => s.hoveredSite);
  const mode = useStore((s) => s.mode);
  const site = mode === 'map' && siteId && SITE_BY_ID[siteId];
  const p = !site && id && PAPER_BY_ID[id];
  const bc = p && CASE_BY_ID[p.bookcase];
  const where = p && mode === 'map' ? (PAPER_SITES[p.id] || []).map((sid) => SITE_BY_ID[sid]) : [];
  return (
    <div className={`hovercard ${mode === 'map' ? 'top' : ''} ${p || site ? 'show' : ''}`} aria-hidden>
      {p && (
        <>
          <div className="hc-meta">
            <i style={{ background: mode === 'map' ? bc.star : p.color }} />
            {p.abbr || p.venue} · {p.year}
            {p.selected && <span className="star-tag">★ selected</span>}
          </div>
          <div className="hc-title">{p.title}</div>
          {mode === 'map' && (
            <div className="hc-hint">
              {bc.name} · {shelfOf(p).name}
              {where.length > 0 && <> · with {where.map((x) => (x.name.includes(x.city) ? x.name : `${x.name} (${x.city})`)).join(', ')}</>}
            </div>
          )}
        </>
      )}
      {site && (
        <>
          <div className="hc-meta">
            <i style={{ background: 'var(--ink)' }} />
            {site.city} · {site.country}
            {site.id === HOME_SITE && <span className="star-tag">home</span>}
          </div>
          <div className="hc-title">{site.name}</div>
          <div className="hc-hint">
            {site.papers.length} {site.papers.length === 1 ? 'paper' : 'papers'} · {site.people.map((x) => x.name).join(', ')}
          </div>
        </>
      )}
    </div>
  );
}

// The country pinned on the globe: its institutions, who I wrote with there, and the papers.
export function CountryPanel() {
  const iso = useStore((s) => s.country);
  const mode = useStore((s) => s.mode);
  const pickCountry = useStore((s) => s.pickCountry);
  const hoverSite = useStore((s) => s.hoverSite);
  const openFromMap = useStore((s) => s.openFromMap);
  const c = mode === 'map' && iso && COUNTRY_BY_ISO[iso];
  if (!c) return null;
  return (
    <aside className="countrypanel" key={iso}>
      <button className="cp-close" onClick={() => pickCountry(iso)} aria-label="Close">
        ×
      </button>
      <div className="fp-num">Collaborators</div>
      <h1>{c.name}</h1>
      <div className="fp-meta">
        {c.people} co-authors · {c.papers.length} papers
      </div>
      {c.sites.map((s) => (
        <section key={s.id} className="cp-site" onMouseEnter={() => hoverSite(s.id)} onMouseLeave={() => hoverSite(null)}>
          <h2>
            {s.name} <span>{s.city}</span>
          </h2>
          <div className="cp-people">
            {s.people.map((x, i) => (
              <span key={x.name}>
                {x.name}
                {x.unsure && <em title="Affiliation not confirmed">?</em>}
                <sup>{x.papers.size}</sup>
                {i < s.people.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
          <ul className="cp-papers">
            {s.papers
              .map((id) => PAPER_BY_ID[id])
              .sort((a, b) => b.year - a.year)
              .map((p) => (
                <li key={p.id}>
                  <button onClick={() => openFromMap(p.id)}>
                    <span className="cp-y">{p.year}</span>
                    <span className="cp-t">{p.title}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}

// A soft ring that follows the pointer and names the action under it.
export function Cursor() {
  const ref = useRef();
  const hovered = useStore((s) => s.hovered);
  const hoveredCase = useStore((s) => s.hoveredCase);
  const hoveredSite = useStore((s) => s.hoveredSite);
  const mode = useStore((s) => s.mode);
  const label = mode === 'map' ? (hoveredSite ? 'Show' : hovered ? 'Find' : '') : hovered ? 'Open' : hoveredCase ? 'Enter' : '';
  useEffect(() => {
    const pos = { x: -100, y: -100, cx: -100, cy: -100 };
    let raf;
    const move = (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
    };
    const tick = () => {
      pos.cx += (pos.x - pos.cx) * 0.22;
      pos.cy += (pos.y - pos.cy) * 0.22;
      if (ref.current) ref.current.style.transform = `translate3d(${pos.cx}px, ${pos.cy}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', move);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('pointing', !!label);
  }, [label]);
  return (
    <div ref={ref} className={`cursor ${label ? 'active' : ''}`} aria-hidden>
      <span>{label}</span>
    </div>
  );
}

// Global keys: ← → between bookcases, ↑ ↓ (or the wheel) between shelves, Esc steps back out.
export function Keys() {
  useEffect(() => {
    const free = () => {
      const s = useStore.getState();
      return !s.selected && s.mode === 'library' && !s.listOpen ? s : null;
    };
    const onKey = (e) => {
      const all = useStore.getState();
      if (e.target.tagName === 'INPUT') return;
      if (all.listOpen && !all.selected && e.key === 'Escape') return all.toggleList(false);
      const s = free();
      if (!s) return;
      if (e.key === 'ArrowRight') s.stepFocus(1);
      if (e.key === 'ArrowLeft') s.stepFocus(-1);
      if (e.key === 'ArrowDown') s.stepShelf(1);
      if (e.key === 'ArrowUp') s.stepShelf(-1);
      if (e.key === 'Escape') s.setFocus(null);
    };
    let last = 0;
    const onWheel = (e) => {
      const s = free();
      if (!s || !s.focus || Math.abs(e.deltaY) < 12) return;
      const now = performance.now();
      if (now - last < 650) return;
      last = now;
      s.stepShelf(e.deltaY > 0 ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
export function Detail() {
  const id = useStore((s) => s.selected);
  const close = useStore((s) => s.close);
  const select = useStore((s) => s.select);
  const [shown, setShown] = useState(null);
  const [copied, setCopied] = useState(false);

  // Let the 3D book fly forward before the pages open.
  useEffect(() => {
    if (!id) return setShown(null);
    setCopied(false);
    const listOpen = useStore.getState().listOpen;
    const t = setTimeout(() => setShown(id), shown || listOpen ? 0 : 560);
    return () => clearTimeout(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = shown && PAPER_BY_ID[shown];
  const focus = useStore((s) => s.focus);
  const focusShelf = useStore((s) => s.shelf);
  const place = p && placeFor(p, focus, focusShelf);
  const shelf = useMemo(() => (place ? shelfPapers(place.bookcase, place.shelf) : []), [place]);

  useEffect(() => {
    if (!p) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      const i = shelf.indexOf(p);
      if (e.key === 'ArrowRight' && shelf[i + 1]) select(shelf[i + 1].id);
      if (e.key === 'ArrowLeft' && shelf[i - 1]) select(shelf[i - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p, shelf, close, select]);

  if (!p) return null;
  const bc = CASE_BY_ID[place.bookcase];
  const i = shelf.indexOf(p);
  const elsewhere = p.places.filter((q) => q !== place);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.bibtex);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="detail-backdrop" onClick={close}>
      <article className="openbook" onClick={(e) => e.stopPropagation()} key={p.id}>
        <button className="close" onClick={close} aria-label="Close">
          ×
        </button>
        <section className="page left">
          <div className="kicker" style={{ color: bc.palette[1] }}>
            {ROMAN[bc.index]} · {bc.name} <span>/ {shelfOf(p, place.bookcase, place.shelf).name}</span>
          </div>
          {elsewhere.length > 0 && (
            <div className="also">
              Also in{' '}
              {elsewhere.map((q, k) => (
                <span key={q.bookcase + q.shelf}>
                  {k > 0 && ' · '}
                  <button onClick={() => select(p.id, q)}>
                    {CASE_BY_ID[q.bookcase].name} / {shelfOf(p, q.bookcase, q.shelf).name}
                  </button>
                </span>
              ))}
            </div>
          )}
          <h2>{p.title}</h2>
          <AuthorsWithAffiliations authors={p.authors} />
          {p.annotation && <p className="annotation">{p.annotation}</p>}
          <div className="venue">
            <span className="abbr">{p.abbr}</span>
            <span>
              {p.venue}, {p.year}
            </span>
          </div>
          {p.note && <p className="note" dangerouslySetInnerHTML={{ __html: p.note }} />}
          <div className="folio">
            {i + 1} / {shelf.length}
          </div>
        </section>
        <section className="page right">
          {p.abstract ? (
            <>
              <h3>Abstract</h3>
              <p className="abstract">{p.abstract}</p>
            </>
          ) : (
            <>
              <h3>{p.isJournal ? 'Journal article' : 'Conference paper'}</h3>
              <p className="muted">
                {p.selected ? 'One of the selected works. ' : ''}
                {p.pages ? `${p.pages} pages.` : ''}
              </p>
            </>
          )}
          {p.keywords.length > 0 && (
            <div className="chips">
              {p.keywords.map((k) => (
                <span key={k}>{k}</span>
              ))}
            </div>
          )}
          <div className="links">
            {p.links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                {l.label} ↗
              </a>
            ))}
            <button onClick={copy}>{copied ? 'Copied ✓' : 'BibTeX'}</button>
          </div>
          <div className="pager">
            <button disabled={!shelf[i - 1]} onClick={() => select(shelf[i - 1].id)}>
              ← Prev
            </button>
            <button disabled={!shelf[i + 1]} onClick={() => select(shelf[i + 1].id)}>
              Next →
            </button>
          </div>
        </section>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ListView() {
  const open = useStore((s) => s.listOpen);
  const toggleList = useStore((s) => s.toggleList);
  const select = useStore((s) => s.select);
  const [q, setQ] = useState('');
  const [onlySel, setOnlySel] = useState(false);

  if (!open) return null;
  const needle = q.trim().toLowerCase();
  const match = (p) =>
    (!onlySel || p.selected) &&
    (!needle ||
      [p.title, p.venue, p.abbr, String(p.year), ...p.authors.map((a) => a.name)].join(' ').toLowerCase().includes(needle));

  return (
    <div className="listview">
      <div className="list-inner">
        <div className="list-head">
          <input autoFocus placeholder="Search title, author, venue, year…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label>
            <input type="checkbox" checked={onlySel} onChange={(e) => setOnlySel(e.target.checked)} /> Selected only
          </label>
          <button className="close inline" onClick={() => toggleList(false)} aria-label="Close list">
            ×
          </button>
        </div>
        {BOOKCASES.map((bc, bi) => {
          const all = PAPERS.filter((p) => isOn(p, bc.id) && match(p));
          if (!all.length) return null;
          return (
            <section key={bc.id} className="list-case">
              <h2>
                <span className="num">{ROMAN[bi]}</span> {bc.name} <small>{all.length}</small>
              </h2>
              {bc.shelves.map((s) => {
                const rows = all.filter((p) => isOn(p, bc.id, s.id)).sort((a, b) => b.year - a.year);
                if (!rows.length) return null;
                return (
                  <div key={s.id}>
                    <h3>
                      <i style={{ background: bc.palette[1] }} />
                      {s.name}
                    </h3>
                    <ol>
                      {rows.map((p) => (
                        <li key={p.id}>
                          <span className="yr">{p.year}</span>
                          <div>
                            <button className="ttl" onClick={() => select(p.id, { bookcase: bc.id, shelf: s.id })}>
                              {p.selected && <span className="gold">★ </span>}
                              {p.title}
                            </button>
                            <div className="au">
                              <Authors authors={p.authors} />
                            </div>
                            <div className="vn">
                              <b>{p.abbr}</b> {p.venue}
                              {p.links.map((l) => (
                                <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                                  {l.label}
                                </a>
                              ))}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
