// Hand-kept corrections for the co-author affiliations shown on the star map's globe.
//
// Affiliations follow the paper: `npm run sync:aff` (scripts/sync-affiliations.mjs) asks OpenAlex,
// by DOI, which institutions each author listed on each paper and writes src/data/affiliations.json.
// This file is what that script falls back on, and where to fix things by hand:
//   1. PAPER_OVERRIDES  – the affiliations of one author on one paper (wins over everything)
//      PERSON_OVERRIDES – the affiliations of one author on all their papers
//   2. OpenAlex         – what the paper itself lists
//   3. PEOPLE           – confirmed by hand per author (groups not ending in "Unsure")
//   4. the same author's affiliations on their other papers (nearest year)   → shown with a "?"
//   5. PEOPLE …Unsure   – a last-resort guess per author                       → shown with a "?"
// Re-run `npm run sync:aff` after editing.

// The hub the arcs start from.
export const HOME = 'Technical University of Munich';

// { citationKey: { 'Author Name': ['Institution name', ...] } }; names as in INSTITUTIONS or OpenAlex.
export const PAPER_OVERRIDES = {};

// { 'Author Name': ['Institution name', ...] }: used on every paper of that author, whatever OpenAlex says.
const HEU = ['Harbin Engineering University'];
const RKI = ['Robert Koch Institute'];
export const PERSON_OVERRIDES = {
  'Wei Ren': ['University of California, Riverside'],
  'Zhijun Li': ['Tongji University'],
  'Hang Zhao': ['The Hong Kong University of Science and Technology (Guangzhou)'],
  'Georges Hattab': ['Robert Koch Institute', 'Freie Universität Berlin'],
  'Luis Roger Esquivel Gomez': RKI,
  'Denise Kühnert': RKI,
  // As printed on the papers (OpenAlex shows where they moved to later).
  'Xiangling Liu': HEU,
  'Jiyun Li': HEU,
  'Tongda Wang': HEU,
  'Jun Zhang': HEU,
};

// OpenAlex name → the name to file it under (merged or duplicate records).
export const ALIAS = {
  'Adelaide University': 'The University of Adelaide',
  'Hong Kong University of Science and Technology': 'The Hong Kong University of Science and Technology',
  'Key Laboratory of Smart Manufacturing in Energy Chemical Process, Ministry of Education': 'East China University of Science and Technology',
};

// Institutions OpenAlex attaches by mistake: ignored in what it returns (hand entries may still use them).
export const DROP = ['Eindhoven University of Technology'];

// Institutions OpenAlex may not return (used by PEOPLE / PAPER_OVERRIDES). `cc` is the ISO alpha-2 code.
export const INSTITUTIONS = {
  tum: { name: 'Technical University of Munich', city: 'Munich', cc: 'DE', lat: 48.149, lon: 11.568 },
  rki: { name: 'Robert Koch Institute', city: 'Berlin', cc: 'DE', lat: 52.539, lon: 13.346 },
  heu: { name: 'Harbin Engineering University', city: 'Harbin', cc: 'CN', lat: 45.776, lon: 126.682 },
  nefu: { name: 'Northeast Forestry University', city: 'Harbin', cc: 'CN', lat: 45.722, lon: 126.636 },
  hit: { name: 'Harbin Institute of Technology', city: 'Harbin', cc: 'CN', lat: 45.744, lon: 126.631 },
  bit: { name: 'Beijing Institute of Technology', city: 'Beijing', cc: 'CN', lat: 39.959, lon: 116.31 },
  nus: { name: 'National University of Singapore', city: 'Singapore', cc: 'SG', lat: 1.2966, lon: 103.7764 },
  ecust: { name: 'East China University of Science and Technology', city: 'Shanghai', cc: 'CN', lat: 31.143, lon: 121.426 },
  tongji: { name: 'Tongji University', city: 'Shanghai', cc: 'CN', lat: 31.283, lon: 121.502 },
  hkustgz: { name: 'The Hong Kong University of Science and Technology (Guangzhou)', city: 'Guangzhou', cc: 'CN', lat: 22.896, lon: 113.478 },
  hku: { name: 'The University of Hong Kong', city: 'Hong Kong', cc: 'HK', lat: 22.283, lon: 114.137 },
  edinburgh: { name: 'University of Edinburgh', city: 'Edinburgh', cc: 'GB', lat: 55.944, lon: -3.188 },
  nottingham: { name: 'University of Nottingham', city: 'Nottingham', cc: 'GB', lat: 52.938, lon: -1.195 },
  adelaide: { name: 'The University of Adelaide', city: 'Adelaide', cc: 'AU', lat: -34.919, lon: 138.604 },
  tue: { name: 'Eindhoven University of Technology', city: 'Eindhoven', cc: 'NL', lat: 51.448, lon: 5.49 },
  ucr: { name: 'University of California, Riverside', city: 'Riverside', cc: 'US', lat: 33.974, lon: -117.328 },
};

