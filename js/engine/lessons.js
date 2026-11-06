// Lesson progression: Descubierta (lived it, heard the audio) → Aplicada (acted on it later)
// → Dominada (applied it three times). Each step carries `ctx`: what just happened in her hotel,
// so the saying is tied to a concrete memory. Messages queue in s.inbox and the UI shows them.

import { LESSON_BY_ID } from '../data/lessons.js';
import { totalRooms, weekCost } from './sim.js';
import { money, DAYS } from '../util.js';

export const level = (s, id) => s.lessons[id]?.level ?? 0;

export function discover(s, id, ctx = '') {
  if (!LESSON_BY_ID[id] || level(s, id) > 0) return false;
  s.lessons[id] = { level: 1, applied: 0, day: s.day, year: s.year, ctx };
  s.inbox.push({ id, kind: 'new', ctx });
  return true;
}

export function applyLesson(s, id, ctx = '') {
  const l = s.lessons[id];
  if (!l || l.level === 0 || l.lastApplied === s.day) return;
  l.applied += 1;
  l.lastApplied = s.day;
  if (ctx) l.lastCtx = ctx;
  const next = l.applied >= 3 ? 3 : 2;
  if (next > l.level) {
    l.level = next;
    s.inbox.push({ id, kind: next === 3 ? 'mastered' : 'applied', ctx });
  }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function afterDay(s, r) {
  const rooms = totalRooms(s);
  const learned = (id) => level(s, id) > 0 && s.lessons[id].day < r.day;
  const empty = r.rooms - r.soldTotal;

  if (r.lostDirty > 0 && r.priceRatio > 0.85 && r.priceRatio < 1.2) {
    discover(s, 'ejecucion', `Hoy tu precio era bueno, pero ${plural(r.lostDirty, 'huésped se fue', 'huéspedes se fueron')} porque había ${plural(r.dirtyStart - r.cleaned, 'cuarto', 'cuartos')} sin limpiar.`);
  } else if (learned('ejecucion') && r.wanted >= rooms * 0.85 && r.lostDirty === 0 && r.occupancy >= 0.8) {
    applyLesson(s, 'ejecucion', `Día con mucha demanda: vendiste ${r.soldTotal} de ${rooms} y nadie se quedó sin cuarto por limpieza.`);
  }

  if (r.occupancy < 0.5 && r.priceRatio > 1.2) {
    discover(s, 'cuarto_vacio', `Hoy cobraste ${Math.round((r.priceRatio - 1) * 100)}% más de lo normal y se quedaron ${plural(empty, 'cuarto vacío', 'cuartos vacíos')}. Esas noches ya no se pueden vender.`);
  } else if (learned('cuarto_vacio') && r.lowDemand && r.occupancy >= 0.7) {
    applyLesson(s, 'cuarto_vacio', `Era un día flojo y aun así vendiste ${r.soldTotal} de ${rooms} cuartos.`);
  }

  if (r.loanPaid) {
    if (!discover(s, 'palabra', `Hoy pagaste ${money(r.loanPaid)} al banco, a tiempo.`) && r.cash >= 0) {
      applyLesson(s, 'palabra', `Otra mensualidad de ${money(r.loanPaid)} pagada a tiempo.`);
    }
  }

  const wc = weekCost(s);
  if (r.cash < wc) {
    discover(s, 'cash_king', `Tu caja bajó a ${money(r.cash)}: menos de lo que gastas en una semana (${money(wc)}).`);
    s.flags.lowCash = true;
  } else if (s.flags.lowCash && r.cash > 2 * wc) {
    s.flags.lowCash = false;
    applyLesson(s, 'cash_king', `Tu caja se recuperó a ${money(r.cash)}: más de dos semanas de gastos.`);
  }

  if (r.morale < 45) {
    discover(s, 'equipo', `El ánimo de tu equipo bajó a ${Math.round(r.morale)}. Un equipo cansado limpia más lento y atiende peor.`);
    s.flags.lowMorale = true;
  } else if (s.flags.lowMorale && r.morale >= 70) {
    s.flags.lowMorale = false;
    applyLesson(s, 'equipo', `Recuperaste el ánimo del equipo: ahora está en ${Math.round(r.morale)}.`);
  }

  if (r.reputation >= 4.0) {
    if (!discover(s, 'resenas_precio', `Tus reseñas llegaron a ${r.reputation.toFixed(1)}★.`) && r.reputation >= 4.3) {
      applyLesson(s, 'resenas_precio', `Reseñas en ${r.reputation.toFixed(1)}★: tus huéspedes aceptan pagar más.`);
    }
  }

  if (s.flags.badEventDay === r.day) {
    if (!discover(s, 'duena', 'Hoy pasó algo que no dependía de ti, y tuviste que decidir qué hacer.') && r.profit > 0) {
      applyLesson(s, 'duena', `Después de un problema, cerraste el día con ${money(r.profit)} de ganancia.`);
    }
  }

  if (r.labels.includes('Descuento de Marea Inn')) {
    if (!discover(s, 'guerra_precios', 'Marea Inn bajó sus precios 20% para quitarte clientes.') && r.priceRatio >= 0.95 && r.profit > 0) {
      applyLesson(s, 'guerra_precios', `Marea Inn bajó precios, tú defendiste los tuyos y ganaste ${money(r.profit)}.`);
    }
  }
}

export function afterWeek(s, w, prev) {
  const days = s.history.slice(-7);
  const best = days.reduce((a, b) => (b.profit > a.profit ? b : a));
  const worst = days.reduce((a, b) => (b.profit < a.profit ? b : a));
  discover(s, 'numeros_historia', `Tu mejor día fue el ${DAYS[best.dow].toLowerCase()} (${money(best.profit)}) y el peor el ${DAYS[worst.dow].toLowerCase()} (${money(worst.profit)}). ¿Por qué crees que fue así?`);
  if (prev) {
    if (prev.profit < 0 && w.profit > prev.profit) {
      const ctx = `La semana pasada ganaste ${money(prev.profit)} y esta ${money(w.profit)}. Mejoraste.`;
      if (!discover(s, 'practica', ctx)) applyLesson(s, 'practica', ctx);
    }
    if (w.revenue > prev.revenue && w.profit < prev.profit) {
      discover(s, 'revenue_vanity', `Esta semana vendiste más (${money(w.revenue)}) pero ganaste menos (${money(w.profit)}) que la anterior.`);
    } else if (level(s, 'revenue_vanity') > 0 && w.profit > prev.profit && w.profit > 0) {
      applyLesson(s, 'revenue_vanity', `Tu ganancia subió a ${money(w.profit)} esta semana.`);
    }
  }
  if (w.repStart - w.reputation >= 0.2) {
    discover(s, 'reputacion', `Tus reseñas bajaron de ${w.repStart.toFixed(1)}★ a ${w.reputation.toFixed(1)}★ en una semana.`);
  } else if (level(s, 'reputacion') > 0 && w.reputation - w.repStart >= 0.1) {
    applyLesson(s, 'reputacion', `Tus reseñas subieron a ${w.reputation.toFixed(1)}★ esta semana.`);
  }
}

export function afterMonth(s, m) {
  if (m.profit < 0) discover(s, 'errores_datos', `El mes cerró con ${money(m.profit)}. Ahora sabes qué no funcionó.`);
  else if (s.months.length > 1 && s.months[s.months.length - 2].profit < 0) applyLesson(s, 'errores_datos', `Después de un mes con pérdida, este cerraste con ${money(m.profit)}.`);
  if (m.profit > 0) {
    applyLesson(s, 'location', `Tu hotel en ${s.hotelName} cerró el mes con ganancia: la ubicación funciona.`);
    applyLesson(s, 'conoce_cliente', 'Tu propuesta de valor atrajo huéspedes todo el mes.');
  }
}

export function afterHire(s) {
  const ctx = `Contrataste a una recamarista más. Ahora tu equipo de limpieza es de ${s.housekeepers}.`;
  if (!discover(s, 'rodeate', ctx)) applyLesson(s, 'rodeate', ctx);
}
