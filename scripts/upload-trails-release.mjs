import { createReadStream, statSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// New database per release; this script never overwrites a live database.
const args = process.argv.slice(2);
const option = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = option('file') && resolve(option('file'));
const name = option('name');
const group = option('group') ?? 'fithub-trails-test';
const apply = args.includes('--apply');
if (!file || !name || !/^[a-z0-9-]{1,64}$/.test(name) || !/^[a-z0-9-]{1,64}$/.test(group)) {
  throw new Error('Usage: --file=ready.sqlite --name=new-version-name [--group=fithub-trails-test] [--apply]');
}
for (const suffix of ['-wal', '-journal']) {
  if (existsSync(file + suffix) && statSync(file + suffix).size > 0) throw new Error('Checkpoint and close SQLite before uploading');
}
const inspected = spawnSync('python', ['-c', `
import sqlite3,json,sys
from pathlib import Path
d=sqlite3.connect(Path(sys.argv[1]).as_uri()+'?mode=ro',uri=True)
r={key:d.execute('PRAGMA '+key).fetchone()[0] for key in ['journal_mode','page_size','auto_vacuum','encoding','integrity_check']}
r['rows']=d.execute('SELECT count(*) FROM trails').fetchone()[0]
r['spatial_rows']=d.execute('SELECT count(*) FROM trails_bounds').fetchone()[0]
r['missing_bounds']=d.execute('SELECT count(*) FROM trails t LEFT JOIN trails_bounds b ON b.rowid=t.rowid WHERE b.rowid IS NULL').fetchone()[0]
r['missing_endpoints']=d.execute('SELECT count(*) FROM trails WHERE start_point IS NULL OR end_point IS NULL').fetchone()[0]
r['sample']=d.execute('SELECT id,hex(geom) FROM trails ORDER BY id LIMIT 3').fetchall()
d.close()
print(json.dumps(r))
`, file], { encoding: 'utf8' });
if (inspected.status !== 0) {
  console.error(inspected.error?.code ?? inspected.stderr?.slice(-600));
  throw new Error('SQLite inspection failed; check file and Python installation');
}
const local = JSON.parse(inspected.stdout);
if (local.journal_mode !== 'wal' || local.page_size !== 4096 || local.auto_vacuum !== 0
  || local.encoding !== 'UTF-8' || local.integrity_check !== 'ok' || !local.rows
  || local.rows !== local.spatial_rows || local.missing_bounds || local.missing_endpoints) {
  throw new Error('SQLite schema, integrity or upload settings failed validation');
}
const bytes = statSync(file).size;
if (bytes >= 1024 ** 3) throw new Error('File exceeds this workflow database limit of 1 GiB');
const hash = createHash('sha256');
for await (const chunk of createReadStream(file)) hash.update(chunk);
const sha256 = hash.digest('hex');
const report = { name, group, file, bytes, sha256, rows: local.rows, status: 'validated-local', production_switched: false };
console.log(JSON.stringify({ ...report, mode: apply ? 'apply-new-database' : 'dry-run-no-network' }, null, 2));
if (apply) {
  const org = process.env.TURSO_ORGANIZATION, token = process.env.TURSO_API_TOKEN;
  if (!org || !token) throw new Error('Missing Turso platform configuration');
  const reportFile = option('report') ? resolve(option('report')) : `${file}.${name}.upload.json`;
  if (existsSync(reportFile)) throw new Error('Report exists; choose a fresh release name/report');
  const base = `https://api.turso.tech/v1/organizations/${encodeURIComponent(org)}`;
  async function api(path, body) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Turso platform ${path.split('?')[0]} HTTP ${response.status}`);
    return response.json();
  }
  const databases = await api('/databases');
  if (databases.databases.some(d => (d.Name ?? d.name) === name)) throw new Error('Database exists; refusing to overwrite');
  const groups = await api('/groups');
  if (!groups.groups.some(g => (g.name ?? g.Name) === group)) throw new Error('Group missing; create and review region separately');
  const persist = () => writeFileSync(reportFile, JSON.stringify(report, null, 2));
  persist();
  try {
    const created = await api('/databases', { name, group, seed: { type: 'database_upload' }, size_limit: '1gb' });
    const hostname = created.database.Hostname ?? created.database.hostname;
    if (!hostname || !/^[a-zA-Z0-9.-]+$/.test(hostname)) throw new Error('Unexpected database hostname');
    report.hostname = hostname;
    report.status = 'created-awaiting-upload'; persist();
    const { jwt } = await api(`/databases/${name}/auth/tokens?expiration=1d&authorization=full-access`, {});
    console.log('Created versioned database; uploading SQLite');
    const uploaded = await fetch(`https://${hostname}/v1/upload`, {
      method: 'POST', signal: AbortSignal.timeout(300000),
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Length': String(bytes) },
      body: createReadStream(file), duplex: 'half',
    });
    if (!uploaded.ok) throw new Error(`Upload HTTP ${uploaded.status}`);
    report.status = 'uploaded-awaiting-verification'; persist();
    const sql = ['SELECT count(*) FROM trails', 'SELECT count(*) FROM trails_bounds',
      'SELECT id,hex(geom) FROM trails ORDER BY id LIMIT 3'];
    const response = await fetch(`https://${hostname}/v2/pipeline`, {
      method: 'POST', signal: AbortSignal.timeout(120000),
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [...sql.map(sql => ({ type: 'execute', stmt: { sql, want_rows: true } })), { type: 'close' }] }),
    });
    if (!response.ok) throw new Error(`Verification HTTP ${response.status}`);
    const result = await response.json();
    if (result.results?.some(r => r.type === 'error')) throw new Error('Verification SQL failed');
    const rows = i => result.results?.[i]?.response?.result?.rows;
    if (Number(rows(0)?.[0]?.[0]?.value) !== local.rows || Number(rows(1)?.[0]?.[0]?.value) !== local.spatial_rows
      || JSON.stringify(rows(2)?.map(row => row.map(cell => cell.value))) !== JSON.stringify(local.sample)) {
      throw new Error('Remote row count or geometry sample differs');
    }
    report.status = 'verified'; report.verified_at = new Date().toISOString(); persist();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.error = error instanceof Error ? error.message : 'Upload failed'; persist();
    throw new Error('Upload not verified; see local report. Existing databases were not changed.');
  }
}
