import {shortestPath, promptFor, promptDecision, validateData, shareURL} from './core.mjs';

const $ = id => document.getElementById(id);
function displayId(style) { return style.styleId || style.id; }
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORAGE = 'style-path-explorer.favorites.v1';

const state = {
  catalog: null,
  graph: null,
  styles: new Map(),
  favorites: new Set(),
  from: null,
  to: null,
  picking: null,
  detail: null,
  language: 'zh',
  onlyFavorites: false,
  examples: []
};

let toastTimer;
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2800);
}

function imageFailure(e) {
  e.currentTarget.style.opacity = '.25';
  e.currentTarget.alt = '图片未加载';
}

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (!saved) return;
    if (saved.version !== state.catalog.version && !(state.catalog.compatibleFavoriteVersions || []).includes(saved.version)) {
      toast('收藏来自其他资料版本，暂未导入');
      return;
    }
    if (Array.isArray(saved.ids)) {
      state.favorites = new Set(saved.ids.filter(id => state.styles.has(id)));
    }
  } catch {
    toast('本次收藏暂存于页面，浏览器存储不可用');
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify({
      version: state.catalog.version,
      ids: [...state.favorites].sort()
    }));
  } catch {
    toast('收藏已保留在本页，但无法持久化到浏览器');
  }
}

function favoriteButton(style) {
  const button = document.createElement('button');
  const isFav = state.favorites.has(style.id);
  button.className = 'fav-btn' + (isFav ? ' saved' : '');
  button.textContent = isFav ? '♥' : '♡';
  button.setAttribute('aria-label', `${isFav ? '取消收藏' : '收藏'}画风 ${displayId(style)}`);
  button.setAttribute('aria-pressed', String(isFav));
  button.onclick = (e) => {
    e.stopPropagation();
    toggleFavorite(style.id);
  };
  return button;
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }
  saveFavorites();
  $('saved-count').textContent = state.favorites.size;
  renderGrid();
  renderRoute(false);
  if (state.detail) updateSaveButton();
}

function renderGrid() {
  const q = $('search').value.trim().toLowerCase();
  const internalQuery = /^#?\d{1,3}$/.test(q) ? q.replace('#', '').padStart(3, '0') : null;
  const group = $('category').value;
  const rows = state.catalog.styles.filter(s =>
    (!state.onlyFavorites || state.favorites.has(s.id)) &&
    (!group || s.group === group) &&
    (!q || (internalQuery ? (s.internalCode || s.id) === internalQuery : [s.id, s.styleId, s.internalCode, s.name, s.author, s.traits].join(' ').toLowerCase().includes(q)))
  ).sort((a, b) => displayId(a).localeCompare(displayId(b), 'en', {numeric: true}));

  const fragment = document.createDocumentFragment();
  for (const style of rows) {
    const card = document.createElement('article');
    card.className = 'style-card' + ([state.from, state.to].includes(style.id) ? ' selected' : '');
    card.dataset.id = style.id;

    const button = document.createElement('button');
    button.className = 'card-image';
    button.setAttribute('aria-label', `${state.picking ? '选为' + (state.picking === 'from' ? '起点' : '终点') : '查看画风'} ${displayId(style)} ${style.name}`);
    button.draggable = true;

    button.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', style.id);
      e.dataTransfer.effectAllowed = 'copy';
    });

    button.onclick = () => state.picking ? chooseEndpoint(state.picking, style.id) : openDetail(style.id);

    const img = document.createElement('img');
    img.src = style.avatar;
    img.alt = style.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = imageFailure;
    button.append(img);
    card.append(button);

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const number = document.createElement('span');
    number.className = 'card-id';
    number.textContent = displayId(style);
    meta.append(number, favoriteButton(style));
    card.append(meta);

    const name = document.createElement('p');
    name.className = 'card-name';
    name.textContent = style.name;
    name.title = style.name;
    card.append(name);

    fragment.append(card);
  }

  $('grid').replaceChildren(fragment);
  $('visible-count').textContent = `${rows.length} / ${state.catalog.count} 种`;
  $('empty-grid').hidden = rows.length > 0;
}

