"""Export 69 source PNG avatars as 512px WebP. Originals are no longer bundled;
provide hash-matching source files to rerun the initial conversion."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SIZE, QUALITY = 512, 85


def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    options = {'ensure_ascii': False}
    if path.name != 'graph.json':
        options['indent'] = 2
    temporary.write_text(json.dumps(value, **options), encoding='utf-8')
    temporary.replace(path)


def main():
    catalog, manifest, graph, examples = [read('data/' + n + '.json') for n in ('catalog', 'manifest', 'graph', 'examples')]
    previous = manifest.get('displayOptimization')
    if previous:
        for item in previous['images']:
            assert digest(ROOT / item['webPath']) == item['webSha256'], 'Web copy changed'
        print('WebP export already applied; all 69 exported file hashes verified.')
        return
    original_version, original_graph = catalog['version'], graph['version']
    assert manifest['version'] == graph['datasetVersion'] == examples['datasetVersion'] == original_version
    targets = [s for s in catalog['styles'] if int(s['id']) > 261]
    assert len(targets) == 69 and all(Path(s['avatar']).suffix == '.png' for s in targets)
    backup = ROOT / '.runtime/before-webp-export'
    backup.mkdir(parents=True, exist_ok=True)
    for name in ('catalog', 'manifest', 'graph', 'examples'):
        dest = backup / (name + '.json')
        if not dest.exists():
            dest.write_bytes((ROOT / 'data' / dest.name).read_bytes())
    records = []
    old_bytes = new_bytes = 0
    file_index = {(f['kind'], f['id']): f for f in manifest['files']}
    for style in targets:
        source_name = style['avatar']
        source = ROOT / source_name
        assert source.resolve().is_relative_to(ROOT.resolve())
        original_hash = digest(source)
        assert original_hash == file_index['avatars', style['id']]['sha256']
        web_name = str(Path(source_name).with_suffix('.webp')).replace('\\', '/')
        web = ROOT / web_name
        # Deterministic resampling and encoding only; keep the original file intact.
        with Image.open(source) as image:
            assert image.size == (1254, 1254)
            image.convert('RGB').resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(
                web.with_suffix('.webp.tmp'), 'WEBP', quality=QUALITY, method=6)
        temporary = web.with_suffix('.webp.tmp')
        if web.exists():
            assert digest(web) == digest(temporary), 'Refusing to overwrite a different WebP copy'
            temporary.unlink()
        else:
            temporary.replace(web)
        with Image.open(web) as exported:
            exported.load()
            assert exported.format == 'WEBP' and exported.size == (SIZE, SIZE)
        assert digest(source) == original_hash, 'Original image changed'
        old_bytes += source.stat().st_size
        new_bytes += web.stat().st_size
        style['avatar'] = web_name
        entry = file_index['avatars', style['id']]
        entry.update(path=web_name, sha256=digest(web))
        records.append(dict(id=style['id'], styleId=style['styleId'], originalPath=source_name,
                            originalSha256=original_hash, webPath=web_name, webSha256=entry['sha256']))
    new_version = '330-' + hashlib.sha256(json.dumps({'styles': catalog['styles'], 'files': manifest['files']}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
    catalog['version'] = manifest['version'] = graph['datasetVersion'] = examples['datasetVersion'] = new_version
    catalog['compatibleFavoriteVersions'] = list(dict.fromkeys(catalog.get('compatibleFavoriteVersions', []) + [original_version]))
    graph['compatibleShareVersions'] = graph.get('compatibleShareVersions', []) + [dict(datasetVersion=original_version, graphVersion=original_graph)]
    graph.pop('version')
    graph['version'] = hashlib.sha256(json.dumps(graph, sort_keys=True).encode()).hexdigest()[:12]
    examples['graphVersion'] = graph['version']
    manifest['displayOptimization'] = dict(
        operation='resize-and-webp-export', size=[SIZE, SIZE], quality=QUALITY, method=6,
        sourceDatasetVersion=original_version, sourceGraphVersion=original_graph,
        graphGeometry='unchanged; precomputed from source images, not recomputed from web copies',
        originalBytes=old_bytes, webBytes=new_bytes, images=records)
    for name, data in [('catalog', catalog), ('manifest', manifest), ('graph', graph), ('examples', examples)]:
        write(ROOT / 'data' / (name + '.json'), data)
    print(f'Converted 69 avatars: {old_bytes / 1048576:.2f} MiB -> {new_bytes / 1048576:.2f} MiB ({100 * (1 - new_bytes / old_bytes):.1f}% smaller).')
    print('Original PNG hashes preserved; route geometry unchanged; dataset', new_version, 'graph', graph['version'])


if __name__ == '__main__':
    main()
