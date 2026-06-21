import type { ReactNode } from 'react';
import type { ServiceType } from './domain';

type IconProps = { className?: string };

const HandballIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 3v18M3 12h18" />
    <path strokeLinecap="round" d="M5.5 5.5c2 2.5 2 4.5 0 6.5M18.5 5.5c-2 2.5-2 4.5 0 6.5M5.5 18.5c2-2.5 2-4.5 0-6.5M18.5 18.5c-2-2.5-2-4.5 0-6.5" />
  </svg>
);

const FootballIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinejoin="round" d="M12 7.5 16 10.2l-1.5 4.6h-5L8 10.2Z" />
    <path strokeLinecap="round" d="M12 7.5V4M16 10.2l3.3-1M14.5 14.8l2 2.8M9.5 14.8l-2 2.8M8 10.2 4.7 9.2" />
  </svg>
);

const MartialArtsIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="5" r="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l-4 3M12 12l4 3M9 12h6" />
    <path strokeLinecap="round" d="M8 15l-2 5M16 15l2 5" />
  </svg>
);

const SkiIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="4.5" r="1.8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v6l3 4M12 13l-3 4" />
    <path strokeLinecap="round" d="M4 19l6.5-3M14 16l5.5 3" />
  </svg>
);

const SwimmingIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="17" cy="6" r="1.6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l4-2 2 3 3-1M3 16c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0M3 20c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0" />
  </svg>
);

const TennisIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="9" cy="9" r="5" />
    <path strokeLinecap="round" d="M5.5 5.5c2.5 1.5 4.5 4 4 7M12.5 5.5c-2.5 1.5-4.5 4-4 7M14 14l6 6" />
  </svg>
);

const BasketballIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 3c2.5 2.5 2.5 15.5 0 18M3 12h18M5 5.5c2 2.5 5 4 7 4s5-1.5 7-4M5 18.5c2-2.5 5-4 7-4s5 1.5 7 4" />
  </svg>
);

const VolleyballIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 3a9 9 0 0 1 6 15.5M12 3a13 13 0 0 0 0 18M6 5.5a9 9 0 0 0 0 13" />
  </svg>
);

const BadmintonIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="9" cy="9" r="5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12l-3 6 2 1 1-2M9 9l5 5M19 19l-3-3" />
  </svg>
);

const YogaIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="5" r="1.8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M12 12l-6 5M12 12l6 5M8 18l4-3 4 3" />
    <path strokeLinecap="round" d="M5 19h14" />
  </svg>
);

const StrengthIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v6M3 10v4M18 9v6M21 10v4" />
    <path strokeLinecap="round" d="M6 12h12" />
  </svg>
);

const RunningIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="14" cy="5" r="1.8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 8l3 3-1 5M14 11l4 1M10 11l-3 2 1 5M7 13l-3 1" />
  </svg>
);

const GroupIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="8" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 20c0-3 2.5-5 5-5s5 2 5 5M14.5 20c0-2.2 1.4-4 3.5-4.5" />
  </svg>
);

const OutdoorIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l5 9H7l5-9ZM7 13l-3 7M17 13l3 7" />
    <path strokeLinecap="round" d="M3 20h18" />
  </svg>
);

const PtIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="7" r="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    <path strokeLinecap="round" d="M9 13.5l-2 2 1 1M15 13.5l2 2-1 1" />
  </svg>
);

const MindbodyIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.6 12 20 12 20Z" />
  </svg>
);

const SportGenericIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 3v18M3 12h18" />
  </svg>
);

const LivsstilIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.5-9-9c-1.3-3 .8-7 4.3-7 2 0 3.4 1.2 4.7 3 1.3-1.8 2.7-3 4.7-3 3.5 0 5.6 4 4.3 7-2 4.5-9 9-9 9Z" />
  </svg>
);

const TeknologiIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M9 20h6M12 16v4" />
  </svg>
);

const RehabIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21Z" />
    <path strokeLinecap="round" d="M9.5 11h2v-2h1v2h2v1h-2v2h-1v-2h-2Z" />
  </svg>
);

const ErnaeringIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3c0 4-2 4-2 8a6 6 0 0 0 12 0c0-4-2-4-2-8" />
    <path strokeLinecap="round" d="M8 21h8M12 17v4" />
  </svg>
);

const HelseIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 8v8M8 12h8" />
  </svg>
);

const KondisjonIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 14l4-5 3 3 4-6 4 5 3-3" />
  </svg>
);

export const SPORT_ICON_KEYWORDS: { keywords: string[]; label: string; icon: ReactNode }[] = [
  { keywords: ['håndball', 'handball'], label: 'Håndball', icon: <HandballIcon className="h-8 w-8" /> },
  { keywords: ['fotball', 'football', 'soccer'], label: 'Fotball', icon: <FootballIcon className="h-8 w-8" /> },
  {
    keywords: ['karate', 'judo', 'taekwondo', 'boksing', 'boxing', 'kampsport', 'mma', 'bryting', 'aikido'],
    label: 'Kampsport',
    icon: <MartialArtsIcon className="h-8 w-8" />,
  },
  { keywords: ['ski', 'skiløype', 'skigruppe', 'alpint', 'slalåm', 'slalom'], label: 'Ski', icon: <SkiIcon className="h-8 w-8" /> },
  { keywords: ['svømming', 'svømmeklubb', 'swim'], label: 'Svømming', icon: <SwimmingIcon className="h-8 w-8" /> },
  { keywords: ['tennis', 'padel'], label: 'Tennis', icon: <TennisIcon className="h-8 w-8" /> },
  { keywords: ['basketball', 'basket'], label: 'Basketball', icon: <BasketballIcon className="h-8 w-8" /> },
  { keywords: ['volleyball', 'volley'], label: 'Volleyball', icon: <VolleyballIcon className="h-8 w-8" /> },
  { keywords: ['badminton'], label: 'Badminton', icon: <BadmintonIcon className="h-8 w-8" /> },
  { keywords: ['yoga', 'pilates'], label: 'Yoga', icon: <YogaIcon className="h-8 w-8" /> },
  {
    keywords: ['styrke', 'vektløfting', 'crossfit', 'styrketrening', 'weightlifting'],
    label: 'Styrke',
    icon: <StrengthIcon className="h-8 w-8" />,
  },
  { keywords: ['løping', 'løpeklubb', 'kondisjon', 'running', 'maraton'], label: 'Løping', icon: <RunningIcon className="h-8 w-8" /> },
];

export const TYPE_FALLBACK_ICON: Record<ServiceType, ReactNode> = {
  styrke: <StrengthIcon className="h-8 w-8" />,
  kondisjon: <KondisjonIcon className="h-8 w-8" />,
  gruppe: <GroupIcon className="h-8 w-8" />,
  yoga: <YogaIcon className="h-8 w-8" />,
  mindbody: <MindbodyIcon className="h-8 w-8" />,
  spesialisert: <RehabIcon className="h-8 w-8" />,
  livsstil: <LivsstilIcon className="h-8 w-8" />,
  outdoor: <OutdoorIcon className="h-8 w-8" />,
  sport: <SportGenericIcon className="h-8 w-8" />,
  pt: <PtIcon className="h-8 w-8" />,
  teknologi: <TeknologiIcon className="h-8 w-8" />,
  rehab: <RehabIcon className="h-8 w-8" />,
  ernæring: <ErnaeringIcon className="h-8 w-8" />,
  helse: <HelseIcon className="h-8 w-8" />,
};

export function getServiceIllustration({ type, name }: { type: ServiceType; name: string }): ReactNode {
  const lowerName = (name || '').toLowerCase();
  for (const entry of SPORT_ICON_KEYWORDS) {
    if (entry.keywords.some((keyword) => lowerName.includes(keyword))) {
      return entry.icon;
    }
  }
  return TYPE_FALLBACK_ICON[type] ?? <SportGenericIcon className="h-8 w-8" />;
}
