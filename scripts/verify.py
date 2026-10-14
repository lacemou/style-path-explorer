"""Check packaged data, image hashes, version coherence and graph invariants."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
cat=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
graph=json.loads((ROOT/'data/graph.json').read_text())
manifest=json.loads((ROOT/'data/manifest.json').read_text())
ids=[s['id'] for s in cat['styles']]
assert len(ids)==len(set(ids))==cat['count']
assert cat['version']==graph['datasetVersion']==manifest['version']
assert ids==graph['ids']
assert len(graph['adjacency'])==len(ids)
for i,row in enumerate(graph['adjacency']):
    assert len({j for j,_ in row})==len(row)
    for j,w in row:
        assert 0<=j<len(ids) and j!=i and 0<=w<=2
        assert [i,w] in graph['adjacency'][j]
for f in manifest['files']:
    path=ROOT/f['path'];assert path.resolve().is_relative_to(ROOT.resolve())
    assert hashlib.sha256(path.read_bytes()).hexdigest()==f['sha256'],f['path']
for s in cat['styles']:
    for k in ['avatar','referenceImage']:assert (ROOT/s[k]).is_file()
examples=json.loads((ROOT/'data/examples.json').read_text())
for p in examples['pairs']:assert p['from'] in ids and p['to'] in ids
copy=dict(graph);version=copy.pop('version')
assert hashlib.sha256(json.dumps(copy,sort_keys=True).encode()).hexdigest()[:12]==version
print(f"Verified {len(ids)} styles, {len(manifest['files'])} image hashes, symmetric graph and version {version}.")
