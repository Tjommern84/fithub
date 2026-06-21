'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import SearchLocationBar from './SearchLocationBar';

// Forsiden har sin egen søkebar i HomeHero — unngå to synlige søkefelt stablet
// på samme side. Alle andre sider (inkl. /resultater) er uendret.
export default function ConditionalSearchBar() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return (
    <Suspense fallback={<div className="h-10" />}>
      <SearchLocationBar />
    </Suspense>
  );
}
