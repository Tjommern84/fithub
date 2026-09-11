# Turso release review

Reviewed 2026-09-11 against the uncommitted `feature/events-basis` worktree and its main baseline. Read-only code/catalog-script review; no production inspection or mutation. Findings below describe the adapter at review time; subsequent fixes need their own test evidence.

Follow-up: the isolated `feature/turso-trails` release addresses findings 1–2 with an overall deadline, request cancellation, an upstream byte limit and a returned-vertex limit. Refresh tooling now maintains geometry/endpoints/RTree in new SQLite versions. See [current cutover report](turso-cutover.md) for evidence; production catalog findings remain outstanding.

## Decision

The existing pilot supports a controlled deployment with the Supabase table retained. It does not yet support deleting `public.trails`. The most concrete unresolved issues are the import destination, catalogue dependencies, snapshot freshness and production configuration. No SQL migration is needed to select Turso at runtime.

## Dependencies found in source

| Consumer | Current behavior | Consequence |
|---|---|---|
| `app/api/trails/route.ts` | Calls `lib/trailsServer.ts`, selects backend | `/tur` viewport can switch independently |
| `app/api/trails/nearest/route.ts` | Same backend selector | Nearest endpoint switches with viewport |
| `components/home/HomeNearbyActivities.tsx` | Fetches new nearest endpoint | Must include this change if deploying against the old homepage |
| `lib/trailsDb.ts` | Direct Supabase RPCs remain as rollback implementation | Keep original table and functions through rollout |
| `lib/destinationsDb.ts:findTrailRoute` | Calls Supabase `find_trail_route` | No callers found in app/components/lib; still an exported capability, not migrated |
| `scripts/push-geonorge-trails.ts` | Writes Supabase `trails` | Runtime flag does not redirect imports |
| `scripts/parse-gpx-trails.ts` | Also writes Supabase `trails` | Must include GPX/manual additions in future update policy |
| `scripts/export-trails-sqlite.py` | Paginated Supabase export | Equal before/after counts cannot prove absence of concurrent edits |

No scheduled trail import was found in `.github` or package scripts. This does not establish that external/manual schedules do not exist. Settlements, destinations, provider search, user data and ORS routing remain separate and still need their existing services.

SQL files identify `get_trails_in_bbox` (22), `get_nearest_trails` (latest 36), `trails_sync_endpoints`/`trg_trails_sync_endpoints` (40), and `find_trail_route` (41). Generated Supabase types also expose these functions. Migration 40 adds materialized start/end columns and indexes; these endpoints are required by Turso nearest search. No source-declared foreign key to trails was found, but production may differ.

Run `scripts/inspect-trail-dependencies.sql` manually in Supabase SQL Editor before retirement. It covers table/index bytes, foreign keys, catalog dependencies, transitive views, function text/name candidates, triggers, policies and publications. **An empty `pg_depend` result cannot certify safety:** PL/pgSQL and quoted SQL bodies commonly lack relation dependencies, and dynamic SQL can evade text search. External callers and cron commands require separate inspection. The script intentionally does not print function bodies or scheduled-job commands that might contain secrets.

## Adapter findings

1. **Runtime work is not bounded end to end.** Viewport search can execute up to 40 sequential 500-row requests, each with a 20-second timeout. Nearest search can make up to eight requests at 1/2/4/8/16/32/64/100 km. A client abort in TrailMap does not propagate to the server's Turso fetch. Add an overall request deadline/cancellation and verify broad-area failure is prompt. Per-process rate limiting is not a global quota limiter.
2. **Rows are bounded, response bytes and vertices are not.** Fetching 500 full route geometries can produce a large response even below the 20,000-candidate guard. `response.json()` buffers the full upstream response. Measure largest/densest route batches and bound response size or geometry workload before accepting arbitrary broad public requests.
3. **Viewport semantics intentionally differ.** SQLite bounds are coordinate extrema and clipping uses straight longitude/latitude segments; PostGIS intersects geography arcs and a geography envelope. Drammen/Oslo/Tromsø agreement does not establish geographic equivalence at large extents or route boundaries. Nearest distance uses spherical endpoint distance, consistent with the intended SQL36 model; it is not distance to the nearest point along the route.
4. **Nearest candidate index is the full-route RTree.** Long routes that cross a window but have distant endpoints increase candidate work. The 20,000 guard fails explicitly rather than returning wrong partial ranking. An endpoint-specific index is a possible later optimization if observed workloads hit that guard.
5. **Rollback error visibility differs.** Supabase `getTrailsInBounds`/`getNearestTrails` swallow errors to `[]`, while Turso errors yield HTTP503. Therefore a rollback can look empty when Supabase is misconfigured. Verify rollback with known positive results, not just HTTP200.
6. **Immutable imported database is the current safe assumption.** SQLite export populates RTree once; it does not define maintenance triggers. Direct writes to `trails` can leave bounds stale. Future updates must rebuild or atomically maintain bounds, endpoint blobs and source identity together.

## Minimal deployment separation

Do not deploy the whole events worktree just to move trails. The current runtime slice consists of these eight files, all independent of activity migration47:

- `app/api/trails/route.ts`
- `app/api/trails/nearest/route.ts`
- `components/TrailMap.tsx`
- `components/home/HomeNearbyActivities.tsx`
- `lib/trailsServer.ts`
- `lib/tursoTrails.ts`
- `lib/tursoSql.ts`
- `lib/trailGeometry.ts`

Include Turso-specific tests, verification scripts and `.env.example` entries as supporting files. The adapter uses built-in fetch/Buffer and introduces no required npm dependency. The worktree's Next/security updates and event-specific dependencies are separate changes; do not copy its entire lockfile without reviewing those changes. Existing CI/homepage smoke edits are event-specific and cannot be transferred wholesale to main's old homepage. Test the isolated release against its actual base.

## Exit conditions

- Runtime rollout: bounded workload findings addressed or measured with explicit operating limits; isolated release build and real deployed Turso positive-result checks; known-result Supabase rollback check; server-only read token installed and expiry/renewal assigned. The pilot token was documented as expiring after 30 days from September11.
- Permanent source switch: reproducible Geonorge and GPX update method that preserves identifiers, spatial bounds and endpoints; include changes since September10 export or establish that source was frozen.
- Space reclamation: actual production catalog results reviewed, backups and restore process verified, source writers retired, and explicit approval of a concrete destructive operation. Neither selecting Turso nor keeping a SQLite export frees Supabase space. Table/index size output is evidence of potential relation bytes, not a guarantee of final billed usage.
