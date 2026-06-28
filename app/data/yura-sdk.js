/* ============================================================
   yura-sdk.js — MOCK client shaped like the Supabase JS SDK.

   The app talks to this exactly as it would to @supabase/supabase-js:
     yura.auth.signInWithPassword({ email, password })
     yura.from('daily_metrics').select().eq('metric','hrv').order('date')
     yura.channel('metrics').on('change', cb).subscribe()

   Everything is in-memory + deterministic so the preview is reproducible.
   To go live: replace this file with `createClient(URL, KEY)` from the real
   SDK — the call sites don't change. The SwiftUI port maps these same calls
   onto the Supabase Swift SDK.
   ============================================================ */

// ---------- deterministic RNG (mulberry32) ----------
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r, mean, sd) {
  const u = Math.max(1e-9, r()), v = r();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const dayMs = 86400000;
function isoDate(d) { return new Date(d).toISOString().slice(0, 10); }

// ---------- metric definitions ----------
export const METRICS = {
  sleep:    { id:'sleep',    label:'Sleep',          unit:'h',   icon:'moon',   base:432, sd:34,  recent:-58,  betterHigh:true,  fmt:v=>`${Math.floor(v/60)}h ${Math.round(v%60)}m`, short:v=>(v/60).toFixed(1) },
  hrv:      { id:'hrv',      label:'HRV',            unit:'ms',  icon:'wave',   base:58,  sd:8,   recent:-13,  betterHigh:true,  fmt:v=>`${Math.round(v)} ms`, short:v=>Math.round(v) },
  rhr:      { id:'rhr',      label:'Resting HR',     unit:'bpm', icon:'heart',  base:54,  sd:3,   recent:6,    betterHigh:false, fmt:v=>`${Math.round(v)} bpm`, short:v=>Math.round(v) },
  steps:    { id:'steps',    label:'Steps',          unit:'',    icon:'shoe',   base:8200,sd:2400,recent:-900, betterHigh:true,  fmt:v=>Math.round(v).toLocaleString(), short:v=>(v/1000).toFixed(1)+'k' },
  stress:   { id:'stress',   label:'Stress',         unit:'',    icon:'spark',  base:38,  sd:9,   recent:19,   betterHigh:false, fmt:v=>`${Math.round(v)}/100`, short:v=>Math.round(v) },
  spo2:     { id:'spo2',     label:'SpO₂',           unit:'%',   icon:'lung',   base:97,  sd:1,   recent:-0.6, betterHigh:true,  fmt:v=>`${v.toFixed(0)}%`, short:v=>v.toFixed(0) },
  temp:     { id:'temp',     label:'Skin Temp',      unit:'°',   icon:'temp',   base:0,   sd:0.15,recent:0.42, betterHigh:false, fmt:v=>`${v>=0?'+':''}${v.toFixed(1)}°`, short:v=>`${v>=0?'+':''}${v.toFixed(1)}` },
  resp:     { id:'resp',     label:'Resp Rate',      unit:'/min',icon:'lung',   base:14.4,sd:0.7, recent:1.5,  betterHigh:false, fmt:v=>`${v.toFixed(1)}/min`, short:v=>v.toFixed(1) },
  hearing:  { id:'hearing',  label:'Hearing',        unit:'',    icon:'ear',    base:14,  sd:6,   recent:12,   betterHigh:false, fmt:v=>`${Math.round(v)} min`, short:v=>Math.round(v) },
};

// ---------- wearable provider registry (all major brands) ----------
export const PROVIDERS = [
  { id:'apple_health',   name:'Apple Health',     color:'#fb5b5b', metrics:['sleep','hrv','rhr','steps','spo2','resp'], precedence:3 },
  { id:'health_connect', name:'Health Connect',   color:'#34a853', metrics:['sleep','steps','rhr'], precedence:2 },
  { id:'oura',           name:'Oura Ring',        color:'#7aa0ff', metrics:['sleep','hrv','rhr','temp','resp'], precedence:4 },
  { id:'whoop',          name:'WHOOP',            color:'#c7f24a', metrics:['hrv','rhr','sleep','stress'], precedence:4 },
  { id:'fitbit',         name:'Fitbit',           color:'#00b0b9', metrics:['sleep','steps','rhr','spo2'], precedence:2 },
  { id:'garmin',         name:'Garmin',           color:'#0a7bc2', metrics:['hrv','rhr','steps','stress','resp'], precedence:3 },
  { id:'samsung',        name:'Samsung Health',   color:'#1f6feb', metrics:['sleep','steps','rhr','spo2'], precedence:2 },
  { id:'withings',       name:'Withings',         color:'#16d3b6', metrics:['rhr','temp','spo2'], precedence:2 },
  { id:'polar',          name:'Polar',            color:'#e2483c', metrics:['hrv','rhr','resp'], precedence:3 },
  { id:'coros',          name:'COROS',            color:'#f06a2a', metrics:['hrv','rhr','steps'], precedence:2 },
  { id:'dexcom',         name:'Dexcom',           color:'#3aa76d', metrics:['glucose'], precedence:4 },
  { id:'airpods',        name:'AirPods',          color:'#d7d7df', metrics:['hearing'], precedence:3 },
  { id:'google_fit',     name:'Google Fit',       color:'#ea4335', metrics:['steps','rhr'], precedence:1 },
];

// persona modes — health means something different to everyone
export const MODES = {
  adult:   { id:'adult',   label:'Everyday',     sub:'Balanced view for daily life' },
  genz:    { id:'genz',    label:'Gen Z',        sub:'Punchy, streaks, shareable' },
  athlete: { id:'athlete', label:'Pro Athlete',  sub:'Training readiness & strain' },
  simple:  { id:'simple',  label:'Simple',       sub:'Large, plain, no numbers. For older adults & care' },
};

// ---------- build 90 days of data ----------
const DAYS = 90;
function buildSeries(metricKey, seed) {
  const m = METRICS[metricKey];
  const r = rng(seed);
  const out = [];
  const today = Date.now();
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDate(today - i * dayMs);
    const weekly = Math.sin((DAYS - i) / 7 * Math.PI) * m.sd * 0.35;
    let val = gauss(r, m.base + weekly, m.sd * 0.6);
    if (i < 7) val += m.recent * (1 - i / 9);
    // clamp all metrics to sane ranges
    if (metricKey === 'spo2') val = Math.min(100, Math.max(88, val));
    else if (metricKey === 'steps') val = Math.max(2000, Math.min(25000, val));
    else if (metricKey === 'sleep') val = Math.max(240, Math.min(660, val));
    else if (metricKey === 'hrv') val = Math.max(15, Math.min(120, val));
    else if (metricKey === 'rhr') val = Math.max(38, Math.min(100, val));
    else if (metricKey === 'stress') val = Math.max(5, Math.min(95, val));
    else if (metricKey === 'temp') val = Math.max(-1.5, Math.min(2.5, val));
    else if (metricKey === 'resp') val = Math.max(10, Math.min(22, val));
    else if (metricKey === 'hearing') val = Math.max(0, Math.min(90, val));
    out.push({ date, value: Math.round(val * 100) / 100 });
  }
  return out;
}

