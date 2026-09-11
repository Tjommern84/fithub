import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('refresh', Path(__file__).resolve().parents[1] / 'scripts/refresh-trails-sqlite.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def record(key, name='Trail', coords=None):
    return dict(sourceLocalId=key, type='fotrute', name=name, marked=True,
                coords=coords or [[10.1, 59.7], [10.2, 59.8]])


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.source, self.input, self.output = (root / n for n in ('source.sqlite', 'input.ndjson', 'output.sqlite'))
        with closing(sqlite3.connect(self.source)) as db, db:
            db.execute('CREATE TABLE trails (id TEXT PRIMARY KEY, source TEXT, source_local_id TEXT, name TEXT, trail_type TEXT, municipality TEXT, maintainer TEXT, marked INTEGER, difficulty TEXT, length_km REAL, geom BLOB NOT NULL, created_at TEXT, start_point BLOB, end_point BLOB)')
            db.execute('CREATE TABLE export_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            db.execute('CREATE VIRTUAL TABLE trails_bounds USING rtree(rowid,min_lon,max_lon,min_lat,max_lat)')
            for key, source in [('same','geonorge'), ('change','geonorge'), ('absent','geonorge'), ('same','gpx')]:
                _, data, bounds = module.values(record(key))
                fields = ['id', 'source', 'source_local_id', 'created_at', 'municipality', *module.UPDATED]
                rowid = db.execute('INSERT INTO trails (' + ','.join(fields) + ') VALUES (' + ','.join('?' for _ in fields) + ')', (source+'-'+key, source, key, 'original-date', 'Drammen', *data)).lastrowid
                db.execute('INSERT INTO trails_bounds VALUES (?,?,?,?,?)', (rowid,*bounds))
        self.original_hash = module.digest(self.source)

    def write(self, rows):
        self.input.write_text(''.join(json.dumps(r)+'\n' for r in rows), encoding='utf-8')

    def test_refresh_preserves_identity_other_sources_and_absent(self):
        self.write([record('same'), record('change', 'Changed', [[11,60],[12,61]]), record('new')])
        report = module.refresh(self.source,self.input,self.output)
        self.assertEqual((report['unchanged'],report['updated'],report['inserted'],report['absent_retained'],report['rows']), (1,1,1,1,5))
        self.assertEqual(module.digest(self.source),self.original_hash)
        self.assertEqual(report['sha256'], module.digest(self.output))
        with closing(sqlite3.connect(self.output)) as db:
            self.assertEqual(db.execute('PRAGMA journal_mode').fetchone()[0], 'wal')
            self.assertEqual(db.execute("SELECT name,municipality,created_at FROM trails WHERE id='geonorge-change'").fetchone(), ('Changed','Drammen','original-date'))
            self.assertEqual(db.execute("SELECT name FROM trails WHERE id='gpx-same'").fetchone()[0], 'Trail')
            self.assertEqual(db.execute("SELECT min_lon,max_lat FROM trails_bounds b JOIN trails t ON b.rowid=t.rowid WHERE t.id='geonorge-change'").fetchone(), (11,61))
            self.assertEqual(db.execute("SELECT start_point,end_point FROM trails WHERE id='geonorge-change'").fetchone(), tuple(module.values(record('change', 'Changed', [[11,60],[12,61]]))[1][-2:]))
            new_id = db.execute("SELECT id FROM trails WHERE source_local_id='new'").fetchone()[0]
        next_output = self.output.with_name('next.sqlite')
        again = module.refresh(self.output,self.input,next_output)
        self.assertEqual((again['inserted'],again['updated'],again['unchanged']), (0,0,3))
        with closing(sqlite3.connect(next_output)) as db:
            self.assertEqual(db.execute("SELECT id FROM trails WHERE source_local_id='new'").fetchone()[0],new_id)

    def test_invalid_input_rolls_back_after_valid_update(self):
        for bad in [record(None), record(''), record('new',coords=[[999,0],[0,0]]), record('new',coords=[[True,0],[0,0]]), record('new',coords=[[float('nan'),0],[0,0]])]:
            with self.subTest(bad=bad):
                self.write([record('change','Changed'),bad])
                with self.assertRaises(ValueError):
                    module.refresh(self.source,self.input,self.output)
                self.assertFalse(self.output.exists())
                self.assertFalse(self.output.with_suffix('.manifest.json').exists())
                self.assertEqual(module.digest(self.source),self.original_hash)

    def test_duplicate_keys_and_empty_input_rejected(self):
        for rows in [[record('new'),record('new')], []]:
            self.write(rows)
            with self.assertRaises(ValueError):
                module.refresh(self.source,self.input,self.output)
            self.assertFalse(self.output.exists())

    def test_ut_source_preserves_geonorge_and_stable_ids(self):
        self.write([record('same','UT route')])
        report = module.refresh(self.source,self.input,self.output,'ut.no')
        self.assertEqual(report['inserted'],1)
        with closing(sqlite3.connect(self.output)) as db:
            self.assertEqual(db.execute("SELECT name FROM trails WHERE id='geonorge-same'").fetchone()[0],'Trail')
            route_id = db.execute("SELECT id FROM trails WHERE source='ut.no'").fetchone()[0]
        self.write([record('same','Updated UT route')])
        next_output = self.output.with_name('next.sqlite')
        report = module.refresh(self.output,self.input,next_output,'ut.no')
        self.assertEqual((report['inserted'],report['updated']), (0,1))
        with closing(sqlite3.connect(next_output)) as db:
            self.assertEqual(db.execute("SELECT id,name FROM trails WHERE source='ut.no'").fetchone(),(route_id,'Updated UT route'))
        with self.assertRaises(ValueError):
            module.refresh(self.source,self.input,next_output,'arbitrary')

    def test_never_overwrites_source_output_or_manifest(self):
        self.write([record('same')])
        with self.assertRaises(FileExistsError):
            module.refresh(self.source,self.input,self.source)
        self.output.write_text('existing')
        with self.assertRaises(FileExistsError):
            module.refresh(self.source,self.input,self.output)
        self.assertEqual(self.output.read_text(),'existing')
        self.output.unlink()
        self.output.with_suffix('.manifest.json').write_text('existing')
        with self.assertRaises(FileExistsError):
            module.refresh(self.source,self.input,self.output)
        self.assertFalse(self.output.exists())

    def test_publication_stages_in_destination_parent_and_cleans_up(self):
        self.write([record('same')])
        real_link = module.os.link
        staged = []

        def inspect_link(source, destination):
            self.assertEqual(Path(source).parent, self.output.parent)
            self.assertTrue(Path(source).is_file())
            staged.append(Path(source))
            return real_link(source, destination)

        with patch.object(module.os, 'link', side_effect=inspect_link):
            module.refresh(self.source, self.input, self.output)
        self.assertEqual(len(staged), 2)
        self.assertTrue(all(not path.exists() for path in staged))

    def test_manifest_publication_failure_removes_only_own_output(self):
        self.write([record('same')])
        real_link = module.os.link

        def conflict(source, destination):
            if Path(destination) == self.output.with_suffix('.manifest.json'):
                Path(destination).write_text('concurrent writer')
            return real_link(source, destination)

        with patch.object(module.os, 'link', side_effect=conflict):
            with self.assertRaises(FileExistsError):
                module.refresh(self.source, self.input, self.output)
        self.assertFalse(self.output.exists())
        self.assertEqual(self.output.with_suffix('.manifest.json').read_text(), 'concurrent writer')
        self.assertFalse(list(self.output.parent.glob('.trails-*.partial')))


if __name__ == '__main__':
    unittest.main()
