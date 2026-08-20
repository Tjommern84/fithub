import Image from 'next/image';
import Link from 'next/link';
import AuthButton from './AuthButton';
import ConditionalSearchBar from './ConditionalSearchBar';
import ExploreActivitiesLink from './ExploreActivitiesLink';
import { container } from '../lib/ui';

export default function TopNav() {
  return (
    <header className="sticky top-0 z-header border-b border-black/10 bg-brand-forest">
      {/* Rad 1: logo + navigasjon */}
      <div className={`${container} grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4`}>
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image src="/images/fithublogo.png" alt="" width={42} height={42} className="rounded-md" />
          <span className="font-heading text-3xl font-bold tracking-wide text-white">fithub.no</span>
        </Link>
        <nav className="hidden items-center justify-center gap-6 md:flex">
          <ExploreActivitiesLink className="text-2xl font-medium text-white/70 transition hover:text-white">
            Utforsk aktiviteter
          </ExploreActivitiesLink>
          <Link href="/om-oss" className="text-2xl font-medium text-white/70 transition hover:text-white">
            Om oss
          </Link>
        </nav>
        <div className="flex shrink-0 items-center justify-self-end gap-2">
          <AuthButton />
        </div>
      </div>

      {/* Rad 2: lokasjonssøk — full bredde */}
      <div className={`${container} pb-3`}>
        <ConditionalSearchBar />
      </div>
    </header>
  );
}