// ---------- seed the in-memory database ----------
function seedDB() {
  const db = {
    users: [{ id:'u1', name:'Alex Mercer', first:'Alex', email:'alex@yura.health',
      dob:'1991-04-18', sex:'F', location:'Vancouver, CA',
      conditions:['Mild asthma'], meds:['Albuterol PRN'], avatar:'AM' }],
    connections: [],
    daily_metrics: [],
    appointments: [],
    physicians: [],
    slots: [],
    trials: [],
    labs: [],
    share_links: [],
    saved_opportunities: [],
  };

  // connected devices (multi-source -> Truth Layer)
  const connected = ['apple_health', 'oura', 'whoop', 'airpods'];
  connected.forEach((pid, idx) => {
    const p = PROVIDERS.find(x => x.id === pid);
    db.connections.push({
      id:'c_' + pid, provider:pid, name:p.name, color:p.color,
      status:'connected', quality: [0.96, 0.91, 0.88, 0.93][idx],
      last_sync: isoDate(Date.now()) + ' · just now',
      metrics: p.metrics,
    });
  });

  // metrics: primary source = Oura/Apple; add a slightly conflicting rhr from whoop
  let seedN = 1000;
  Object.keys(METRICS).forEach((mk) => {
    const series = buildSeries(mk, seedN++);
    const primary = mk === 'stress' ? 'whoop' : (mk === 'temp' ? 'oura' : 'apple_health');
    series.forEach(pt => db.daily_metrics.push({
      id: mk + '_' + pt.date, metric: mk, date: pt.date, value: pt.value,
      source: primary, quality: 0.95,
    }));
  });
  // conflicting resting-HR readings from WHOOP (a few bpm off) for the Truth Layer
  buildSeries('rhr', 7777).forEach(pt => db.daily_metrics.push({
    id: 'rhr_whoop_' + pt.date, metric:'rhr', date:pt.date,
    value: Math.round((pt.value + 4 + (Math.random()*2-1)) * 100)/100,
    source:'whoop', quality:0.86,
  }));

  // physician partners
  const docs = [
    { id:'d1', name:'Dr. Naomi Feldman', spec:'Sleep Medicine', clinic:'Pacific Sleep & Circadian', modality:'Telehealth', rating:4.9, init:'NF', color:'#7aa0ff', bio:'Board-certified sleep physician focused on circadian disruption and wearable-informed care.' },
    { id:'d2', name:'Dr. Idris Okafor', spec:'Cardiology', clinic:'Westside Heart Institute', modality:'In-person', rating:4.8, init:'IO', color:'#e2483c', bio:'Preventive cardiologist; HRV, resting heart rate and early arrhythmia screening.' },
    { id:'d3', name:'Dr. Lena Whitfield', spec:'Internal Medicine', clinic:'Yura Partner Clinic', modality:'Telehealth', rating:4.9, init:'LW', color:'#16d3b6', bio:'Primary care with a longitudinal, data-forward approach to everyday health.' },
    { id:'d4', name:'Dr. Marco Rossi', spec:'Endocrinology', clinic:'Metabolic Health Group', modality:'In-person', rating:4.7, init:'MR', color:'#ffb020', bio:'Metabolic and thyroid health; integrates CGM and wearable trends.' },
  ];
  db.physicians = docs;
  // slots over next 10 days
  let slotId = 1;
  docs.forEach(d => {
    for (let day = 1; day <= 10; day++) {
      [9, 11, 14, 16].forEach(h => {
        if (Math.random() < 0.55) {
          const dt = new Date(Date.now() + day * dayMs);
          dt.setHours(h, [0, 30][Math.floor(Math.random()*2)], 0, 0);
          db.slots.push({ id:'s' + (slotId++), physician_id:d.id, start: dt.toISOString(), booked:false });
        }
      });
    }
  });

  // bundled clinical-trial / care opportunities (shape matches ClinicalTrials.gov-style)
  db.trials = [
    { nct:'NCT05821632', title:'Wearable-Guided Sleep Optimization in Adults with Mild Asthma', cond:['Asthma','Sleep'], status:'RECRUITING', phase:'N/A', city:'Vancouver, CA', remote:true, fit:92, why:'Matches your asthma history and recent sleep changes; remote participation.' },
    { nct:'NCT06012457', title:'HRV Biofeedback for Stress Resilience: A Randomized Study', cond:['Stress','Autonomic'], status:'RECRUITING', phase:'2', city:'Remote', remote:true, fit:86, why:'Your HRV and stress trends fit the enrollment profile.' },
    { nct:'NCT05744098', title:'Continuous Temperature Monitoring for Early Illness Detection', cond:['Respiratory','Fever'], status:'RECRUITING', phase:'N/A', city:'Seattle, US', remote:false, fit:74, why:'Recent skin-temp and respiratory-rate elevation align with study aims.' },
    { nct:'NCT06233110', title:'Digital Biomarkers of Recovery in Endurance Athletes', cond:['Fitness','Recovery'], status:'RECRUITING', phase:'N/A', city:'Remote', remote:true, fit:61, why:'General activity profile match; lower priority.' },
    { nct:'NCT05990012', title:'Preventive Cardiology Screening via Consumer Wearables', cond:['Cardiovascular'], status:'RECRUITING', phase:'N/A', city:'Vancouver, CA', remote:true, fit:69, why:'Local site; resting-HR trend relevant.' },
  ];

  // instant telehealth availability ("Book a Yura")
  db.physicians[0].instant = true;   // Dr. Feldman
  db.physicians[2].instant = true;   // Dr. Whitfield (Yura Partner Clinic)
  db.physicians[2].earnings = '$180/hr';

  // lifestyle layer (smoking / drinking) — weekly, with personal trend
  db.lifestyle = {
    alcohol: { week: 9, prev: 5, unit: 'units', guide: 14, nudge: 'Up from 5 last week. Alcohol is suppressing your deep sleep, which tracks with your HRV dip.' },
    smoking: { week: 0, prev: 0, unit: 'cigarettes', nudge: '7 days smoke-free. Resting heart rate has dropped 3 bpm since you stopped.' },
    caffeine: { week: 22, prev: 19, unit: 'drinks', nudge: 'Late-afternoon coffee on 4 of your 5 worst-sleep nights.' },
  };

  // live alerts + next best actions (real-time nudges)
  db.live = [
    { id:'lv1', kind:'alert', sev:'watch', t:'09:12', title:'Recovery is low this morning', body:'HRV and resting HR suggest your body is still catching up. Ease into the day.' },
    { id:'lv2', kind:'action', sev:'info', t:'now', title:'Do this next', body:'A 6-minute breathing session now tends to lift your HRV within a day, based on your history.' },
    { id:'lv3', kind:'schedule', sev:'info', t:'today', title:'Smart schedule', body:'Move deep-focus work to 11:00 AM. Your alertness peaks ~2 hours later on low-recovery days.' },
    { id:'lv4', kind:'alert', sev:'notable', t:'last night', title:'Skin temp + breathing elevated', body:'Patterns that sometimes precede feeling run-down. Yura will keep watching and flag your doctor packet if it continues.' },
  ];

  // family / care circle
  db.family = [
    { id:'f1', name:'Margaret', relation:'Mom · 71', band:'watch', score:54, note:'Sleep down 1.4h this week and more night waking. Worth a check-in call.', init:'M', photo:'assets/fam-margaret.jpg', color:'#e75d42' },
    { id:'f2', name:'David', relation:'Dad · 69', band:'good', score:82, note:'Steady week. Daily walks holding strong.', init:'D', photo:'assets/fam-david.jpg', color:'#4fd07f' },
    { id:'f3', name:'Priya', relation:'Sister · 34', band:'good', score:77, note:'Recovered well after a busy stretch.', init:'P', photo:'assets/fam-priya.jpg', color:'#7aa0ff' },
  ];

  // predictive early-signals (BETA)
  db.predictions = [
    { id:'p1', title:'Early illness signal', prob:34, window:'next 48–72h', band:'watch',
      drivers:['Skin temp +0.4°', 'Resp rate +1.5/min', 'HRV below baseline'],
      note:'A pattern that sometimes precedes a cold or infection. Not a diagnosis. Rest, hydrate, and Yura keeps watching.' },
    { id:'p2', title:'Sleep-debt buildup', prob:61, window:'this week', band:'notable',
      drivers:['3 nights under 6.5h', 'Stress trending up'],
      note:'On your current trajectory, recovery keeps sliding. One earlier night is the highest-leverage fix.' },
    { id:'p3', title:'Cardiac strain', prob:8, window:'30 days', band:'good',
      drivers:['Resting HR slightly up', 'Otherwise stable'],
      note:'Low likelihood. Tracked continuously; no action needed.' },
  ];

  // a sample lab result
  db.labs = [
    { id:'l1', panel:'Complete Blood Count', date: isoDate(Date.now() - 9*dayMs), markers:[
      { name:'Hemoglobin', value:13.8, unit:'g/dL', low:12, high:15.5, flag:'normal' },
      { name:'WBC', value:9.6, unit:'10⁹/L', low:4, high:11, flag:'normal' },
      { name:'Ferritin', value:18, unit:'µg/L', low:30, high:200, flag:'low' },
      { name:'CRP', value:4.2, unit:'mg/L', low:0, high:3, flag:'high' },
    ], plain:'' },
  ];

  return db;
}

