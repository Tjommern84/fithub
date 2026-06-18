export type MainCategory =
  | 'trene-selv'
  | 'trene-sammen'
  | 'oppfolging'
  | 'aktivitet-sport'
  | 'helse'
  | 'paraidrett'
  | 'utendors';

export type TagOption = { label: string; value: string };

export type CategoryTheme = {
  accent: string;
  headerBg: string;
  titleColor: string;
  subColor: string;
  badgeBg: string;
  badgeText: string;
  barStart: string;
  barEnd: string;
};

export type CategoryConfig = {
  key: MainCategory;
  label: string;
  description: string;
  tags: TagOption[];
  theme: CategoryTheme;
  accent: string;
  images: string[];
  /** Legacy service types that belong to this category. */
  serviceTypes: string[];
};

export const CATEGORIES: CategoryConfig[] = [
  {
    key: 'trene-selv',
    label: 'Egentrening',
    description: 'Tuftepark, treningssenter og egentrening',
    tags: [
      { label: 'Styrke',    value: 'styrke' },
      { label: 'Kondisjon', value: 'kondisjon' },
      { label: 'Klatring',  value: 'klatring' },
    ],
    theme: {
      accent:     '#D4872A',
      headerBg:   '#1C1108',
      titleColor: '#F5D99A',
      subColor:   '#C49A5A',
      badgeBg:    '#FFF3DC',
      badgeText:  '#7A4A10',
      barStart:   '#D4872A',
      barEnd:     '#F5C05A',
    },
    accent: 'from-amber-300/60 via-orange-300/40 to-rose-300/30',
    images: [
      '/bilder/Treningssenter/pexels-glebkrs-2628215.webp',
      '/bilder/Treningssenter/pexels-ivan-s-4162477.webp',
      '/bilder/Treningssenter/pexels-roman-odintsov-4553611.webp',
    ],
    serviceTypes: ['styrke', 'kondisjon', 'teknologi'],
  },
  {
    key: 'trene-sammen',
    label: 'Gruppetime',
    description: 'Gruppetimer, yoga, bootcamp og fellesøvelser',
    tags: [
      { label: 'Gruppe',     value: 'gruppe' },
      { label: 'Yoga',       value: 'yoga' },
      { label: 'Utetrening', value: 'utetrening' },
      { label: 'Spinning',   value: 'spinning' },
      { label: 'Aerobic',    value: 'aerobic' },
    ],
    theme: {
      accent:     '#8B5CF6',
      headerBg:   '#0F0A1E',
      titleColor: '#D4C8F8',
      subColor:   '#9B8CC4',
      badgeBg:    '#EDE9FF',
      badgeText:  '#4C2DA0',
      barStart:   '#7C3AED',
      barEnd:     '#C084FC',
    },
    accent: 'from-fuchsia-300/60 via-pink-300/40 to-rose-300/30',
    images: [
      '/bilder/Gruppetimer/pexels-airfit-6150627.webp',
      '/bilder/Gruppetimer/pexels-katetrysh-4090009.webp',
      '/bilder/Gruppetimer/pexels-pavel-danilyuk-6339488.webp',
    ],
    serviceTypes: ['gruppe', 'yoga', 'mindbody', 'outdoor'],
  },
  {
    key: 'oppfolging',
    label: 'Oppfølging & coaching',
    description: 'PT, coaching og personlig veiledning',
    tags: [
      { label: 'PT',       value: 'pt' },
      { label: 'Ernæring', value: 'ernæring' },
      { label: 'Livsstil', value: 'livsstil' },
      { label: 'Kosthold', value: 'kosthold' },
    ],
    theme: {
      accent:     '#0F766E',
      headerBg:   '#021A18',
      titleColor: '#A7F3E8',
      subColor:   '#5BA89F',
      badgeBg:    '#CCFBF1',
      badgeText:  '#0F4F47',
      barStart:   '#0F766E',
      barEnd:     '#2DD4BF',
    },
    accent: 'from-sky-300/60 via-cyan-300/40 to-teal-300/30',
    images: [
      '/bilder/Personlig%20trener/pexels-jonathanborba-3076510.webp',
      '/bilder/Personlig%20trener/pexels-julia-larson-6456323.webp',
      '/bilder/Personlig%20trener/pexels-kampus-6922165.webp',
    ],
    serviceTypes: ['pt', 'spesialisert', 'livsstil'],
  },
  {
    key: 'helse',
    label: 'Helse & behandling',
    description: 'Fysioterapi, ernæring, rehab og velvære',
    tags: [
      { label: 'Fysioterapi',   value: 'fysioterapi' },
      { label: 'Rehab',         value: 'rehab' },
      { label: 'Ernæring',      value: 'ernæring' },
      { label: 'Kiropraktikk',  value: 'kiropraktikk' },
      { label: 'Solarium',      value: 'solarium' },
      { label: 'Kroppsanalyse', value: 'kroppsanalyse' },
    ],
    theme: {
      accent:     '#BE185D',
      headerBg:   '#1A0510',
      titleColor: '#FBCFE8',
      subColor:   '#C084A0',
      badgeBg:    '#FCE7F3',
      badgeText:  '#831843',
      barStart:   '#BE185D',
      barEnd:     '#F472B6',
    },
    accent: 'from-rose-300/60 via-pink-300/40 to-fuchsia-300/30',
    images: [
      '/bilder/Klinisk & Rehab/pexels-kampus-6111589.webp',
      '/bilder/Livsstil & Helse/pexels-karola-g-5714341.webp',
      '/bilder/Klinisk & Rehab/pexels-karola-g-4506214.webp',
    ],
    serviceTypes: ['rehab', 'ernæring', 'helse', 'spesialisert'],
  },
  {
    key: 'aktivitet-sport',
    label: 'Sport',
    description: 'Idrettslag og sportsklubber i hele Norge',
    tags: [
      { label: 'Fotball',     value: 'fotball' },
      { label: 'Klatring',    value: 'klatring' },
      { label: 'Ski',         value: 'ski' },
      { label: 'Tennis',      value: 'tennis' },
      { label: 'Golf',        value: 'golf' },
      { label: 'Padel',       value: 'padel' },
      { label: 'Langrenn',    value: 'langrenn' },
      { label: 'Bowling',     value: 'bowling' },
      { label: 'Ishockey',    value: 'ishockey' },
      { label: 'Friidrett',   value: 'friidrett' },
      { label: 'Orientering', value: 'orientering' },
      { label: 'Kampsport',   value: 'kampsport' },
      { label: 'Svømming',    value: 'svomming' },
    ],
    theme: {
      accent:     '#DC2626',
      headerBg:   '#180808',
      titleColor: '#FDCACA',
      subColor:   '#B87070',
      badgeBg:    '#FEE2E2',
      badgeText:  '#7F1D1D',
      barStart:   '#DC2626',
      barEnd:     '#F87171',
    },
    accent: 'from-emerald-300/60 via-teal-300/40 to-cyan-300/30',
    images: [
      '/bilder/Idrettslag%20%26%20Sport/pexels-micaasato-1198172.webp',
      '/bilder/Idrettslag%20%26%20Sport/pexels-pspov-3046582.webp',
      '/bilder/Idrettslag%20%26%20Sport/pexels-pavel-danilyuk-6203514.webp',
    ],
    serviceTypes: ['sport'],
  },
  {
    key: 'paraidrett',
    label: 'Paraidrett',
    description: 'Tilpasset trening og idrett for alle',
    tags: [
      { label: 'Tilpasset idrett', value: 'paraidrett' },
      { label: 'Svømming',         value: 'svomming' },
      { label: 'Rullestol',        value: 'rullestol' },
    ],
    theme: {
      accent:     '#2563EB',
      headerBg:   '#030B1A',
      titleColor: '#BFDBFE',
      subColor:   '#7BAEE0',
      badgeBg:    '#DBEAFE',
      badgeText:  '#1E3A6E',
      barStart:   '#2563EB',
      barEnd:     '#60A5FA',
    },
    accent: 'from-blue-300/60 via-sky-300/40 to-cyan-300/30',
    images: [
      '/bilder/HC/pexels-andrew-mcmurtrie-2303639-3997914.webp',
      '/bilder/HC/pexels-kampus-6763808.webp',
      '/bilder/HC/pexels-mikhail-nilov-7697828.webp',
    ],
    serviceTypes: ['sport'],
  },
  {
    key: 'utendors',
    label: 'Utendørs',
    description: 'Tuftepark, utetrening og friluftsliv',
    tags: [
      { label: 'Tuftepark',   value: 'tuftepark' },
      { label: 'Utetrening',  value: 'utetrening' },
      { label: 'Fellestimer', value: 'fellestimer' },
    ],
    theme: {
      accent:     '#16A34A',
      headerBg:   '#0A1A0E',
      titleColor: '#A7F3C0',
      subColor:   '#6EE7A0',
      badgeBg:    '#DCFCE7',
      badgeText:  '#14532D',
      barStart:   '#15803D',
      barEnd:     '#4ADE80',
    },
    accent: 'from-green-300/60 via-emerald-300/40 to-teal-300/30',
    images: [
      '/bilder/Outdoor/pexels-rdne-5837154.webp',
      '/bilder/Outdoor/pexels-rdne-8402245.webp',
      '/bilder/Outdoor/pexels-rui-dias-469842-1472887.webp',
    ],
    serviceTypes: ['outdoor'],
  },
];

export const CATEGORY_LABELS: Record<MainCategory, string> = {
  'trene-selv': 'Egentrening',
  'trene-sammen': 'Gruppetime',
  oppfolging: 'Oppfølging & coaching',
  'aktivitet-sport': 'Sport',
  helse: 'Helse & behandling',
  paraidrett: 'Paraidrett',
  utendors: 'Utendørs',
};

export function getCategoryConfig(key: string): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function parseMainCategory(value: string): MainCategory | null {
  if (
    value === 'trene-selv' ||
    value === 'trene-sammen' ||
    value === 'oppfolging' ||
    value === 'aktivitet-sport' ||
    value === 'helse' ||
    value === 'paraidrett' ||
    value === 'utendors'
  ) {
    return value;
  }
  return null;
}
