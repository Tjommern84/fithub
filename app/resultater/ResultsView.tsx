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
type TabKey = 'all' | 'business' | 'facility' | 'sessions';

// ─── SearchHereButton ─────────────────────────────────────────────────────────

function SearchHereButton({
  lat, lon, label, city, onSearchHere,
}: {
  lat: number; lon: number; label: string; city: string | null; onSearchHere?: SearchHereFn;
}) {
  if (!onSearchHere) return null;
  return (
    <button
      type="button"
      onClick={() => onSearchHere({ lat, lon, label, city })}
      className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
    >
      📍 Søk her
    </button>
  );
}

// ─── ResultCard (ny stil) ─────────────────────────────────────────────────────

function ResultCard({
  item,
  searchQueryString,
  onSearchHere,
}: {
  item: RankedService;
  searchQueryString: string;
  onSearchHere?: SearchHereFn;
}) {
  const { service } = item;
  const typeLabel = (serviceTypeLabels as Record<string, string>)[service.type] ?? service.type;
  const profileHref = `/tilbyder/${encodeURIComponent(service.id)}${searchQueryString ? `?${searchQueryString}` : ''}`;
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Bilde-topp */}
      {service.cover_image_url ? (
        <Link href={profileHref} className="relative block h-36 w-full overflow-hidden">
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
          className="flex h-36 w-full items-center justify-center bg-brand-cream text-brand-copper"
        >
          {getServiceIllustration(service)}
        </Link>
      )}

      <div className="p-5">
        {/* Navn + typelabel */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {service.logo_image_url && (
              <Image
                src={service.logo_image_url}
                alt=""
                width={28}
                height={28}
                className="shrink-0 rounded-full border border-slate-100 object-cover"
              />
            )}
            <Link
              href={profileHref}
              className="font-heading text-lg font-bold leading-snug text-slate-900 transition-colors hover:text-brand-forest"
            >
              {service.name}
            </Link>
          </div>
          <span className="mt-0.5 shrink-0 text-[11px] font-medium text-slate-400">
            {typeLabel}
          </span>
        </div>

        {/* Beskrivelse */}
        {service.description && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{service.description}</p>
        )}

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {typeof item.distanceKm === 'number' && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              {item.distanceKm.toFixed(1)} km
            </span>
          )}
          {service.rating_avg > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              ★ {service.rating_avg.toFixed(1)}
            </span>
          )}
          {service.address && (
            <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">
              {service.address}
            </span>
          )}
          {Array.isArray(service.tags) && service.tags.includes('paraidrett') && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              ♿ Paraidrett
            </span>
          )}
        </div>

        {/* Kontaktinfo (telefon, e-post, nettside) */}
        {(service.phone || service.email || service.website) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
            {service.phone && (
              <a href={`tel:+47${service.phone}`} className="transition-colors hover:text-slate-600 hover:underline">
                {service.phone}
              </a>
            )}
            {service.email && (
              <a href={`mailto:${service.email}`} className="transition-colors hover:text-slate-600 hover:underline">
                {service.email}
              </a>
            )}
            {service.website && (
              <a
                href={service.website.startsWith('http') ? service.website : `https://${service.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-slate-600 hover:underline"
              >
                {service.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        )}

        {/* Footer: CTA-er */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-3">
            <Link
              href={profileHref}
              className="text-xs font-semibold text-brand-copper transition-colors hover:text-brand-copperHover"
            >
              Se profil →
            </Link>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="text-xs text-slate-400 transition-colors hover:text-slate-600"
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
              ? service.website.startsWith('http') ? service.website : `https://${service.website}`
              : undefined,
            aggregateRating:
              service.rating_avg > 0
                ? { '@type': 'AggregateRating', ratingValue: service.rating_avg, ratingCount: service.rating_count }
                : undefined,
          }),
        }}
      />
    </div>
  );
}

// ─── UnanchoredCard ──────────────────────────────────────────────────────────

