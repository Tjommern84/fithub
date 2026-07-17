'use client';

import { useEffect, useState } from 'react';
import HeroTopNav from './HeroTopNav';

export default function ScrollAwareTopNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-header transition-all duration-300',
        scrolled ? 'bg-brand-forest/90 backdrop-blur-md' : 'bg-transparent',
      ].join(' ')}
    >
      <HeroTopNav />
    </header>
  );
}
