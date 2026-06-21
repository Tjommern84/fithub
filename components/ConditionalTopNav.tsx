'use client';

import { usePathname } from 'next/navigation';
import TopNav from './TopNav';

// Forsiden bygger sin egen transparente navigasjon inni HomeHero (flyter over
// hero-bildet) — den vanlige mørke, sticky TopNav skal ikke også rendres der.
// Alle andre sider er uendret.
export default function ConditionalTopNav() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <TopNav />;
}
