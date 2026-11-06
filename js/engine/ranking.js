// Tablero de Directoras: a small summary of each player's hotel that travels between devices as a
// link. Comparisons use numbers that are fair across hotels and pace: Consejo stars and the % of
// the month's profit goal (both scaled to the location), compared month by month.

import { profitGoalFor, starsFor } from './board.js';
import { points } from '../data/badges.js';

const VERSION = 1;

// Compact summary of one player's current hotel. m: [month, stars, % of goal, reputation×10, morale].
export function summary(profile, s) {
  const year = s?.year || 1;
  const months = (s?.months || []).map((m) => [
    m.month,
    s.monthStars?.[`${year}-${m.month}`] ?? starsFor(s, m),
    Math.round((m.profit / profitGoalFor(s, m.month)) * 100),
    Math.round(m.reputation * 10),
    Math.round(m.morale),
  ]);
  const lessons = Object.values(s?.lessons || {});
  return {
    v: VERSION, u: profile.uid, n: profile.name, k: profile.look, t: profile.savedAt || Date.now(),
    h: s?.hotelName || '', l: s?.locationId || '', d: s?.day || 0, m: months,
    p: s?.months ? points(s) : 0,
    gold: lessons.filter((x) => x.level >= 3).length,
    known: lessons.filter((x) => x.level >= 1).length,
  };
}

// base64url of UTF-8 JSON, so names with accents survive a WhatsApp message.
export function encode(list) {
  const bytes = new TextEncoder().encode(JSON.stringify(list));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Accepts the whole shared message, the link, or just the code. Returns a list or null.
export function decode(text) {
  const code = String(text || '').match(/#r=([A-Za-z0-9_-]+)/)?.[1] || String(text || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(code)) return null;
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const list = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    const ok = Array.isArray(list) && list.every((r) => r && r.v === VERSION && typeof r.u === 'string' && typeof r.n === 'string' && Array.isArray(r.m));
    return ok ? list.map(clean) : null;
  } catch { return null; }
}

// Keep only what the board shows, with sane types, whatever arrives in a link.
function clean(r) {
  const num = (x, lo, hi) => (Number.isFinite(+x) ? Math.max(lo, Math.min(hi, Math.round(+x))) : 0);
  return {
    v: VERSION, u: r.u.slice(0, 24), n: r.n.slice(0, 16), k: r.k && typeof r.k === 'object' ? r.k : {}, t: num(r.t, 0, 9e15),
    h: String(r.h || '').slice(0, 40), l: String(r.l || '').slice(0, 16), d: num(r.d, 0, 9999),
    m: r.m.slice(0, 60).map((x) => [num(x[0], 1, 99), num(x[1], 0, 3), num(x[2], -999, 999), num(x[3], 0, 50), num(x[4], 0, 100)]),
    p: num(r.p, 0, 9999), gold: num(r.gold, 0, 999), known: num(r.known, 0, 999),
  };
}

// Months in a row with profit (goal % above zero), the longest stretch.
function streak(m) {
  let best = 0;
  let run = 0;
  for (const x of m) { run = x[2] > 0 ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

// Family records: several categories so different players can shine. value(r) → number or null.
export const RECORDS = [
  { id: 'estrellas', icon: '⭐', name: 'Estrellas del Consejo', hint: 'promedio por mes', value: (r) => (r.m.length ? r.m.reduce((a, x) => a + x[1], 0) / r.m.length : null), fmt: (v) => `${v.toFixed(1)} ⭐` },
  { id: 'meta', icon: '🎯', name: 'Mejor mes', hint: 'de la meta de ganancia', value: (r) => (r.m.length ? Math.max(...r.m.map((x) => x[2])) : null), fmt: (v) => `${v}%` },
  { id: 'racha', icon: '📈', name: 'Racha con ganancia', hint: 'meses seguidos', value: (r) => (r.m.length ? streak(r.m) : null), fmt: (v) => `${v} ${v === 1 ? 'mes' : 'meses'}` },
  { id: 'resenas', icon: '🌟', name: 'Mejores reseñas', hint: 'al cerrar un mes', value: (r) => (r.m.length ? Math.max(...r.m.map((x) => x[3])) / 10 : null), fmt: (v) => `${v.toFixed(1)}★` },
  { id: 'equipo', icon: '💛', name: 'Equipo más feliz', hint: 'ánimo al cerrar un mes', value: (r) => (r.m.length ? Math.max(...r.m.map((x) => x[4])) : null), fmt: (v) => `${v}` },
  { id: 'lecciones', icon: '🥇', name: 'Lecciones dominadas', hint: 'cartas doradas', value: (r) => (r.known ? r.gold : null), fmt: (v) => `${v}` },
];

// Leaders of a record (ties share it). Empty when nobody has a value or the best is zero.
export function leaders(rec, list) {
  const vals = list.map((r) => ({ r, v: rec.value(r) })).filter((x) => x.v != null);
  if (!vals.length) return { best: null, who: [] };
  const best = Math.max(...vals.map((x) => x.v));
  if (best <= 0) return { best, who: [] };
  return { best, who: vals.filter((x) => Math.abs(x.v - best) < 1e-9).map((x) => x.r) };
}
