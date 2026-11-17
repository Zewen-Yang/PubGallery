// Pull the latest papers.bib from the homepage repo so the gallery never drifts from it.
// If the download fails, the copy already in src/data is kept.
import { writeFile } from 'node:fs/promises';

const SRC = 'https://raw.githubusercontent.com/Zewen-Yang/Zewen-Yang.github.io/main/_bibliography/papers.bib';
const DEST = new URL('../src/data/papers.bib', import.meta.url);

// Spelling fixes applied after every sync, until the homepage bib carries them itself.
const FIXES = [
  [/undefinedlgen, Bahar/g, 'İlgen, Bahar'],
  [/\bIlgen, Bahar/g, 'İlgen, Bahar'],
  [/An\\v\{z\}el, Aleksandar/g, 'Anžel, Aleksandar'],
  [/\bAnzel, Aleksandar/g, 'Anžel, Aleksandar'],
];

try {
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let text = await res.text();
  if (!text.includes('@')) throw new Error('response does not look like BibTeX');
  for (const [re, to] of FIXES) text = text.replace(re, to);
  await writeFile(DEST, text);
  console.log(`papers.bib synced (${(text.match(/^\s*@\w+\s*\{/gm) || []).length} entries)`);
} catch (err) {
  console.warn(`Could not sync papers.bib (${err.message}); keeping the committed copy.`);
}
