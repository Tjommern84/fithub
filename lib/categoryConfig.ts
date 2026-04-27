export type MainCategory =
  | 'trene-selv'
  | 'trene-sammen'
  | 'oppfolging'
  | 'aktivitet-sport'
  | 'helse';

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
    label: 'Trene selv',
    description: 'Gym, styrke og egentreningsøkter',
    tags: [
      { label: 'Styrke',        value: 'styrke' },
      { label: 'Kondisjon',     value: 'kondisjon' },
      { label: 'CrossFit',      value: 'crossfit' },
      { label: 'Functional',    value: 'functional' },
      { label: 'Hjemmetrening', value: 'hjemmetrening' },
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
      '/bilder/Treningssenter/pexels-glebkrs-2628215.jpg',
      '/bilder/Treningssenter/pexels-ivan-s-4162477.jpg',
      '/bilder/Treningssenter/pexels-roman-odintsov-4553611.jpg',
    ],
    serviceTypes: ['styrke', 'kondisjon', 'teknologi'],
  },
  {
    key: 'trene-sammen',
    label: 'Trene sammen',
    description: 'Gruppetimer, yoga, bootcamp og fellesøvelser',
    tags: [
      { label: 'Gruppetime', value: 'gruppetime' },
      { label: 'Yoga',       value: 'yoga' },
      { label: 'Outdoor',    value: 'outdoor' },
      { label: 'Bootcamp',   value: 'bootcamp' },
      { label: 'Løpegruppe', value: 'løpegruppe' },
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
      '/bilder/Gruppetimer/pexels-airfit-6150627.jpg',
      '/bilder/Gruppetimer/pexels-katetrysh-4090009.jpg',
      '/bilder/Gruppetimer/pexels-pavel-danilyuk-6339488.jpg',
    ],
    serviceTypes: ['gruppe', 'yoga', 'mindbody', 'outdoor'],
  },
  {
    key: 'oppfolging',
    label: 'Oppfølging & coaching',
    description: 'PT, coaching, rehab og ernæring',
    tags: [
      { label: 'PT',        value: 'pt' },
      { label: 'Rehab',     value: 'rehab' },
      { label: 'Online',    value: 'online' },
      { label: 'Ernæring',  value: 'ernæring' },
      { label: 'Smågruppe', value: 'small-group' },
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
      '/bilder/Personlig%20trener/pexels-jonathanborba-3076510.jpg',
      '/bilder/Personlig%20trener/pexels-julia-larson-6456323.jpg',
      '/bilder/Personlig%20trener/pexels-kampus-6922165.jpg',
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
      '/bilder/Klinisk & Rehab/pexels-kampus-6111589.jpg',
      '/bilder/Livsstil & Helse/pexels-karola-g-5714341.jpg',
      '/bilder/Klinisk & Rehab/pexels-karola-g-4506214.jpg',
    ],
    serviceTypes: ['rehab', 'ernæring', 'helse', 'spesialisert'],
  },
  {
    key: 'aktivitet-sport',
    label: 'Aktivitet & sport',
    description: 'Idrettslag, friluft og naturbasert aktivitet',
    tags: [
      { label: 'Fotball',     value: 'fotball' },
      { label: 'Ski',         value: 'ski' },
      { label: 'Håndball',    value: 'håndball' },
      { label: 'Svømming',    value: 'svømming' },
      { label: 'Orientering', value: 'orientering' },
      { label: 'Friidrett',   value: 'friidrett' },
      { label: 'Kampsport',   value: 'kampsport' },
      { label: 'Padel',       value: 'padel' },
      { label: 'Langrenn',    value: 'langrenn' },
      { label: 'Klatring',    value: 'klatring' },
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
      '/bilder/Idrettslag%20%26%20Sport/pexels-micaasato-1198172.jpg',
      '/bilder/Outdoor/pexels-rdne-5837154.jpg',
      '/bilder/Idrettslag%20%26%20Sport/pexels-pavel-danilyuk-6203514.jpg',
    ],
    serviceTypes: ['sport'],
  },
];

export const CATEGORY_LABELS: Record<MainCategory, string> = {
  'trene-selv': 'Trene selv',
  'trene-sammen': 'Trene sammen',
  oppfolging: 'Oppfølging & coaching',
  'aktivitet-sport': 'Aktivitet & sport',
  helse: 'Helse & behandling',
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
    value === 'helse'
  ) {
    return value;
  }
  return null;
}
