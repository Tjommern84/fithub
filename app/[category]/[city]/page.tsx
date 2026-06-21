import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { CATEGORIES, getCategoryConfig, parseMainCategory } from '../../../lib/categoryConfig';
import { cityCoordinates, cityDisplayNames } from '../../../lib/matching';
import { searchServices } from '../../../lib/matchingDb';
import type { RankedService } from '../../../lib/matching';
import { serviceTypeLabels } from '../../../lib/resultFilters';
import LocalHighlights from '../../../components/LocalHighlights';

export const revalidate = 86400;

function capitalizeCity(city: string) {
  return city.charAt(0).toUpperCase() + city.slice(1);
}

export function generateStaticParams() {
  const cities = Object.keys(cityCoordinates);
  return CATEGORIES.flatMap((cat) =>
    cities.map((city) => ({ category: cat.key, city }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: { category: string; city: string };
}): Promise<Metadata> {
  const catConfig = getCategoryConfig(params.category);
  if (!catConfig) return { title: 'FitHub' };
  const displayCity = capitalizeCity(params.city);
  const title = `${catConfig.label} i ${displayCity}`;
  const description = `Finn ${catConfig.description.toLowerCase()} nær ${displayCity}. Sammenlign tilbydere på FitHub.`;
  return {
    title,
    description,
    alternates: {
      canonical: `https://fithub.no/${params.category}/${params.city}`,
    },
    openGraph: { title, description, type: 'website' },
  };
}

function ServiceCard({ item, resultsUrl }: { item: RankedService; resultsUrl: string }) {
  const { service } = item;
  const typeLabel = (serviceTypeLabels as Record<string, string>)[service.type] ?? service.type;
  const profileHref = `/tilbyder/${encodeURIComponent(service.id)}?${new URLSearchParams({ from: resultsUrl }).toString()}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: service.name,
    description: service.description || undefined,
    address: service.address
      ? { '@type': 'PostalAddress', streetAddress: service.address, addressCountry: 'NO' }
      : undefined,
    telephone: service.phone ? `+47${service.phone}` : undefined,
    email: service.email || undefined,
    url: service.website
      ? service.website.startsWith('http')
        ? service.website
        : `https://${service.website}`
      : undefined,
    aggregateRating:
      service.rating_avg > 0
        ? { '@type': 'AggregateRating', ratingValue: service.rating_avg, ratingCount: service.rating_count }
        : undefined,
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {service.cover_image_url && (
        <Link href={profileHref} className="relative block h-28 w-full overflow-hidden">
          <Image
            src={service.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover transition-transform hover:scale-105"
          />
        </Link>
      )}
      <div className="p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {service.logo_image_url && (
              <Image
                src={service.logo_image_url}
                alt=""
                width={28}
                height={28}
                className="rounded-full object-cover shrink-0 border border-slate-100"
              />
            )}
            <Link
              href={profileHref}
              className="font-semibold text-slate-900 text-base leading-snug hover:text-rose-700 transition-colors"
            >
              {service.name}
            </Link>
          </div>
          {service.description && (
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">{service.description}</p>
          )}
        </div>
        <span className="shrink-0 mt-1 sm:mt-0 text-xs font-medium text-slate-400">{typeLabel}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {typeof item.distanceKm === 'number' && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            {item.distanceKm.toFixed(1)} km
          </span>
        )}
        {service.rating_avg > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            ★ {service.rating_avg.toFixed(1)}
          </span>
        )}
        {Array.isArray(service.tags) && service.tags.includes('paraidrett') && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            ♿ Paraidrett
          </span>
        )}
      </div>

      {(service.address || service.phone || service.website) && (
        <div className="mt-3 space-y-0.5 text-xs text-slate-500">
          {service.address && <p>📍 {service.address}</p>}
          {service.phone && (
            <p>
              📞{' '}
              <a href={`tel:+47${service.phone}`} className="hover:underline">
                {service.phone}
              </a>
            </p>
          )}
          {service.website && (
            <p>
              🌐{' '}
              <a
                href={service.website.startsWith('http') ? service.website : `https://${service.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {service.website.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100">
        <Link
          href={profileHref}
          className="text-xs font-medium text-rose-600 hover:text-rose-800 transition-colors"
        >
          Se full profil →
        </Link>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      </div>
    </div>
  );
}

export default async function CategoryCityPage({
  params,
}: {
  params: { category: string; city: string };
}) {
  const mainCategory = parseMainCategory(params.category);
  if (!mainCategory) notFound();

  const coords = cityCoordinates[params.city];
  if (!coords) notFound();

  const catConfig = getCategoryConfig(mainCategory)!;
  const displayCity = capitalizeCity(params.city);
  const { theme } = catConfig;

  let results: RankedService[] = [];
  try {
    results = await searchServices({
      mainCategory,
      city: params.city,
      lat: coords.lat,
      lon: coords.lon,
      sort: 'nearest',
      limit: 20,
    });
  } catch {
    // render page with empty results rather than crashing
  }

  const resultsUrl = `/resultater?cat=${params.category}&location=${encodeURIComponent(displayCity)}&lat=${coords.lat}&lon=${coords.lon}`;
  const pageUrl = `https://fithub.no/${params.category}/${params.city}`;
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'FitHub', item: 'https://fithub.no' },
      { '@type': 'ListItem', position: 2, name: catConfig.label, item: `https://fithub.no/${params.category}` },
      { '@type': 'ListItem', position: 3, name: displayCity, item: pageUrl },
    ],
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {/* Category header */}
      <div style={{ background: theme.headerBg, position: 'relative' }}>
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
            background: `linear-gradient(90deg, ${theme.barStart}, ${theme.barEnd})`,
          }}
        />
        <div className="max-w-5xl mx-auto px-4 pt-7 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs mb-5"
            style={{ color: theme.subColor }}
          >
            ← Tilbake
          </Link>
          <h1
            className="font-barlow text-4xl font-bold leading-tight"
            style={{ color: theme.titleColor, letterSpacing: '-0.01em' }}
          >
            {catConfig.label} i {displayCity}
          </h1>
          <p className="mt-1 text-sm" style={{ color: theme.subColor }}>
            {catConfig.description}
          </p>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {results.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-slate-500 text-sm">Ingen treff i {displayCity} akkurat nå.</p>
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-rose-600 hover:underline">
              ← Gå tilbake
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-slate-500">{results.length} tilbydere nær {displayCity}</p>
              <Link
                href={resultsUrl}
                className="text-sm font-medium rounded-full px-4 py-1.5 transition-colors"
                style={{ background: theme.accent, color: '#fff' }}
              >
                Filtrer og søk videre
              </Link>
            </div>
            <div className="space-y-3">
              {results.map((item) => (
                <ServiceCard key={item.service.id} item={item} resultsUrl={resultsUrl} />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href={resultsUrl}
                className="inline-block rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
                style={{ background: theme.accent, color: '#fff' }}
              >
                Se alle og filtrer på tag →
              </Link>
            </div>
          </>
        )}
        <LocalHighlights
          cityKey={params.city}
          cityLabel={cityDisplayNames[params.city] ?? displayCity}
          className="mt-10"
        />
      </div>
    </main>
  );
}
