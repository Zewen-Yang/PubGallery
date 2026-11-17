// Pull the latest papers.bib from the homepage repo so the gallery never drifts from it.
// If the download fails, the copy already in src/data is kept.
import { writeFile } from 'node:fs/promises';

const SRC = 'https://raw.githubusercontent.com/Zewen-Yang/Zewen-Yang.github.io/main/_bibliography/papers.bib';
const DEST = new URL('../src/data/papers.bib', import.meta.url);

try {
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('@')) throw new Error('response does not look like BibTeX');
  await writeFile(DEST, text);
  console.log(`papers.bib synced (${(text.match(/^\s*@\w+\s*\{/gm) || []).length} entries)`);
} catch (err) {
  console.warn(`Could not sync papers.bib (${err.message}); keeping the committed copy.`);
}
