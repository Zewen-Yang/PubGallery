// The library: one bookcase per research area, one shelf per sub-topic.
// `keys` are citation keys from papers.bib and chinese.bib. A paper may sit on several shelves (in several bookcases):
// just list its key in each. The first place it is listed (in bookcase order) is its "home",
// used for the star map and for deep links.
// A paper can also be placed from the bib itself with `category = {ml/gp; control/learning}`
// (bookcase/shelf, several separated by `;` or `,`). Papers that are not listed anywhere are
// placed by FALLBACK_RULES onto the first shelf of the matching bookcase.

const UUV_COORDINATION = [
  'YAN_OE_2020_pathtracking', 'YAN_OE_2019_coordinatedcontrol', 'Yan_OCEANS_2019_coordinatedcontrol',
  'Yan_IECON_2018_pathtracking', 'Yan_CCC_2022_coordinatedcontrol', 'Yan_CCC_2021_leaderfollowing',
  'Yan_ACCESS_2019_formation', 'Zhang_ACCESS_2019_consensuscontrol',
];
const COLLECTIVE_LEARNING = [
  'yang_arXiv2026_coingp', 'yang_JAS2026_qualityorquantity', 'yang_JAAMAS2026_whomtotrust', 'yang_AAAI2025_Asynchronous', 'Yang_AAMAS_2024_whomtotrust',
];
const COOPERATIVE_LEARNING_CONTROL = [
  'dai_arXiv2026_etnetworked', 'dai_arXiv2026_asyncmultirobot', 'Dai_TNNLS2025_cooperative', 'Yang_ACC_2024_cooperative', 'DAI2024101058', 'Lederer_TAC_2023_cooperative',
  'Yang_CDC_2021_distributedlearning',
];
const MOTOR_GP = ['Yin_JSTSP_2026_gpreg', 'Yin_TMECH_2025_torqueinducedovershoot', 'Yin_IECON_2023_learningbased'];
const ROBOT_LEARNING = [
  'yang_TRO2026_uniconflow', 'dai_arXiv2025_safeflow', 'yang_arXiv2025_prompt2auto', 'yu2026safenightvlaseeingunseen', 'Deng_IFAC2026_residual', 'huang_ICRA2026_contactsafe',
];