function pick(which) {
  state.picking = which;
  state.onlyFavorites = false;
  $('filter-favorites').setAttribute('aria-pressed', 'false');
  $('selection-notice').hidden = false;
  $('selection-text').textContent = which === 'from' ? '选择一张画风，作为出发起点' : '选择一张画风，作为到达终点';
  $('pick-from').classList.toggle('picking', which === 'from');
  $('pick-to').classList.toggle('picking', which === 'to');
  renderGrid();
  $('library').scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
}

function cancelPicking() {
  state.picking = null;
  $('selection-notice').hidden = true;
  $('pick-from').classList.remove('picking');
  $('pick-to').classList.remove('picking');
}

function chooseEndpoint(which, id) {
  if (!state.styles.has(id)) return;
  state[which] = id;
  cancelPicking();
  renderGrid();
  renderRoute();
  if (!state.from || !state.to) {
    pick(!state.from ? 'from' : 'to');
    return;
  }
  document.querySelector('.journey').scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
}

function routeError(message) {
  $('route').classList.remove('long-route');
  const p = document.createElement('p');
  p.className = 'empty error';
  p.textContent = message;
  $('route').replaceChildren(p);
  $('route-count').textContent = '';
  $('share-route').disabled = true;
}

function updateEndpointPedestals() {
  const fromThumb = $('from-thumb'), fromHolder = $('from-placeholder');
  const toThumb = $('to-thumb'), toHolder = $('to-placeholder');

  if (state.from && state.styles.has(state.from)) {
    const s = state.styles.get(state.from);
    $('from-info').textContent = `${displayId(s)} · ${s.name}`;
    if (fromThumb && fromHolder) {
      fromThumb.src = s.avatar;
      fromThumb.alt = s.name;
      fromThumb.hidden = false;
      fromHolder.hidden = true;
      $('pick-from').classList.add('has-selection');
    }
  } else {
    $('from-info').textContent = '选择起点';
    if (fromThumb && fromHolder) {
      fromThumb.hidden = true;
      fromHolder.hidden = false;
      $('pick-from').classList.remove('has-selection');
    }
  }

  if (state.to && state.styles.has(state.to)) {
    const s = state.styles.get(state.to);
    $('to-info').textContent = `${displayId(s)} · ${s.name}`;
    if (toThumb && toHolder) {
      toThumb.src = s.avatar;
      toThumb.alt = s.name;
      toThumb.hidden = false;
      toHolder.hidden = true;
      $('pick-to').classList.add('has-selection');
    }
  } else {
    $('to-info').textContent = '选择终点';
    if (toThumb && toHolder) {
      toThumb.hidden = true;
      toHolder.hidden = false;
      $('pick-to').classList.remove('has-selection');
    }
  }
}

function createPhotoClip() {
  const clip = document.createElement('span');
  clip.className = 'photo-clip';
  clip.setAttribute('aria-hidden', 'true');
  clip.innerHTML = `<svg viewBox="0 0 16 32" width="16" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="14" width="10" height="17" rx="1" fill="rgba(7,7,9,0.12)"/>
    <path d="M4 2C4 1 5 0 6 0H7V30C7 31 6 32 5 32C4 32 4 31 4 30V2Z" fill="url(#clip-l)"/>
    <path d="M12 2C12 1 11 0 10 0H9V30C9 31 10 32 11 32C12 32 12 31 12 30V2Z" fill="url(#clip-r)"/>
    <rect x="7" y="11" width="2" height="4" fill="#3D414A"/>
    <rect x="2.5" y="11" width="11" height="4" rx="2" fill="url(#clip-s)"/>
    <circle cx="8" cy="13" r="1.4" fill="#434954"/>
    <defs>
      <linearGradient id="clip-l" x1="4" y1="0" x2="7" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#DFCCA8"/>
        <stop offset="0.5" stop-color="#C7AE87"/>
        <stop offset="1" stop-color="#A88D65"/>
      </linearGradient>
      <linearGradient id="clip-r" x1="12" y1="0" x2="9" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#D7C39E"/>
        <stop offset="0.5" stop-color="#BEA47D"/>
        <stop offset="1" stop-color="#9E835B"/>
      </linearGradient>
      <linearGradient id="clip-s" x1="2.5" y1="11" x2="13.5" y2="15" gradientUnits="userSpaceOnUse">
        <stop stop-color="#D0D5DE"/>
        <stop offset="0.5" stop-color="#8F97A4"/>
        <stop offset="1" stop-color="#4B515D"/>
      </linearGradient>
    </defs>
  </svg>`;
  return clip;
}

