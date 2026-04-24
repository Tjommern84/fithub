import type { Metadata } from 'next';
import Link from 'next/link';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Kontakt oss – FitHub',
  description: 'Ta kontakt med FitHub – spørsmål, tilbakemeldinger eller listeoppføring.',
};

export default function KontaktPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-8"
        >
          ← Tilbake
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Kontakt oss</h1>
        <p className="text-slate-500 text-sm mb-8">
          Vi svarer innen 1–2 virkedager. Du kan også nå oss direkte på{' '}
          <a href="mailto:post@fithub.no" className="text-rose-600 hover:underline">
            post@fithub.no
          </a>
          .
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
