import Image from 'next/image';
import Link from 'next/link';
import AuthButton from './AuthButton';
import { container } from '../lib/ui';

// Transparent navigasjon som flyter over hero-bildet på forsiden — ingen bakgrunn,
// skygge, border eller blur, jf. forside-spesifikasjonen. Brukes KUN inni HomeHero,
// ikke den vanlige (mørke, sticky) TopNav som resten av sidene bruker.
export default function HeroTopNav() {
  return (
    <div className={`${container} grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4 lg:h-20`}>
      <Link href="/" className="flex shrink-0 items-center gap-3">
        <Image src="/images/fithublogo.png" alt="" width={42} height={42} className="rounded-md" />
        <span className="font-heading text-3xl font-bold tracking-wide text-white">fithub.no</span>
      </Link>
      <nav className="hidden items-center justify-center gap-6 md:flex">
        <Link href="/resultater" className="text-sm font-medium text-white transition hover:text-white/80">
          Utforsk aktiviteter
        </Link>
        <Link href="/tilbydere" className="text-sm font-medium text-white transition hover:text-white/80">
          Tilbydere
        </Link>
        <Link href="/magasin" className="text-sm font-medium text-white transition hover:text-white/80">
          Magasin
        </Link>
        <Link href="/om-oss" className="text-sm font-medium text-white transition hover:text-white/80">
          Om oss
        </Link>
      </nav>
      <div className="flex shrink-0 items-center justify-self-end gap-2">
        <AuthButton ctaLabel="Kom i gang" ctaVariant="forest" textSizeClassName="" />
      </div>
    </div>
  );
}
