// Co-authors on the globe (the "Collaborators" view).
// Each co-author points at the institution they were at when we wrote together.
// `iso` is the ISO 3166-1 numeric country code (world-atlas ids), used to light up the country.
// Names are matched after lower-casing and stripping accents, so "Anžel" == "Anzel".
// Entries marked `unsure` are best guesses: please check them.

export const HOME = 'tum';

export const INSTITUTIONS = {
  tum: { name: 'Technical University of Munich', city: 'Munich', country: 'Germany', iso: '276', lat: 48.149, lon: 11.568 },
  rki: { name: 'Robert Koch Institute', city: 'Berlin', country: 'Germany', iso: '276', lat: 52.539, lon: 13.346 },
  heu: { name: 'Harbin Engineering University', city: 'Harbin', country: 'China', iso: '156', lat: 45.776, lon: 126.682 },
  nefu: { name: 'Northeast Forestry University', city: 'Harbin', country: 'China', iso: '156', lat: 45.722, lon: 126.636 },
  hit: { name: 'Harbin Institute of Technology', city: 'Harbin', country: 'China', iso: '156', lat: 45.744, lon: 126.631 },
  bit: { name: 'Beijing Institute of Technology', city: 'Beijing', country: 'China', iso: '156', lat: 39.959, lon: 116.31 },
  tsinghua: { name: 'Tsinghua University', city: 'Beijing', country: 'China', iso: '156', lat: 40.0, lon: 116.326 },
  ecust: { name: 'East China University of Science and Technology', city: 'Shanghai', country: 'China', iso: '156', lat: 31.143, lon: 121.426 },
  tongji: { name: 'Tongji University', city: 'Shanghai', country: 'China', iso: '156', lat: 31.283, lon: 121.502 },
  hkustgz: { name: 'HKUST (Guangzhou)', city: 'Guangzhou', country: 'China', iso: '156', lat: 22.896, lon: 113.478 },
  hku: { name: 'The University of Hong Kong', city: 'Hong Kong', country: 'China', iso: '156', lat: 22.283, lon: 114.137 },
  edinburgh: { name: 'University of Edinburgh', city: 'Edinburgh', country: 'United Kingdom', iso: '826', lat: 55.944, lon: -3.188 },
  nottingham: { name: 'University of Nottingham', city: 'Nottingham', country: 'United Kingdom', iso: '826', lat: 52.938, lon: -1.195 },
  adelaide: { name: 'University of Adelaide', city: 'Adelaide', country: 'Australia', iso: '036', lat: -34.919, lon: 138.604 },
  ucr: { name: 'University of California, Riverside', city: 'Riverside', country: 'United States', iso: '840', lat: 33.974, lon: -117.328 },
};

const PEOPLE = {
  // Technical University of Munich (ITR, MIRMI)
  tum: [
    'Sandra Hirche', 'Xiaobing Dai', 'Armin Lederer', 'Stefan Sosnowski', 'Junjie Jiao', 'Qingchen Liu',
    'Sihua Zhang', 'Songbo Dong', 'Siyu Chen', 'Sami Haddadin', 'Hamid Sadeghian', 'Majid Khadiv',
    'Bingkun Huang', 'Dian Yu', 'Yu Li', 'Valentin Le Mesle', 'Yansong Wu', 'Xiao Chen',
    'Zhenxiao Yin',
  ],
  tumUnsure: [
    'Mengtian Xu', 'Weijie Yang', 'Dongfa Zhang', 'Fengyi Yu', 'Chi Zhang', 'Kaize Deng', 'Simiao Zhuang',
    'Qingchuan Zhou', 'Yuhe Gong', 'Tianyu Ren', 'Lu Wan', 'Yang Shen', 'Fang Li', 'Dianxun Xiao',
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
  tsinghua: ['Ziyang Meng'],
  ecust: ['Yang Tang'],
  tongjiUnsure: ['Zhijun Li'],
  hkustgzUnsure: ['Hang Zhao'],
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

// normalised name → { inst, unsure }
export const AFFILIATION = {};
for (const [k, names] of Object.entries(PEOPLE)) {
  const unsure = k.endsWith('Unsure');
  const inst = unsure ? k.slice(0, -6) : k;
  for (const n of names) AFFILIATION[normName(n)] = { inst, unsure };
}
