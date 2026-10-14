export function shortestPath(graph, from, to) {
  const start=graph.ids.indexOf(from), end=graph.ids.indexOf(to);
  if(start<0||end<0) return null;
  const n=graph.ids.length, distances=Array(n).fill(Infinity), paths=Array(n).fill(null), visited=new Set();
  distances[start]=0; paths[start]=[start];
  const key=p=>p.map(i=>graph.ids[i]).join(',');
  for(let step=0;step<n;step++){
    let u=-1;
    for(let i=0;i<n;i++) if(!visited.has(i)&&paths[i]&&(u<0||distances[i]<distances[u]||(distances[i]===distances[u]&&key(paths[i])<key(paths[u]))))u=i;
    if(u<0)return [];
    if(u===end)return paths[u].map(i=>graph.ids[i]);
    visited.add(u);
    for(const [v,w] of graph.adjacency[u]){
      if(visited.has(v)||paths[u].includes(v))continue;
      const candidate=Math.round((distances[u]+w)*1e9)/1e9, next=[...paths[u],v];
      if(candidate<distances[v]||(candidate===distances[v]&&(!paths[v]||key(next)<key(paths[v])))){distances[v]=candidate;paths[v]=next;}
    }
  }
  return [];
}

export function promptFor(style, theme='', options={}) {
  const topic=theme.trim()||'【填写你的创作主题】';
  const extras=[['ratio','画幅','aspect ratio'],['subject','主体限制','subject constraints'],['text','文字要求','text requirement']].filter(([k])=>options[k]?.trim());
  const zhExtra=extras.map(([k,label])=>`${label}：${options[k].trim()}`).join('；');
  const enExtra=extras.map(([k,,label])=>`${label}: ${options[k].trim()}`).join('; ');
  return {
    zh:`风格名称：#${style.id} · ${style.name}。主题：${topic}。参考作者/风格名称：${style.author}。${zhExtra?'；'+zhExtra:''}`,
    en:`Style name: #${style.id} · ${style.name}. Theme: ${topic}. Reference author/style name: ${style.author}.${enExtra?' '+enExtra+'.':''}`
  };
}

export function validateData(catalog,graph) {
  if(!catalog?.version||!Array.isArray(catalog.styles)||!Array.isArray(graph?.ids)||graph.datasetVersion!==catalog.version)throw new Error('图片资料与路线版本不一致');
  const ids=catalog.styles.map(s=>s.id);
  if(new Set(ids).size!==ids.length||JSON.stringify(ids)!==JSON.stringify(graph.ids)||graph.adjacency?.length!==ids.length)throw new Error('画风编号或路线资料不完整');
  graph.adjacency.forEach((edges,i)=>{if(!Array.isArray(edges))throw new Error('路线资料无效');for(const [j,w] of edges){if(!Number.isInteger(j)||j<0||j>=ids.length||j===i||!Number.isFinite(w)||w<0)throw new Error('路线连接无效');}});
  return true;
}

export function shareURL(base,graph,from,to) {
  const url=new URL(base);url.search='';url.hash='';
  for(const [key,value] of Object.entries({from,to,v:graph.datasetVersion,g:graph.version}))url.searchParams.set(key,value);
  return url.href;
}
