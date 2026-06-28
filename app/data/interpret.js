/* ============================================================
   interpret.js — Yura's interpretation engine (client mirror).

   Turns raw metric series into a personal baseline, then plain-language
   insights with confidence + safe next steps. Statistical + deterministic;
   the SwiftUI build keeps this logic server/edge-side, optionally enriched
   by Claude. SAFETY: wellness insights and physician *discussion prompts* —
   never diagnoses.
   ============================================================ */

import { yura, METRICS } from './yura-sdk.js?v=13';

// pull a metric's primary-source daily series, ascending by date.
// (rhr has a second, slightly-conflicting WHOOP source used by the Truth Layer —
// exclude it here so the baseline uses one consistent source.)
function series(metricKey) {
  const rows = yura._db.daily_metrics.filter(r =>
    r.metric === metricKey && !(metricKey === 'rhr' && r.source === 'whoop'));
  return rows.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
}

function mean(a) { return a.reduce((s, x) => s + x, 0) / (a.length || 1); }
function sd(a, m) { m = m ?? mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2)) || 1e-9); }

// baseline = trailing window [day-35 .. day-8], recent = last 7 days
export function baseline(metricKey) {
  const s = series(metricKey).map(r => r.value);
  const n = s.length;
  const recentArr = s.slice(Math.max(0, n - 7));
  const baseArr = s.slice(Math.max(0, n - 35), Math.max(0, n - 7));
  const bMean = mean(baseArr), bSd = sd(baseArr, bMean);
  const rMean = mean(recentArr);
  const z = (rMean - bMean) / bSd;
  const pct = Math.abs(bMean) > 1 ? (rMean - bMean) / Math.abs(bMean) * 100 : 0;
  return {
    metric: metricKey, mean: bMean, sd: bSd, recent: rMean,
    last: s[s.length - 1], z, pct, n: baseArr.length, series: s,
    lo: bMean - bSd, hi: bMean + bSd,
  };
}

function severity(z) {
  const a = Math.abs(z);
  if (a >= 2) return 'notable';
  if (a >= 1) return 'watch';
  return 'good';
}
function confidence(b) {
  // more data + larger effect => higher confidence (0..3)
  const c = Math.min(3, Math.round((b.n / 14) + Math.min(2, Math.abs(b.z))));
  return Math.max(1, c);
}

