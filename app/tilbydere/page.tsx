import type { Metadata } from 'next';
import Link from 'next/link';
import { container } from '../../lib/ui';

export const metadata: Metadata = {
  title: 'For tilbydere – FitHub',
  description: 'List treningssenteret, PT-tjenesten eller gruppetimene dine på FitHub og nå nye kunder lokalt.',
};

export default function TilbydersidePage() {
  return (
    <main className={`${container} py-16`}>
      <h1 className="font-heading text-3xl font-extrabold text-brand-forest">For tilbydere</h1>
      <p className="mt-4 max-w-2xl text-sm text-slate-600">
        Driver du et treningssenter, jobber som personlig trener, eller arrangerer gruppetimer
        eller friluftsaktiviteter? FitHub hjelper deg nå nye kunder i ditt lokalområde — gratis å
        bli oppført, ingen bindingstid.
      </p>
      <p className="mt-4 max-w-2xl text-sm text-slate-600">
        Send oss en e-post for å komme i gang, eller hvis du allerede er oppført og vil oppdatere
        eller kreve eierskap til profilen din.
      </p>

      <a
        href="mailto:post@fithub.no?subject=List%20meg%20p%C3%A5%20FitHub"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-copper px-5 text-sm font-semibold text-white transition hover:bg-brand-copperHover"
      >
        Kontakt oss på e-post
      </a>

      <div>
        <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-slate-700 underline">
          Tilbake til forsiden
        </Link>
      </div>
    </main>
  );
}
