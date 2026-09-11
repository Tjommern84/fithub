-- Read-only. Run manually in Supabase SQL Editor and retain every result set.
-- No row contents, function bodies, job commands, credentials or mutations returned.
-- pg_depend is NOT complete for PL/pgSQL, quoted SQL bodies or dynamic SQL.
-- The source-text search below is a heuristic: comments can match, constructed
-- identifiers can escape it. External applications/jobs require separate review.

SELECT current_database() AS database_name, now() AS inspected_at,
       to_regclass('public.trails') AS trails_relation,
       pg_database_size(current_database()) AS database_bytes;

SELECT c.oid::regclass AS relation,
       pg_table_size(c.oid) AS table_including_toast_bytes,
       pg_indexes_size(c.oid) AS indexes_bytes,
       pg_total_relation_size(c.oid) AS total_bytes,
       c.reltuples::bigint AS estimated_rows
FROM pg_class c WHERE c.oid = to_regclass('public.trails');

SELECT i.indexrelid::regclass AS index_name,
       pg_relation_size(i.indexrelid) AS bytes,
       pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index i WHERE i.indrelid = to_regclass('public.trails')
ORDER BY bytes DESC;

SELECT conname, conrelid::regclass AS referencing_relation,
       confrelid::regclass AS referenced_relation,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f' AND (conrelid = to_regclass('public.trails')
                        OR confrelid = to_regclass('public.trails'));

SELECT d.deptype, pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent_object,
       pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) AS referenced_object
FROM pg_depend d
WHERE d.refclassid = 'pg_class'::regclass
  AND d.refobjid = to_regclass('public.trails')
ORDER BY dependent_object;

-- Direct and transitive view/materialized-view dependencies tracked by PostgreSQL.
WITH RECURSIVE related(oid, path) AS (
  SELECT to_regclass('public.trails')::oid, ARRAY[to_regclass('public.trails')::oid]
  UNION ALL
  SELECT r.ev_class, related.path || r.ev_class
  FROM related
  JOIN pg_depend d ON d.refclassid = 'pg_class'::regclass AND d.refobjid = related.oid
  JOIN pg_rewrite r ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
  JOIN pg_class c ON c.oid = r.ev_class AND c.relkind IN ('v','m')
  WHERE NOT r.ev_class = ANY(related.path)
)
SELECT DISTINCT oid::regclass AS dependent_view
FROM related WHERE oid <> to_regclass('public.trails');

-- Include named trail RPCs even if their body text is not visible to this role.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       l.lanname AS language, p.prosecdef AS security_definer,
       (p.prosrc ~* '\m(trails|get_trails_in_bbox|get_nearest_trails|find_trail_route|trails_sync_endpoints)\M') AS source_text_match
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND (p.proname IN ('get_trails_in_bbox','get_nearest_trails','find_trail_route','trails_sync_endpoints')
    OR p.prosrc ~* '\m(trails|get_trails_in_bbox|get_nearest_trails|find_trail_route|trails_sync_endpoints)\M')
ORDER BY schema_name, function_name, arguments;

-- Includes triggers on other relations whose function text references trails.
SELECT t.tgrelid::regclass AS relation, t.tgname, t.tgenabled,
       t.tgisinternal, t.tgfoid::regprocedure AS trigger_function
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = to_regclass('public.trails')
   OR p.prosrc ~* '\m(trails|get_trails_in_bbox|get_nearest_trails|find_trail_route|trails_sync_endpoints)\M';

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trails';

SELECT pubname, schemaname, tablename FROM pg_publication_tables
WHERE schemaname = 'public' AND tablename = 'trails';

-- Presence only: inspect schedules manually if cron exists; commands may contain secrets.
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron','pg_net');
