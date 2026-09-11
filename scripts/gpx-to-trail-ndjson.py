"""Convert local UT.no GPX files to offline refresh NDJSON; no database writes.

python scripts/gpx-to-trail-ndjson.py --input turer --output new-trails.ndjson
"""
import argparse
import json
import math
import os
from pathlib import Path
import uuid
import xml.etree.ElementTree as ET


def infer_type(name):
    lower = name.lower()
    if 'fottur' in lower:
        return 'fotrute'
    if 'skiløype' in lower or 'skitur' in lower:
        return 'skiloype'
    if 'sykkeltur' in lower or 'sykkelrute' in lower:
        return 'sykkelrute'
    return 'annet'


def parse_gpx(path):
    raw = path.read_bytes()
    # No DTD/entity expansion, including internal entities; GPX does not require either.
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper() or b'\x00' in raw:
        raise ValueError('DTD, entities and non-UTF8 XML are unsupported')
    root = ET.fromstring(raw)
    for element in root.iter():
        if isinstance(element.tag, str):
            element.tag = element.tag.rsplit('}', 1)[-1]
    if root.tag != 'gpx':
        raise ValueError('Expected GPX root')
    tracks = root.findall('trk')
    if len(tracks) != 1:
        raise ValueError('Expected exactly one track')
    segments = tracks[0].findall('trkseg')
    if len(segments) != 1:
        raise ValueError('Expected exactly one continuous track segment; split disconnected tracks explicitly')
    name = (root.findtext('metadata/name') or '').strip()
    name = name or (tracks[0].findtext('name') or '').strip() or path.stem
    coords = []
    for point in segments[0].findall('trkpt'):
        try:
            lon, lat = float(point.attrib['lon']), float(point.attrib['lat'])
        except (ValueError, KeyError) as error:
            raise ValueError('Missing or invalid track point') from error
        if not math.isfinite(lon) or not math.isfinite(lat) or not -180 <= lon <= 180 or not -90 <= lat <= 90:
            raise ValueError('Invalid coordinates')
        coords.append([lon, lat])
    if len(coords) < 2:
        raise ValueError('Expected at least two track points')
    return dict(sourceLocalId=path.stem, name=name, type=infer_type(name),
                maintainer='UT.no', marked=None, difficulty=None, coords=coords)


def convert(input_path, output):
    input_path, output = Path(input_path).resolve(), Path(output).resolve()
    if output.exists() or output == input_path:
        raise FileExistsError('Choose an unused output filename')
    files = sorted(p for p in input_path.iterdir() if p.is_file() and p.suffix.lower() == '.gpx') if input_path.is_dir() else [input_path]
    if not files or any(not p.is_file() or p.suffix.lower() != '.gpx' for p in files):
        raise ValueError('No GPX files found')
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.parent / ('.gpx-' + uuid.uuid4().hex + '.partial')
    seen = set()
    created = False
    points = 0
    try:
        with partial.open('x', encoding='utf-8') as target:
            created = True
            for path in files:
                if path.stem in seen:
                    raise ValueError('Duplicate filename stem: ' + path.stem)
                seen.add(path.stem)
                try:
                    record = parse_gpx(path)
                except (ValueError, ET.ParseError) as error:
                    raise ValueError(f'{path.name}: {error}') from error
                target.write(json.dumps(record, ensure_ascii=False) + '\n')
                points += len(record['coords'])
            target.flush()
            os.fsync(target.fileno())
        os.link(partial, output)
    finally:
        if created:
            partial.unlink()
    return dict(file=str(output), rows=len(files), points=points, data_source='ut.no')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(convert(args.input, args.output), ensure_ascii=False, indent=2))