export const BOOKCASES = [
  {
    id: 'mas',
    name: 'Multi-Agent Systems',
    palette: ['#1f4e5f', '#2a6273', '#183f52', '#2f5d6b', '#1b5566', '#24495a'],
    star: '#6fd3ff',
    shelves: [
      {
        id: 'coordinated',
        name: 'Coordinated Control',
        keys: [...UUV_COORDINATION, 'zhuang2026safeconsensuscooperativemanipulation', 'Yan_SENSORS_2018_polarcooperative'],
      },
      { id: 'collective', name: 'Collective Learning', keys: COLLECTIVE_LEARNING },
      { id: 'coop', name: 'Cooperative Learning-based Control', keys: COOPERATIVE_LEARNING_CONTROL },
    ],
  },
  {
    id: 'ml',
    name: 'Machine Learning',
    palette: ['#6b1f2a', '#7d2934', '#5a1a28', '#82303a', '#682337', '#4f1824'],
    star: '#ff8fa8',
    shelves: [
      {
        id: 'gp',
        name: 'Gaussian Process Learning',
        keys: [
          'Yang_AAAI2026_SkyGP', 'yang_arXiv2025_prompt2auto', 'dai_TUM2026_resilientdos', 'yang_EAAI2025_safe',
          'dai_arXiv2024_gpgym', 'dai_L4DC2023_can', 'Yang_CCC_2024_kernelbased', ...MOTOR_GP, ...COLLECTIVE_LEARNING,
        ],
      },
      { id: 'robot', name: 'Robot Learning', keys: ROBOT_LEARNING },
      {
        id: 'ai',
        name: 'Trustworthy AI',
        keys: [
          'Hattab_NLPIR2024_personastrategies', 'dubey_EXPLIMED2024_storytelling', 'gomez2025holistic',
          'dubey_STARProtocols2025_protocol', 'WECKBECKER20242326', 'dubey_iScience2024_nestedmodel',
        ],
      },
      // Chinese journal papers
      { id: 'pattern', name: 'Recognition & Stochastic Models', keys: ['Jia_TIS_2018_gesture', 'Yan_CJSR_2018_markov'] },
    ],
  },
  {
    id: 'robotics',
    name: 'Robotics',
    palette: ['#2f4a2a', '#3b5a31', '#28402a', '#456236', '#33502e', '#2a4426'],
    star: '#a8f08f',
    shelves: [
      { id: 'learning', name: 'Robot Learning', keys: ROBOT_LEARNING },
      { id: 'control', name: 'Robot Control', keys: ['li_ICRA_2026_RCM', 'zhuang2026safeconsensuscooperativemanipulation'] },
      {
        id: 'nav',
        name: 'Underwater Vehicle Applications',
        keys: [
          'Yan_CCC_2018_transversalnavigation', 'Yan_ACCESS_2019_finealignment', 'Yan_SENSORS_2018_polarinitialalignment',
          'Yan_CPE_2021_pathplanning', 'Yan_ACCESS_2018_pathplanning', 'Yan_ACCESS_2021_multilevelthresholding',
          'Yan_SENSORS_2018_polarcooperative',
          // Chinese journal papers
          'Yan_HUST_2019_motionparameter', 'Jia_SLGC_2016_initialalignment', 'Jia_SDKJ_2015_cubaturekalman',
        ],
      },
      {
        // Chinese journal papers
        id: 'plant',
        name: 'Plant Factory & Embedded Systems',
        keys: [
          'Yang_CEA_2018_plantfactory', 'Yang_JSNY_2018_plantfactoryenergy', 'Jia_YYKJ_2018_sensorplacement', 'Jia_TYKJ_2018_temperaturesensors',
          'Jia_SLGC_2017_miniplantfactory', 'Luo_TYKJ_2017_nutrientsolution', 'Luo_TYKJ_2017_aeroponic', 'Tang_KJWH_2016_stm32',
          'Liu_KJWH_2017_balancevehicle', 'Liu_KJWH_2017_trackingcar',
        ],
      },
    ],
  },
  {
    id: 'control',
    name: 'Control Theory',
    palette: ['#8a5a1c', '#7a4c16', '#956726', '#6e4413', '#a06e2c', '#80521b'],
    star: '#ffc56b',
    shelves: [
      {
        id: 'tracking',
        name: 'Trajectory Tracking',
        keys: [
          'Yan_CCC_2018_pathtracking', 'Yan_ACCESS_2019_trajectory', 'Zhou_ACCESS_2019_trajectorytracking', 'Yan_CCC_2019_divingcontrol',
          // Chinese journal papers
          'Jia_TYKJ_2018_backsteppingnn', 'Lin_TYKJ_2018_depthbackstepping', 'Yang_CEA_2017_highgainobserver', 'Yang_JDGC_2017_backstepping',
          'Yan_YHZT_2017_backsteppingslidingmode', 'Wang_KJWH_2017_controlsystemmodel',
        ],
      },
      { id: 'robust', name: 'Robust & Recovery Control', keys: ['Zhou_CCC_2019_timedelaystatefeedback', 'Du_OCEANS_2019_recoverycontroller'] },
      {
        id: 'learning',
        name: 'Learning-based Control',
        keys: [
          'dai_TUM2026_resilientdos', 'yang_EAAI2025_safe', 'Yang_CCC_2024_kernelbased', ...MOTOR_GP, 'yang_JAAMAS2026_whomtotrust',
          ...COOPERATIVE_LEARNING_CONTROL,
        ],
      },
      { id: 'coordinated', name: 'Coordinated Control', keys: UUV_COORDINATION },
    ],
  },
];

const FALLBACK_RULES = [
  ['robotics', /manipulat|robot|motion planning|teleoperation|surgical|vision-language/i],
  ['mas', /multi-?agent|consensus|cooperative|coordinated|multiple (auv|uuv)s|multi-uuv|formation|distributed/i],
  ['ml', /learning|gaussian process|language model|\bai\b|machine|neural|kernel/i],
  ['control', /control|observer|sliding mode|backstepping/i],
  ['robotics', /auv|uuv|underwater|vehicle|navigation|path planning|alignment/i],
];

const BY_KEY = {};
for (const b of BOOKCASES)
  for (const s of b.shelves)
    for (const k of s.keys) {
      const list = (BY_KEY[k] ||= []);
      if (!list.some(([bc, sh]) => bc === b.id && sh === s.id)) list.push([b.id, s.id]);
    }

function explicitPlace(spec) {
  const [bc, sh] = spec.toLowerCase().split('/').map((x) => x?.trim());
  const caseHit = BOOKCASES.find((b) => b.id === bc || b.name.toLowerCase() === bc);
  if (!caseHit) return null;
  const shelfHit = caseHit.shelves.find((s) => s.id === sh || s.name.toLowerCase() === sh);
  return [caseHit.id, (shelfHit || caseHit.shelves[0]).id];
}

// Every [bookcase, shelf] the paper sits on; the first one is its home.
export function placePaper(key, title, explicit = '') {
  const fromBib = explicit.split(/[;,]/).map((s) => s.trim()).filter(Boolean).map(explicitPlace).filter(Boolean);
  if (fromBib.length) return fromBib;
  if (BY_KEY[key]) return BY_KEY[key];
  for (const [id, re] of FALLBACK_RULES) {
    if (re.test(title)) return [[id, BOOKCASES.find((b) => b.id === id).shelves[0].id]];
  }
  return [['ml', 'gp']];
}