function triggerPathReveal() {
  if (reduced) return;
  const routeEl = $('route');
  const cards = [...routeEl.querySelectorAll('.route-item')];
  if (!cards.length) return;

  cards.forEach((card, i) => {
    const rot = card.style.getPropertyValue('--rest-rot') || '0deg';
    const initSway = i % 2 === 0 ? '-3.5deg' : '3.5deg';
    card.animate([
      { opacity: 0, transform: `translateY(-20px) rotate(${initSway})` },
      { opacity: 1, transform: `translateY(0) rotate(${rot})` }
    ], {
      duration: 550,
      delay: 60 + i * 65,
      easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
      fill: 'both'
    });
  });
}

function findRandomJourneyPair(minLen = 7, maxLen = 11) {
  if (!state.graph || !state.graph.ids || !state.graph.ids.length) return null;
  const ids = state.graph.ids;
  for (let attempt = 0; attempt < 250; attempt++) {
    const i = Math.floor(Math.random() * ids.length);
    const j = Math.floor(Math.random() * ids.length);
    if (i === j) continue;
    const from = ids[i];
    const to = ids[j];
    if (from === state.from && to === state.to) continue;
    const path = shortestPath(state.graph, from, to);
    if (path && path.length >= minLen && path.length <= maxLen) {
      return { from, to, path };
    }
  }
  return null;
}

function renderHeroFan(path) {
  const fanEl = $('hero-fan');
  if (!fanEl) return;

  // 7、图片数量 7-11 张；低于 7 张的随机或路线，不要显示展台
  if (!path || path.length < 7 || path.length > 11) {
    fanEl.replaceChildren();
    fanEl.style.display = 'none';
    return;
  }

  fanEl.style.display = 'flex';
  const N = path.length;
  const half = (N - 1) / 2;
  const maxSpread = 135 + N * 15;
  const fragment = document.createDocumentFragment();

  // 4、扇形第一张是起点，最后一张是终点，中间为自然过渡轨迹
  path.forEach((id, i) => {
    const style = state.styles.get(id);
    if (!style) return;

    const u = half === 0 ? 0 : (i - half) / half;
    const tx = Math.round(u * maxSpread);
    const ty = Math.round(u * u * 48);
    const rot = Math.round(u * 14 * 10) / 10;
    const z = Math.round(20 - Math.abs(i - half) * 2);

    const card = document.createElement('article');
    card.className = 'fan-card';
    card.style.setProperty('--tx', `${tx}px`);
    card.style.setProperty('--ty', `${ty}px`);
    card.style.setProperty('--rot', `${rot}deg`);
    card.style.setProperty('--z', String(z));
    card.dataset.id = id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `画风 ${style.name}`);

    // 纯粹艺术画幅：无徽标、无文字、无操作按钮，纯净展示
    const mount = document.createElement('div');
    mount.className = 'fan-card-mount';
    const img = document.createElement('img');
    img.src = style.avatar;
    img.alt = style.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = imageFailure;
    mount.append(img);
    card.append(mount);

    card.onclick = () => openDetail(id);
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(id);
      }
    };

    fragment.append(card);
  });

  fanEl.replaceChildren(fragment);
}

