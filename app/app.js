/* ============================================================
   app.js — Yura iOS preview: router, screens, interactions.
   Vanilla ES modules; mirrors the SwiftUI screen structure.
   ============================================================ */
import { yura, METRICS, PROVIDERS, MODES } from './data/yura-sdk.js?v=13';
import * as I from './data/interpret.js?v=13';

// ---------------- tiny DOM helpers ----------------
const $ = (s, r = document) => r.querySelector(s);
const screensEl = $('#screens');
const sheetEl = $('#sheet'), scrimEl = $('#scrim'), sheetBody = $('#sheet-body');
const fsEl = $('#fsmodal');

function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// ---------------- fit device to window ----------------
// On a laptop the 393×852 frame is often taller than the window, which made the
// preview feel "stuck" (bottom cut off, no scroll). Scale it down to always fit.
// On narrow windows / phones, drop the bezel and fill the screen instead.
const deviceEl = document.getElementById('device');
function fitDevice() {
  const W = window.innerWidth, H = window.innerHeight;
  const bare = W <= 520;
  document.body.classList.toggle('bare', bare);
  deviceEl.classList.toggle('bare', bare);
  if (bare) { deviceEl.style.removeProperty('--fit'); return; }
  const margin = 28;
  const scale = Math.min(1, (H - margin) / 882, (W - margin) / 415);
  deviceEl.style.setProperty('--fit', scale.toFixed(3));
}
fitDevice();
window.addEventListener('resize', fitDevice);

// ---------------- icons ----------------
const ICON = {
  today:   '<path d="M3 11l9-8 9 8M5 10v10h14V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  connect: '<path d="M9 12a3 3 0 0 1 3-3h2a3 3 0 0 1 0 6h-1M15 12a3 3 0 0 1-3 3h-2a3 3 0 0 1 0-6h1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  timeline:'<path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  doctor:  '<path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-1M20 12a2 2 0 1 0 0 .01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  discover:'<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.5 6.5-2 5-5 2 2-5 5-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  spark:   '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="currentColor"/>',
  bell:    '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 21a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  gear:    '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.06-.3.1-.66.1-1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  chev:    '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  moon:    '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  wave:    '<path d="M2 12h3l2-6 3 12 3-9 2 3h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  heart:   '<path d="M12 20S4 14.5 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.5-8 11-8 11Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  shoe:    '<path d="M3 16v-4l5-2 3 3 5 1 5 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  lung:    '<path d="M12 3v9M8 12c0-3-5-2-5 3s1 6 3 6 2-3 2-5M16 12c0-3 5-2 5 3s-1 6-3 6-2-3-2-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  temp:    '<path d="M10 13V5a2 2 0 1 1 4 0v8a4 4 0 1 1-4 0Z" fill="none" stroke="currentColor" stroke-width="2"/>',
  ear:     '<path d="M6 10a6 6 0 0 1 12 0c0 3-2 4-3.5 5.2C13 16.4 13 18 11.5 18 10 18 10 16 8.5 15 7 14 6 12.5 6 10Zm6 0a1.5 1.5 0 0 0-3 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  pulse:   '<path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  bolt:    '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  calendar:'<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 4h16M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  glass:   '<path d="M6 4h12l-1.5 8.5a5 5 0 0 1-9 0L6 4Z M12 17v3M9 21h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  video:   '<path d="M4 7a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm11 3 5-3v10l-5-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  check:   '<path d="M5 12l5 5 9-11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  x:       '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  plus:    '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  share:   '<path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  apple:   '<path d="M16 12c0-2 1.6-3 1.7-3a3.7 3.7 0 0 0-2.9-1.6c-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7A3.9 3.9 0 0 0 4 12.6c0 2.4 1.7 5.4 3.4 5.4.8 0 1.1-.5 2.2-.5s1.3.5 2.2.5c1.7 0 3.2-2.7 3.2-2.7S16 14.4 16 12Zm-3-6.3c.6-.7.5-1.7.5-1.7s-1 .1-1.6.8c-.5.6-.6 1.6-.6 1.6s1.1 0 1.7-.7Z" fill="currentColor"/>',
  google:  '<path d="M21 12.2c0-.7-.1-1.2-.2-1.8H12v3.4h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-6.9Z" fill="#4285F4"/><path d="M12 21c2.5 0 4.6-.8 6.1-2.2l-3.1-2.4c-.8.6-1.9 1-3 1a5.2 5.2 0 0 1-4.9-3.6H3.9v2.4A9 9 0 0 0 12 21Z" fill="#34A853"/><path d="M7.1 13.8a5.4 5.4 0 0 1 0-3.5V7.9H3.9a9 9 0 0 0 0 8.3l3.2-2.4Z" fill="#FBBC05"/><path d="M12 7.6c1.4 0 2.6.5 3.5 1.4l2.7-2.7A9 9 0 0 0 3.9 7.9l3.2 2.4A5.2 5.2 0 0 1 12 7.6Z" fill="#EA4335"/>',
  family:  '<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 20c0-3 2.7-5 6-5s6 2 6 5M15 20c0-2 .5-3.4 1.5-4.2.8-.6 2-.8 2.5-.8 2 0 3 1.5 3 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  lab:     '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  doc2:    '<path d="M6 3h8l5 5v13H6V3Z M14 3v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
};
const svg = (name, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${ICON[name] || ''}</svg>`;

// ---------------- charts ----------------
function ringSVG(score, size = 132) {
  const r = size/2 - 11, c = 2*Math.PI*r, cx = size/2;
  return `<svg width="${size}" height="${size}">
    <defs>
      <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#aab6ff"/><stop offset=".55" stop-color="#d7dcff"/><stop offset="1" stop-color="#f3f5ff"/>
      </linearGradient>
      <filter id="rgGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--hairline-2)" stroke-width="11"/>
    <circle class="ring-prog" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="11"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-c="${c}" data-score="${score}"
      filter="url(#rgGlow)"/>
  </svg>`;
}
function sparkline(values, color = 'var(--ink)', w = 150, ht = 30) {
  if (!values.length) return '';
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [i/(values.length-1)*w, ht - (v-min)/span*(ht-4) - 2]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg class="spark-svg" width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none" style="color:${color}">
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:draw .9s var(--ease-out) forwards"/>
  </svg><style>@keyframes draw{to{stroke-dashoffset:0}}</style>`;
}
function lineChart(b, color = 'var(--ink)', w = 320, ht = 170) {
  const s = b.series, min = Math.min(...s, b.lo), max = Math.max(...s, b.hi), span = (max-min)||1;
  const X = i => i/(s.length-1)*w;
  const Y = v => ht - (v-min)/span*(ht-16) - 8;
  const line = s.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
  const area = line + ` L ${w} ${ht} L 0 ${ht} Z`;
  const bandTop = Y(b.hi), bandH = Y(b.lo) - Y(b.hi);
  return `<svg width="100%" height="${ht}" viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none" style="color:${color}">
    <defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="currentColor" stop-opacity=".18"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <rect x="0" y="${bandTop.toFixed(1)}" width="${w}" height="${Math.max(2,bandH).toFixed(1)}" fill="var(--ink)" opacity=".06"/>
    <line x1="0" y1="${Y(b.mean).toFixed(1)}" x2="${w}" y2="${Y(b.mean).toFixed(1)}" stroke="var(--ink-faint)" stroke-width="1" stroke-dasharray="3 4" opacity=".5"/>
    <path d="${area}" fill="url(#cf)"/>
    <path d="${line}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"
      pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.1s var(--ease-out) forwards"/>
  </svg>`;
}

