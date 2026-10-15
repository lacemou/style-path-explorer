"""Small fixed graph sensitivity sweep; this measures connectivity, not taste."""
import json
from pathlib import Path
import numpy as np
from graph import ROOT,PAIRS,build,shortest
cat=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'));ids=[s['id'] for s in cat['styles']]
results=[]
for method in ['baseline','dino','clip']:
    features=np.load(ROOT/f'.runtime/features/{method}.npy')
    for k in [3,5,8]:
        for q in [.85,.90,.95]:
            adj,dist,limit=build(features,k,q)
            remaining=set(range(len(ids)));components=[]
            while remaining:
                todo=[min(remaining)];component=set()
                while todo:
                    u=todo.pop()
                    if u in component:continue
                    component.add(u);todo.extend(v for v,_ in adj[u] if v not in component)
                remaining-=component;components.append(len(component))
            lengths=[len(shortest(adj,ids.index(a),ids.index(b))) for a,b in PAIRS]
            results.append({'method':method,'k':k,'quantile':q,'edges':sum(map(len,adj))//2,'isolated':sum(not a for a in adj),'components':sorted(components,reverse=True),'reachableTestPairs':sum(n>0 for n in lengths),'testPathLengths':lengths,'maxEdgeDistance':round(limit,7)})
(ROOT/'research/parameter-sweep.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
for r in results:
    if r['method']=='dino':print(r['k'],r['quantile'],'edges',r['edges'],'isolated',r['isolated'],'reachable',r['reachableTestPairs'],'largest component',r['components'][0])
