import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('gpx', Path(__file__).resolve().parents[1] / 'scripts/gpx-to-trail-ndjson.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
POINTS = '<trkpt lon="10" lat="60"/><trkpt lat="61" lon="11"/>'


class GpxTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.input = self.root / 'input'
        self.input.mkdir()
        self.output = self.root / 'out.ndjson'

    def write(self, name='route.gpx', content=None):
        path = self.input / name
        path.write_text(content or '<gpx><trk><name>Fottur</name><trkseg>'+POINTS+'</trkseg></trk></gpx>', encoding='utf-8')
        return path

    def test_namespace_metadata_and_stable_filename_id(self):
        self.write(content='<gpx xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Sykkeltur &amp; bad</name></metadata><trk><name>Ignored</name><trkseg>'+POINTS+'</trkseg></trk></gpx>')
        report = module.convert(self.input, self.output)
        row = json.loads(self.output.read_text(encoding='utf-8'))
        self.assertEqual((row['sourceLocalId'],row['name'],row['type'],row['maintainer']), ('route','Sykkeltur & bad','sykkelrute','UT.no'))
        self.assertEqual(row['coords'], [[10,60],[11,61]])
        self.assertEqual(report['rows'],1)

    def test_single_file_track_name_and_type_rules(self):
        path = self.write()
        module.convert(path,self.output)
        self.assertEqual(json.loads(self.output.read_text())['type'],'fotrute')
        self.assertEqual(module.infer_type('Skitur'), 'skiloype')
        self.assertEqual(module.infer_type('Kajakktur'), 'annet')

    def test_invalid_file_rolls_back_entire_directory(self):
        self.write('a.gpx')
        invalid = ['<gpx/>', '<gpx><trk><trkseg>'+POINTS+'</trkseg><trkseg>'+POINTS+'</trkseg></trk></gpx>',
                   '<gpx><trk><trkseg><trkpt lat="NaN" lon="10"/>'+POINTS+'</trkseg></trk></gpx>',
                   '<gpx><trk><trkseg><trkpt lat="60"/>'+POINTS+'</trkseg></trk></gpx>',
                   '<!DOCTYPE gpx [<!ENTITY x "test">]><gpx/>']
        for content in invalid:
            with self.subTest(content=content):
                self.write('b.gpx', content)
                with self.assertRaises(ValueError):
                    module.convert(self.input,self.output)
                self.assertFalse(self.output.exists())
                self.assertFalse(list(self.root.glob('*.partial')))

    def test_output_not_overwritten(self):
        self.write()
        self.output.write_text('keep')
        with self.assertRaises(FileExistsError):
            module.convert(self.input,self.output)
        self.assertEqual(self.output.read_text(),'keep')


if __name__ == '__main__':
    unittest.main()