// Per author, when the paper itself gives nothing (keys of INSTITUTIONS). Groups ending in
// "Unsure" are guesses and show a "?"; the others are confirmed.
export const PEOPLE = {
  // Technical University of Munich (ITR, MIRMI)
  tum: [
    'Sandra Hirche', 'Xiaobing Dai', 'Armin Lederer', 'Stefan Sosnowski', 'Junjie Jiao', 'Qingchen Liu',
    'Sihua Zhang', 'Songbo Dong', 'Siyu Chen', 'Sami Haddadin', 'Hamid Sadeghian', 'Majid Khadiv',
    'Bingkun Huang', 'Dian Yu', 'Yu Li', 'Valentin Le Mesle', 'Yansong Wu', 'Xiao Chen',
    'Zhenxiao Yin', 'Simiao Zhuang', 'Qingchuan Zhou', 'Dongfa Zhang',
    'Zewen Yang', // my own affiliation where the paper record gives none
  ],
  tumUnsure: [
    'Mengtian Xu', 'Weijie Yang', 'Fengyi Yu', 'Chi Zhang', 'Kaize Deng', 
    'Yuhe Gong', 'Tianyu Ren', 'Yang Shen', 'Fang Li', 'Dianxun Xiao',
  ],
  rki: [
    'Georges Hattab', 'Akshat Dubey', 'Aleksandar Anzel', 'Moritz Weckbecker', 'Bahar Ilgen', 'Chisom Ezekannagha',
    'Luis Roger Esquivel Gomez', 'Nadezdha Malysheva', 'Juliane Pfeil', 'Sandra M. Butow', 'Christopher Irrgang',
    'Nils Korber', 'Denise Kuhnert', 'Katharina Ladewig',
  ],
  rkiUnsure: ['Ebebezer Oladimeji'],
  heu: [
    'Zheping Yan', 'Jiajia Zhou', 'Lu Wang', 'Tongda Wang', 'Jiyun Li', 'Yi Wu', 'Di Wu', 'Tao Chen', 'Lidong Yue',
    'Xiaoli Pan', 'Anzuo Jiang', 'Xiangling Liu', 'Jinzhong Zhang', 'Xue Du', 'Yanbin Teng', 'Shilin Wei', 'Wei Zhang',
    'Yulong Huang',
  ],
  heuUnsure: [
    'Jian Xu', 'Honghan Zhang', 'Xuan Zhao', 'Heng Li', 'Gengshi Zhang', 'Jia Zeng', 'Jun Zhang', 'Xinyi Zhao',
    'Jialing Tang', 'Liang Fang', 'Jiajun Cheng',
  ],
  nefu: ['Heming Jia'],
  hit: ['Fangzhou Liu'],
  bit: ['Yuanqing Xia', 'Di-Hua Zhai'],
  nus: ['Ziyang Meng'],
  ecust: ['Yang Tang'],
  tongji: ['Zhijun Li'],
  tue: ['Lu Wan'],
  hku: ['C. C. Chan'],
  edinburgh: ['Filippo Menolascina'],
  nottingham: ['Luis Figueredo'],
  adelaide: ['Peng Shi'],
  ucr: ['Wei Ren'],
};

export function normName(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/undefined/g, 'i') // \.{I} in the bib
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

// normalised name → { inst: key of INSTITUTIONS, unsure }
export const GUESS = {};
for (const [k, names] of Object.entries(PEOPLE)) {
  const unsure = k.endsWith('Unsure');
  for (const n of names) GUESS[normName(n)] = { inst: unsure ? k.slice(0, -6) : k, unsure };
}
