"""Refresh a new, offline SQLite snapshot from Geonorge NDJSON; never delete routes.

Usage: python scripts/refresh-trails-sqlite.py --source old.sqlite --input trails.ndjson --output new.sqlite
"""
import argparse
from contextlib import closing
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import sqlite3
import struct
import tempfile
import uuid


COLUMNS = ['id', 'source', 'source_local_id', 'name', 'trail_type', 'municipality',
           'maintainer', 'marked', 'difficulty', 'length_km', 'geom', 'created_at',
           'start_point', 'end_point']
UPDATED = ['name', 'trail_type', 'maintainer', 'marked', 'difficulty', 'length_km',
           'geom', 'start_point', 'end_point']


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def values(record):
    if not isinstance(record, dict):
        raise ValueError('Expected an object')
    key = record.get('sourceLocalId')
    if not isinstance(key, str) or not key.strip() or key != key.strip():
        raise ValueError('Missing or invalid sourceLocalId')
    if record.get('type') not in ('fotrute', 'skiloype', 'sykkelrute', 'annet'):
        raise ValueError('Invalid trail type')
    for field in ('name', 'maintainer', 'difficulty'):
        if record.get(field) is not None and not isinstance(record[field], str):
            raise ValueError('Invalid ' + field)
    if record.get('marked') is not None and type(record['marked']) is not bool:
        raise ValueError('Invalid marked flag')
    coords = record.get('coords')
    if not isinstance(coords, list) or len(coords) < 2:
        raise ValueError('Expected at least two coordinates')
    for point in coords:
        if (not isinstance(point, list) or len(point) != 2
                or any(type(n) not in (int, float) or not math.isfinite(n) for n in point)
                or not -180 <= point[0] <= 180 or not -90 <= point[1] <= 90):
            raise ValueError('Invalid coordinates')
    length = 0
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        a = (math.sin(math.radians(y2-y1)/2)**2
             + math.cos(math.radians(y1))*math.cos(math.radians(y2))
             * math.sin(math.radians(x2-x1)/2)**2)
        length += 6371 * 2 * math.asin(math.sqrt(min(1, max(0, a))))
    geom = struct.pack('<BIII', 1, 0x20000002, 4326, len(coords))
    geom += b''.join(struct.pack('<dd', *point) for point in coords)
    endpoints = [struct.pack('<BIIdd', 1, 0x20000001, 4326, *point)
                 for point in (coords[0], coords[-1])]
    data = [record.get('name'), record['type'], record.get('maintainer'),
            record.get('marked'), record.get('difficulty'), round(length, 3), geom, *endpoints]
    bounds = (min(p[0] for p in coords), max(p[0] for p in coords),
              min(p[1] for p in coords), max(p[1] for p in coords))
    return key, data, bounds