// ---------- insight copy (safe-claims) ----------
const COPY = {
  sleep: {
    down: b => ({ title:'Sleep is below your normal', body:`You've averaged ${(b.recent/60).toFixed(1)}h over the last week, about ${Math.abs(Math.round((b.mean-b.recent)))} min less than your typical ${(b.mean/60).toFixed(1)}h. Short sleep often shows up first in recovery and mood.`,
      steps:['Aim for a consistent wind-down window tonight','Watch how HRV responds over the next 3 nights'] }),
    up:   b => ({ title:'Sleep is trending up', body:`You're sleeping more than your baseline this week, a good sign for recovery.`, steps:['Keep the routine that\'s working'] }),
  },
  hrv: {
    down: b => ({ title:'HRV dipped below baseline', body:`Your heart-rate variability is averaging ${Math.round(b.recent)} ms, under your usual ${Math.round(b.mean)} ms. Lower HRV can reflect accumulated strain, poor sleep, or stress.`,
      steps:['Prioritise rest and hydration','If it persists past a week, worth discussing with a clinician'] }),
    up:   b => ({ title:'HRV is recovering', body:`HRV is back up toward your baseline, your autonomic recovery looks better.`, steps:['Maintain current habits'] }),
  },
  rhr: {
    up:   b => ({ title:'Resting heart rate is elevated', body:`Resting HR is averaging ${Math.round(b.recent)} bpm, about ${Math.round(b.recent-b.mean)} bpm above your baseline. Combined with other shifts, this can mean your body is working a little harder than usual.`,
      steps:['Note any symptoms (cough, fatigue, fever)','Recheck over the next few days'] }),
    down: b => ({ title:'Resting heart rate looks good', body:`Resting HR is at or below your baseline.`, steps:[] }),
  },
  stress: {
    up:   b => ({ title:'Stress load is higher this week', body:`Your stress signal is up meaningfully versus your baseline. Sustained stress tends to suppress HRV and sleep quality.`,
      steps:['Try a short breathing session','Protect one low-demand evening this week'] }),
    down: b => ({ title:'Stress is easing', body:`Your stress signal is trending down.`, steps:[] }),
  },
  temp: {
    up:   b => ({ title:'Skin temperature is running warm', body:`Your overnight skin temperature is about ${b.recent.toFixed(1)}° above your baseline. Small rises sometimes precede feeling run-down.`,
      steps:['Keep an eye on how you feel tomorrow','Hydrate and rest'] }),
    down: b => ({ title:'Skin temperature is stable', body:`Temperature is within your normal range.`, steps:[] }),
  },
  resp: {
    up:   b => ({ title:'Respiratory rate ticked up', body:`Overnight breathing rate is averaging ${b.recent.toFixed(1)}/min, slightly above your usual ${b.mean.toFixed(1)}/min. Given your asthma history, this is worth noting alongside how you feel.`,
      steps:['Monitor for any breathing changes','Have your reliever inhaler accessible'] }),
    down: b => ({ title:'Breathing rate is normal', body:`Respiratory rate is within range.`, steps:[] }),
  },
  spo2: {
    down: b => ({ title:'Oxygen saturation slightly lower', body:`SpO₂ is averaging ${b.recent.toFixed(0)}%, a touch under your baseline but still within a typical range.`, steps:['Keep monitoring overnight readings'] }),
    up:   b => ({ title:'Oxygen saturation is steady', body:`SpO₂ looks normal.`, steps:[] }),
  },
  steps: {
    down: b => ({ title:'Activity is down this week', body:`You're averaging ${Math.round(b.recent).toLocaleString()} steps/day, below your usual ${Math.round(b.mean).toLocaleString()}.`, steps:['A short walk can lift HRV and mood'] }),
    up:   b => ({ title:'Activity is up', body:`Step count is above your baseline. Nice work.`, steps:[] }),
  },
};

export function insights() {
  const out = [];
  Object.keys(METRICS).forEach(mk => {
    const b = baseline(mk);
    if (Math.abs(b.z) < 0.8) return; // only surface meaningful change
    const dir = b.z > 0 ? 'up' : 'down';
    const copy = COPY[mk]?.[dir];
    if (!copy) return;
    const c = copy(b);
    const sev = severity(b.z);
    // direction "good/bad" depends on metric
    const m = METRICS[mk];
    const improving = (m.betterHigh && b.z > 0) || (!m.betterHigh && b.z < 0);
    out.push({
      id: 'ins_' + mk, metric: mk, title: c.title, body: c.body,
      severity: improving ? 'good' : sev, kind: improving ? 'wellness' : 'trend_flag',
      confidence: confidence(b), nextSteps: c.steps || [], z: b.z,
    });
  });
  // sort: notable first, then by |z|
  const rank = { notable: 0, watch: 1, good: 2 };
  return out.sort((a, b) => (rank[a.severity] - rank[b.severity]) || (Math.abs(b.z) - Math.abs(a.z)));
}

// predictive early-signals (BETA) — surfaced from the seeded model
export function predictions() { return yura._db.predictions; }