function renderRoute(animate = true) {
  updateEndpointPedestals();

  if (!state.from || !state.to) {
    routeError('请选定两张画风，开启一段视觉探索。');
    renderHeroFan(null);
    return;
  }

  const path = shortestPath(state.graph, state.from, state.to);
  renderHeroFan(path);

  if (path === null) {
    routeError('该画风编号不在素材库中，请重新选择。');
    return;
  }

  $('share-route').disabled = false;
  if (!path.length) {
    routeError('这两种画风之间暂时没有可行的视觉过渡路径，试试更换其中一个端点。');
    $('share-route').disabled = false;
    $('route-note').textContent = '无合适路径时，系统不使用无关图片凑数。';
    updateURL();
    return;
  }

  const fragment = document.createDocumentFragment();
  const restAngles = [-1.4, 1.1, -0.7, 1.5, -1.0, 0.8, -1.3, 0.9, -0.5, 1.2, -0.9];

  path.forEach((id, i) => {
    const style = state.styles.get(id);
    const card = document.createElement('article');
    const isStart = (i === 0);
    const isEnd = (i === path.length - 1);
    const restRot = restAngles[i % restAngles.length];

    card.className = 'route-item' + (isStart ? ' is-start-photo' : isEnd ? ' is-end-photo' : '');
    card.dataset.id = id;
    card.style.setProperty('--rest-rot', `${restRot}deg`);

    // 顶部暗房相片夹（夹在晾衣线上）
    card.append(createPhotoClip());

    const button = document.createElement('button');
    button.className = 'route-portrait';
    button.setAttribute('aria-label', `查看路径画风 ${displayId(style)} ${style.name}`);
    button.onclick = () => openDetail(id);

    const img = document.createElement('img');
    img.src = style.avatar;
    img.alt = style.name;
    img.onerror = imageFailure;
    button.append(img);
    card.append(button);

    const meta = document.createElement('div');
    meta.className = 'route-label';

    const tagGroup = document.createElement('div');
    tagGroup.className = 'route-tag-group';

    const stepTag = document.createElement('span');
    stepTag.className = 'route-step-tag' + (isStart || isEnd ? ' is-endpoint' : '');
    stepTag.textContent = path.length === 1 ? '端点' : isStart ? '起点' : isEnd ? '终点' : `№ 0${i}`;

    const idTag = document.createElement('strong');
    idTag.className = 'route-id-tag';
    idTag.textContent = displayId(style);

    tagGroup.append(stepTag, idTag);
    meta.append(tagGroup, favoriteButton(style));
    card.append(meta);

    const name = document.createElement('p');
    name.className = 'route-name';
    name.textContent = style.name;
    name.title = style.name;
    card.append(name);

    // 鼠标在卡片左半或右半游移时，感应微风并触发角翘起
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const isLeft = (e.clientX - rect.left) < (rect.width / 2);
      card.classList.toggle('curl-left', isLeft);
      card.classList.toggle('curl-right', !isLeft);
    });
    card.addEventListener('mouseleave', () => {
      card.classList.remove('curl-left', 'curl-right');
    });

    fragment.append(card);
  });

  $('route').replaceChildren(fragment);
  $('route').classList.toggle('long-route', path.length > 6);
  $('route-count').textContent = path.length === 1 ? '同张画风' : `${path.length} 种画风 · ${path.length - 1} 次视觉流变`;
  $('route-note').textContent = path.length === 1
    ? '起点和终点为同一画风。点击放大，查看该画风并提取提示词。'
    : path.length === 2
    ? '两张画风在视觉网络中直接相邻，构成最直接的笔触关联。'
    : '每一张均为素材库真实画风，如相片风干晾挂。鼠标划过时随风轻扬，角部微翘；点击放大提取提示词。';

  for (const b of $('examples').children) {
    b.classList.toggle('active', b.dataset.from === state.from && b.dataset.to === state.to);
  }

  updateURL();

  if (animate) {
    requestAnimationFrame(triggerPathReveal);
  }
}

function updateURL() {
  // 不在默认漫游时污染地址栏，保证用户刷新页面时能呈现全新随机画风路径；
  // 分享功能在点击“分享路径”时调用 shareURL 独立生成精确链接。
}

function openDetail(id) {
  const style = state.styles.get(id);
  if (!style) return;
  state.detail = style;

  // 1. Probe avatar
  $('detail-image').src = style.avatar;
  $('detail-image').alt = `${style.name} · 人物样张`;

  // 2. Original reference artwork
  const refImg = $('detail-reference-image');
  if (refImg) {
    refImg.src = style.referenceImage;
    refImg.alt = `${style.name} · 原典参考图`;
  }

  // 提取精炼分类中文名，去除字母前缀与长斜杠英文，不显示内部编号
  const cleanGroup = (style.group || '').replace(/^[A-Z]{2}\s*/, '').split('/')[0].trim();
  $('detail-number').textContent = cleanGroup ? `${displayId(style)} · ${cleanGroup}` : displayId(style);
  $('detail-name').textContent = style.name;
  $('detail-name').title = style.name;
  $('detail-author').textContent = `参考作者 / 风格标识：${style.author}`;
  $('detail-traits').textContent = style.traits;
  $('reference-link').href = style.referenceImage;
  $('reference-link').download = `style-${displayId(style)}-reference.webp`;
  $('reference-instruction').hidden = true;
  $('reference-instruction').textContent = "参考图用于借鉴整体视觉语言（笔触、线条、材质、色彩搭配与媒介特征），请勿照搬图中的人物、场景或文字内容。画面具体元素由你的主题决定；生图工具中可作为图像参考（Image-to-Image / Style Reference）上传。";
  $('prompt-source').textContent = `资料来源：yang0/handraw-style · ${state.catalog.upstreamRevision.slice(0, 7)} · ${state.catalog.version}`;

  updateSaveButton();
  updatePrompt();
  if (!$('detail').open) $('detail').showModal();
}

