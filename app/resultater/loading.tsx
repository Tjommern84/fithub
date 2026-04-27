'use client';
import { useSearchParams } from 'next/navigation';
import { parseMainCategory, getCategoryConfig } from '../../lib/categoryConfig';

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-5 bg-slate-200 rounded w-3/4" />
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
        </div>
        <div className="h-4 bg-slate-100 rounded w-20 shrink-0 mt-1" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-6 bg-slate-100 rounded-full w-28" />
        <div className="h-6 bg-slate-100 rounded-full w-16" />
      </div>
    </div>
  );
}

export default function Loading() {
  const sp = useSearchParams();
  const cat = sp.get('cat') ?? '';
  const mainCat = parseMainCategory(cat);
  const catTheme = mainCat ? getCategoryConfig(mainCat)?.theme : null;

  return (
    <main className="min-h-screen bg-slate-50">
      {catTheme ? (
        <div style={{ background: catTheme.headerBg, position: 'relative' }}>
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
              background: `linear-gradient(90deg, ${catTheme.barStart}, ${catTheme.barEnd})`,
            }}
          />
          <div className="max-w-5xl mx-auto px-4 pt-7 pb-6">
            <div className="text-xs mb-5" style={{ color: catTheme.subColor }}>← Tilbake</div>
            <div className="h-9 w-56 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <div className="mt-2 h-4 w-44 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="h-4 w-20 rounded animate-pulse bg-slate-200 mb-6" />
          <div className="h-9 w-56 rounded animate-pulse bg-slate-200 mb-2" />
          <div className="h-4 w-40 rounded animate-pulse bg-slate-200" />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tag filter row */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[100, 120, 90, 110].map((w, i) => (
            <div
              key={i}
              className="h-8 rounded-full animate-pulse bg-slate-200"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* Card skeletons */}
        <div className="space-y-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
