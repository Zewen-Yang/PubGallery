// Minimal BibTeX parser: enough for al-folio style papers.bib files.

function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length - 1;
}

function parseFields(body) {
  const fields = {};
  let i = 0;
  const n = body.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(body[i])) i++;
    const nameMatch = /^[A-Za-z_][\w-]*/.exec(body.slice(i));
    if (!nameMatch) break;
    const name = nameMatch[0].toLowerCase();
    i += nameMatch[0].length;
    while (i < n && /\s/.test(body[i])) i++;
    if (body[i] !== '=') break;
    i++;
    while (i < n && /\s/.test(body[i])) i++;
    let value = '';
    if (body[i] === '{') {
      const end = matchBrace(body, i);
      value = body.slice(i + 1, end);
      i = end + 1;
    } else if (body[i] === '"') {
      let j = i + 1;
      while (j < n && !(body[j] === '"' && body[j - 1] !== '\\')) j++;
      value = body.slice(i + 1, j);
      i = j + 1;
    } else {
      let j = i;
      while (j < n && body[j] !== ',') j++;
      value = body.slice(i, j).trim();
      i = j;
    }
    fields[name] = value;
  }
  return fields;
}

export function parseBib(src) {
  const entries = [];
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let m;
  while ((m = re.exec(src))) {
    const type = m[1].toLowerCase();
    if (['comment', 'string', 'preamble'].includes(type)) continue;
    const open = src.indexOf('{', m.index);
    const end = matchBrace(src, open);
    const body = src.slice(m.index + m[0].length, end);
    entries.push({ type, key: m[2], fields: parseFields(body), raw: src.slice(m.index, end + 1) });
    re.lastIndex = end + 1;
  }
  return entries;
}

const ACCENTS = { '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', c: '̧' };

export function cleanLatex(s = '') {
  return s
    .replace(/\\([\"'`^~]|[cv](?=\s*\{))\s*\{?\s*([A-Za-z])\s*\}?/g, (_, a, l) =>
      (l + (ACCENTS[a] || (a === 'v' ? '̌' : ''))).normalize('NFC'),
    )
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\\[a-zA-Z]+\s*/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAuthors(s = '') {
  return cleanLatex(s)
    .split(/\s+and\s+/i)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      const mark = (a.match(/[†*]+/) || [''])[0];
      const plain = a.replace(/[†*]+/g, '').trim();
      const name = plain.includes(',')
        ? plain.split(',').slice(1).join(' ').trim() + ' ' + plain.split(',')[0].trim()
        : plain;
      return { name, mark, me: /zewen\s+yang/i.test(name) };
    });
}

// Strip the fields that only al-folio cares about, so "Copy BibTeX" gives a clean entry.
const SITE_FIELDS = [
  'abbr', 'selected', 'note', 'google_scholar_id', 'code', 'website', 'preview', 'annotation',
  'category', 'bibtex_show', 'pdf', 'html', 'award', 'award_name', 'keywords', 'abstract', 'arxiv',
];

export function cleanBibtex(entry) {
  const lines = [`@${entry.type}{${entry.key},`];
  for (const [k, v] of Object.entries(entry.fields)) {
    if (SITE_FIELDS.includes(k)) continue;
    lines.push(`  ${k} = {${v.replace(/\s+/g, ' ').trim()}},`);
  }
  lines.push('}');
  return lines.join('\n');
}
