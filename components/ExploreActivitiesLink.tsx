'use client';

import Link from 'next/link';
import { useLocation } from '../lib/locationContext';

type ExploreActivitiesLinkProps = {
  className?: string;
  children: React.ReactNode;
};

// Bygger /resultater-lenken med gjeldende lokasjon som query-params — samme
// param-mønster som HomeHeroSearchBar.tsx sin submit. Fallback til ren
// /resultater (ingen params) skjer kun i det korte vinduet før
// LocationProvider sin mount-effekt har satt Oslo-default (millisekunder).
export default function ExploreActivitiesLink({ className, children }: ExploreActivitiesLinkProps) {
  const { location } = useLocation();

  const href = (() => {
    if (!location) return '/resultater';
    const params = new URLSearchParams();
    params.set('location', location.label);
    if (location.city) params.set('city', location.city);
    params.set('lat', String(location.lat));
    params.set('lon', String(location.lon));
    if (location.radius !== null) params.set('radius', String(location.radius));
    return `/resultater?${params.toString()}`;
  })();

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