def refresh(source, input_path, output, data_source='geonorge'):
    if data_source not in ('geonorge', 'ut.no'):
        raise ValueError('Unsupported data source')
    source, input_path, output = map(lambda p: Path(p).resolve(), (source, input_path, output))
    manifest = output.with_suffix('.manifest.json')
    if output in (source, input_path) or output.exists() or manifest.exists():
        raise FileExistsError('Choose an unused output and manifest filename')
    if not source.is_file() or not input_path.is_file():
        raise FileNotFoundError('Source SQLite and input NDJSON must exist')
    output.parent.mkdir(parents=True, exist_ok=True)
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report = dict(started_at=started, source=str(source), input=str(input_path),
                  data_source=data_source, policy='Retain absent routes and all other sources',
                  inserted=0, updated=0, unchanged=0, input_rows=0)
    with tempfile.TemporaryDirectory(prefix='trails-refresh-', dir=output.parent) as directory:
        partial = Path(directory) / 'snapshot.sqlite'
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
            db = sqlite3.connect(partial)
            try:
                original.backup(db)
                if [r[1] for r in db.execute('PRAGMA table_info(trails)')] != COLUMNS:
                    raise ValueError('Unsupported trails export schema')
                if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('Source integrity check failed')
                if db.execute("SELECT 1 FROM trails WHERE source=? AND source_local_id IS NOT NULL GROUP BY source_local_id HAVING count(*)>1 LIMIT 1", (data_source,)).fetchone():
                    raise ValueError('Duplicate source keys in source SQLite')
                report['source_rows'] = db.execute('SELECT count(*) FROM trails').fetchone()[0]
                for pragma, expected in [('page_size', 4096), ('auto_vacuum', 0), ('encoding', 'UTF-8')]:
                    if db.execute('PRAGMA ' + pragma).fetchone()[0] != expected:
                        raise ValueError('Unsupported SQLite ' + pragma)
                db.execute('PRAGMA journal_mode=WAL')
                db.execute('CREATE TEMP TABLE seen (id TEXT PRIMARY KEY)')
                db.execute('CREATE INDEX IF NOT EXISTS trails_source_idx ON trails(source,source_local_id)')
                db.commit()
                input_hash = hashlib.sha256()
                with db, input_path.open('rb') as stream:
                    for line_number, raw in enumerate(stream, 1):
                        input_hash.update(raw)
                        if not raw.strip():
                            continue
                        try:
                            key, data, bounds = values(json.loads(raw))
                            db.execute('INSERT INTO seen VALUES (?)', (key,))
                        except (ValueError, sqlite3.IntegrityError) as error:
                            raise ValueError(f'Input line {line_number}: invalid or duplicate record ({error})') from error
                        existing = db.execute('SELECT rowid,' + ','.join(UPDATED) + ' FROM trails WHERE source=? AND source_local_id=?', (data_source, key)).fetchone()
                        if existing:
                            rowid = existing[0]
                            if list(existing[1:]) == data:
                                report['unchanged'] += 1
                            else:
                                db.execute('UPDATE trails SET ' + ','.join(c+'=?' for c in UPDATED) + ' WHERE rowid=?', (*data, rowid))
                                report['updated'] += 1
                        else:
                            fields = ['id', 'source', 'source_local_id', 'created_at', *UPDATED]
                            rowid = db.execute('INSERT INTO trails (' + ','.join(fields) + ') VALUES (' + ','.join('?' for _ in fields) + ')', (str(uuid.uuid4()), data_source, key, started, *data)).lastrowid
                            report['inserted'] += 1
                        db.execute('INSERT OR REPLACE INTO trails_bounds VALUES (?,?,?,?,?)', (rowid, *bounds))
                        report['input_rows'] += 1
                    if not report['input_rows']:
                        raise ValueError('Empty input is not a refresh')
                    report['absent_retained'] = db.execute('SELECT count(*) FROM trails t WHERE source=? AND NOT EXISTS (SELECT 1 FROM seen s WHERE s.id=t.source_local_id)', (data_source,)).fetchone()[0]
                    report['rows'] = db.execute('SELECT count(*) FROM trails').fetchone()[0]
                    report['input_sha256'] = input_hash.hexdigest()
                    if report['rows'] != report['source_rows'] + report['inserted']:
                        raise ValueError('Row count mismatch')
                    if db.execute('SELECT count(*) FROM trails_bounds').fetchone()[0] != report['rows'] or db.execute('SELECT 1 FROM trails t LEFT JOIN trails_bounds b ON b.rowid=t.rowid WHERE b.rowid IS NULL LIMIT 1').fetchone():
                        raise ValueError('Spatial index membership mismatch')
                    report['integrity_check'] = db.execute('PRAGMA integrity_check').fetchone()[0]
                    if report['integrity_check'] != 'ok':
                        raise ValueError('Output integrity check failed')
                    report['completed_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    report['geometry'] = 'Full 2D EWKB SRID 4326; endpoints and RTree bounds'
                    db.execute('INSERT OR REPLACE INTO export_metadata VALUES (?,?)', ('latest_refresh', json.dumps(report)))
                db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            finally:
                db.close()
        report.update(file=str(output), bytes=partial.stat().st_size, sha256=digest(partial))
        # Files inherit the destination directory ACL, not TemporaryDirectory's private ACL.
        pending_output = output.parent / ('.trails-' + uuid.uuid4().hex + '.partial')
        pending_manifest = output.parent / ('.trails-' + uuid.uuid4().hex + '.partial')
        created = []
        published = False
        try:
            with pending_output.open('xb') as target:
                created.append(pending_output)
                with partial.open('rb') as source_file:
                    shutil.copyfileobj(source_file, target, length=1024 * 1024)
                target.flush()
                os.fsync(target.fileno())
            with pending_manifest.open('x', encoding='utf-8') as target:
                created.append(pending_manifest)
                json.dump(report, target, ensure_ascii=False, indent=2)
                target.flush()
                os.fsync(target.fileno())
            if pending_output.stat().st_size != report['bytes'] or digest(pending_output) != report['sha256']:
                raise ValueError('Publication copy verification failed')
            # Hard links expose only complete files and refuse existing destinations.
            os.link(pending_output, output)
            published = True
            os.link(pending_manifest, manifest)
        except OSError:
            if published and output.exists() and os.path.samefile(pending_output, output):
                output.unlink()
            raise
        finally:
            for path in created:
                path.unlink()
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for argument in ('source', 'input', 'output'):
        parser.add_argument('--' + argument, required=True, type=Path)
    parser.add_argument('--data-source', choices=('geonorge', 'ut.no'), default='geonorge')
    args = parser.parse_args()
    print(json.dumps(refresh(args.source, args.input, args.output, args.data_source), ensure_ascii=False, indent=2))