function updateSaveButton() {
  const saved = state.favorites.has(state.detail.id);
  $('save-style').textContent = saved ? '♥ 已收藏' : '♡ 收藏';
  $('save-style').setAttribute('aria-pressed', String(saved));
}

function options() {
  return {
    model: $('prompt-model').value,
    ratio: $('ratio').value,
    subject: $('subject').value,
    text: $('text-requirement').value
  };
}

function sourceURL() {
  const repo = state.catalog.upstreamRepository || 'yang0/handraw-style';
  return repo !== 'custom' && /^[\w.-]+\/[\w.-]+$/.test(repo) && /^[a-f0-9]{40}$/.test(state.catalog.upstreamRevision)
    ? `https://github.com/${repo}/tree/${state.catalog.upstreamRevision}`
    : '';
}

function updatePrompt() {
  if (!state.detail) return;
  $('prompt-output').value = promptFor(state.detail, $('theme').value, options())[state.language];
  const decision = promptDecision(state.detail, options().model);
  $('reference-instruction').hidden = !decision.useReferenceImage;
  $('reference-instruction').textContent = decision.useReferenceImage
    ? '这份提示词需要参考图：请下载对应画风参考图，并与提示词一起上传到生图工具。只借画风，画面内容由你的主题决定。'
    : '按上游当前模型规则，这张画风可使用文字提示词；参考图仍可单独下载。模型判断来自上游规则，实际效果以生成结果为准。';
  $('prompt-source').textContent = '来源：yang0 / handraw-style';
}

function language(value) {
  state.language = value;
  for (const key of ['zh', 'en']) {
    $('tab-' + key).setAttribute('aria-selected', String(key === value));
    $('tab-' + key).tabIndex = key === value ? 0 : -1;
  }
  updatePrompt();
}

async function copy(text, fallback) {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    toast('提示词已复制到剪贴板');
  } catch {
    fallback.focus();
    fallback.select();
    toast('无法自动复制，文字已自动选中，请按 Ctrl+C 复制');
  }
}

