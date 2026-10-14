"""Create reproducible undirected kNN graphs and visual comparison artifacts."""
import argparse, hashlib, heapq, json
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
# Fixed before inspecting model outputs; all methods use the same endpoint pairs.
PAIRS=[('001','002'),('004','007'),('062','067'),('125','177'),('202','213'),('001','142'),('002','247'),('062','221'),('067','177'),('032','213'),('045','202'),('111','222'),('017','258'),('055','205'),('090','160'),('010','250')]

def shortest(adj,a,b):
    q=[(0,(a,),a)];best={a:(0,(a,))}
    while q:
        cost,path,u=heapq.heappop(q)
        if best.get(u)!=(cost,path):continue
        if u==b:return list(path)
        for v,w in adj[u]:
            nxt=(round(cost+w,9),path+(v,))
            if v not in path and (v not in best or nxt<best[v]):best[v]=nxt;heapq.heappush(q,(nxt[0],nxt[1],v))
    return []

def build(features,k,quantile):
    dist=np.maximum(0,1-features@features.T);np.fill_diagonal(dist,np.inf)
    if len(features)<2:return [[] for _ in features],dist,0.0
    pairs={}
    for i in range(len(features)):
        for j in np.argsort(dist[i],kind='stable')[:min(k,len(features)-1)]:
            a,b=sorted((i,int(j)));pairs[(a,b)]=round(float(dist[a,b]),7)
    limit=float(np.quantile(list(pairs.values()),quantile))
    adj=[[] for _ in features]
    for (a,b),w in sorted(pairs.items()):
        if w<=limit:adj[a].append([b,w]);adj[b].append([a,w])
    for row in adj:row.sort()
    return adj,dist,limit

def main():
    p=argparse.ArgumentParser();p.add_argument('--methods',nargs='+',default=['baseline','dino','clip']);p.add_argument('--select');p.add_argument('--k',type=int,default=5);p.add_argument('--quantile',type=float,default=.90);p.add_argument('--pairs',type=Path,help='Optional JSON endpoint pairs for your own library');args=p.parse_args()
    if args.k<1 or not 0<args.quantile<=1:p.error('k must be positive and quantile in (0,1]')
    cat=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'));ids=[s['id'] for s in cat['styles']]
    pairs=json.loads(args.pairs.read_text()) if args.pairs else [p for p in PAIRS if all(id in ids for id in p)]
    report=[];graphs={};all_neighbors={}
    for method in args.methods:
        v=np.load(ROOT/f'.runtime/features/{method}.npy');meta=json.loads((ROOT/f'.runtime/features/{method}.json').read_text());assert meta['datasetVersion']==cat['version'] and meta['ids']==ids
        adj,dist,limit=build(v,args.k,args.quantile)
        routes=[];usage=np.zeros(len(ids),int)
        for a,b in pairs:
            route=shortest(adj,ids.index(a),ids.index(b));
            for i in route[1:-1]:usage[i]+=1
            routes.append({'from':a,'to':b,'ids':[ids[i] for i in route],'edgeDistances':[round(float(dist[route[i],route[i+1]]),5) for i in range(len(route)-1)]})
        edges=sum(map(len,adj))//2
        stats={'method':method,'k':args.k,'quantile':args.quantile,'maxEdgeDistance':round(limit,7),'edges':edges,'isolated':[ids[i] for i,x in enumerate(adj) if not x],'reachableTestPairs':sum(bool(r['ids']) for r in routes),'testPairs':len(routes),'routes':routes,'mostUsedIntermediate':[{'id':ids[i],'uses':int(usage[i])} for i in np.argsort(-usage)[:8] if usage[i]],'featureMetadata':meta}
        report.append(stats)
        graph={'datasetVersion':cat['version'],'method':method,'config':{'neighbors':args.k,'symmetric':'union','maxEdgeQuantile':args.quantile,'maxEdgeDistance':round(limit,7)},'ids':ids,'adjacency':adj}
        graph['version']=hashlib.sha256(json.dumps(graph,sort_keys=True).encode()).hexdigest()[:12];graphs[method]=graph
        all_neighbors[method]=[[ids[int(i)] for i in np.argsort(dist[j],kind='stable')[:6]] for j in range(len(ids))]
    out=ROOT/'research';out.mkdir(exist_ok=True)
    (out/'comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    comparison={'datasetVersion':cat['version'],'methods':report,'neighbors':all_neighbors}
    (out/'comparison-data.js').write_text('window.COMPARISON='+json.dumps(comparison,ensure_ascii=False)+';',encoding='utf-8')
    if args.select:
        assert args.select in graphs
        (ROOT/'data/graph.json').write_text(json.dumps(graphs[args.select]),encoding='utf-8')
        print('Selected',args.select,'graph',graphs[args.select]['version'])
    for r in report:print(r['method'],'edges',r['edges'],'reachable pairs',r['reachableTestPairs'],'isolated',len(r['isolated']))

if __name__=='__main__':main()
