import {shortestPath,promptFor,validateData,shareURL} from './core.mjs';

const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORAGE='style-path-explorer.favorites.v1';
const state={catalog:null,graph:null,styles:new Map(),favorites:new Set(),from:null,to:null,picking:null,detail:null,language:'zh',onlyFavorites:false,examples:[]};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200)}
function imageFailure(e){e.currentTarget.style.opacity='.3';e.currentTarget.alt='图片暂未加载';}
function loadFavorites(){try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(!saved)return;if(saved.version!==state.catalog.version){toast('收藏来自其他资料版本，暂未导入');return}if(Array.isArray(saved.ids))state.favorites=new Set(saved.ids.filter(id=>state.styles.has(id)));}catch{toast('本次收藏暂存于页面，浏览器存储不可用')}}
function saveFavorites(){try{localStorage.setItem(STORAGE,JSON.stringify({version:state.catalog.version,ids:[...state.favorites].sort()}))}catch{toast('收藏已保留在本页，但无法保存到浏览器')}}
function favoriteButton(style){const button=document.createElement('button');button.className=state.favorites.has(style.id)?'saved':'';button.textContent=state.favorites.has(style.id)?'♥':'♡';button.setAttribute('aria-label',`${state.favorites.has(style.id)?'取消收藏':'收藏'}画风 ${style.id}`);button.setAttribute('aria-pressed',String(state.favorites.has(style.id)));button.onclick=()=>toggleFavorite(style.id);return button}
function toggleFavorite(id){if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);saveFavorites();$('saved-count').textContent=state.favorites.size;renderGrid();renderRoute(false);if(state.detail)updateSaveButton()}
function renderGrid(){
 const q=$('search').value.trim().toLowerCase(),group=$('category').value;
 const rows=state.catalog.styles.filter(s=>(!state.onlyFavorites||state.favorites.has(s.id))&&(!group||s.group===group)&&(!q||[s.id,s.name,s.author,s.traits].join(' ').toLowerCase().includes(q)));
 const fragment=document.createDocumentFragment();
 for(const style of rows){
  const card=document.createElement('article');card.className='style-card'+([state.from,state.to].includes(style.id)?' selected':'');card.dataset.id=style.id;
  const button=document.createElement('button');button.className='card-image';button.setAttribute('aria-label',`${state.picking?'选为'+(state.picking==='from'?'起点':'终点'):'查看画风'} ${style.id} ${style.name}`);button.draggable=true;
  button.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',style.id);e.dataTransfer.effectAllowed='copy'});
  button.onclick=()=>state.picking?chooseEndpoint(state.picking,style.id):openDetail(style.id);
  const img=document.createElement('img');img.src=style.avatar;img.alt=style.name;img.loading='lazy';img.decoding='async';img.onerror=imageFailure;button.append(img);card.append(button);
  const meta=document.createElement('div');meta.className='card-meta';const number=document.createElement('span');number.textContent='#'+style.id;meta.append(number,favoriteButton(style));card.append(meta);
  const name=document.createElement('p');name.className='card-name';name.textContent=style.name;name.title=style.name;card.append(name);fragment.append(card);
 }
 $('grid').replaceChildren(fragment);$('visible-count').textContent=`${rows.length} / ${state.catalog.count} 张`;$('empty-grid').hidden=rows.length>0;
}
function pick(which){state.picking=which;state.onlyFavorites=false;$('filter-favorites').setAttribute('aria-pressed','false');$('selection-notice').hidden=false;$('selection-text').textContent=which==='from'?'选一张，作为起点':'选一张，作为终点';$('pick-from').classList.toggle('picking',which==='from');$('pick-to').classList.toggle('picking',which==='to');renderGrid();$('library').scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'})}
function cancelPicking(){state.picking=null;$('selection-notice').hidden=true;$('pick-from').classList.remove('picking');$('pick-to').classList.remove('picking')}
function chooseEndpoint(which,id){if(!state.styles.has(id))return;state[which]=id;cancelPicking();renderGrid();renderRoute();if(!state.from||!state.to){pick(!state.from?'from':'to');return}document.querySelector('.journey').scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'})}
function routeError(message){$('route').classList.remove('long-route');const p=document.createElement('p');p.className='empty error';p.textContent=message;$('route').replaceChildren(p);$('route-count').textContent='';$('share-route').disabled=true}
function renderRoute(animate=true){
 $('from-info').textContent=state.from?`#${state.from} · ${state.styles.get(state.from).name}`:'选择起点';$('to-info').textContent=state.to?`#${state.to} · ${state.styles.get(state.to).name}`:'选择终点';
 if(!state.from||!state.to){routeError('选择两张头像，开始一段画风旅行。');return}
 const path=shortestPath(state.graph,state.from,state.to);
 if(path===null){routeError('这个编号不在当前画风库里，请重新选择。');return}
 $('share-route').disabled=false;
 if(!path.length){routeError('这两种画风之间，暂时没有找到可用的连接。试试更换一个端点。');$('share-route').disabled=false;$('route-note').textContent='没有合适路线时，我们不插入图片凑数。';updateURL();return}
 const fragment=document.createDocumentFragment();
 path.forEach((id,i)=>{
  if(i){const connector=document.createElement('span');connector.className='route-connector';connector.setAttribute('aria-hidden','true');fragment.append(connector)}
  const style=state.styles.get(id),card=document.createElement('article');card.className='route-item'+((i===0||i===path.length-1)?' endpoint-item':'');card.dataset.id=id;card.dataset.endpoint=path.length===1?'起点 / 终点':i===0?'起点':'终点';
  const delay=i===0||i===path.length-1?0:.35+Math.min(i-1,path.length-2-i)*.14;card.style.setProperty('--delay',delay+'s');if(!animate)card.style.animation='none';
  const button=document.createElement('button');button.className='route-portrait';button.setAttribute('aria-label',`查看路径画风 ${id} ${style.name}`);button.onclick=()=>openDetail(id);const img=document.createElement('img');img.src=style.avatar;img.alt=style.name;img.onerror=imageFailure;button.append(img);card.append(button);
  const meta=document.createElement('div');meta.className='route-label';const label=document.createElement('strong');label.textContent='#'+id;meta.append(label,favoriteButton(style));card.append(meta);const name=document.createElement('p');name.className='route-name';name.textContent=style.name;name.title=style.name;card.append(name);fragment.append(card);
 });
 $('route').replaceChildren(fragment);$('route').classList.toggle('long-route',path.length>6);$('route-count').textContent=path.length===1?'同一张头像':`${path.length} 张 · ${path.length-1} 次连接`;
 $('route-note').textContent=path.length===1?'起点和终点相同。点开这张，查看画风和提示词。':path.length===2?'这两张在视觉网络中直接相邻，无需中间图片。':'每一张都是已有画风。点击图片，放大看看。';
 for(const b of $('examples').children)b.classList.toggle('active',b.dataset.from===state.from&&b.dataset.to===state.to);
 updateURL();
}
function updateURL(){try{history.replaceState(null,'',shareURL(location.href,state.graph,state.from,state.to))}catch{/* Sharing remains available even when history is restricted. */}}
function openDetail(id){const style=state.styles.get(id);if(!style)return;state.detail=style;$('detail-image').src=style.avatar;$('detail-image').alt=style.name;$('detail-number').textContent=`STYLE ${id} / ${style.group}`;$('detail-name').textContent=style.name;$('detail-author').textContent=`参考作者 / 风格名称：${style.author}`;$('detail-traits').textContent=style.traits;$('reference-link').href=style.referenceImage;$('reference-link').download=`style-${id}-reference.webp`;$('reference-instruction').hidden=true;$('reference-instruction').textContent="参考图仅用于借鉴画风。只提取线条、笔触、媒介、材质、色彩倾向和整体视觉语言；不要沿用图中的人物、场景、构图或文字。画面内容以你的主题为准。需要图片参考时，在生图工具中另行上传。";$('prompt-source').textContent=`上游：yang0/handraw-style · ${state.catalog.upstreamRevision.slice(0,7)} · ${state.catalog.version}`;updateSaveButton();updatePrompt();if(!$('detail').open)$('detail').showModal()}
function updateSaveButton(){const saved=state.favorites.has(state.detail.id);$('save-style').textContent=saved?'♥ 已收藏这个画风':'♡ 收藏这个画风';$('save-style').setAttribute('aria-pressed',String(saved))}
function options(){return {ratio:$('ratio').value,subject:$('subject').value,text:$('text-requirement').value}}
function sourceURL(){const repo=state.catalog.upstreamRepository||'yang0/handraw-style';return repo!=='custom'&&/^[\w.-]+\/[\w.-]+$/.test(repo)&&/^[a-f0-9]{40}$/.test(state.catalog.upstreamRevision)?`https://github.com/${repo}/tree/${state.catalog.upstreamRevision}`:''}
function updatePrompt(){if(!state.detail)return;$('prompt-output').value=promptFor(state.detail,$('theme').value,options())[state.language];const url=sourceURL();if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent='查看上游版本 ↗';$('prompt-source').replaceChildren(document.createTextNode('来源：yang0 / handraw-style · '),link)}else $('prompt-source').textContent='画风资料由当前素材库提供；提示词结构参考 handraw-style。'}
function language(value){state.language=value;for(const key of ['zh','en']){$('tab-'+key).setAttribute('aria-selected',String(key===value));$('tab-'+key).tabIndex=key===value?0:-1}updatePrompt()}
async function copy(text,fallback){try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);toast('已复制')}catch{fallback.focus();fallback.select();toast('无法自动复制，文字已选中，可手动复制')}}
function downloadPrompt(){const s=state.detail,p=promptFor(s,$('theme').value,options());const text=[`#${s.id} · ${s.name}`,'','中文提示词',p.zh,'','English prompt',p.en,'','来源与说明',sourceURL()?`上游：${sourceURL()}`:'画风资料：自定义素材库；模板结构参考handraw-style。',`数据版本：${state.catalog.version}`,'按上游固定版本模板输出，不是该头像的原始生图记录。','英文模板中的主题保持用户原文。','需要图片参考时，另行上传同编号风格参考图，仅借画风，不沿用参考图内容。'].join('\n');const blob=new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`style-${s.id}-prompt.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('提示词文件已导出')}
function showShare(){if(!state.from||!state.to)return;$('share-output').value=shareURL(location.href,state.graph,state.from,state.to);$('share-dialog').showModal()}
function applyPair(from,to){cancelPicking();state.from=from;state.to=to;renderGrid();renderRoute()}
function setup(){
 for(const group of [...new Set(state.catalog.styles.map(s=>s.group))]){const o=document.createElement('option');o.value=o.textContent=group;$('category').append(o)}
 $('total-count').textContent=state.catalog.count;$('library-total').firstChild.nodeValue=String(state.catalog.count);$('saved-count').textContent=state.favorites.size;$('random-pair').disabled=!state.examples.length;
 $('pick-from').onclick=()=>pick('from');$('pick-to').onclick=()=>pick('to');$('cancel-selection').onclick=()=>{cancelPicking();renderGrid()};
 for(const [id,which] of [['pick-from','from'],['pick-to','to']]){const el=$(id);el.addEventListener('dragover',e=>{if(!e.dataTransfer.types.includes('text/plain'))return;e.preventDefault();el.classList.add('picking')});el.addEventListener('dragleave',()=>el.classList.remove('picking'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('picking');chooseEndpoint(which,e.dataTransfer.getData('text/plain'))})}
 $('swap').onclick=()=>{if(state.from&&state.to)applyPair(state.to,state.from)};
 $('collection-link').onclick=()=>{state.onlyFavorites=false;$('filter-favorites').setAttribute('aria-pressed','false');renderGrid();$('library').scrollIntoView()};
 $('favorites-link').onclick=()=>{state.onlyFavorites=true;$('filter-favorites').setAttribute('aria-pressed','true');$('search').value='';$('category').value='';renderGrid();$('library').scrollIntoView()};
 $('filter-favorites').onclick=()=>{state.onlyFavorites=!state.onlyFavorites;$('filter-favorites').setAttribute('aria-pressed',String(state.onlyFavorites));renderGrid()};
 $('search').oninput=renderGrid;$('category').onchange=renderGrid;
 $('close-detail').onclick=()=>$('detail').close();$('detail').addEventListener('click',e=>{if(e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close()}});
 $('save-style').onclick=()=>toggleFavorite(state.detail.id);
 $('detail-from').onclick=()=>{$('detail').close();chooseEndpoint('from',state.detail.id)};$('detail-to').onclick=()=>{$('detail').close();chooseEndpoint('to',state.detail.id)};
 for(const id of ['theme','ratio','subject','text-requirement'])$(id).oninput=updatePrompt;
 $('tab-zh').onclick=()=>language('zh');$('tab-en').onclick=()=>language('en');for(const id of ['tab-zh','tab-en'])$(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();language(state.language==='zh'?'en':'zh');$('tab-'+state.language).focus()}});language('zh');
 $('copy-prompt').onclick=()=>copy($('prompt-output').value,$('prompt-output'));$('download-prompt').onclick=downloadPrompt;$('reference-help').onclick=()=>{$('reference-instruction').hidden=!$('reference-instruction').hidden};
 $('share-route').onclick=showShare;$('copy-share').onclick=()=>copy($('share-output').value,$('share-output'));$('close-share').onclick=()=>$('share-dialog').close();
 $('random-pair').onclick=()=>{const choices=state.examples.filter(p=>p.from!==state.from||p.to!==state.to);const pair=choices[Math.floor(Math.random()*choices.length)]||state.examples[0];if(pair)applyPair(pair.from,pair.to)};
 for(const [i,pair] of state.examples.entries()){const b=document.createElement('button');b.textContent=`旅行 ${String(i+1).padStart(2,'0')}`;b.dataset.from=pair.from;b.dataset.to=pair.to;b.setAttribute('aria-label',`探索示例路线 ${pair.from} 到 ${pair.to}`);b.onclick=()=>applyPair(pair.from,pair.to);$('examples').append(b)}
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.picking){cancelPicking();renderGrid()}});
}
async function start(){try{
 const [catalog,graph,exampleData]=await Promise.all(['data/catalog.json','data/graph.json','data/examples.json'].map(async path=>{const r=await fetch(path);if(!r.ok)throw new Error('画风资料暂未打开');return r.json()}));validateData(catalog,graph);
 state.catalog=catalog;state.graph=graph;state.styles=new Map(catalog.styles.map(s=>[s.id,s]));const examplesMatch=(!exampleData.datasetVersion||exampleData.datasetVersion===catalog.version)&&(!exampleData.graphVersion||exampleData.graphVersion===graph.version);state.examples=examplesMatch?exampleData.pairs.filter(p=>state.styles.has(p.from)&&state.styles.has(p.to)):[];loadFavorites();setup();renderGrid();
 document.body.dataset.ready='true';
 const params=new URLSearchParams(location.search),from=params.get('from'),to=params.get('to');
 if(from||to){
  if(params.get('v')!==catalog.version||params.get('g')!==graph.version){routeError('这条分享链接来自其他资料版本，当前无法重现。你可以选择下方示例，开始新的旅行。');return}
  if(!state.styles.has(from)||!state.styles.has(to)){routeError('分享链接中的画风编号无效，请重新选择。');return}
  applyPair(from,to);
 }else if(state.examples.length)applyPair(state.examples[0].from,state.examples[0].to);else renderRoute();
 document.body.dataset.ready='true';
}catch(error){routeError('画风库暂未打开。请通过预览服务访问，或稍后刷新重试。');$('route-note').textContent=error.message;console.error(error)}}
start();
