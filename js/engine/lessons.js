// Lesson progression: Descubierta (lived it, heard the audio) → Aplicada (acted on it later)
// → Dominada (applied it three times). Messages queue in s.inbox and the UI shows them.

import { LESSON_BY_ID } from '../data/lessons.js';
import { totalRooms, weekCost } from './sim.js';

export const level = (s, id) => s.lessons[id]?.level ?? 0;

export function discover(s, id) {
  if (!LESSON_BY_ID[id] || level(s, id) > 0) return false;
  s.lessons[id] = { level: 1, applied: 0, day: s.day };
  s.inbox.push({ id, kind: 'new' });
  return true;
}

export function applyLesson(s, id) {
  const l = s.lessons[id];
  if (!l || l.level === 0 || l.lastApplied === s.day) return;
  l.applied += 1;
  l.lastApplied = s.day;
  const next = l.applied >= 3 ? 3 : 2;
  if (next > l.level) {
    l.level = next;
    s.inbox.push({ id, kind: next === 3 ? 'mastered' : 'applied' });
  }
}

export function afterDay(s, r) {
  const rooms = totalRooms(s);
  const discovered = (id) => level(s, id) > 0 && s.lessons[id].day < r.day;

  if (r.lostDirty > 0 && r.priceRatio > 0.85 && r.priceRatio < 1.2) discover(s, 'ejecucion');
  else if (discovered('ejecucion') && r.wanted >= rooms * 0.85 && r.lostDirty === 0 && r.occupancy >= 0.8) applyLesson(s, 'ejecucion');

  if (r.occupancy < 0.5 && r.priceRatio > 1.2) discover(s, 'cuarto_vacio');
  else if (discovered('cuarto_vacio') && r.lowDemand && r.occupancy >= 0.7) applyLesson(s, 'cuarto_vacio');

  if (r.loanPaid) {
    if (!discover(s, 'palabra') && r.cash >= 0) applyLesson(s, 'palabra');
  }

  const wc = weekCost(s);
  if (r.cash < wc) { discover(s, 'cash_king'); s.flags.lowCash = true; }
  else if (s.flags.lowCash && r.cash > 2 * wc) { s.flags.lowCash = false; applyLesson(s, 'cash_king'); }

  if (r.morale < 45) { discover(s, 'equipo'); s.flags.lowMorale = true; }
  else if (s.flags.lowMorale && r.morale >= 70) { s.flags.lowMorale = false; applyLesson(s, 'equipo'); }

  if (r.reputation >= 4.0) { if (!discover(s, 'cliente_regresa') && r.reputation >= 4.3) applyLesson(s, 'cliente_regresa'); }

  if (s.flags.badEventDay === r.day) {
    discover(s, 'duena');
    if (discovered('duena') && r.profit > 0) applyLesson(s, 'duena');
  }
}

export function afterWeek(s, w, prev) {
  discover(s, 'numeros_historia');
  if (prev) {
    if (prev.profit < 0 && w.profit > prev.profit) {
      if (!discover(s, 'practica')) applyLesson(s, 'practica');
    }
    if (w.revenue > prev.revenue && w.profit < prev.profit) discover(s, 'revenue_vanity');
    else if (level(s, 'revenue_vanity') > 0 && w.profit > prev.profit && w.profit > 0) applyLesson(s, 'revenue_vanity');
  }
  if (w.repStart - w.reputation >= 0.2) discover(s, 'reputacion');
  else if (level(s, 'reputacion') > 0 && w.reputation - w.repStart >= 0.1) applyLesson(s, 'reputacion');
}

export function afterMonth(s, m) {
  if (m.profit < 0) discover(s, 'errores_datos');
  else if (s.months.length > 1 && s.months[s.months.length - 2].profit < 0) applyLesson(s, 'errores_datos');
  if (m.profit > 0) { applyLesson(s, 'location'); applyLesson(s, 'conoce_cliente'); }
}

export function afterHire(s) {
  if (!discover(s, 'rodeate')) applyLesson(s, 'rodeate');
}
