type SqlValue = null | string | number | Uint8Array;
type WireValue = { type: string; value?: string | number; base64?: string };

export async function tursoQuery(sql: string, args: (number | string)[] = [], signal?: AbortSignal): Promise<Record<string, SqlValue>[]> {
  if (typeof window !== 'undefined') throw new Error('Turso is server-only');
  const configured = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!configured || !token) throw new Error('Turso configuration missing');
  const url = new URL(configured.replace(/^(libsql|turso):/, 'https:'));
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid Turso URL');
  let response: Response;
  try {
    response = await fetch(new URL('/v2/pipeline', url), {
      method: 'POST', cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: args.map(value => (
        typeof value === 'string' ? { type: 'text', value } : Number.isInteger(value)
          ? { type: 'integer', value: String(value) } : { type: 'float', value }
      )), want_rows: true } }, { type: 'close' }] }),
    });
  } catch { throw new Error('Turso request unavailable'); }
  if (!response.ok) throw new Error(`Turso HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty Turso response');
  const decoder = new TextDecoder();
  let bytes = 0, json = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8 * 1024 * 1024) {
      await reader.cancel();
      throw new Error('Turso response too large; narrow the search');
    }
    json += decoder.decode(value, { stream: true });
  }
  json += decoder.decode();
  const payload = JSON.parse(json) as { results?: { type: string; response?: { result?: {
    cols: { name: string }[]; rows: WireValue[][];
  } } }[] };
  const entry = payload.results?.[0];
  const result = entry?.response?.result;
  if (entry?.type !== 'ok' || !result) throw new Error('Turso query failed');
  return result.rows.map(row => Object.fromEntries(result.cols.map((column, i) => {
    const cell = row[i];
    const value = cell.type === 'null' ? null : cell.type === 'blob'
      ? new Uint8Array(Buffer.from(cell.base64 ?? '', 'base64')) : cell.type === 'integer' || cell.type === 'float'
        ? Number(cell.value) : String(cell.value);
    return [column.name, value];
  })));
}
