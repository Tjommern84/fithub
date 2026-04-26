import Link from 'next/link';
import AuthButton from './AuthButton';
import LocationBar from './LocationBar';
import { container } from '../lib/ui';

export default function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className={`${container} flex h-16 items-center gap-4`}>
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-wide text-slate-900">
          fithub.no
        </Link>

        <div className="flex min-w-0 flex-1 items-center">
          <LocationBar />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
