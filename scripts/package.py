"""Build explicit source/website archives; never package runtime caches or secrets."""
import hashlib,json,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE_FILES=['index.html','styles.css','app.mjs','core.mjs','favicon.svg','README.md','REBUILD.md','VERIFICATION.md','LICENSE','ASSET_LICENSE.md','THIRD_PARTY_NOTICES.md','requirements.txt','start-preview.ps1','.gitignore','.gitattributes','.nojekyll']
SOURCE_DIRS=['assets','data','scripts','tests','research','screenshots']
WEB_FILES=['index.html','styles.css','app.mjs','core.mjs','favicon.svg','LICENSE','ASSET_LICENSE.md','THIRD_PARTY_NOTICES.md','.nojekyll']
WEB_DIRS=['assets','data']
out=ROOT/'output';out.mkdir(exist_ok=True)
for name,files,folders in [('source',SOURCE_FILES,SOURCE_DIRS),('website',WEB_FILES,WEB_DIRS)]:
    paths=[ROOT/f for f in files]
    for folder in folders:paths.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    paths=sorted(set(paths))
    missing=[str(p.relative_to(ROOT)) for p in paths if not p.is_file()]
    if missing:raise ValueError(f'Missing delivery files: {missing}')
    dest=out/f'style-path-explorer-{name}.zip'
    with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as archive:
        for path in paths:archive.write(path,path.relative_to(ROOT).as_posix())
    print(name,len(paths),'files',dest.stat().st_size,'bytes',hashlib.sha256(dest.read_bytes()).hexdigest())