// composite "Yura readiness" score (0..100)
export function yuraScore() {
  const w = { hrv: 0.34, rhr: 0.22, sleep: 0.30, resp: 0.08, stress: 0.06 };
  let score = 0;
  for (const k in w) {
    const b = baseline(k);
    const m = METRICS[k];
    let z = b.z; if (!m.betterHigh) z = -z; // flip so +z is always "good"
    const norm = Math.max(-2.2, Math.min(2.2, z)) / 2.2; // -1..1
    score += w[k] * (72 + norm * 26);
  }
  return Math.round(Math.max(1, Math.min(100, score)));
}
// per-factor signed contribution to the readiness score (baseline = 72).
// Sum of contributions + 72 ≈ score, so this fully "explains" the number.
export function scoreContributors() {
  const w = { sleep: 0.30, hrv: 0.34, rhr: 0.22, stress: 0.06, resp: 0.08 };
  const items = [];
  for (const k in w) {
    const b = baseline(k), m = METRICS[k];
    let z = b.z; if (!m.betterHigh) z = -z;
    const norm = Math.max(-2.2, Math.min(2.2, z)) / 2.2;
    const raw = w[k] * norm * 26;
    items.push({ key: k, label: m.label, points: Math.round(raw), raw });
  }
  return items.sort((a, b) => a.raw - b.raw); // most draining first
}

export function scoreLabel(s) {
  if (s >= 80) return { word:'Primed', desc:'Your body looks well recovered today.' };
  if (s >= 65) return { word:'Steady', desc:'You\'re in a normal range, a few signals are shifting.' };
  if (s >= 45) return { word:'Strained', desc:'Several signals are below your baseline. Ease into the day.' };
  return { word:'Depleted', desc:'Your recovery markers are low. Prioritise rest today.' };
}

// ---------- Ask Yura (context-aware over the user's own data) ----------
export function askYura(q) {
  const t = q.toLowerCase();
  const B = Object.fromEntries(Object.keys(METRICS).map(k => [k, baseline(k)]));
  const cite = m => `Based on your ${METRICS[m].label.toLowerCase()} · last 7 days vs your 28-day baseline`;

  if (/(tired|fatigue|exhaust|drained|energy)/.test(t)) {
    return { text:`A few of your signals line up with feeling tired: sleep is down about ${Math.round(B.sleep.mean-B.sleep.recent)} min/night, HRV has dropped to ${Math.round(B.hrv.recent)} ms (from ~${Math.round(B.hrv.mean)}), and resting heart rate is up ${Math.round(B.rhr.recent-B.rhr.mean)} bpm. Together that points to lower recovery this week rather than any single cause. A couple of solid nights of sleep is the highest-leverage fix.`, cite: cite('hrv') };
  }
  if (/(sleep|slept|rest)/.test(t)) {
    return { text:`You've averaged ${(B.sleep.recent/60).toFixed(1)}h over the last week, versus your usual ${(B.sleep.mean/60).toFixed(1)}h. The biggest dips were mid-week. Sleep is your most influential signal right now, and it's correlating with your HRV drop.`, cite: cite('sleep') };
  }
  if (/(stress|anxious|overwhelm)/.test(t)) {
    return { text:`Your stress signal is up meaningfully this week and it's tracking with the dip in HRV. A short paced-breathing session tends to move your HRV within a day or two, based on your own past patterns.`, cite: cite('stress') };
  }
  if (/(heart|hrv|recovery|recover)/.test(t)) {
    return { text:`Recovery is the headline this week: HRV ${Math.round(B.hrv.recent)} ms (down from ${Math.round(B.hrv.mean)}) and resting HR ${Math.round(B.rhr.recent)} bpm (up from ${Math.round(B.rhr.mean)}). Neither is alarming on its own, but the combination is why your readiness score dipped.`, cite: cite('hrv') };
  }
  if (/(sick|ill|cold|flu|fever|temperature|temp)/.test(t)) {
    return { text:`Your skin temperature is running about ${B.temp.recent.toFixed(1)}° above baseline and respiratory rate is slightly up, patterns that *sometimes* appear before feeling run-down. This isn't a diagnosis; if symptoms develop, it's worth flagging to a clinician. Yura can package these trends for that conversation.`, cite: cite('temp') };
  }
  if (/(doctor|appointment|share|physician)/.test(t)) {
    return { text:`I can build a pre-visit packet of your recent changes and create a secure, time-limited link to share with a physician. Your sleep, HRV and resting-HR shifts would be the headline. Head to the Doctor tab to generate it.`, cite:'Yura Physician Bridge' };
  }
  return { text:`Here's your week at a glance: readiness ${yuraScore()}/100. The notable shifts are lower sleep and HRV with a small rise in resting heart rate. Ask me about your sleep, stress, recovery, or whether to see a doctor.`, cite:'Across your connected devices' };
}

