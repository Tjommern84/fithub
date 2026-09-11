"""Read-only Supabase trails export. Credentials are inherited from the environment.

Usage: node --env-file=.env.local -e "require('child_process').spawnSync('python',
['.worktrees/events-basis/scripts/export-trails-sqlite.py','data/geonorge/trails-export.sqlite'],
{stdio:'inherit',env:process.env})"
The output preserves PostgreSQL EWKB geometry as binary, not SpatiaLite geometry.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import struct
import sys
import time
import urllib.parse
import urllib.request


def fetch(params, count=False):
    url = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1/trails?' + urllib.parse.urlencode(params)
    key = os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
    if count:
        headers['Prefer'] = 'count=exact'
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response:
                return json.load(response), response.headers.get('Content-Range', '')
        except Exception:
            if attempt == 4:
                raise RuntimeError('Supabase read failed after five attempts; partial export retained') from None
            time.sleep(2 ** attempt)


def line_bounds(blob):
    endian = '<' if blob[0] == 1 else '>'
    kind = struct.unpack_from(endian + 'I', blob, 1)[0]
    if kind & 0xFFFF != 2 or kind & 0xC0000000:
        raise ValueError('Expected two-dimensional EWKB LineString')
    offset = 5
    if kind & 0x20000000:
        if struct.unpack_from(endian + 'I', blob, offset)[0] != 4326:
            raise ValueError('Expected SRID 4326')
        offset += 4
    count = struct.unpack_from(endian + 'I', blob, offset)[0]
    offset += 4
    if count < 2 or len(blob) != offset + count * 16:
        raise ValueError('Invalid LineString length')
    points = list(struct.iter_unpack(endian + 'dd', blob[offset:]))
    if any(not (-180 <= x <= 180 and -90 <= y <= 90) for x, y in points):
        raise ValueError('Invalid coordinates')
    return min(x for x, y in points), max(x for x, y in points), min(y for x, y in points), max(y for x, y in points)


def main():
    output = Path(sys.argv[1]).resolve()
    partial = output.with_suffix('.partial.sqlite')
    if output.exists() or partial.exists():
        raise FileExistsError('Output already exists; choose a new filename')
    output.parent.mkdir(parents=True, exist_ok=True)
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    _, content_range = fetch({'select': 'id', 'limit': 1}, True)
    expected = int(content_range.split('/')[-1])
    db = sqlite3.connect(partial)
    db.executescript('''
      CREATE TABLE trails (
        id TEXT PRIMARY KEY, source TEXT, source_local_id TEXT, name TEXT,
        trail_type TEXT, municipality TEXT, maintainer TEXT, marked INTEGER,
        difficulty TEXT, length_km REAL, geom BLOB NOT NULL, created_at TEXT,
        start_point BLOB, end_point BLOB);
      CREATE TABLE export_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE VIRTUAL TABLE trails_bounds USING rtree(rowid, min_lon, max_lon, min_lat, max_lat);
    ''')
    columns = ['id', 'source', 'source_local_id', 'name', 'trail_type', 'municipality',
               'maintainer', 'marked', 'difficulty', 'length_km', 'geom', 'created_at', 'start_point', 'end_point']
    total = 0
    last_id = None
    while True:
        params = {'select': ','.join(columns), 'order': 'id.asc', 'limit': 500}
        if last_id:
            params['id'] = 'gt.' + last_id
        rows, _ = fetch(params)
        if not rows:
            break
        with db:
            for row in rows:
                for field in ('geom', 'start_point', 'end_point'):
                    if row[field] is not None:
                        row[field] = bytes.fromhex(row[field].removeprefix('\\x'))
                bounds = line_bounds(row['geom'])
                cursor = db.execute('INSERT INTO trails VALUES (' + ','.join('?' for _ in columns) + ')', [row[c] for c in columns])
                db.execute('INSERT INTO trails_bounds VALUES (?,?,?,?,?)', (cursor.lastrowid, *bounds))
        total += len(rows)
        last_id = rows[-1]['id']
        if total % 10000 == 0:
            print(f'Exported {total}/{expected}', flush=True)
    _, ending_range = fetch({'select': 'id', 'limit': 1}, True)
    final_source_count = int(ending_range.split('/')[-1])
    if total != expected or total != final_source_count:
        raise RuntimeError('Source count changed or export incomplete; partial file retained')
    db.executescript('CREATE INDEX trails_type_idx ON trails(trail_type); CREATE INDEX trails_source_idx ON trails(source,source_local_id);')
    result = db.execute('PRAGMA integrity_check').fetchone()[0]
    spatial_count = db.execute('SELECT count(*) FROM trails_bounds').fetchone()[0]
    if result != 'ok' or spatial_count != total:
        raise RuntimeError('SQLite integrity check failed')
    report = {'source': 'Supabase public.trails (public read API)', 'started_at': started,
              'completed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'rows': total, 'source_count_before': expected, 'source_count_after': final_source_count,
              'integrity_check': result, 'geometry': 'Original EWKB, SRID 4326; RTree bounding boxes added',
              'consistency': 'Paginated read, not a transactional snapshot; concurrent edits may be reflected',
              'scope': 'trails only; no users, credentials, PostgreSQL functions or policies'}
    with db:
        db.executemany('INSERT INTO export_metadata VALUES (?,?)', [(k, json.dumps(v, ensure_ascii=False)) for k, v in report.items()])
    db.close()
    partial.rename(output)
    report['file'] = str(output)
    report['bytes'] = output.stat().st_size
    with output.open('rb') as handle:
        report['sha256'] = hashlib.file_digest(handle, 'sha256').hexdigest()
    output.with_suffix('.manifest.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
