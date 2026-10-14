"""Explicit first-run downloads. No inference script downloads implicitly."""
import hashlib, json, shutil, urllib.request, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'.runtime/models'
DEST.mkdir(parents=True,exist_ok=True)

def request(url):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'style-path-explorer-research'}),timeout=120)

def download(url,dest,expected=None):
    if dest.exists():
        if expected and hashlib.sha256(dest.read_bytes()).hexdigest()!=expected:raise ValueError(f'Cached weight hash mismatch: {dest.name}')
        print('Cached:',dest.name,flush=True);return
    temp=dest.with_suffix(dest.suffix+'.partial')
    with request(url) as source,temp.open('wb') as output:
        total=0;last=0
        while chunk:=source.read(1024*1024):
            output.write(chunk);total+=len(chunk)
            if total-last>30*1024*1024:print(f'{dest.name}: {total//1048576} MiB',flush=True);last=total
    temp.replace(dest)
    print('Downloaded:',dest.name,dest.stat().st_size,flush=True)

def main():
    lock_path=ROOT/'research/model-lock.json';lock_path.parent.mkdir(exist_ok=True)
    if lock_path.exists():lock=json.loads(lock_path.read_text())
    else:
        dino=json.load(request('https://api.github.com/repos/facebookresearch/dinov2/commits/main'))['sha']
        clip=json.load(request('https://huggingface.co/api/models/laion/CLIP-ViT-B-32-laion2B-s34B-b79K'))['sha']
        lock={'dinoCodeRevision':dino,'clipWeightRevision':clip}
        lock_path.write_text(json.dumps(lock,indent=2),encoding='utf-8')
    sources={
       'dinov2_vits14_pretrain.pth':'https://dl.fbaipublicfiles.com/dinov2/dinov2_vits14/dinov2_vits14_pretrain.pth',
       'open_clip_pytorch_model.bin':f'https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K/resolve/{lock["clipWeightRevision"]}/open_clip_pytorch_model.bin',
       'dinov2-code.zip':f'https://api.github.com/repos/facebookresearch/dinov2/zipball/{lock["dinoCodeRevision"]}',
    }
    for name,url in sources.items():
        dest=DEST/name;expected=lock.get(name,{}).get('sha256');download(url,dest,expected)
        actual=hashlib.sha256(dest.read_bytes()).hexdigest()
        if expected and actual!=expected:raise ValueError(f'Download hash mismatch: {name}')
        lock[name]={'url':url,'sha256':actual,'bytes':dest.stat().st_size}
        lock_path.write_text(json.dumps(lock,indent=2),encoding='utf-8')
    repo=DEST/'dinov2-code'
    if not repo.exists():
        with zipfile.ZipFile(DEST/'dinov2-code.zip') as z:
            base=z.namelist()[0].split('/')[0]
            # All paths originate from a pinned upstream archive; prevent traversal.
            for item in z.infolist():
                rel=Path(item.filename).relative_to(base)
                if not str(rel) or str(rel)=='.':continue
                target=repo/rel
                if not target.resolve().is_relative_to(repo.resolve()):raise ValueError('Unsafe archive path')
                if item.is_dir():target.mkdir(parents=True,exist_ok=True)
                else:
                    target.parent.mkdir(parents=True,exist_ok=True)
                    with z.open(item) as src,target.open('wb') as dst:shutil.copyfileobj(src,dst)
    print('Model lock written; weights remain in ignored .runtime/models',flush=True)

if __name__=='__main__':main()
