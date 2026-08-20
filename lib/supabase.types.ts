/**
 * Temporary Supabase type definitions.
 *
 * This file provides permissive types for the Supabase client until
 * proper types are generated from the database schema.
 *
 * To generate proper types, run:
 *   npx supabase gen types typescript --project-id <your-project-id> > lib/database.types.ts
 *
 * Then update lib/supabaseClient.ts to use the generated types.
 */

export type Database = any;
