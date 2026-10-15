"""Exercise replacement-library build in ignored fixtures, without touching shipped data."""
import json,shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
for count in [1,3]:
    fixture=ROOT/f'.runtime/custom-smoke-{count}'
    source=fixture/'input';scripts=fixture/'scripts'
    scripts.mkdir(parents=True,exist_ok=True)
    for name in ['prepare.py','features.py','graph.py','verify.py']:shutil.copy2(ROOT/'scripts'/name,scripts/name)
    styles=[]
    for row in catalog['styles'][:count]:
        s={k:row[k] for k in ['id','name','author','group','traits']}
        for key,prop,kind in [('avatar_url','avatar','avatars'),('preview_url','referenceImage','previews')]:
            s[key]=f'assets/{kind}/{s["id"]}.webp';target=source/s[key];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/row[prop],target)
        styles.append(s)
    (source/'styles.json').write_text(json.dumps({'styles':styles},ensure_ascii=False),encoding='utf-8')
    for cmd in [[str(scripts/'prepare.py'),'--source',str(source)],[str(scripts/'features.py'),'--method','baseline'],[str(scripts/'graph.py'),'--methods','baseline','--select','baseline'],[str(scripts/'verify.py')]]:
        subprocess.run([sys.executable,'-X','utf8',*cmd],check=True,cwd=fixture)
    result=json.loads((fixture/'data/catalog.json').read_text(encoding='utf-8'))
    assert result['count']==count and result['upstreamRepository']=='custom'
print('One-image and three-image replacement-library rebuilds passed.')