function UnanchoredCard({
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
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {item.cover_image_url ? (
        <Link href={profileHref} className="relative block h-36 w-full overflow-hidden">
          <Image src={item.cover_image_url} alt="" fill sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover transition-transform hover:scale-105" />
        </Link>
      ) : (
        <Link href={profileHref} className="flex h-36 w-full items-center justify-center bg-brand-cream text-brand-copper">
          {getServiceIllustration(item)}
        </Link>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {item.logo_image_url && (
              <Image src={item.logo_image_url} alt="" width={28} height={28}
                className="shrink-0 rounded-full border border-slate-100 object-cover" />
            )}
            <Link href={profileHref}
              className="font-heading text-lg font-bold leading-snug text-slate-900 transition-colors hover:text-brand-forest">
              {item.name}
            </Link>
          </div>
          <span className="mt-0.5 shrink-0 text-[11px] font-medium text-slate-400">{typeLabel}</span>
        </div>
        {item.description && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            📍 Utenfor ditt område{item.city ? ` — ${item.city}` : ''}
          </span>
          {item.rating_avg > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              ★ {item.rating_avg.toFixed(1)}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-3">
            <Link href={profileHref}
              className="text-xs font-semibold text-brand-copper transition-colors hover:text-brand-copperHover">
              Se profil →
            </Link>
            <button type="button" onClick={() => setReportOpen(true)}
              className="text-xs text-slate-400 transition-colors hover:text-slate-600">
              Rapporter feil
            </button>
          </div>
          {item.lat != null && item.lon != null && (
            <SearchHereButton lat={item.lat} lon={item.lon}
              label={item.city ?? item.name} city={item.city}
              onSearchHere={onSearchHere} />
          )}
        </div>
      </div>
      <ReportIssueModal serviceId={item.id} serviceName={item.name}
        open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

// ─── FallbackNoticeBanner ─────────────────────────────────────────────────────

function FallbackNoticeBanner({ notice }: { notice: FallbackNotice }) {
  if (!notice || notice.tier !== 2) return null;
  return (
    <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      ℹ️ {notice.message}
    </div>
  );
}

// ─── ShareButton ──────────────────────────────────────────────────────────────

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

// ─── EmptyState ───────────────────────────────────────────────────────────────

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
  const otherCategories = CATEGORIES.filter((c) => c.key !== catConfig?.key).slice(0, 3);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10">
      <p className="text-base font-medium text-slate-700">Ingen treff her</p>
      <p className="mt-1 text-sm text-slate-400">
        {catConfig && city
          ? `Vi fant ingen ${catConfig.label.toLowerCase()} innenfor ${radiusKm} km fra ${city}.`
          : 'Ingen treff for dette søket akkurat nå.'}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {radiusKm < 50 && (
          <Link
            href={`/resultater?${widerRadiusParams.toString()}`}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="text-lg">🔍</span>
            Prøv med større søkeradius ({radiusKm <= 10 ? '25' : '50'} km)
          </Link>
        )}
        {otherCategories.length > 0 && (
          <div className="mt-2">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Andre kategorier</p>
            <div className="flex flex-wrap gap-2">
              {otherCategories.map((c) => {
                const copyParams = new URLSearchParams(searchParams.toString());
                copyParams.set('cat', c.key);
                copyParams.delete('tags');
                return (
                  <Link key={c.key} href={`/resultater?${copyParams.toString()}`}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{ background: c.theme.badgeBg, color: c.theme.badgeText }}>
                    {c.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        <Link href="/" className="mt-2 text-center text-sm text-brand-copper hover:underline">
          ← Tilbake til forsiden
        </Link>
      </div>
    </div>
  );
}

// ─── Paginering ───────────────────────────────────────────────────────────────

function Pagination({
  prevPageUrl,
  nextPageUrl,
  currentPage,
}: {
  prevPageUrl?: string;
  nextPageUrl?: string;
  currentPage: number;
}) {
  if (!prevPageUrl && !nextPageUrl) return null;
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {prevPageUrl ? (
        <Link href={prevPageUrl}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-center text-sm text-slate-600 transition-colors hover:bg-slate-50">
          ← Forrige
        </Link>
      ) : <div className="flex-1" />}
      <span className="text-xs text-slate-400">Side {currentPage}</span>
      {nextPageUrl ? (
        <Link href={nextPageUrl}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-center text-sm text-slate-600 transition-colors hover:bg-slate-50">
          Neste →
        </Link>
      ) : <div className="flex-1" />}
    </div>
  );
}

// ─── Hoved-export ────────────────────────────────────────────────────────────

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

  // Background city refresh (best-effort)
  useEffect(() => {
    const city = locationLabel?.split(',')[0].trim().toLowerCase();
    if (!city) return;
    fetch('/api/refresh-city', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city }),
    }).catch(() => {});
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
    ...(hasCoords ? [{ value: 'nearest', label: 'Nærmest' }] : []),
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

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const businessResults = results.filter((r) => r.service.provider_type !== 'facility');
  const facilityResults = results.filter((r) => r.service.provider_type === 'facility');
  const hasSessions = groupSessions.length > 0;

  const showTabs =
    (businessResults.length > 0 && facilityResults.length > 0) || hasSessions;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all',      label: 'Alle',        count: results.length + groupSessions.length },
    ...(businessResults.length > 0 ? [{ key: 'business' as TabKey, label: 'Tilbydere', count: businessResults.length }] : []),
    ...(facilityResults.length > 0 ? [{ key: 'facility'  as TabKey, label: 'Anlegg',    count: facilityResults.length }] : []),
    ...(hasSessions                 ? [{ key: 'sessions'  as TabKey, label: 'Gruppeøkter', count: groupSessions.length }] : []),
  ];

  const tabResults =
    activeTab === 'business' ? businessResults :
    activeTab === 'facility' ? facilityResults :
    activeTab === 'sessions' ? [] :
    results;

  const tabSessions =
    activeTab === 'all' || activeTab === 'sessions' ? groupSessions : [];

  // ── Paginering ────────────────────────────────────────────────────────────
  const hasNextPage = results.length === pageSize;
  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete('page');
    else params.set('page', String(p));
    return `/resultater?${params.toString()}`;
  };
  const prevPageUrl = currentPage > 1 ? buildPageUrl(currentPage - 1) : undefined;
  const nextPageUrl = hasNextPage ? buildPageUrl(currentPage + 1) : undefined;

  const searchQueryString = searchParams.toString();
  const hasAnyResults = results.length > 0 || hasSessions;

  return (
    <div>
      {/* ── Chip-tags + sortering + del ──────────────────────────────────── */}
      <div className="mb-4 space-y-3">
        {catConfig && (
          <div className="flex flex-wrap items-center gap-2">
            {catConfig.key === 'trene-sammen' && (
              <Link
                href="/arrangementer/nytt"
                className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
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
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={
                    active
                      ? { background: '#0A1A0E', color: '#fff', border: '1px solid #0A1A0E' }
                      : { background: '#fff', border: '1px solid #E5E5E5', color: '#555' }
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
        )}

        {/* Sorteringsvalg + mobil kart-toggle */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-medium text-slate-400">Sorter:</span>
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSortChange(opt.value)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                currentSort === opt.value
                  ? { background: '#0A1A0E', color: '#fff' }
                  : { background: '#fff', border: '1px solid #E5E7EB', color: '#6B7280' }
              }
            >
              {opt.label}
            </button>
          ))}
          {hasCoords && (
            <div className="ml-auto flex shrink-0 items-center overflow-hidden rounded-xl border border-slate-200 lg:hidden">
              <button
                type="button"
                onClick={() => handleViewToggle('list')}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={view !== 'map' ? { background: '#0A1A0E', color: '#fff' } : { background: '#fff', color: '#64748B' }}
              >
                Liste
              </button>
              <button
                type="button"
                onClick={() => handleViewToggle('map')}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={view === 'map' ? { background: '#0A1A0E', color: '#fff' } : { background: '#fff', color: '#64748B' }}
              >
                Kart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      {showTabs && (
        <div className="mb-6 flex gap-1 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-brand-forest text-brand-forest'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 text-[11px] text-slate-400">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Hoved-grid: resultater + sticky kart ─────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">

        {/* Venstre: resultatliste */}
        <div>
          {/* Kart på mobil (toggle) */}
          {hasCoords && view === 'map' && (
            <div className="mb-6 lg:hidden">
              <ServiceMap
                center={{ lat: centerLat!, lon: centerLon! }}
                radiusKm={radiusKm}
                services={tabResults}
                locationLabel={locationLabel}
              />
            </div>
          )}

          <FallbackNoticeBanner notice={fallbackNotice} />

          <div className={view === 'map' && hasCoords ? 'hidden lg:block' : ''}>
            {/* Gruppeøkter */}
            {tabSessions.length > 0 && (
              <div className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-heading text-lg font-bold text-slate-800">
                    Aktive arrangementer
                    {locationLabel ? ` nær ${locationLabel.split(',')[0]}` : ''}
                  </h2>
                  <Link href="/arrangementer/nytt"
                    className="text-xs font-medium text-violet-600 hover:text-violet-800">
                    + Opprett
                  </Link>
                </div>
                <div className="space-y-3">
                  {tabSessions.map((s) => (
                    <GroupSessionCard key={s.id} session={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Tilbyderkort */}
            {tabResults.length > 0 ? (
              <div className="space-y-4">
                {tabResults.map((item) => (
                  <ResultCard
                    key={item.service.id}
                    item={item}
                    searchQueryString={searchQueryString}
                    onSearchHere={handleSearchHere}
                  />
                ))}
                <Pagination
                  prevPageUrl={prevPageUrl}
                  nextPageUrl={nextPageUrl}
                  currentPage={currentPage}
                />
              </div>
            ) : !hasSessions && tabResults.length === 0 && activeTab !== 'sessions' ? (
              <EmptyState
                searchParams={searchParams}
                catConfig={catConfig}
                locationLabel={locationLabel}
                radiusKm={radiusKm}
              />
            ) : null}

            {/* Resultater utenfor søkeradius */}
            {unanchoredResults.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-3 font-heading text-lg font-bold text-slate-800">
                  Andre treff (utenfor ditt område)
                </h2>
                <div className="space-y-4">
                  {unanchoredResults.map((item) => (
                    <UnanchoredCard
                      key={item.id}
                      item={item}
                      searchQueryString={searchQueryString}
                      onSearchHere={handleSearchHere}
                    />
                  ))}
                </div>
              </div>
            )}

            {!hasAnyResults && unanchoredResults.length === 0 && (
              <EmptyState
                searchParams={searchParams}
                catConfig={catConfig}
                locationLabel={locationLabel}
                radiusKm={radiusKm}
              />
            )}
          </div>
        </div>

        {/* Høyre: sticky kart (desktop) */}
        {hasCoords && (
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <ServiceMap
                center={{ lat: centerLat!, lon: centerLon! }}
                radiusKm={radiusKm}
                services={tabResults}
                locationLabel={locationLabel}
                height={520}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
