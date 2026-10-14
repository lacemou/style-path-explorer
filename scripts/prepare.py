"""Package an existing numbered library; never regenerate source images."""
import argparse, hashlib, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVISION = '58dee6151874c6fc381e6a0d97430f1c275c1696'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, required=True, help='Directory with styles.json and assets/')
    p.add_argument('--upstream', type=Path, help='Optional matching frozen catalog/styles.json')
    p.add_argument('--revision', help='Source revision; defaults to the frozen default library only with --upstream, otherwise custom')
    args = p.parse_args()
    original = json.loads((args.source / 'styles.json').read_text(encoding='utf-8'))['styles']
    if args.upstream:
        upstream = json.loads(args.upstream.read_text(encoding='utf-8'))
        if isinstance(upstream, dict): upstream = upstream.get('styles', upstream.get('items'))
        indexed = {str(s.get('id', s.get('number'))).zfill(3): s for s in upstream}
        for s in original:
            u = indexed[s['id']]
            for key, alias in [('name','generation_name'), ('author','reference'), ('traits','traits')]:
                assert s[key] == u.get(key, u.get(alias)), f'Upstream mismatch: {s["id"]} {key}'
    rows, manifest = [], []
    assert len({s['id'] for s in original}) == len(original), 'Duplicate IDs'
    for s in sorted(original, key=lambda x:x['id']):
        row = {k:s[k] for k in ('id','name','author','group','traits')}
        for key, folder in [('avatar_url','avatars'),('preview_url','references')]:
            source = args.source / s[key]
            dest = ROOT / 'assets' / folder / source.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
            rel = dest.relative_to(ROOT).as_posix()
            row['avatar' if folder == 'avatars' else 'referenceImage'] = rel
            manifest.append({'id':s['id'], 'kind':folder, 'path':rel, 'sha256':digest(dest)})
        rows.append(row)
    data = ROOT / 'data'; data.mkdir(exist_ok=True)
    raw = json.dumps({'styles':rows,'files':manifest},ensure_ascii=False,sort_keys=True).encode()
    version = str(len(rows)) + '-' + hashlib.sha256(raw).hexdigest()[:12]
    revision = args.revision or (REVISION if args.upstream else 'custom')
    catalog = {'version':version,'upstreamRepository':'yang0/handraw-style' if args.upstream else 'custom','upstreamRevision':revision,'count':len(rows),'styles':rows}
    (data/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
    (data/'examples.json').write_text(json.dumps({'datasetVersion':version,'reviewState':'not_reviewed','pairs':[]}),encoding='utf-8')
    repair=[{'id':'046','method':'contact_sheet_crop','source':'images/B_036-048.png','sourceSha256':'ccb6580124b895b321ae24a56de7e76d26efba6363057e334768f338655859ea','cropBox':[527,630,730,960]}] if args.upstream and revision==REVISION else []
    (data/'manifest.json').write_text(json.dumps({'version':version,'upstream':{'repository':'yang0/handraw-style' if args.upstream else 'custom','revision':revision},'files':manifest,'referenceRepairs':repair},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Packaged {len(rows)} styles; dataset {version}',flush=True)

if __name__ == '__main__': main()
