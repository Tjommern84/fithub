# FitHub – Project Instructions

<!-- Stable rules only. Ephemeral project state lives in memory/MEMORY.md (auto-loaded). -->
<!-- Last reviewed: 2026-04-25 -->

## Commands

- **Dev server**: `npm run dev` (ports 3000–3002 may all be in use — check first)
- **Build**: `npm run build`
- **Type check**: `npx tsc --noEmit`
- **Run scripts**: `npx tsx scripts/<name>.ts`

## Architecture

Next.js 14 App Router · React **18.2** · TypeScript · Supabase (PostgreSQL + PostGIS) · Tailwind CSS

| File | Role |
|------|------|
| `app/page.tsx` | Homepage — server component, imports CategoryGrid |
| `components/CategoryGrid.tsx` | 4-tile grid, GPS, Oslo bydel picker — `'use client'` |
| `app/resultater/page.tsx` | Results server component — calls `searchServices()` directly, no cache |
| `app/resultater/ResultsView.tsx` | Results client component — tag panel, map, card list |
| `lib/matchingDb.ts` | `searchServices()` — direct Supabase RPC, no cache layer |
| `lib/categoryConfig.ts` | 4 categories with theme colors and tag options |
| `sql/01_postgis_and_search.sql` | `search_services()` SQL function (14 params) |

## Coding standards

- **No comments** unless the WHY is non-obvious (constraint, workaround, subtle invariant)
- **React 18.2**: `useFormState` + `useFormStatus` from `react-dom` — never `useActionState` (React 19 only)
- **Dynamic theme colors**: inline `style={{color: theme.accent}}` — not dynamic Tailwind strings (purged at build)
- **TypeScript**: strict; `unknown` + narrowing over `any`
- No premature abstractions; no error handling for impossible cases; no backwards-compat shims

## Critical gotchas

### Nominatim reverse geocoding
Fallback order **must** be: `city → town → municipality → village`
`municipality` before `village` — otherwise suburbs (e.g. Konnerud) win over the actual city (Drammen).
Both `reverseGeocode()` and `reverseGeocodeTop()` in `CategoryGrid.tsx` must follow this order.

### City param normalization
Always take the first segment before passing to DB:
```ts
locationLabel.split(',')[0].trim().toLowerCase()
```
Nominatim can return "Oslo, Norge" as `display_name` — without this, `city='oslo, norge'` finds nothing.

### `search_services()` SQL function
- **After every `DROP + CREATE`**: re-run `GRANT EXECUTE ON FUNCTION search_services(...) TO anon, authenticated;`
- Keep `#variable_conflict use_column` pragma at top of function body
- 14 params total — last two are `p_main_category text DEFAULT NULL, p_tags text[] DEFAULT NULL`

### Results page design
- Dark category header + gradient bar: read `catTheme` from `getCategoryConfig(mainCategory)` in `page.tsx`
- Tag filter panel in `ResultsView.tsx`: reads `?cat` + `?tags` from URL; active chip color = `catConfig.theme.accent`
- Never put category-specific colors in Tailwind classes — use inline styles with theme values

## Workflow

- **Never commit or push** unless explicitly asked
- **Confirm before destructive DB operations** (DROP, DELETE, TRUNCATE)
- **Image resize script**: `EBUSY` = file open elsewhere — skip it, close the file, re-run
- **Supabase config**: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (never commit)