export const SUGGESTED_Q = [
  'Why am I so tired this week?',
  'How has my sleep been?',
  'Is my recovery okay?',
  'Should I see a doctor?',
];

// ---------- Weekly Health Story ----------
export function weeklyStory() {
  const sleep = baseline('sleep'), steps = baseline('steps'), hrv = baseline('hrv');
  const ins = insights();
  const top = ins[0];
  return [
    { kicker:'Your week in health', big:`${(sleep.recent/60).toFixed(1)}h`, em:'avg sleep', desc:`That's ${sleep.recent < sleep.mean ? 'below' : 'above'} your usual ${(sleep.mean/60).toFixed(1)}h. Sleep set the tone for everything else this week.` },
    { kicker:'On the move', big:`${Math.round(steps.recent*7).toLocaleString()}`, em:'steps', desc:`Across the week, about ${Math.round(steps.recent).toLocaleString()} a day.` },
    { kicker:'Recovery', big:`${Math.round(hrv.recent)} ms`, em:'avg HRV', desc:`${hrv.recent < hrv.mean ? 'Down from' : 'Up from'} your ${Math.round(hrv.mean)} ms baseline. Your body asked for more rest.` },
    { kicker:'The headline', big:top ? top.title.split(' ').slice(0,3).join(' ') : 'Steady week', em:'', desc: top ? top.body : 'Nothing unusual stood out this week.' },
    { kicker:'Next week', big:'Sleep', em:'is your lever', desc:'One extra hour a night is the single change most likely to lift your readiness. Yura will track whether it works.' },
  ];
}

// ---------- Labs → plain English ----------
export function explainLab(lab) {
  const flagged = lab.markers.filter(m => m.flag !== 'normal');
  if (!flagged.length) return 'All markers in this panel are within their normal reference ranges.';
  const parts = flagged.map(m => {
    if (m.name === 'Ferritin' && m.flag === 'low') return `Ferritin (iron stores) is low at ${m.value} ${m.unit}, sometimes linked to fatigue, which fits your recent tiredness.`;
    if (m.name === 'CRP' && m.flag === 'high') return `CRP, a general inflammation marker, is mildly elevated at ${m.value} ${m.unit}.`;
    return `${m.name} is ${m.flag} at ${m.value} ${m.unit} (ref ${m.low}–${m.high}).`;
  });
  return parts.join(' ') + ' These are worth discussing with your physician. Yura can include them in your visit packet.';
}

// ---------- Cross-device Truth Layer ----------
export function truthLayer(metricKey) {
  // compare today's reading across sources for the metric
  const rows = yura._db.daily_metrics.filter(r => r.metric === metricKey);
  const today = rows.map(r => r.date).sort().slice(-1)[0];
  const todays = rows.filter(r => r.date === today);
  if (todays.length < 2) return null;
  const bySource = todays.map(r => ({ source: r.source, value: r.value, quality: r.quality }));
  const spread = Math.max(...bySource.map(s => s.value)) - Math.min(...bySource.map(s => s.value));
  // reconcile by quality-weighted average
  const wsum = bySource.reduce((s, x) => s + x.quality, 0);
  const reconciled = bySource.reduce((s, x) => s + x.value * x.quality, 0) / wsum;
  const conf = spread < METRICS[metricKey].sd ? 'High' : spread < METRICS[metricKey].sd * 2 ? 'Medium' : 'Low';
  return { sources: bySource, reconciled, spread, confidence: conf };
}
