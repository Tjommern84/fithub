export type ProfileCompletenessInput = {
  description: string | null;
  coverImageUrl: string | null;
  logoImageUrl: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  goals: string[];
  venues: string[];
};

export type ProfileCompleteness = {
  percentage: number;
  missing: string[];
};

const hasText = (value: string | null, minimumLength = 1) =>
  Boolean(value && value.trim().length >= minimumLength);

export function getProfileCompleteness(profile: ProfileCompletenessInput): ProfileCompleteness {
  const checks = [
    { complete: hasText(profile.description, 80), label: 'Skriv en beskrivelse på minst 80 tegn' },
    { complete: hasText(profile.coverImageUrl), label: 'Last opp et coverbilde' },
    { complete: hasText(profile.logoImageUrl), label: 'Last opp en logo' },
    { complete: hasText(profile.address), label: 'Legg inn besøksadresse' },
    { complete: hasText(profile.website), label: 'Legg inn nettsiden din' },
    {
      complete: hasText(profile.phone) || hasText(profile.email),
      label: 'Legg inn telefon eller e-post',
    },
    { complete: profile.tags.length >= 3, label: 'Velg minst tre relevante stikkord' },
    {
      complete: profile.goals.length > 0 && profile.venues.length > 0,
      label: 'Velg mål og hvor tjenesten tilbys',
    },
  ];

  const completed = checks.filter((check) => check.complete).length;
  return {
    percentage: Math.round((completed / checks.length) * 100),
    missing: checks.filter((check) => !check.complete).map((check) => check.label),
  };
}
