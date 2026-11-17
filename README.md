# PubGallery

Zewen Yang's publications as a 3D library (Three.js / React Three Fiber), with a star-map overview and a plain list view.
Live at <https://zewen-yang.github.io/PubGallery/>.

## Data

- `src/data/papers.bib` is copied from the homepage repo (`Zewen-Yang.github.io/_bibliography/papers.bib`).
  `npm run sync` refreshes it. The deploy workflow also syncs on every push and every Monday.
- The room is defined in `src/data/taxonomy.js`: one bookcase per area, one shelf per sub-topic, each listing citation keys.
  A paper may be listed on several shelves (also across bookcases); it then gets a copy on each, and the first listing is its
  home (star map, deep links). A paper can also be placed from the bib with `category = {ml/gp; control/learning}`
  (bookcase/shelf). Unlisted papers fall back to title rules.
- Gold bands on a spine = `selected = {true}`. Journal papers are taller than conference papers.

## Develop

```bash
npm install
npm run dev   # http://localhost:5173/PubGallery/
npm run build
```

## Deploy

Push to `main`. GitHub Actions builds and publishes to Pages
(repo Settings → Pages → Source: **GitHub Actions**).
