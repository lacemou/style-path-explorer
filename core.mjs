import promptPolicy from './data/prompt-policy.mjs';

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

export function promptDecision(style, model='gpt-image-2') {
  const profile=promptPolicy.models[model]||{};
  const entry={...promptPolicy.default,...profile,...(profile.styles?.[style.styleId]||profile.styles?.[style.internalCode||style.id]||{})};
  const raw=style.traits||'';
  const keepRaw=['FE-048','FE-049','FE-051','FH-050','FD-042'].includes(style.styleId)||['240','242','257','259','260'].includes(style.internalCode||style.id);
  const traits=keepRaw?raw:raw.split(/[；;。\n]+/).map(s=>s.replace(/^[ ，,、：:。；;\t]+|[ ，,、：:。；;\t]+$/g,'')).filter(s=>s&&!/避免|不要|不准|禁止|无(?:写实纹理|精细材质|真实纹理)/.test(s)).join('；');
  if(entry.name_activation==='strong')return {model,traits:'',useReferenceImage:false};
  if(entry.traits_activation==='strong'&&traits)return {model,traits,useReferenceImage:false};
  return {model,traits,useReferenceImage:true};
}

export function promptFor(style, theme='', options={}) {
  const topic=theme.trim()||'【请在此输入画面主题，或在生图模型中垫入你的照片】';
  const decision=promptDecision(style,options.model||'gpt-image-2');
  const traitsZh=decision.traits?`核心风格特征：${decision.traits}。`:'';
  const traitsEn=decision.traits?` Core style traits: ${decision.traits}.`:'';
  // Browser adaptation: use the matching downloadable reference, never a local Skill path.
  const referenceZh=decision.useReferenceImage?'参考图：请上传本页下载的对应画风参考图。所附图片仅用于参考画风。只提取参考图的风格特征，例如线条、笔触、媒介、材质、色彩倾向和整体视觉语言；不要使用、复制或延续参考图中的任何主体、人物、动物、服装、道具、动作、姿态、场景、背景、构图、布局、文字或故事。最终画面内容完全以用户提供的主题为准。':'';
  const referenceEn=decision.useReferenceImage?" Reference image: upload the matching style reference downloaded from this page. Use the attached image only as a style reference. Extract only its stylistic qualities, such as linework, brushwork, medium, material texture, color tendencies, and overall visual language. Do not use, copy, or carry over any subject, person, animal, clothing, prop, action, pose, setting, background, composition, layout, text, or story from the reference image. The user's written theme is the sole source for the image content.":'';
  const extras=[['ratio','画幅','aspect ratio'],['subject','主体限制','subject constraints'],['text','文字要求','text requirement']].filter(([k])=>options[k]?.trim());
  const zhExtra=extras.map(([k,label])=>`${label}：${options[k].trim()}`).join('；');
  const enExtra=extras.map(([k,,label])=>`${label}: ${options[k].trim()}`).join('; ');
  return {
    zh:`风格名称：${style.name}。主题：${topic}。参考作者/风格名称：${style.author}。${traitsZh}${referenceZh}${zhExtra?'；'+zhExtra:''}`,
    en:`Style name: ${style.name}. Theme: ${topic}. Reference author/style name: ${style.author}.${traitsEn}${referenceEn}${enExtra?' '+enExtra+'.':''}`
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
