'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RankedService } from '../../lib/matching';
import type { UnanchoredService, FallbackNotice } from '../../lib/matchingDb';
import { serviceTypeLabels } from '../../lib/resultFilters';
import { CATEGORIES } from '../../lib/categoryConfig';
import type { CategoryConfig } from '../../lib/categoryConfig';
import type { GroupSession } from '../../lib/groupSessions';
import GroupSessionCard from '../../components/GroupSessionCard';
import { useLocation } from '../../lib/locationContext';
import { getServiceIllustration } from '../../lib/serviceIllustrations';
import ReportIssueModal from '../../components/ReportIssueModal';

const ServiceMap = dynamic(() => import('../../components/ServiceMap'), { ssr: false });

type Props = {
  results: RankedService[];
  unanchoredResults?: UnanchoredService[];
  fallbackNotice?: FallbackNotice;
  groupSessions?: GroupSession[];
  categoryLabel: string;
  locationLabel: string | null;
  centerLat?: number;
  centerLon?: number;
  radiusKm?: number;
  currentPage?: number;
  pageSize?: number;
};

type SearchHereCoords = { lat: number; lon: number; label: string; city: string | null };
type SearchHereFn = (coords: SearchHereCoords) => void;

function SearchHereButton({
  lat,
  lon,
  label,
  city,
  onSearchHere,
}: {
  lat: number;
  lon: number;
  label: string;
  city: string | null;
  onSearchHere?: SearchHereFn;
}) {
  if (!onSearchHere) return null;
  return (
    <button
      type="button"
      onClick={() => onSearchHere({ lat, lon, label, city })}
      title="Søk her i stedet"
      className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
    >
      📍 Søk her i stedet
    </button>
  );
}