function downloadPrompt() {
  const s = state.detail, p = promptFor(s, $('theme').value, options());
  const text = [
    `${displayId(s)} · ${s.name}`,
    `内部识别代码：${s.internalCode || s.id}`,
    '',
    '【中文提示词】',
    p.zh,
    '',
    '【English Prompt】',
    p.en,
    '',
    '【来源与使用说明】',
    sourceURL() ? `上游参考：${sourceURL()}` : '画风资料：自定义素材库；模板结构参考 handraw-style。',
    `数据版本：${state.catalog.version}`,
    `模型配置：${options().model}；按上游模型规则输出，非该头像原始生图记录。`,
    '英文模板中的主题保留用户原文。',
    '如需图片参考，可在生图工具中上传对应编号的风格参考图；仅借画风，不复用人物与构图。'
  ].join('\n');

  const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `style-${displayId(s)}-prompt.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('提示词文件已导出');
}

function showShare() {
  if (!state.from || !state.to) {
    toast('请先选择两个画风端点');
    return;
  }
  $('share-output').value = shareURL(location.href, state.graph, state.from, state.to);
  if (!$('share-dialog').open) $('share-dialog').showModal();
}

function applyPair(from, to) {
  cancelPicking();
  state.from = from;
  state.to = to;
  renderGrid();
  renderRoute();
}

function setup() {
  for (const group of [...new Set(state.catalog.styles.map(s => s.group))]) {
    const o = document.createElement('option');
    o.value = o.textContent = group;
    $('category').append(o);
  }

  $('total-count').textContent = state.catalog.count;
  if ($('library-total')) {
    if ($('library-total').firstChild) {
      $('library-total').firstChild.nodeValue = String(state.catalog.count);
    } else {
      $('library-total').textContent = String(state.catalog.count);
    }
  }
  $('saved-count').textContent = state.favorites.size;
  if ($('random-pair')) {
    $('random-pair').disabled = !state.examples.length;
  }

  $('pick-from').onclick = () => pick('from');
  $('pick-to').onclick = () => pick('to');
  $('cancel-selection').onclick = () => {
    cancelPicking();
    renderGrid();
  };

  // Drag and Drop support onto Start / End pedestals
  for (const [id, which] of [['pick-from', 'from'], ['pick-to', 'to']]) {
    const el = $(id);
    el.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('text/plain')) return;
      e.preventDefault();
      el.classList.add('picking');
    });
    el.addEventListener('dragleave', () => el.classList.remove('picking'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('picking');
      chooseEndpoint(which, e.dataTransfer.getData('text/plain'));
    });
  }

  $('swap').onclick = () => {
    if (state.from && state.to) applyPair(state.to, state.from);
  };

  $('collection-link').onclick = () => {
    state.onlyFavorites = false;
    $('filter-favorites').setAttribute('aria-pressed', 'false');
    renderGrid();
    $('library').scrollIntoView({ behavior: 'smooth' });
  };

  $('favorites-link').onclick = () => {
    state.onlyFavorites = true;
    $('filter-favorites').setAttribute('aria-pressed', 'true');
    $('search').value = '';
    $('category').value = '';
    renderGrid();
    $('library').scrollIntoView({ behavior: 'smooth' });
  };

  $('filter-favorites').onclick = () => {
    state.onlyFavorites = !state.onlyFavorites;
    $('filter-favorites').setAttribute('aria-pressed', String(state.onlyFavorites));
    renderGrid();
  };

  $('search').oninput = renderGrid;
  $('category').onchange = renderGrid;

  $('close-detail').onclick = () => $('detail').close();
  $('detail').addEventListener('click', e => {
    if (e.target === $('detail')) {
      const r = $('detail').getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        $('detail').close();
      }
    }
  });

  $('save-style').onclick = () => toggleFavorite(state.detail.id);

  function scrollToJourney() {
    const target = document.querySelector('.journey');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if ($('detail-back-journey')) {
    $('detail-back-journey').onclick = () => {
      $('detail').close();
      scrollToJourney();
    };
  }

  if ($('bottom-back-journey')) {
    $('bottom-back-journey').onclick = scrollToJourney;
  }

  const floatingBtn = $('floating-back-journey');
  if (floatingBtn) {
    floatingBtn.onclick = scrollToJourney;
    window.addEventListener('scroll', () => {
      const journey = document.querySelector('.journey');
      if (!journey) return;
      const threshold = journey.offsetTop + journey.offsetHeight;
      if (window.scrollY > threshold - 80) {
        floatingBtn.classList.add('visible');
      } else {
        floatingBtn.classList.remove('visible');
      }
    }, { passive: true });
  }

  $('detail-from').onclick = () => {
    $('detail').close();
    chooseEndpoint('from', state.detail.id);
  };
  $('detail-to').onclick = () => {
    $('detail').close();
    chooseEndpoint('to', state.detail.id);
  };

  for (const id of ['theme', 'ratio', 'subject', 'text-requirement', 'prompt-model']) {
    $(id).oninput = updatePrompt;
  }
  $('prompt-model').onchange = updatePrompt;

  $('tab-zh').onclick = () => language('zh');
  $('tab-en').onclick = () => language('en');
  for (const id of ['tab-zh', 'tab-en']) {
    $(id).addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        language(state.language === 'zh' ? 'en' : 'zh');
        $('tab-' + state.language).focus();
      }
    });
  }
  language('zh');

  $('copy-prompt').onclick = () => copy($('prompt-output').value, $('prompt-output'));
  $('download-prompt').onclick = downloadPrompt;
  $('reference-help').onclick = () => {
    $('reference-instruction').hidden = !$('reference-instruction').hidden;
  };

  $('share-route').onclick = showShare;
  $('copy-share').onclick = () => copy($('share-output').value, $('share-output'));
  $('close-share').onclick = () => $('share-dialog').close();
  $('share-dialog').addEventListener('click', e => {
    if (e.target === $('share-dialog')) {
      const r = $('share-dialog').getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        $('share-dialog').close();
      }
    }
  });

  if ($('random-pair')) {
    $('random-pair').onclick = () => {
      const pair = findRandomJourneyPair(7, 11);
      if (pair) {
        applyPair(pair.from, pair.to);
      } else {
        const choices = state.examples.filter(p => p.from !== state.from || p.to !== state.to);
        const p = choices[Math.floor(Math.random() * choices.length)] || state.examples[0];
        if (p) applyPair(p.from, p.to);
      }
    };
  }

  for (const [i, pair] of state.examples.entries()) {
    const b = document.createElement('button');
    b.textContent = `路线 ${String(i + 1).padStart(2, '0')}`;
    b.dataset.from = pair.from;
    b.dataset.to = pair.to;
    b.setAttribute('aria-label', `探索精选路线 ${pair.from} 到 ${pair.to}`);
    b.onclick = () => applyPair(pair.from, pair.to);
    $('examples').append(b);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.picking) {
      cancelPicking();
      renderGrid();
    }
  });
}

async function start() {
  try {
    const [catalog, graph, exampleData] = await Promise.all([
      'data/catalog.json',
      'data/graph.json',
      'data/examples.json'
    ].map(async path => {
      const r = await fetch(path);
      if (!r.ok) throw new Error('画风资料暂未打开');
      return r.json();
    }));

    validateData(catalog, graph);

    state.catalog = catalog;
    state.graph = graph;
    state.styles = new Map(catalog.styles.map(s => [s.id, s]));

    const examplesMatch = (!exampleData.datasetVersion || exampleData.datasetVersion === catalog.version) &&
      (!exampleData.graphVersion || exampleData.graphVersion === graph.version);
    state.examples = examplesMatch ? exampleData.pairs.filter(p => state.styles.has(p.from) && state.styles.has(p.to)) : [];

    loadFavorites();
    setup();
    renderGrid();

    document.body.dataset.ready = 'true';

    const navEntry = performance.getEntriesByType('navigation')[0];
    const isReload = (navEntry && navEntry.type === 'reload') || (window.performance?.navigation?.type === 1);
    const params = new URLSearchParams(location.search);
    const from = params.get('from');
    const to = params.get('to');

    if (isReload) {
      // 每次刷新：清除旧查询参数，随机呈现全新的一组 7-11 张画风变迁路径与扇形展台
      try {
        history.replaceState(null, '', location.pathname);
      } catch {}
      const freshPair = findRandomJourneyPair(7, 11) || findRandomJourneyPair(6, 12);
      if (freshPair) {
        applyPair(freshPair.from, freshPair.to);
      } else if (state.examples.length) {
        const p = state.examples[Math.floor(Math.random() * state.examples.length)];
        applyPair(p.from, p.to);
      } else {
        renderRoute();
      }
    } else if (from || to) {
      const matchingCurrent = params.get('v') === catalog.version && params.get('g') === graph.version;
      const matchingWebExport = (graph.compatibleShareVersions || []).some(version =>
        version.datasetVersion === params.get('v') && version.graphVersion === params.get('g'));
      if (!matchingCurrent && !matchingWebExport) {
        routeError('该分享链接来自其他版本，当前素材库无法重现。你可以浏览精选路线或自由探索。');
        return;
      }
      if (!state.styles.has(from) || !state.styles.has(to)) {
        routeError('分享链接中的画风编号无效，请重新选择。');
        return;
      }
      applyPair(from, to);
    } else {
      const initialPair = findRandomJourneyPair(7, 11) || findRandomJourneyPair(6, 12);
      if (initialPair) {
        applyPair(initialPair.from, initialPair.to);
      } else if (state.examples.length) {
        const p = state.examples[Math.floor(Math.random() * state.examples.length)];
        applyPair(p.from, p.to);
      } else {
        renderRoute();
      }
    }

    document.body.dataset.ready = 'true';
  } catch (error) {
    routeError('画风库暂未打开。请通过本地静态服务访问，或稍后刷新重试。');
    $('route-note').textContent = error.message;
    console.error(error);
  }
}

start();
