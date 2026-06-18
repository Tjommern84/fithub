import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { cityCoordinates, cityDisplayNames } from '../../../lib/matching';
import { searchServices } from '../../../lib/matchingDb';
import type { RankedService } from '../../../lib/matching';

export const revalidate = 86400;

const theme = {
  headerBg:   '#0A1A0E',
  titleColor: '#A7F3C0',
  subColor:   '#6EE7A0',
  accent:     '#16A34A',
  barStart:   '#15803D',
  barEnd:     '#4ADE80',
};

function capitalizeCity(city: string) {
  return cityDisplayNames[city] ?? city.charAt(0).toUpperCase() + city.slice(1);
}

export function generateStaticParams() {
  return Object.keys(cityCoordinates).map((city) => ({ city }));
}

export async function generateMetadata({
  params,
}: {
  params: { city: string };
}): Promise<Metadata> {
  const coords = cityCoordinates[params.city];
  if (!coords) return { title: 'FitHub' };
  const displayCity = capitalizeCity(params.city);
  const title = `Tufteparker i ${displayCity} – gratis utendørs trening`;
  const description = `Finn gratis tufteparker og utendørs treningsplasser i ${displayCity}. Tren styrke og kondisjon utendørs, uten medlemskap.`;
  return {
    title,
    description,
    alternates: {
      canonical: `https://fithub.no/tuftepark/${params.city}`,
    },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function TufteparkCityPage({
  params,
}: {
  params: { city: string };
}) {
  const coords = cityCoordinates[params.city];
  if (!coords) notFound();

  const displayCity = capitalizeCity(params.city);

  let results: RankedService[] = [];
  try {
    results = await searchServices({
      mainCategory: 'aktivitet-sport',
      tags: ['tuftepark'],
      city: params.city,
      lat: coords.lat,
      lon: coords.lon,
      sort: 'nearest',
      limit: 30,
    });
  } catch {
    // vis tom side heller enn å krasje
  }

  const resultsUrl = `/resultater?cat=utendors&tags=tuftepark&location=${encodeURIComponent(displayCity)}&lat=${coords.lat}&lon=${coords.lon}`;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'FitHub', item: 'https://fithub.no' },
      { '@type': 'ListItem', position: 2, name: 'Tufteparker', item: 'https://fithub.no/tuftepark/oslo' },
      { '@type': 'ListItem', position: 3, name: displayCity, item: `https://fithub.no/tuftepark/${params.city}` },
    ],
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* Header */}
      <div style={{ background: theme.headerBg, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: `linear-gradient(90deg, ${theme.barStart}, ${theme.barEnd})`,
        }} />
        <div className="max-w-5xl mx-auto px-4 pt-7 pb-6">
          <Link href="/" className="inline-flex items-center gap-1 text-xs mb-5"
            style={{ color: theme.subColor }}>
            ← Tilbake
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌳</span>
            <div>
              <h1 className="font-barlow text-4xl font-bold leading-tight"
                style={{ color: theme.titleColor, letterSpacing: '-0.01em' }}>
                Tufteparker i {displayCity}
              </h1>
              <p className="mt-1 text-sm" style={{ color: theme.subColor }}>
                Gratis utendørs trening — åpent for alle, hele året
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: '#15803D', color: '#F0FDF4' }}>
              ✓ Gratis
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: '#166534', color: '#F0FDF4' }}>
              ✓ Ingen medlemskap
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: '#14532D', color: '#F0FDF4' }}>
              ✓ Åpent hele døgnet
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {results.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-2xl mb-3">🌱</p>
            <p className="text-slate-600 text-sm font-medium">
              Vi holder på å kartlegge tufteparker i {displayCity}.
            </p>
            <p className="mt-1 text-slate-400 text-xs">
              Vet du om en tuftepark som mangler?{' '}
              <Link href="/kontakt" className="underline hover:text-slate-600">
                Tips oss
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-slate-500">
                {results.length} {results.length === 1 ? 'tuftepark' : 'tufteparker'} i {displayCity}
              </p>
              <Link
                href={resultsUrl}
                className="text-sm font-medium rounded-full px-4 py-1.5 text-white transition-colors"
                style={{ background: theme.accent }}
              >
                Se kart og filtrer
              </Link>
            </div>

            <div className="space-y-3">
              {results.map((item) => {
                const { service } = item;
                const jsonLd = {
                  '@context': 'https://schema.org',
                  '@type': 'SportsActivityLocation',
                  name: service.name,
                  description: service.description || undefined,
                  address: service.address
                    ? { '@type': 'PostalAddress', streetAddress: service.address, addressLocality: displayCity, addressCountry: 'NO' }
                    : undefined,
                  isAccessibleForFree: true,
                };
                return (
                  <div key={service.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <script type="application/ld+json"
                      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🌳</span>
                          <h2 className="font-semibold text-slate-900">{service.name}</h2>
                        </div>
                        {service.address && (
                          <p className="mt-1 text-sm text-slate-500">📍 {service.address}</p>
                        )}
                        {service.description && (
                          <p className="mt-1 text-sm text-slate-500">{service.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          Gratis
                        </span>
                        {typeof item.distanceKm === 'number' && (
                          <span className="text-xs text-slate-400">
                            {item.distanceKm.toFixed(1)} km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <Link
                href={resultsUrl}
                className="inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-colors"
                style={{ background: theme.accent }}
              >
                Se alle på kart →
              </Link>
            </div>
          </>
        )}

        {/* Info-boks */}
        <div className="mt-10 rounded-xl border border-green-100 bg-green-50 p-6">
          <h2 className="font-semibold text-green-900 text-base">Hva er en tuftepark?</h2>
          <p className="mt-2 text-sm text-green-800">
            Tufteparker er gratis utendørs treningsplasser med fast utstyr for styrke, kondisjon og balanse.
            De er åpne hele døgnet, krever ingen påmelding og er for alle aldre og nivåer.
            Perfekt for en rask treningsøkt alene eller i gruppe.
          </p>
          <p className="mt-3 text-sm text-green-700">
            Vil du trene med en gruppe eller ha veiledning?{' '}
            <Link
              href={`/resultater?cat=utendors&tags=utetrening&location=${encodeURIComponent(displayCity)}&lat=${coords.lat}&lon=${coords.lon}`}
              className="font-medium underline"
            >
              Se utendørs gruppetrening i {displayCity}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