function ServiceCard({
  item,
  searchQueryString,
  onSearchHere,
}: {
  item: RankedService;
  searchQueryString: string;
  onSearchHere?: SearchHereFn;
}) {
  const { service } = item;
  const typeLabel =
    (serviceTypeLabels as Record<string, string>)[service.type] ?? service.type;
  const profileHref = `/tilbyder/${encodeURIComponent(service.id)}${searchQueryString ? `?${searchQueryString}` : ''}`;
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {service.cover_image_url ? (
        <Link href={profileHref} className="relative block h-28 w-full overflow-hidden">
          <Image
            src={service.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover transition-transform hover:scale-105"
          />
        </Link>
      ) : (
        <Link
          href={profileHref}
          className="flex h-28 w-full items-center justify-center bg-brand-cream text-brand-copper"
        >
          {getServiceIllustration(service)}
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
        <span className="shrink-0 mt-1 sm:mt-0 text-xs font-medium text-slate-400">
          {typeLabel}
        </span>
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.matchReason && (
          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
            {item.matchReason}
          </span>
        )}
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

      {/* Contact info */}
      {(service.address || service.phone || service.email || service.website) && (
        <div className="mt-3 space-y-0.5 text-xs text-slate-500">
          {service.address && <p>📍 {service.address}</p>}
          {service.phone && (
            <p>
              📞{' '}
              <a href={`tel:+47${service.phone}`} className="hover:underline hover:text-slate-700">
                {service.phone}
              </a>
            </p>
          )}
          {service.email && (
            <p>
              ✉️{' '}
              <a href={`mailto:${service.email}`} className="hover:underline hover:text-slate-700">
                {service.email}
              </a>
            </p>
          )}
          {service.website && (
            <p>
              🌐{' '}
              <a
                href={
                  service.website.startsWith('http')
                    ? service.website
                    : `https://${service.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-slate-700"
              >
                {service.website.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={profileHref}
            className="text-xs font-medium text-rose-600 hover:text-rose-800 transition-colors"
          >
            Se full profil →
          </Link>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            Rapporter feil
          </button>
        </div>
        {item.lat != null && item.lon != null && (
          <SearchHereButton
            lat={item.lat}
            lon={item.lon}
            label={service.city ?? service.name}
            city={service.city ?? null}
            onSearchHere={onSearchHere}
          />
        )}
      </div>

      <ReportIssueModal
        serviceId={service.id}
        serviceName={service.name}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
          }),
        }}
      />
      </div>
    </div>
  );
}

function UnanchoredServiceCard({
  item,
  searchQueryString,
  onSearchHere,
}: {
  item: UnanchoredService;
  searchQueryString: string;
  onSearchHere?: SearchHereFn;
}) {
  const typeLabel = (serviceTypeLabels as Record<string, string>)[item.type] ?? item.type;
  const profileHref = `/tilbyder/${encodeURIComponent(item.id)}${searchQueryString ? `?${searchQueryString}` : ''}`;
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {item.cover_image_url ? (
        <Link href={profileHref} className="relative block h-28 w-full overflow-hidden">
          <Image
            src={item.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover transition-transform hover:scale-105"
          />
        </Link>
      ) : (
        <Link
          href={profileHref}
          className="flex h-28 w-full items-center justify-center bg-brand-cream text-brand-copper"
        >
          {getServiceIllustration(item)}
        </Link>
      )}
      <div className="p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {item.logo_image_url && (
                <Image
                  src={item.logo_image_url}
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
                {item.name}
              </Link>
            </div>
            {item.description && (
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{item.description}</p>
            )}
          </div>
          <span className="shrink-0 mt-1 sm:mt-0 text-xs font-medium text-slate-400">
            {typeLabel}
          </span>
        </div>

        {/* Badges — nøytral/amber stil, IKKE samme palett som matchReason-badgen */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            📍 Utenfor ditt område{item.city ? ` — ${item.city}` : ''}
          </span>
          {item.rating_avg > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              ★ {item.rating_avg.toFixed(1)}
            </span>
          )}
        </div>

        {(item.address || item.phone || item.email || item.website) && (
          <div className="mt-3 space-y-0.5 text-xs text-slate-500">
            {item.address && <p>📍 {item.address}</p>}
            {item.phone && (
              <p>
                📞{' '}
                <a href={`tel:+47${item.phone}`} className="hover:underline hover:text-slate-700">
                  {item.phone}
                </a>
              </p>
            )}
            {item.email && (
              <p>
                ✉️{' '}
                <a href={`mailto:${item.email}`} className="hover:underline hover:text-slate-700">
                  {item.email}
                </a>
              </p>
            )}
            {item.website && (
              <p>
                🌐{' '}
                <a
                  href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:text-slate-700"
                >
                  {item.website.replace(/^https?:\/\//, '')}
                </a>
              </p>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={profileHref}
              className="text-xs font-medium text-rose-600 hover:text-rose-800 transition-colors"
            >
              Se full profil →
            </Link>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              Rapporter feil
            </button>
          </div>
          {item.lat != null && item.lon != null && (
            <SearchHereButton
              lat={item.lat}
              lon={item.lon}
              label={item.city ?? item.name}
              city={item.city}
              onSearchHere={onSearchHere}
            />
          )}
        </div>
      </div>

      <ReportIssueModal
        serviceId={item.id}
        serviceName={item.name}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}

function FallbackNoticeBanner({ notice }: { notice: FallbackNotice }) {
  if (!notice || notice.tier !== 2) return null;
  return (
    <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      ℹ️ {notice.message}
    </div>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
      style={copied
        ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' }
        : { background: '#fff', border: '1px solid #E5E7EB', color: '#6B7280' }
      }
    >
      {copied ? '✓ Kopiert' : '⎘ Del søk'}
    </button>
  );
}

function ResultSection({
  title,
  items,
  prevPageUrl,
  nextPageUrl,
  currentPage,
  searchQueryString,
  onSearchHere,
}: {
  title: string;
  items: RankedService[];
  prevPageUrl?: string;
  nextPageUrl?: string;
  currentPage?: number;
  searchQueryString: string;
  onSearchHere?: SearchHereFn;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-700 mb-3">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <ServiceCard
            key={item.service.id}
            item={item}
            searchQueryString={searchQueryString}
            onSearchHere={onSearchHere}
          />
        ))}
      </div>
      {(prevPageUrl || nextPageUrl) && (
        <div className="mt-6 flex items-center justify-between gap-3">
          {prevPageUrl ? (
            <Link
              href={prevPageUrl}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-center text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ← Forrige side
            </Link>
          ) : <div className="flex-1" />}
          {currentPage && (
            <span className="text-xs text-slate-400">Side {currentPage}</span>
          )}
          {nextPageUrl ? (
            <Link
              href={nextPageUrl}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-center text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Neste side →
            </Link>
          ) : <div className="flex-1" />}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  searchParams,
  catConfig,
  locationLabel,
  radiusKm,
}: {
  searchParams: ReturnType<typeof useSearchParams>;
  catConfig: CategoryConfig | null;
  locationLabel: string | null;
  radiusKm: number;
}) {
  const city = locationLabel?.split(',')[0].trim() ?? null;

  const widerRadiusParams = new URLSearchParams(searchParams.toString());
  widerRadiusParams.set('radius', String(radiusKm <= 10 ? 25 : 50));
  const widerRadiusUrl = `/resultater?${widerRadiusParams.toString()}`;

  const allInCityParams = new URLSearchParams();
  if (city) allInCityParams.set('location', city);
  const allInCityUrl = city ? `/resultater?${allInCityParams.toString()}` : '/';

  const otherCategories = CATEGORIES.filter((c) => c.key !== catConfig?.key).slice(0, 3);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-10">
      <p className="text-slate-700 font-medium text-base mb-1">Ingen treff her</p>
      <p className="text-slate-400 text-sm mb-6">
        {catConfig && city
          ? `Vi fant ingen ${catConfig.label.toLowerCase()} innenfor ${radiusKm} km fra ${city}.`
          : 'Ingen treff for dette søket akkurat nå.'}
      </p>

      <div className="flex flex-col gap-2">
        {radiusKm < 50 && (
          <Link
            href={widerRadiusUrl}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="text-lg">🔍</span>
            <span>Prøv med større søkeradius ({radiusKm <= 10 ? '25' : '50'} km)</span>
          </Link>
        )}
        {city && (
          <Link
            href={allInCityUrl}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="text-lg">📍</span>
            <span>Se alle tilbydere nær {city}</span>
          </Link>
        )}
        {otherCategories.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Andre kategorier</p>
            <div className="flex flex-wrap gap-2">
              {otherCategories.map((c) => {
                const params = new URLSearchParams();
                params.set('cat', c.key);
                if (city) params.set('location', city);
                const copyParams = new URLSearchParams(searchParams.toString());
                copyParams.set('cat', c.key);
                copyParams.delete('tags');
                return (
                  <Link
                    key={c.key}
                    href={`/resultater?${copyParams.toString()}`}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{ background: c.theme.badgeBg, color: c.theme.badgeText }}
                  >
                    {c.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        <Link
          href="/"
          className="mt-2 text-center text-sm text-rose-600 hover:underline"
        >
          ← Tilbake til forsiden
        </Link>
      </div>
    </div>
  );
}

export default function ResultsView({
  results,
  unanchoredResults = [],
  fallbackNotice = null,
  groupSessions = [],
  categoryLabel,
  locationLabel,
  centerLat,
  centerLon,
  radiusKm = 10,
  currentPage = 1,
  pageSize = 50,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { location, setLocation } = useLocation();

  // Fire-and-forget: background city refresh (24hr cooldown enforced server-side)
  useEffect(() => {
    const city = locationLabel?.split(',')[0].trim().toLowerCase();
    if (!city) return;
    fetch('/api/refresh-city', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city }),
    }).catch(() => { /* ignore errors — this is best-effort */ });
  }, [locationLabel]);

  const cat = searchParams.get('cat');
  const activeTags = (searchParams.get('tags') ?? '').split(',').filter(Boolean);
  const catConfig = CATEGORIES.find((c) => c.key === cat) ?? null;

  const handleTagToggle = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const next = activeTags.includes(value)
        ? activeTags.filter((t) => t !== value)
        : [...activeTags, value];
      if (next.length > 0) params.set('tags', next.join(','));
      else params.delete('tags');
      router.replace(`/resultater?${params.toString()}`);
    },
    [router, searchParams, activeTags]
  );

  const view = searchParams.get('view') ?? 'list';
  const hasCoords = centerLat != null && centerLon != null;

  const currentSort = searchParams.get('sort') ?? (hasCoords ? 'nearest' : 'best_match');
  const sortOptions = [
    ...(hasCoords ? [{ value: 'nearest',    label: 'Nærmest' }] : []),
    { value: 'best_match', label: 'Beste treff' },
    { value: 'rating',     label: 'Høyest rating' },
    { value: 'price_low',  label: 'Lavest pris' },
  ];

  const handleSortChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('sort', next);
      params.delete('page');
      router.replace(`/resultater?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleViewToggle = useCallback(
    (next: 'map' | 'list') => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', next);
      router.replace(`/resultater?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearchHere = useCallback(
    (coords: SearchHereCoords) => {
      setLocation({
        label: coords.label,
        city: coords.city,
        lat: coords.lat,
        lon: coords.lon,
        source: 'search',
        radius: location?.radius ?? 10,
      });
      const params = new URLSearchParams(searchParams.toString());
      params.delete('q');
      params.delete('page');
      params.set('lat', String(coords.lat));
      params.set('lon', String(coords.lon));
      params.set('location', coords.label);
      if (coords.city) params.set('city', coords.city);
      else params.delete('city');
      router.push(`/resultater?${params.toString()}`);
    },
    [location, searchParams, router, setLocation]
  );

  const hasResults = results.length > 0;
  const hasSessions = groupSessions.length > 0;
  const hasNextPage = results.length === pageSize;

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete('page');
    else params.set('page', String(p));
    return `/resultater?${params.toString()}`;
  };

  const prevPageUrl = currentPage > 1 ? buildPageUrl(currentPage - 1) : undefined;
  const nextPageUrl = hasNextPage ? buildPageUrl(currentPage + 1) : undefined;

  return (
    <div>
      {/* Tag filter panel */}
      {catConfig ? (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Create session shortcut for trene-sammen */}
          {catConfig.key === 'trene-sammen' && (
            <Link
              href="/arrangementer/nytt"
              className="shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors"
              style={{ borderColor: catConfig.theme.accent, color: catConfig.theme.accent }}
            >
              + Opprett arrangement
            </Link>
          )}
          {catConfig.tags.map((tag) => {
            const active = activeTags.includes(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => handleTagToggle(tag.value)}
                className="rounded-full px-3 py-2 text-sm font-medium transition-colors"
                style={active
                  ? { background: catConfig.theme.accent, color: '#fff' }
                  : { background: '#fff', border: '0.5px solid #E5E5E5', color: '#555' }
                }
              >
                {tag.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">{results.length} treff</span>
            <ShareButton />
          </div>
        </div>
      ) : (
        <div className="flex justify-end mb-4">
          <ShareButton />
        </div>
      )}

      {/* Sort selector */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs font-medium text-slate-400">Sorter:</span>
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSortChange(opt.value)}
            className="shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-colors"
            style={
              currentSort === opt.value
                ? { background: '#0F172A', color: '#fff' }
                : { background: '#fff', border: '1px solid #E5E7EB', color: '#6B7280' }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Mobile view toggle — only when map is available */}
      {hasCoords && (
        <div className="flex sm:hidden mb-4 rounded-xl overflow-hidden border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => handleViewToggle('list')}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={view !== 'map'
              ? { background: '#0F172A', color: '#fff' }
              : { background: '#fff', color: '#64748B' }}
          >
            Liste
          </button>
          <button
            type="button"
            onClick={() => handleViewToggle('map')}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={view === 'map'
              ? { background: '#0F172A', color: '#fff' }
              : { background: '#fff', color: '#64748B' }}
          >
            Kart
          </button>
        </div>
      )}

      {/* Map — always on desktop, toggle-controlled on mobile */}
      {hasCoords && (
        <div className={`mb-6 ${view === 'map' ? 'block' : 'hidden sm:block'}`}>
          <ServiceMap
            center={{ lat: centerLat!, lon: centerLon! }}
            radiusKm={radiusKm}
            services={results}
            locationLabel={locationLabel}
          />
        </div>
      )}

      <FallbackNoticeBanner notice={fallbackNotice} />

      <div className={`space-y-10 ${view === 'map' && hasCoords ? 'hidden sm:block' : ''}`}>
        {/* Group sessions section */}
        {hasSessions && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-700">
                Aktive arrangementer{locationLabel ? ` nær ${locationLabel.split(',')[0]}` : ''}
              </h2>
              <Link
                href="/arrangementer/nytt"
                className="text-xs font-medium text-violet-600 hover:text-violet-800"
              >
                + Opprett
              </Link>
            </div>
            <div className="space-y-3">
              {groupSessions.map((s) => (
                <GroupSessionCard key={s.id} session={s} />
              ))}
            </div>
          </div>
        )}

        {hasResults && (
          <ResultSection
            title={locationLabel ? `Nær ${locationLabel.split(',')[0]}` : 'Alle treff'}
            items={results}
            prevPageUrl={prevPageUrl}
            nextPageUrl={nextPageUrl}
            currentPage={currentPage}
            searchQueryString={searchParams.toString()}
            onSearchHere={handleSearchHere}
          />
        )}

        {unanchoredResults.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-700 mb-3">
              Andre treff (utenfor ditt område)
            </h2>
            <div className="space-y-3">
              {unanchoredResults.map((item) => (
                <UnanchoredServiceCard
                  key={item.id}
                  item={item}
                  searchQueryString={searchParams.toString()}
                  onSearchHere={handleSearchHere}
                />
              ))}
            </div>
          </div>
        )}

        {!hasResults && !hasSessions && unanchoredResults.length === 0 && (
          <EmptyState
            searchParams={searchParams}
            catConfig={catConfig}
            locationLabel={locationLabel}
            radiusKm={radiusKm}
          />
        )}
      </div>
    </div>
  );
}
