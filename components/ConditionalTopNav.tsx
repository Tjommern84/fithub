'use client';

import { usePathname } from 'next/navigation';
import TopNav from './TopNav';

// Disse sidene bygger sin egen transparente ScrollAwareTopNav inni sin hero —
// den vanlige mørke, sticky TopNav skal ikke rendres der.
const HERO_PATHS = ['/', '/resultater', '/tur'];

export default function ConditionalTopNav() {
  const pathname = usePathname();
  if (HERO_PATHS.includes(pathname)) return null;
  return <TopNav />;
}
