import Link from 'next/link';
import AuthButton from './AuthButton';
import SearchLocationBar from './SearchLocationBar';
import { container } from '../lib/ui';

export default function TopNav() {
  return (
    <header className="sticky top-0 z-header border-b border-slate-200 bg-white/80 backdrop-blur">
      {/* Rad 1: logo + navigasjon */}
      <div className={`${container} flex h-12 items-center justify-between`}>
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-wide text-slate-900">
          fithub.no
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <AuthButton />
        </div>
      </div>

      {/* Rad 2: lokasjonssøk — full bredde */}
      <div className={`${container} pb-3`}>
        <SearchLocationBar />
      </div>
    </header>
  );
}
