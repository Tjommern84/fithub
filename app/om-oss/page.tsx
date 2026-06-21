import type { Metadata } from 'next';
import Link from 'next/link';
import { container } from '../../lib/ui';

export const metadata: Metadata = {
  title: 'Om oss – FitHub',
  description: 'FitHub kobler deg med treningssentre, personlige trenere, gruppetimer og friluftsaktiviteter over hele Norge.',
};

export default function OmOssPage() {
  return (
    <main className={`${container} py-16`}>
      <h1 className="font-heading text-3xl font-extrabold text-brand-forest">Om oss</h1>
      <p className="mt-4 max-w-2xl text-sm text-slate-600">
        FitHub er en nordisk aktivitetsplattform som gjør det enkelt å finne treningssenter,
        personlig trener, gruppetimer og friluftsaktiviteter nær deg — gratis og uforpliktende.
        Vi formidler kontakt mellom deg og lokale tilbydere, uten mellomledd og uten binding.
      </p>
      <p className="mt-4 max-w-2xl text-sm text-slate-600">
        Tjenesten er under aktiv utvikling. Har du tilbakemeldinger eller ønsker å samarbeide med
        oss, hører vi gjerne fra deg på{' '}
        <a href="mailto:post@fithub.no" className="font-semibold text-brand-copper hover:underline">
          post@fithub.no
        </a>
        .
      </p>

      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-slate-700 underline">
        Tilbake til forsiden
      </Link>
    </main>
  );
}
