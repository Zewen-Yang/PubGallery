// Pull the latest bib files from the homepage repo so the gallery never drifts from it.
// papers.bib holds the English papers, chinese.bib the Chinese journal papers.
// If a download fails, the copy already in src/data is kept.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/Zewen-Yang/Zewen-Yang.github.io/main/_bibliography/';
const FILES = ['papers.bib', 'chinese.bib'];

// Spelling fixes applied after every sync, until the homepage bib carries them itself.
const FIXES = [
  [/undefinedlgen, Bahar/g, 'İlgen, Bahar'],
  [/\bIlgen, Bahar/g, 'İlgen, Bahar'],
  [/An\\v\{z\}el, Aleksandar/g, 'Anžel, Aleksandar'],
  [/\bAnzel, Aleksandar/g, 'Anžel, Aleksandar'],
];

for (const file of FILES) {
  try {
    const res = await fetch(BASE + file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let text = await res.text();
    if (!text.includes('@')) throw new Error('response does not look like BibTeX');
    for (const [re, to] of FIXES) text = text.replace(re, to);
    await writeFile(new URL(`../src/data/${file}`, import.meta.url), text);
    console.log(`${file} synced (${(text.match(/^\s*@\w+\s*\{/gm) || []).length} entries)`);
  } catch (err) {
    console.warn(`Could not sync ${file} (${err.message}); keeping the committed copy.`);
  }
}
