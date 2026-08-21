import { writeFile } from 'node:fs/promises';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY må være satt.');
}

const response = await fetch(`${supabaseUrl}/rest/v1/`, {
  headers: {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    Accept: 'application/openapi+json',
    'User-Agent': 'fithub-schema-generator/1.0',
  },
});

if (!response.ok) {
  throw new Error(`Supabase OpenAPI svarte HTTP ${response.status}.`);
}

const openApi = await response.json();
const supplementalDefinitions = {
  brreg_entities: {
    required: ['orgnr', 'navn'],
    properties: {
      orgnr: { type: 'string', format: 'text' },
      navn: { type: 'string', format: 'text' },
      category: { type: 'string', format: 'text' },
      naeringskode1_kode: { type: 'string', format: 'text' },
      antall_ansatte: { type: 'integer', format: 'integer' },
      verified: { type: 'boolean', format: 'boolean', default: false },
      quality_score: { type: 'integer', format: 'integer', default: 0 },
      relevance_score: { type: 'integer', format: 'integer' },
      forretningsadresse_adresse: { type: 'array', items: { type: 'string' } },
      forretningsadresse_postnummer: { type: 'string', format: 'text' },
      forretningsadresse_poststed: { type: 'string', format: 'text' },
    },
  },
  brreg_import_log: {
    properties: {
      id: { type: 'integer', format: 'integer', default: 'nextval' },
      status: { type: 'string', format: 'text' },
      started_at: { type: 'string', format: 'timestamp', default: 'now()' },
      completed_at: { type: 'string', format: 'timestamp' },
      total_imported: { type: 'integer', format: 'integer' },
    },
  },
  service_cache: {
    required: ['service_id', 'payload'],
    properties: {
      service_id: { type: 'string', format: 'text' },
      payload: { format: 'jsonb' },
      updated_at: { type: 'string', format: 'timestamp with time zone', default: 'now()' },
    },
  },
};
const definitions = { ...supplementalDefinitions, ...(openApi.definitions ?? {}) };
const viewNames = new Set(['geography_columns', 'geometry_columns']);
const functionNames = [
  'find_trail_route',
  'get_destinations_in_bbox',
  'get_nearest_destinations',
  'get_nearest_trails',
  'get_settlements_in_bbox',
  'get_trails_in_bbox',
  'is_org_admin',
  'search_services',
  'search_services_unanchored',
];

function quoteKey(value) {
  return /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);
}

function propertyType(property = {}) {
  if (Array.isArray(property.enum) && property.enum.length > 0) {
    return property.enum.map((value) => JSON.stringify(value)).join(' | ');
  }
  if (property.type === 'array') return `Array<${propertyType(property.items)}>`;
  if (property.type === 'boolean') return 'boolean';
  if (property.type === 'integer' || property.type === 'number') return 'number';
  if (property.type === 'object') return 'Json';

  const format = String(property.format ?? '').toLowerCase();
  if (format === 'json' || format === 'jsonb' || format.includes('geometry') || format.includes('geography')) {
    return 'Json';
  }
  return 'string';
}

function relationshipsFor(tableName, definition) {
  const relationships = [];
  for (const [column, property] of Object.entries(definition.properties ?? {})) {
    const match = String(property.description ?? '').match(/<fk table='([^']+)' column='([^']+)'\/>/);
    if (!match) continue;
    relationships.push({
      foreignKeyName: `${tableName}_${column}_fkey`,
      columns: [column],
      referencedRelation: match[1],
      referencedColumns: [match[2]],
    });
  }
  return relationships;
}

function renderShape(definition, mode) {
  const required = new Set(definition.required ?? []);
  const lines = [];
  for (const [name, property] of Object.entries(definition.properties ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const nullable = !required.has(name);
    const optional = mode === 'Update' || (mode === 'Insert' && (nullable || property.default !== undefined));
    const type = `${propertyType(property)}${nullable ? ' | null' : ''}`;
    lines.push(`          ${quoteKey(name)}${optional ? '?' : ''}: ${type}`);
  }
  return lines.length > 0 ? lines.join('\n') : '          [_ in never]: never';
}

function renderRelations(tableName, definition) {
  const relationships = relationshipsFor(tableName, definition);
  if (relationships.length === 0) return '';
  return relationships.map((relationship) => [
    '          {',
    `            foreignKeyName: ${JSON.stringify(relationship.foreignKeyName)}`,
    `            columns: [${relationship.columns.map(JSON.stringify).join(', ')}]`,
    `            referencedRelation: ${JSON.stringify(relationship.referencedRelation)}`,
    `            referencedColumns: [${relationship.referencedColumns.map(JSON.stringify).join(', ')}]`,
    '          }',
  ].join('\n')).join(',\n');
}

function renderRelationMap(entries, kind) {
  if (entries.length === 0) return '      [_ in never]: never';
  return entries.map(([name, definition]) => {
    const shapes = kind === 'Tables'
      ? [
          `        Row: {\n${renderShape(definition, 'Row')}\n        }`,
          `        Insert: {\n${renderShape(definition, 'Insert')}\n        }`,
          `        Update: {\n${renderShape(definition, 'Update')}\n        }`,
        ]
      : [`        Row: {\n${renderShape(definition, 'Row')}\n        }`];
    return [
      `      ${quoteKey(name)}: {`,
      ...shapes,
      `        Relationships: [\n${renderRelations(name, definition)}\n        ]`,
      '      }',
    ].join('\n');
  }).join('\n');
}

function functionArgs(name) {
  const operation = openApi.paths?.[`/rpc/${name}`]?.post;
  const body = operation?.parameters?.find((parameter) => parameter.in === 'body')?.schema;
  if (!body?.properties) return '        [_ in never]: never';
  const required = new Set(body.required ?? []);
  return Object.entries(body.properties)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([arg, property]) => `        ${quoteKey(arg)}${required.has(arg) ? '' : '?'}: ${propertyType(property)} | null`)
    .join('\n');
}

function renderFunctions() {
  return functionNames
    .filter((name) => openApi.paths?.[`/rpc/${name}`])
    .map((name) => [
      `      ${quoteKey(name)}: {`,
      `        Args: {\n${functionArgs(name)}\n        }`,
      '        Returns: unknown',
      '      }',
    ].join('\n'))
    .join('\n');
}

const entries = Object.entries(definitions).sort(([a], [b]) => a.localeCompare(b));
const tables = entries.filter(([name]) => !viewNames.has(name));
const views = entries.filter(([name]) => viewNames.has(name));
const output = `/**
 * Generated from the live Supabase PostgREST OpenAPI schema.
 * Run \`npm run db:types\` after database migrations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
${renderRelationMap(tables, 'Tables')}
    }
    Views: {
${renderRelationMap(views, 'Views')}
    }
    Functions: {
${renderFunctions()}
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
};
`;

await writeFile(new URL('../lib/supabase.types.ts', import.meta.url), output, 'utf8');
console.log(`Genererte ${tables.length} tabeller, ${views.length} views og ${functionNames.length} RPC-typer.`);