// animate ring after insert
function animateRings(root) {
  root.querySelectorAll('.ring-prog').forEach(p => {
    const c = +p.dataset.c, score = +p.dataset.score;
    requestAnimationFrame(() => { p.style.transition = 'stroke-dashoffset 1.3s var(--ease-out)'; p.style.strokeDashoffset = c * (1 - score/100); });
  });
  root.querySelectorAll('[data-countup]').forEach(el => {
    const target = +el.dataset.countup; let cur = 0; const t0 = performance.now();
    const step = now => { const k = Math.min(1, (now-t0)/1100); cur = Math.round(target*(1-Math.pow(1-k,3))); el.textContent = cur; if (k<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

// ---------------- shell / nav helpers ----------------
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function openSheet(html) {
  sheetBody.innerHTML = html;
  scrimEl.classList.add('open'); sheetEl.classList.add('open');
  animateRings(sheetBody);
}
function closeSheet() { scrimEl.classList.remove('open'); sheetEl.classList.remove('open'); }
scrimEl.addEventListener('click', closeSheet);

function openFS(html) { fsEl.innerHTML = html; fsEl.classList.add('open'); animateRings(fsEl); }
function closeFS() { fsEl.classList.remove('open'); setTimeout(() => fsEl.innerHTML = '', 400); }

// ---------------- theme ----------------
function applyTheme(mode) {
  localStorage.setItem('yura-theme', mode);
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const eff = mode === 'system' ? (sysDark ? 'dark' : 'light') : mode;
  document.documentElement.setAttribute('data-theme', eff);
}
const _urlTheme = new URLSearchParams(location.search).get('theme');
applyTheme(_urlTheme || localStorage.getItem('yura-theme') || 'dark');

// clock
function tickClock(){ const d=new Date(); $('#clock').textContent = d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).replace(/\s?[AP]M/,''); }
tickClock(); setInterval(tickClock, 10000);

// ============================================================
//  STATE + ROUTER
// ============================================================
const state = { screen: 'splash', tab: 'today', obIndex: 0, mode: localStorage.getItem('yura-mode') || 'adult' };
function setMode(m){ state.mode = m; localStorage.setItem('yura-mode', m); }

function show(name) {
  state.screen = name;
  screensEl.innerHTML = '';
  const r = RENDER[name]();
  r.classList.add('entering');
  screensEl.appendChild(r);
  animateRings(r);
  const inApp = name === 'app';
  $('#tabbar').hidden = !inApp;
  $('#nav-actions').hidden = !inApp;
  if (!inApp) $('#navbar').classList.remove('show'); // clear collapsed title outside the app
  if (inApp) buildTabbar();
}

// ============================================================
//  SCREENS
// ============================================================
const RENDER = {};

// ---- Splash ----
RENDER.splash = () => {
  const s = h(`<div class="screen"><div class="splash"><div class="sorb"></div><div class="wm"></div></div></div>`);
  setTimeout(() => show('onboarding'), 1900);
  return s;
};

// ---- Onboarding ----
const OB = [
  { t:'Understand <em>your</em> data, not just numbers.', p:'Yura connects every wearable you own and turns scattered metrics into one clear story.' },
  { t:'Yura learns <em>your</em> normal.', p:'Insights are measured against your personal baseline, so you see what actually changed, and why it might matter.' },
  { t:'Bring it to <em>your</em> doctor.', p:'Turn months of data into a concise, doctor-ready summary you can securely share in seconds.' },
];
RENDER.onboarding = () => {
  const i = state.obIndex, slide = OB[i];
  const s = h(`<div class="screen"><div class="ob">
    <div class="ob-orb"></div>
    <div class="ob-body">
      <div class="logo-mark" style="width:46px;height:46px;margin-bottom:20px"></div>
      <h1>${slide.t}</h1><p>${slide.p}</p>
      <div class="dots">${OB.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
      <button class="btn btn-iris" id="ob-next">${i<OB.length-1?'Continue':'Get started'}</button>
      <div class="disclaimer">Yura provides wellness insights, not medical diagnoses.</div>
    </div></div></div>`);
  s.querySelector('#ob-next').onclick = () => { if (i<OB.length-1){ state.obIndex++; show('onboarding'); } else show('auth'); };
  return s;
};

// ---- Auth ----
RENDER.auth = () => {
  const s = h(`<div class="screen"><div class="ob">
    <div class="ob-orb" style="opacity:.4"></div>
    <div class="ob-body" style="justify-content:center">
      <div class="logo-word" style="width:140px;height:48px;margin:0 auto 8px"></div>
      <p style="text-align:center;margin-bottom:26px">Your health, in context.</p>
      <div class="field"><input id="em" type="email" placeholder="Email" value="alex@yura.health"/></div>
      <div class="field"><input id="pw" type="password" placeholder="Password" value="••••••••"/></div>
      <button class="btn btn-primary" id="signin">Sign in</button>
      <div style="display:flex;align-items:center;gap:12px;margin:18px 0;color:var(--ink-faint);font-size:13px"><div style="flex:1;height:1px;background:var(--hairline)"></div>or<div style="flex:1;height:1px;background:var(--hairline)"></div></div>
      <div class="field"><button class="btn btn-apple" id="apple">${svg('apple',20)} Continue with Apple</button></div>
      <button class="btn btn-google" id="google">${svg('google',20)} Continue with Google</button>
      <div class="disclaimer">By continuing you agree to Yura's Terms & Privacy.</div>
    </div></div></div>`);
  const go = async (fn) => { await fn(); show('profile'); };
  s.querySelector('#signin').onclick = () => go(() => yura.auth.signInWithPassword({ email:'alex@yura.health' }));
  s.querySelector('#apple').onclick  = () => go(() => yura.auth.signInWithOAuth({ provider:'apple' }));
  s.querySelector('#google').onclick = () => go(() => yura.auth.signInWithOAuth({ provider:'google' }));
  return s;
};

// ---- Personalization questionnaire (sets the persona mode) ----
const QUIZ = [
  { id:'age', q:'How old are you?', opts:[['genz','Under 25'],['adult','25–59'],['simple','60+']] },
  { id:'occupation', q:'What best describes you?', opts:[['athlete','Athlete / very active'],['adult','Professional / busy'],['genz','Student'],['simple','Retired']] },
  { id:'schedule', q:'Your typical day is…', opts:[['adult','9-to-5 structured'],['athlete','Built around training'],['genz','Different every day'],['simple','Relaxed and flexible']] },
  { id:'goal', q:'What do you want from Yura?', opts:[['athlete','Peak performance & recovery'],['adult','Stay ahead of my health'],['genz','Keep good habits & vibes'],['simple','Simple peace of mind']] },
];
RENDER.profile = () => {
  state._quiz = state._quiz || { step: 0, votes: {} };
  const qz = state._quiz;
  const q = QUIZ[qz.step];
  const s = h(`<div class="screen"><div class="scroll" style="padding-top:84px">
    <div class="nav-large"><div class="eyebrow">Personalizing · ${qz.step+1} of ${QUIZ.length}</div><h1 style="font-size:30px">${q.q}</h1></div>
    <div class="px" style="color:var(--ink-dim);font-size:14.5px;margin:-2px 22px 20px;line-height:1.5">Health means something different to everyone. Your answers shape your dashboard, language and what Yura watches for, powered by AI.</div>
    <div class="quiz-opts">${q.opts.map(([mode,label],i)=>`<button class="quiz-opt" data-mode="${mode}">${label}</button>`).join('')}</div>
    <div class="dots" style="margin-top:26px">${QUIZ.map((_,k)=>`<i class="${k<=qz.step?'on':''}"></i>`).join('')}</div>
  </div></div>`);
  s.querySelectorAll('.quiz-opt').forEach(b => b.onclick = () => {
    const m = b.dataset.mode; qz.votes[m] = (qz.votes[m]||0)+1;
    if (qz.step < QUIZ.length-1) { qz.step++; show('profile'); }
    else {
      // pick the most-voted mode
      const best = Object.entries(qz.votes).sort((a,b)=>b[1]-a[1])[0][0];
      setMode(best); state._quiz = null; state.tab='today'; show('app');
      toast('Personalized: ' + MODES[best].label + ' mode');
    }
  });
  return s;
};

// ============================================================
//  MAIN APP (tabbed)
// ============================================================
const TABS = [
  { id:'today', label:'Today', icon:'today' },
  { id:'connect', label:'Connect', icon:'connect' },
  { id:'timeline', label:'Trends', icon:'timeline' },
  { id:'doctor', label:'Doctor', icon:'doctor' },
  { id:'discover', label:'Discover', icon:'discover' },
];
function buildTabbar() {
  const tb = $('#tabbar');
  tb.innerHTML = TABS.map(t => `<div class="tab ${t.id===state.tab?'active':''}" data-tab="${t.id}">${svg(t.icon,25)}<span class="lbl">${t.label}</span></div>`).join('');
  tb.querySelectorAll('.tab').forEach(el => el.onclick = () => { state.tab = el.dataset.tab; show('app'); });
  // nav actions: Ask Yura + profile
  const na = $('#nav-actions');
  na.innerHTML = `<div class="nav-icon-btn" id="ask-btn" title="Ask Yura"><span class="logo-mark" style="width:19px;height:19px;display:block"></span></div>
                  <div class="avatar" id="me-btn">${yura._db.users[0].avatar}</div>`;
  na.querySelector('#ask-btn').onclick = openAskYura;
  na.querySelector('#me-btn').onclick = openSettings;
}

RENDER.app = () => {
  const screen = h(`<div class="screen has-tabbar"><div class="orb" style="top:-120px;left:-80px"></div><div class="scroll" id="scroll"></div></div>`);
  const scroll = screen.querySelector('#scroll');
  scroll.innerHTML = TAB_VIEW[state.tab]();
  // nav bar collapse on scroll
  const title = TABS.find(t=>t.id===state.tab).label;
  $('#navbar-title').textContent = title;
  scroll.addEventListener('scroll', () => {
    $('#navbar').classList.toggle('show', scroll.scrollTop > 46);
  });
  wireTab(state.tab, scroll);
  return screen;
};

// ---------------- TAB: TODAY ----------------
const TAB_VIEW = {};
TAB_VIEW.today = () => state.mode === 'simple' ? todaySimple() : todayRich();

// shared rich layout for Everyday / Gen Z / Athlete, retailored by mode
function todayRich() {
  const u = yura._db.users[0];
  const score = I.yuraScore(), lab = I.scoreLabel(score);
  const ins = I.insights();
  const m = state.mode;
  const hr = new Date().getHours();
  const greet = hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
  const sc = scoreColor(score);

  // mode-specific framing
  const cfg = {
    adult:   { eyebrow:'Readiness today', greet:`${greet}, ${u.first}`, tiles:['sleep','hrv','rhr','steps','stress','spo2'], drivers:true, extra:'' },
    genz:    { eyebrow:'today’s vibe', greet:`hey ${u.first} ✦`, tiles:['sleep','stress','steps','hrv','hearing','spo2'], drivers:true,
               extra:`<div class="card streak"><div><div style="font-family:var(--font-display);font-weight:800;font-size:30px;color:var(--ink)">12<span style="font-size:15px;color:var(--ink-faint)"> day streak</span></div><div style="font-size:13px;color:var(--ink-dim);margin-top:2px">Logged every day. Share your week and flex the glow-up.</div></div><button class="btn btn-iris sm" id="share-week2">Share</button></div>` },
    athlete: { eyebrow:'Training readiness', greet:`${greet}, ${u.first}`, tiles:['hrv','rhr','sleep','resp','steps','hearing'], drivers:true,
               extra:`<div class="card reco"><div class="reco-ic">${svg('bolt',22)}</div><div style="flex:1"><div style="font-family:var(--font-display);font-weight:700;font-size:16px;color:var(--ink)">Today: active recovery</div><div style="font-size:13px;color:var(--ink-dim);margin-top:3px">Readiness ${score}/100 with HRV below baseline. Keep it Zone 2; hold heavy intervals for 1–2 days.</div></div></div>` },
  }[m];

  return `
  <div class="nav-large"><div class="eyebrow">${cfg.greet}</div><h1>Today</h1></div>
  <div class="mode-row">${modeChip()}</div>
  <div class="ring-hero">
    <div class="orb-inner"></div>
    <div class="hero-top">
      <div class="ring">${ringSVG(score)}<div class="ring-center"><div class="score" data-countup="${score}" style="color:${sc}">0</div></div></div>
      <div class="ring-text">
        <div class="eyebrow">${cfg.eyebrow}</div>
        <h2 style="color:${sc}">${lab.word}</h2>
        <p>${lab.desc}</p>
        <div class="week-link" id="story-btn">View your week ${svg('chev',15)}</div>
      </div>
    </div>
    <div class="hero-strip">${(m==='athlete'?['hrv','rhr','sleep']:['sleep','hrv','rhr']).map(heroStat).join('')}</div>
  </div>

  ${cfg.extra}

  ${predictiveCard()}

  <div class="section-label">What's shaping today</div>
  <div class="card drivers">${I.scoreContributors().map(driverRow).join('')}</div>

  <div class="card live-card" id="live-card">
    <div class="live-ic">${svg('pulse',22)}</div>
    <div style="flex:1"><div style="display:flex;align-items:center;gap:8px"><span style="font-family:var(--font-display);font-weight:700;font-size:16px;color:var(--ink)">Live health</span><span class="livedot"></span></div>
      <div style="font-size:13px;color:var(--ink-dim);margin-top:2px">Real-time alerts, next best action, and smart scheduling.</div></div>
    ${svg('chev',20)}
  </div>

  <div class="section-label">What changed</div>
  ${ins.slice(0,3).map(insightCard).join('')}

  <div class="section-label">Your signals</div>
  <div class="tiles stagger">${cfg.tiles.map(tileCard).join('')}</div>

  <div class="card" id="ask-card" style="margin-top:18px;display:flex;align-items:center;gap:14px;cursor:pointer">
    <div style="width:46px;height:46px;border-radius:14px;background:var(--iris);display:grid;place-items:center;flex:none"><span class="logo-mark-bone" style="width:26px;height:26px;display:block"></span></div>
    <div style="flex:1"><div style="font-family:var(--font-display);font-weight:700;font-size:16px;color:var(--ink)">Ask Yura</div>
      <div style="font-size:13px;color:var(--ink-dim);margin-top:2px">“Why am I so tired this week?”</div></div>
    ${svg('chev',20)}
  </div>

  <div class="list" style="margin-top:16px">
    <div class="row" id="labs-row"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('lab',20)}</div>
      <div class="r-main"><div class="r-title">Recent labs</div><div class="r-sub">CBC, explained in plain English</div></div>${svg('chev',18)}</div>
    <div class="row" id="family-row"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('family',20)}</div>
      <div class="r-main"><div class="r-title">Family & care circle</div><div class="r-sub">3 people · 1 needs a check-in</div></div>${svg('chev',18)}</div>
  </div>
  <div class="disclaimer">Yura provides wellness insights and physician discussion prompts, not diagnoses.</div>`;
}

// Simple mode — large, plain, no numbers. For older adults & care homes.
function todaySimple() {
  const u = yura._db.users[0];
  const score = I.yuraScore();
  const word = score>=65 ? 'You’re doing well today' : score>=45 ? 'Take it easy today' : 'Please rest today';
  const plain = (key)=>{ const b=I.baseline(key); const ok=(METRICS[key].betterHigh? b.z>-0.6 : b.z<0.6); return ok?'Good':'A little low'; };
  const items = [
    { ic:'moon', label:'Sleep', val: plain('sleep') },
    { ic:'heart', label:'Heart', val: plain('rhr') },
    { ic:'shoe', label:'Moving', val: plain('steps') },
  ];
  return `
  <div class="nav-large"><h1 style="font-size:30px">Hi, ${u.first}</h1></div>
  <div class="mode-row">${modeChip()}</div>
  <div class="simple-hero ${score>=65?'ok':score>=45?'watch':'low'}">
    <div class="simple-emoji">${score>=65?'☺':score>=45?'•':'!'}</div>
    <div class="simple-word">${word}</div>
  </div>
  <div class="simple-cards">
    ${items.map(it=>`<div class="simple-card"><div class="sc-ic">${svg(it.ic,30)}</div><div class="sc-l">${it.label}</div><div class="sc-v ${it.val==='Good'?'good':'watch'}">${it.val}</div></div>`).join('')}
  </div>
  <div class="px">
    <button class="btn btn-iris simple-btn" id="simple-share">Tell my family & care team</button>
    <button class="btn btn-ghost simple-btn" id="simple-call">Call my Yura doctor</button>
  </div>
  <div class="disclaimer">Yura provides wellness guidance, not diagnoses. In an emergency, call your local emergency number.</div>`;
}

function modeChip() {
  return `<div class="mode-chip" id="mode-chip">${MODES[state.mode].label} ${svg('chev',13)}</div>`;
}

function predictiveCard() {
  const preds = I.predictions();
  const top = preds[0];
  return `<div class="card pred-card" id="pred-card">
    <div class="pred-head"><span style="font-family:var(--font-display);font-weight:700;font-size:16px;color:var(--ink)">Predictive signals</span><span class="beta">BETA</span></div>
    <div class="pred-row"><div class="pred-prob ${top.band}">${top.prob}%</div>
      <div><div style="font-weight:600;font-size:14.5px;color:var(--ink)">${top.title}</div>
      <div style="font-size:12.5px;color:var(--ink-dim);margin-top:2px">Likelihood over ${top.window}. Tap to see what's driving it.</div></div></div>
  </div>`;
}

function scoreColor(s) { return s >= 65 ? 'var(--ink)' : s >= 45 ? 'var(--ink-dim)' : 'var(--ink-faint)'; }

function driverRow(d) {
  const w = Math.min(48, Math.abs(d.points) / 12 * 48); // % of half-track
  const pos = d.points >= 0;
  const fill = pos
    ? `left:50%;width:${w}%;background:var(--ink-dim)`
    : `right:50%;width:${w}%;background:var(--ink)`;
  const sign = d.points > 0 ? '+' : '';
  return `<div class="driver" data-ins="${d.key}">
    <div class="dlabel">${d.label}</div>
    <div class="dbar"><span class="center"></span><i style="${fill}"></i></div>
    <div class="dval" style="color:${pos ? 'var(--ink-dim)' : 'var(--ink)'}">${sign}${d.points}</div>
  </div>`;
}

function heroStat(key) {
  const b = I.baseline(key), m = METRICS[key];
  const improving = (m.betterHigh && b.z > 0) || (!m.betterHigh && b.z < 0);
  const dir = Math.abs(b.z) < 0.4 ? 'flat' : improving ? 'up' : 'down';
  const arrow = dir === 'flat' ? '→' : b.z > 0 ? '↑' : '↓';
  return `<div class="hs"><div class="hv">${m.fmt(b.recent)}</div><div class="hl">${m.label}</div><div class="hd ${dir}">${arrow} ${dir === 'flat' ? 'normal' : Math.abs(Math.round(b.pct)) + '%'}</div></div>`;
}

function insightCard(ins) {
  return `<div class="insight" data-ins="${ins.metric}">
    <div class="ins-top"><div class="ins-ico">${svg(METRICS[ins.metric].icon,18)}</div><h3>${ins.title}</h3>
      <span class="chip ${ins.severity}"><span class="dot"></span>${ins.severity==='good'?'On track':ins.severity==='watch'?'Watch':'Notable'}</span></div>
    <p>${ins.body}</p>
    <div class="ins-foot"><span class="confidence"><span class="bars">${[1,2,3].map(n=>`<i class="${n<=ins.confidence?'on':''}"></i>`).join('')}</span>${['','Low','Moderate','High'][ins.confidence]} confidence</span></div>
  </div>`;
}
function tileCard(key) {
  const b = I.baseline(key), m = METRICS[key];
  const delta = m.short(b.recent) - m.short(b.mean);
  const improving = (m.betterHigh && b.z>0) || (!m.betterHigh && b.z<0);
  const dir = Math.abs(b.z)<0.4 ? 'flat' : improving ? 'up' : 'down';
  const arrow = dir==='flat'?'→':b.z>0?'↑':'↓';
  const col = key==='stress'||key==='rhr'||key==='temp'||key==='resp' ? 'var(--ink)' : 'var(--ink-faint)';
  return `<div class="tile" data-ins="${key}">
    <div class="t-head"><div class="t-ico">${svg(m.icon,18)}</div><div class="t-name">${m.label}</div></div>
    <div class="t-val">${m.fmt(b.last)}</div>
    <div class="t-delta ${dir}">${arrow} ${dir==='flat'?'at baseline':'vs your normal'}</div>
    <div class="spark">${sparkline(b.series.slice(-21), col)}</div>
  </div>`;
}

// ---------------- TAB: CONNECT ----------------
TAB_VIEW.connect = () => {
  const conns = yura._db.connections;
  const connectedIds = conns.map(c=>c.provider);
  const available = PROVIDERS.filter(p => !connectedIds.includes(p.id));
  const tl = I.truthLayer('rhr');
  return `
  <div class="nav-large"><div class="eyebrow">${conns.length} connected · ${PROVIDERS.length} supported</div><h1>Connect</h1></div>

  ${tl ? `<div class="card" style="background:var(--iris-soft);border-color:transparent">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><strong style="font-family:var(--font-display);font-size:15px;color:var(--ink)">Cross-device Truth Layer</strong>
      <span class="chip ${tl.confidence==='High'?'good':'watch'}"><span class="dot"></span>${tl.confidence} confidence</span></div>
    <p style="font-size:13.5px;color:var(--ink-dim);line-height:1.5">Your devices report resting HR slightly differently. Yura reconciles them into one number: <strong style="color:var(--ink)">${Math.round(tl.reconciled)} bpm</strong>.</p>
    <div style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap">${tl.sources.map(s=>`<span style="font-size:12px;color:var(--ink-dim)"><b style="color:var(--ink)">${Math.round(s.value)}</b> ${PROVIDERS.find(p=>p.id===s.source)?.name||s.source}</span>`).join('')}</div>
  </div>` : ''}

  <div class="section-label">Connected</div>
  <div class="list">${conns.map(deviceRow).join('')}</div>

  <div class="section-label">Add a device</div>
  <div class="list">${available.map(p=>`
    <div class="row" data-add="${p.id}"><div class="r-ico" style="background:var(--surface-3);color:var(--ink)">${p.name[0]}</div>
      <div class="r-main"><div class="r-title">${p.name}</div><div class="r-sub">${p.metrics.slice(0,3).map(m=>METRICS[m]?.label||m).join(' · ')}</div></div>
      <div class="r-trail"><span class="chip" style="color:var(--coral)">Connect</span></div></div>`).join('')}
  </div>
  <div class="disclaimer">Real device sync uses each provider's secure OAuth. This preview uses representative data.</div>`;
};
function deviceRow(c) {
  return `<div class="row" data-device="${c.provider}"><div class="r-ico" style="background:var(--surface-3);color:var(--ink)">${c.name[0]}</div>
    <div class="r-main"><div class="r-title">${c.name}</div><div class="r-sub">Synced ${c.last_sync}</div></div>
    <div class="r-trail"><div><div style="font-size:11px;color:var(--ink-faint);text-align:right;margin-bottom:3px">${Math.round(c.quality*100)}% quality</div><div class="quality"><i style="width:${c.quality*100}%"></i></div></div></div></div>`;
}

// ---------------- TAB: TIMELINE ----------------
TAB_VIEW.timeline = () => {
  const key = state.tlMetric || 'hrv';
  const keys = ['sleep','hrv','rhr','steps','stress'];
  const b = I.baseline(key), m = METRICS[key];
  const ins = I.insights().find(x=>x.metric===key);
  const col = (key==='stress'||key==='rhr') ? 'var(--ink)' : 'var(--ink-faint)';
  return `
  <div class="nav-large"><div class="eyebrow">Last 90 days</div><h1>Trends</h1></div>
  <div class="segmented" id="tl-seg">${keys.map(k=>`<button class="${k===key?'active':''}" data-m="${k}">${METRICS[k].label}</button>`).join('')}</div>
  <div class="chart-wrap">
    <div class="c-head"><div class="c-val">${m.fmt(b.recent)} <small>7-day avg</small></div><div class="c-meta">baseline ${m.fmt(b.mean)}</div></div>
    ${lineChart(b, col)}
    <div style="display:flex;gap:16px;margin-top:8px;padding:0 4px"><span style="font-size:11.5px;color:var(--ink-faint)"><b style="color:${col}">▬</b> daily</span><span style="font-size:11.5px;color:var(--ink-faint)">⋯ baseline</span><span style="font-size:11.5px;color:var(--ink-faint)">▦ normal range</span></div>
  </div>
  ${ins ? insightCard(ins) : `<div class="card"><p style="color:var(--ink-dim);font-size:14px">${m.label} is tracking within your normal range over this period.</p></div>`}
  <div class="disclaimer">Shaded band = your personal normal (±1 SD). Yura compares you to you.</div>`;
};

// ---------------- TAB: DOCTOR ----------------
TAB_VIEW.doctor = () => {
  const appts = yura._db.appointments.filter(a=>a.status==='booked');
  const links = yura._db.share_links;
  return `
  <div class="nav-large"><h1>Doctor</h1></div>

  <div class="card book-yura" id="book-yura">
    <div class="by-top"><span style="font-family:var(--font-display);font-weight:800;font-size:19px;color:var(--ink)">Book a Yura</span><span class="livedot"></span><span style="font-size:12px;color:var(--green);font-weight:600">2 doctors available now</span></div>
    <p style="font-size:14px;color:var(--ink-dim);margin-top:6px;line-height:1.5">Instant telehealth with a Yura physician partner. Your data and pre-visit packet are shared the moment you connect. Included with Yura Plus.</p>
    <div class="by-docs">${yura._db.physicians.filter(d=>d.instant).map(d=>`<div class="by-doc" data-doc="${d.id}"><div class="r-ico" style="background:var(--surface-3);color:var(--ink)">${d.init}</div><div><div style="font-weight:600;font-size:13.5px;color:var(--ink)">${d.name}</div><div style="font-size:11.5px;color:var(--green)">● Available now</div></div></div>`).join('')}</div>
    <button class="btn btn-iris sm" id="instant-now" style="margin-top:14px">Start instant visit</button>
  </div>

  <div class="card" style="background:var(--iris-soft);border-color:transparent">
    <div style="font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--ink)">Pre-visit packet</div>
    <p style="font-size:14px;color:var(--ink-dim);margin-top:6px;line-height:1.5">A concise, evidence-backed summary of what changed, built for the 12 minutes you get with your doctor.</p>
    <div class="btn-row" style="margin-top:14px"><button class="btn btn-primary sm" id="build-packet" style="flex:1">Build packet</button></div>
  </div>

  ${links.length ? `<div class="section-label">Secure share links</div><div class="list">${links.map(l=>`
    <div class="row"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('share',18)}</div>
      <div class="r-main"><div class="r-title">${l.revoked?'<s>'+l.token+'</s>':l.token}</div><div class="r-sub">${l.revoked?'Revoked':'Expires '+l.expires+' · '+l.views+' views'}</div></div>
      ${l.revoked?'':`<div class="r-trail"><span class="chip" data-revoke="${l.token}" style="color:var(--coral)">Revoke</span></div>`}</div>`).join('')}</div>` : ''}

  <div class="section-label">Book a physician partner</div>
  <div class="list">${yura._db.physicians.map(d=>`
    <div class="row" data-doc="${d.id}"><div class="r-ico" style="background:var(--surface-3);color:var(--ink)">${d.init}</div>
      <div class="r-main"><div class="r-title">${d.name}</div><div class="r-sub">${d.spec} · ${d.modality}</div></div>
      <div class="r-trail">★ ${d.rating} ${svg('chev',18)}</div></div>`).join('')}
  </div>

  ${appts.length ? `<div class="section-label">Upcoming</div><div class="list">${appts.map(a=>`
    <div class="row" data-appt="${a.id}"><div class="r-ico" style="background:var(--surface-3);color:var(--ink)">${a.physician.init}</div>
      <div class="r-main"><div class="r-title">${a.physician.name}</div><div class="r-sub">${fmtDateTime(a.slot.start)} · ${a.physician.modality}</div></div>
      <div class="r-trail"><span class="chip good"><span class="dot"></span>Booked</span></div></div>`).join('')}</div>` : ''}
  <div class="disclaimer">You control what's shared. Links are scoped and time-limited.</div>`;
};

// ---------------- TAB: DISCOVER ----------------
TAB_VIEW.discover = () => {
  const trials = yura._db.trials.slice().sort((a,b)=>b.fit-a.fit);
  return `
  <div class="nav-large"><div class="eyebrow">Matched to your profile</div><h1>Discover</h1></div>
  <div class="px" style="color:var(--ink-dim);font-size:14px;margin:-2px 22px 16px;line-height:1.5">Clinical trials, studies and care programs you may be eligible for, reviewed safely and never auto-enrolled.</div>
  ${trials.map(t=>`
  <div class="card" data-trial="${t.nct}" style="cursor:pointer">
    <div style="display:flex;gap:14px;align-items:flex-start">
      <div style="flex:1"><div style="font-family:var(--font-display);font-weight:700;font-size:15.5px;color:var(--ink);line-height:1.3">${t.title}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><span class="chip good"><span class="dot"></span>${t.status}</span><span class="chip">${t.remote?'Remote':t.city}</span></div></div>
      <div style="text-align:center;flex:none"><div style="font-family:var(--font-display);font-weight:800;font-size:24px;background:var(--iris);-webkit-background-clip:text;background-clip:text;color:transparent">${t.fit}</div><div style="font-size:9px;letter-spacing:.12em;color:var(--ink-faint)">FIT</div></div>
    </div>
  </div>`).join('')}
  <div class="disclaimer">Final eligibility is determined only through each study's official screening.</div>`;
};

// ============================================================
//  TAB WIRING (event handlers per tab)
// ============================================================
function wireTab(tab, root) {
  if (tab === 'today') {
    root.querySelector('#mode-chip')?.addEventListener('click', openModeSwitch);
    if (state.mode === 'simple') {
      root.querySelector('#simple-share').onclick = openFamily;
      root.querySelector('#simple-call').onclick = () => { state.tab='doctor'; show('app'); setTimeout(()=>$('#instant-now')?.click(),50); };
    } else {
      root.querySelector('#story-btn').onclick = openStory;
      root.querySelector('#ask-card').onclick = openAskYura;
      root.querySelector('#labs-row').onclick = openLabs;
      root.querySelector('#family-row').onclick = openFamily;
      root.querySelector('#pred-card')?.addEventListener('click', openPredictions);
      root.querySelector('#live-card')?.addEventListener('click', openLive);
      root.querySelector('#share-week2')?.addEventListener('click', (e)=>{ e.stopPropagation(); openStory(); });
      root.querySelectorAll('[data-ins]').forEach(el => el.onclick = () => openInsight(el.dataset.ins));
    }
  }
  if (tab === 'connect') {
    root.querySelectorAll('[data-add]').forEach(el => el.onclick = () => openConnect(el.dataset.add));
    root.querySelectorAll('[data-device]').forEach(el => el.onclick = () => openInsight(yura._db.connections.find(c=>c.provider===el.dataset.device).metrics[0]));
  }
  if (tab === 'timeline') {
    root.querySelectorAll('#tl-seg button').forEach(b => b.onclick = () => { state.tlMetric = b.dataset.m; show('app'); });
  }
  if (tab === 'doctor') {
    root.querySelector('#build-packet').onclick = openPacket;
    root.querySelector('#instant-now')?.addEventListener('click', () => openInstant());
    root.querySelectorAll('.by-doc[data-doc]').forEach(el => el.onclick = () => openInstant(el.dataset.doc));
    root.querySelectorAll('.list [data-doc], [data-doc]:not(.by-doc)').forEach(el => { if(!el.closest('.book-yura')) el.onclick = () => openDoctor(el.dataset.doc); });
    root.querySelectorAll('[data-revoke]').forEach(el => el.onclick = (e) => { e.stopPropagation(); yura.revokeShareLink(el.dataset.revoke); show('app'); toast('Share link revoked'); });
  }
  if (tab === 'discover') {
    root.querySelectorAll('[data-trial]').forEach(el => el.onclick = () => openTrial(el.dataset.trial));
  }
}

// ============================================================
//  SHEETS & MODALS
// ============================================================
function openInsight(key) {
  const b = I.baseline(key), m = METRICS[key];
  const ins = I.insights().find(x=>x.metric===key);
  const col = (key==='stress'||key==='rhr'||key==='temp'||key==='resp')?'var(--ink)':'var(--ink-faint)';
  openSheet(`<h2>${m.label}</h2><div class="sub">Your 90-day trend vs your personal baseline.</div>
    <div class="chart-wrap" style="margin:0 0 16px">
      <div class="c-head"><div class="c-val">${m.fmt(b.last)}</div><div class="c-meta">baseline ${m.fmt(b.mean)}</div></div>
      ${lineChart(b, col)}</div>
    ${ins ? `<div class="insight" style="margin:0 0 14px">${insightInner(ins)}</div>` : `<p style="color:var(--ink-dim);margin-bottom:14px">Within your normal range.</p>`}
    ${ins && ins.nextSteps.length ? `<div class="section-label" style="margin:8px 0">Suggested next steps</div>${ins.nextSteps.map(s=>`<div class="row" style="border-radius:13px;background:var(--surface-2);border:.5px solid var(--hairline);margin-bottom:8px"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('check',16)}</div><div class="r-main"><div class="r-title" style="font-size:14px;font-weight:500">${s}</div></div></div>`).join('')}` : ''}`);
}
function insightInner(ins){return `<div class="ins-top"><div class="ins-ico">${svg(METRICS[ins.metric].icon,18)}</div><h3>${ins.title}</h3></div><p>${ins.body}</p>`;}

function openConnect(pid) {
  const p = PROVIDERS.find(x=>x.id===pid);
  openSheet(`<div style="text-align:center;padding-top:6px">
    <div style="width:64px;height:64px;border-radius:18px;background:var(--surface-3);color:var(--ink);display:grid;place-items:center;margin:0 auto 14px;font-family:var(--font-display);font-weight:800;font-size:26px">${p.name[0]}</div>
    <h2 style="text-align:center">Connect ${p.name}</h2></div>
    <div class="sub" style="text-align:center">Yura will securely sync ${p.metrics.map(m=>METRICS[m]?.label||m).join(', ')} and normalise it against your other devices.</div>
    <div class="list" style="margin:0 0 16px">${p.metrics.map(m=>`<div class="row"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg(METRICS[m]?.icon||'wave',18)}</div><div class="r-main"><div class="r-title" style="font-size:14.5px">${METRICS[m]?.label||m}</div></div>${svg('check',18)}</div>`).join('')}</div>
    <button class="btn btn-iris" id="do-connect">Authorize & connect</button>`);
  $('#do-connect').onclick = () => { yura.connectDevice(pid); closeSheet(); show('app'); toast(`${p.name} connected`); };
}

function openPacket() {
  const ins = I.insights().slice(0,3);
  const u = yura._db.users[0];
  openSheet(`<h2>Pre-visit packet</h2><div class="sub">Review what Yura will share. You choose the scope.</div>
    <div class="card" style="margin:0 0 14px">
      <div style="font-size:12px;letter-spacing:.1em;color:var(--ink-faint);text-transform:uppercase">Patient</div>
      <div style="font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--ink);margin:4px 0 2px">${u.name}</div>
      <div style="font-size:13px;color:var(--ink-dim)">${u.sex} · ${u.location} · ${u.conditions.join(', ')||'No conditions'}</div>
    </div>
    <div class="section-label" style="margin:8px 0 10px">Key changes (last 7 days)</div>
    ${ins.map(i=>`<div class="card" style="margin:0 0 10px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-family:var(--font-display);font-size:14.5px;color:var(--ink)">${i.title}</strong><span class="chip ${i.severity}"><span class="dot"></span>${i.severity}</span></div><p style="font-size:13px;color:var(--ink-dim);margin-top:6px;line-height:1.5">${i.body}</p></div>`).join('')}
    <div class="section-label" style="margin:10px 0">Questions to ask</div>
    <div class="card" style="margin:0 0 16px;padding:14px"><div style="font-size:14px;color:var(--ink);line-height:1.7">• Could my sleep and stress explain the HRV drop?<br>• Is the resting-HR / temperature change worth investigating?<br>• Should my asthma plan adapt to the breathing trend?</div></div>
    <button class="btn btn-iris" id="make-link">Create secure share link</button>`);
  $('#make-link').onclick = () => { const l = yura.createShareLink({metrics:ins.map(i=>i.metric)}); closeSheet(); show('app'); toast('Secure link created · '+l.token); };
}

function openDoctor(id) {
  const d = yura._db.physicians.find(x=>x.id===id);
  const slots = yura._db.slots.filter(s=>s.physician_id===id && !s.booked).slice(0,8);
  openSheet(`<div style="display:flex;gap:14px;align-items:center;padding-top:4px">
      <div style="width:58px;height:58px;border-radius:16px;background:var(--surface-3);color:var(--ink);display:grid;place-items:center;font-family:var(--font-display);font-weight:800;font-size:22px;flex:none">${d.init}</div>
      <div><h2 style="margin:0">${d.name}</h2><div style="font-size:13.5px;color:var(--ink-dim)">${d.spec} · ${d.clinic}</div></div></div>
    <div class="sub" style="margin-top:14px">${d.bio}</div>
    <div class="section-label" style="margin:6px 0 10px">Available times · ${d.modality}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:16px">
      ${slots.map(s=>`<button class="btn btn-ghost sm" data-slot="${s.id}" style="width:100%">${fmtDateTime(s.start)}</button>`).join('') || '<p style="color:var(--ink-dim)">No open slots this week.</p>'}
    </div>`);
  sheetBody.querySelectorAll('[data-slot]').forEach(btn => btn.onclick = () => {
    const appt = yura.bookAppointment(btn.dataset.slot, 'Review recent recovery & sleep changes', true);
    closeSheet(); show('app'); toast('Appointment booked with '+d.name.split(' ')[1]);
  });
}

function openTrial(nct) {
  const t = yura._db.trials.find(x=>x.nct===nct);
  openSheet(`<div class="chip iris" style="margin-bottom:10px">${t.fit}% profile fit</div>
    <h2>${t.title}</h2>
    <div style="display:flex;gap:8px;margin:10px 0 16px;flex-wrap:wrap"><span class="chip good"><span class="dot"></span>${t.status}</span><span class="chip">${t.remote?'Remote OK':t.city}</span><span class="chip">${t.nct}</span></div>
    <div class="section-label" style="margin:4px 0 8px">Why Yura matched you</div>
    <p style="color:var(--ink-dim);font-size:14.5px;line-height:1.55;margin-bottom:16px">${t.why}</p>
    <div class="card" style="margin:0 0 16px;background:var(--iris-soft);border-color:transparent;padding:14px"><p style="font-size:13.5px;color:var(--ink);line-height:1.5">Yura never enrols you automatically. We can prepare a physician-reviewed note, <em>“worth discussing?”</em>, and final eligibility is confirmed only through the study's official screening.</p></div>
    <div class="btn-row"><button class="btn btn-ghost sm" id="dismiss-t" style="flex:1">Not now</button><button class="btn btn-iris sm" id="save-t" style="flex:1">Save & discuss</button></div>`);
  $('#dismiss-t').onclick = () => { closeSheet(); toast('Dismissed'); };
  $('#save-t').onclick = () => { closeSheet(); toast('Saved. Yura will prep a physician note'); };
}

function openLabs() {
  const lab = yura._db.labs[0];
  openSheet(`<h2>${lab.panel}</h2><div class="sub">Collected ${lab.date}. Here's what it means, in plain English.</div>
    <div class="card" style="margin:0 0 14px;background:var(--iris-soft);border-color:transparent"><p style="font-size:14px;color:var(--ink);line-height:1.6">${I.explainLab(lab)}</p></div>
    <div class="list" style="margin:0">${lab.markers.map(m=>`<div class="row"><div class="r-main"><div class="r-title" style="font-size:14.5px">${m.name}</div><div class="r-sub">Ref ${m.low}–${m.high} ${m.unit}</div></div><div class="r-trail"><b style="color:var(--ink);font-size:15px">${m.value}</b> <span class="chip ${m.flag==='normal'?'good':m.flag==='low'?'watch':'notable'}" style="margin-left:6px"><span class="dot"></span>${m.flag}</span></div></div>`).join('')}</div>`);
}

function openFamily() {
  const fam = yura._db.family;
  const bandWord = b => b==='good'?'Doing well':b==='watch'?'Worth a check-in':'Needs attention';
  openSheet(`<h2>Family & care circle</h2>
    <div class="sub">A calm, read-only view of the people you care for. Yura surfaces the early shifts families usually miss between visits.</div>
    ${fam.map(f=>`<div class="fam-card ${f.band}">
      <div class="fam-top"><div class="r-ico fam-ava" style="${f.photo?`background-image:url('${f.photo}')`:`background:var(--surface-3);color:var(--ink)`};width:44px;height:44px;border-radius:13px">${f.photo?'':f.init}</div>
        <div style="flex:1"><div style="font-family:var(--font-display);font-weight:700;font-size:16px;color:var(--ink)">${f.name}</div><div style="font-size:12.5px;color:var(--ink-faint)">${f.relation}</div></div>
        <span class="chip ${f.band}"><span class="dot"></span>${bandWord(f.band)}</span></div>
      <p style="font-size:13.5px;color:var(--ink-dim);margin-top:11px;line-height:1.5">${f.note}</p>
    </div>`).join('')}
    <div class="card" style="margin:4px 0 14px;background:var(--iris-soft);border-color:transparent;padding:16px">
      <div style="font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:5px">For care homes & clinics</div>
      <p style="font-size:13px;color:var(--ink-dim);line-height:1.5">Monitor a whole floor of residents on one board. Yura flags who needs attention first, so staff act before a visit becomes an emergency.</p>
    </div>
    <button class="btn btn-iris" id="add-fam">Invite someone to your circle</button>`);
  $('#add-fam').onclick = () => { closeSheet(); toast('Invite sent'); };
}

// ---- Mode / persona switcher ----
function openModeSwitch() {
  openSheet(`<h2>Your Yura</h2>
    <div class="sub">Health means something different to everyone. Pick the experience that fits you, Yura retailors the whole app, language and explanations to match.</div>
    ${Object.values(MODES).map(m=>`<div class="mode-opt ${m.id===state.mode?'on':''}" data-mode="${m.id}">
      <div><div style="font-family:var(--font-display);font-weight:700;font-size:16px;color:var(--ink)">${m.label}</div><div style="font-size:12.5px;color:var(--ink-dim);margin-top:2px">${m.sub}</div></div>
      ${m.id===state.mode?svg('check',20):'<span style="color:var(--ink-faint);font-size:13px">Select</span>'}</div>`).join('')}
    <p class="disc" style="margin-top:14px">Your mode is set from your onboarding answers (age, occupation, schedule, goals) and you can change it anytime.</p>`);
  sheetBody.querySelectorAll('[data-mode]').forEach(el => el.onclick = () => { setMode(el.dataset.mode); closeSheet(); show('app'); toast(MODES[el.dataset.mode].label + ' mode'); });
}

// ---- Predictive signals (BETA) ----
function openPredictions() {
  const preds = I.predictions();
  openSheet(`<div style="display:flex;align-items:center;gap:10px"><h2 style="margin:0">Predictive signals</h2><span class="beta">BETA</span></div>
    <div class="sub">Yura watches your trends together to flag what may be coming, with a likelihood and what's driving it. These are early signals, never diagnoses.</div>
    ${preds.map(p=>`<div class="card" style="margin:0 0 12px;padding:16px">
      <div style="display:flex;align-items:center;gap:14px"><div class="pred-prob ${p.band}" style="font-size:30px">${p.prob}%</div>
        <div style="flex:1"><div style="font-family:var(--font-display);font-weight:700;font-size:15.5px;color:var(--ink)">${p.title}</div><div style="font-size:12px;color:var(--ink-faint)">over ${p.window}</div></div></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin:12px 0">${p.drivers.map(d=>`<span class="chip">${d}</span>`).join('')}</div>
      <p style="font-size:13px;color:var(--ink-dim);line-height:1.5">${p.note}</p>
    </div>`).join('')}
    <p class="disc">Predictive models are in beta and for wellness awareness only. Always consult a clinician for medical concerns.</p>`);
}

// ---- Live health (alerts + lifestyle + smart scheduling) ----
function openLive() {
  const live = yura._db.live, ls = yura._db.lifestyle;
  const ico = k => k==='schedule'?'calendar':k==='action'?'bolt':'pulse';
  openSheet(`<div style="display:flex;align-items:center;gap:9px"><h2 style="margin:0">Live health</h2><span class="livedot"></span></div>
    <div class="sub">Real-time nudges, your next best action, and scheduling that bends to how your body is doing today.</div>
    ${live.map(l=>`<div class="live-item ${l.sev}">
      <div class="li-ic">${svg(ico(l.kind),18)}</div>
      <div style="flex:1"><div style="display:flex;justify-content:space-between"><span style="font-weight:600;font-size:14.5px;color:var(--ink)">${l.title}</span><span style="font-size:11px;color:var(--ink-faint)">${l.t}</span></div>
        <p style="font-size:13px;color:var(--ink-dim);line-height:1.45;margin-top:4px">${l.body}</p></div>
    </div>`).join('')}
    <div class="section-label" style="margin:14px 0 10px">Lifestyle layer</div>
    ${[['alcohol','glass'],['smoking','lung'],['caffeine','bolt']].map(([k,ic])=>{const d=ls[k];const up=d.week>d.prev;return `<div class="ls-row">
      <div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg(ic,18)}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:14px;color:var(--ink);text-transform:capitalize">${k} · <span style="color:${up&&k!=='smoking'?'var(--coral)':'var(--green)'}">${d.week} ${d.unit}/wk</span></div>
      <div style="font-size:12px;color:var(--ink-dim);margin-top:3px;line-height:1.4">${d.nudge}</div></div></div>`;}).join('')}
    <p class="disc">Live guidance adapts to your data. It is wellness support, not medical advice.</p>`);
}

// ---- Instant telehealth (Book a Yura) ----
function openInstant(docId) {
  const doc = yura._db.physicians.find(d => d.id === (docId || (yura._db.physicians.find(x=>x.instant)||{}).id));
  openSheet(`<div style="text-align:center;padding-top:4px">
      <div style="width:64px;height:64px;border-radius:18px;background:var(--surface-3);color:var(--ink);display:grid;place-items:center;margin:0 auto 12px;font-family:var(--font-display);font-weight:800;font-size:24px">${doc.init}</div>
      <h2 style="text-align:center">Start instant visit</h2></div>
    <div class="sub" style="text-align:center">${doc.name} · ${doc.spec} is available now. Your recent trends and pre-visit packet are shared automatically when you connect.</div>
    <div class="list" style="margin:0 0 14px"><div class="row"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('video',18)}</div><div class="r-main"><div class="r-title" style="font-size:14.5px">Secure video, ~2 min wait</div></div></div>
      <div class="row"><div class="r-main"><div class="r-title" style="font-size:14.5px">Pre-visit packet auto-shared</div></div>${svg('check',18)}</div>
      <div class="row"><div class="r-main"><div class="r-title" style="font-size:14.5px">Included with Yura Plus</div></div>${svg('check',18)}</div></div>
    <button class="btn btn-iris" id="connect-now">Connect now</button>`);
  $('#connect-now').onclick = () => { closeSheet(); toast('Connecting you to ' + doc.name.split(' ')[1] + '…'); };
}

// ---- Ask Yura (fullscreen chat) ----
function openAskYura() {
  openFS(`<div style="display:flex;flex-direction:column;height:100%">
    <div style="display:flex;align-items:center;gap:12px;padding:62px 18px 14px;border-bottom:.5px solid var(--hairline)">
      <div style="width:38px;height:38px;border-radius:12px;background:var(--iris);display:grid;place-items:center"><span class="logo-mark-bone" style="width:22px;height:22px;display:block"></span></div>
      <div style="flex:1"><div style="font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--ink)">Ask Yura</div><div style="font-size:12px;color:var(--ink-faint)">Knows your baseline & history</div></div>
      <div class="nav-icon-btn" id="ask-close">${svg('x',20)}</div>
    </div>
    <div class="chat-feed" id="feed">
      <div class="bubble yura">Hi Alex, I've been watching your signals this week. Ask me anything about your health data.</div>
    </div>
    <div class="suggested" id="sugg">${I.SUGGESTED_Q.map(q=>`<span class="s" data-q="${q}">${q}</span>`).join('')}</div>
    <div class="chat-input"><input id="ask-in" placeholder="Ask about your health…"/><button class="chat-send" id="ask-go">${svg('share',18)}</button></div>
  </div>`);
  const feed = $('#feed'), input = $('#ask-in');
  $('#ask-close').onclick = closeFS;
  const send = (q) => {
    if (!q.trim()) return;
    feed.appendChild(h(`<div class="bubble me">${q}</div>`));
    $('#sugg').style.display = 'none';
    feed.scrollTop = feed.scrollHeight;
    const typing = h(`<div class="bubble yura" id="typing">…</div>`); feed.appendChild(typing); feed.scrollTop = feed.scrollHeight;
    setTimeout(() => {
      const a = I.askYura(q); typing.remove();
      feed.appendChild(h(`<div class="bubble yura">${a.text}<span class="cite">${a.cite}</span></div>`));
      feed.scrollTop = feed.scrollHeight;
    }, 650);
  };
  fsEl.querySelectorAll('[data-q]').forEach(s => s.onclick = () => send(s.dataset.q));
  $('#ask-go').onclick = () => { send(input.value); input.value=''; };
  input.addEventListener('keydown', e => { if (e.key==='Enter'){ send(input.value); input.value=''; } });
}

// ---- Weekly Story (fullscreen, tap to advance) ----
function openStory() {
  const slides = I.weeklyStory();
  let i = 0;
  const render = () => {
    const s = slides[i];
    openFS(`<div class="story">
      <div class="s-orb"></div>
      <div class="story-progress">${slides.map((_,k)=>`<i class="${k<i?'done':k===i?'active':''}"><b></b></i>`).join('')}</div>
      <div class="nav-icon-btn" id="story-close" style="position:absolute;top:60px;right:18px;z-index:3">${svg('x',20)}</div>
      <div class="s-kicker">${s.kicker}</div>
      <div class="s-big">${s.big}${s.em?` <em>${s.em}</em>`:''}</div>
      <div class="s-desc">${s.desc}</div>
      ${i===slides.length-1?`<button class="btn btn-iris" id="story-share" style="margin-top:28px;position:relative">Share my week</button>`:''}
    </div>`);
    const story = fsEl.querySelector('.story');
    story.onclick = (e) => { if (e.target.closest('#story-close')||e.target.closest('#story-share')) return; if (i<slides.length-1){ i++; render(); } };
    $('#story-close').onclick = closeFS;
    const sh = $('#story-share'); if (sh) sh.onclick = () => { closeFS(); toast('Saved to share'); };
  };
  render();
}

// ---- Settings ----
function openSettings() {
  const cur = localStorage.getItem('yura-theme') || 'dark';
  const u = yura._db.users[0];
  openSheet(`<div style="display:flex;gap:14px;align-items:center;padding-top:4px">
      <div class="avatar" style="width:54px;height:54px;font-size:20px">${u.avatar}</div>
      <div><h2 style="margin:0">${u.name}</h2><div style="font-size:13px;color:var(--ink-dim)">${u.email} · Yura Plus</div></div></div>
    <div class="section-label" style="margin:18px 0 10px">Your experience</div>
    <div class="list" style="margin:0 0 16px"><div class="row" id="set-mode"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('spark',18)}</div><div class="r-main"><div class="r-title" style="font-size:14.5px">Yura mode</div><div class="r-sub">${MODES[state.mode].label} · tailored to you</div></div>${svg('chev',18)}</div></div>
    <div class="section-label" style="margin:6px 0 10px">Appearance</div>
    <div class="segmented" id="theme-seg" style="margin:0 0 16px">${['system','light','dark'].map(t=>`<button class="${t===cur?'active':''}" data-theme="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>
    <div class="list" style="margin:0">
      <div class="row"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('family',18)}</div><div class="r-main"><div class="r-title" style="font-size:14.5px">Caregiver & family</div><div class="r-sub">Not sharing</div></div>${svg('chev',18)}</div>
      <div class="row"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('bell',18)}</div><div class="r-main"><div class="r-title" style="font-size:14.5px">Notable-change alerts</div></div>${svg('check',18)}</div>
      <div class="row"><div class="r-ico" style="background:var(--iris-soft);color:var(--ink)">${svg('doc2',18)}</div><div class="r-main"><div class="r-title" style="font-size:14.5px">Privacy & data controls</div></div>${svg('chev',18)}</div>
    </div>
    <button class="btn btn-ghost" id="signout" style="margin-top:18px">Sign out</button>
    <div class="disclaimer">Yura v1.0 preview · Not a medical device.</div>`);
  sheetBody.querySelectorAll('#theme-seg button').forEach(b => b.onclick = () => {
    applyTheme(b.dataset.theme);
    sheetBody.querySelectorAll('#theme-seg button').forEach(x=>x.classList.toggle('active', x===b));
  });
  $('#set-mode').onclick = openModeSwitch;
  $('#signout').onclick = () => { closeSheet(); state.obIndex=0; show('splash'); };
}

// ---------------- utils ----------------
function fmtDateTime(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US',{weekday:'short'});
  const time = d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  return `${day} ${time}`;
}

// ============================================================
//  BOOT
// ============================================================
show('splash');
