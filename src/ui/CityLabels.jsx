import { CITIES } from '../lib/collab.js';
import { labelEls } from '../scene/registry.js';
import { useStore } from '../store.js';

// City labels for the globe. Positions, leader lines and visibility are written every frame by
// CityLabelLayout in scene/Globe.jsx; this only renders the elements.
export function CityLabels() {
  const hoverSite = useStore((s) => s.hoverSite);
  const pickCountry = useStore((s) => s.pickCountry);
  const reg = (city, key) => (el) => {
    if (!el) return;
    (labelEls[city] ??= {})[key] = el;
  };
  return (
    <div className="citylabels" aria-hidden>
      <svg className="cl-lines">
        {CITIES.map((c) => (
          <line key={c.city} ref={reg(c.city, 'line')} />
        ))}
      </svg>
      {CITIES.map((c) => (
        <div
          key={c.city}
          ref={reg(c.city, 'label')}
          className="cl-label"
          style={{ visibility: 'hidden' }}
          onMouseEnter={() => hoverSite(c.main)}
          onMouseLeave={() => useStore.getState().hoveredSite === c.main && hoverSite(null)}
          onClick={() => pickCountry(c.iso)}
        >
          {c.city}
          <span>{c.n}</span>
        </div>
      ))}
    </div>
  );
}