// ---------- Supabase-shaped query builder ----------
class Query {
  constructor(rows) { this._rows = rows.slice(); this._order = null; this._limit = null; }
  select() { return this; }
  eq(field, val) { this._rows = this._rows.filter(r => r[field] === val); return this; }
  in(field, vals) { this._rows = this._rows.filter(r => vals.includes(r[field])); return this; }
  gte(field, val) { this._rows = this._rows.filter(r => r[field] >= val); return this; }
  lte(field, val) { this._rows = this._rows.filter(r => r[field] <= val); return this; }
  order(field, opts = {}) { this._order = { field, asc: opts.ascending !== false }; return this; }
  limit(n) { this._limit = n; return this; }
  _resolve() {
    let rows = this._rows;
    if (this._order) {
      const { field, asc } = this._order;
      rows = rows.slice().sort((a, b) => (a[field] > b[field] ? 1 : -1) * (asc ? 1 : -1));
    }
    if (this._limit != null) rows = rows.slice(0, this._limit);
    return { data: rows, error: null };
  }
  then(resolve) { resolve(this._resolve()); } // thenable: `await yura.from(...).select()...`
  single() { const r = this._resolve(); return Promise.resolve({ data: r.data[0] || null, error: null }); }
}

// ---------- client ----------
function createMockClient() {
  const db = seedDB();
  let session = null;
  const listeners = {};

  const emit = (table) => (listeners[table] || []).forEach(cb => cb({ table }));

  return {
    _db: db, // (preview convenience; real SDK has no _db)

    auth: {
      async signInWithPassword({ email }) {
        session = { user: db.users[0] }; return { data: session, error: null };
      },
      async signUp({ email }) { session = { user: db.users[0] }; return { data: session, error: null }; },
      async signInWithOAuth({ provider }) { session = { user: db.users[0] }; return { data: session, error: null }; },
      async getUser() { return { data: { user: session?.user || null }, error: null }; },
      async signOut() { session = null; return { error: null }; },
    },

    from(table) { return new Query(db[table] || []); },

    channel(name) {
      const sub = {
        on(_evt, cb) { (listeners[name] = listeners[name] || []).push(cb); return sub; },
        subscribe() { return sub; },
      };
      return sub;
    },

    // --- preview-only mutation helpers (a real app would use .insert()/.update()) ---
    connectDevice(providerId) {
      const p = PROVIDERS.find(x => x.id === providerId);
      if (!p || db.connections.find(c => c.provider === providerId)) return;
      db.connections.push({
        id:'c_' + providerId, provider:providerId, name:p.name, color:p.color,
        status:'connected', quality: 0.8 + Math.random()*0.18,
        last_sync: 'just now', metrics: p.metrics,
      });
      emit('connections');
    },
    disconnectDevice(providerId) {
      db.connections = db.connections.filter(c => c.provider !== providerId);
      emit('connections');
    },
    bookAppointment(slotId, reason, packet) {
      const slot = db.slots.find(s => s.id === slotId);
      if (!slot || slot.booked) return null;
      slot.booked = true;
      const doc = db.physicians.find(d => d.id === slot.physician_id);
      const appt = { id:'a' + (db.appointments.length+1), physician:doc, slot, reason, packet, status:'booked' };
      db.appointments.push(appt);
      emit('appointments');
      return appt;
    },
    cancelAppointment(id) {
      const a = db.appointments.find(x => x.id === id);
      if (a) { a.status = 'cancelled'; a.slot.booked = false; emit('appointments'); }
    },
    createShareLink(scope) {
      const token = 'yura.health/s/' + Math.random().toString(36).slice(2, 8);
      const link = { id:token, token, scope, created: isoDate(Date.now()),
        expires: isoDate(Date.now() + 7*dayMs), revoked:false, views:0 };
      db.share_links.unshift(link);
      emit('share_links');
      return link;
    },
    revokeShareLink(token) {
      const l = db.share_links.find(x => x.token === token);
      if (l) { l.revoked = true; emit('share_links'); }
    },
  };
}

export const yura = createMockClient();
