// Lesson progression: Descubierta (lived it, heard the audio) → Aplicada (acted on it later)
// → Dominada (applied it three times). Each step carries `ctx`: what just happened in her hotel,
// so the saying is tied to a concrete memory. Messages queue in s.inbox and the UI shows them.

import { LESSON_BY_ID } from '../data/lessons.js';
import { totalRooms, weekCost, season } from './sim.js';
import { money, DAYS } from '../util.js';
import { chapterFor } from '../data/chapters.js';
import { occTargetFor } from './board.js';

export const level = (s, id) => s.lessons[id]?.level ?? 0;

export function discover(s, id, ctx = '') {
  if (!LESSON_BY_ID[id] || level(s, id) > 0) return false;
  s.lessons[id] = { level: 1, applied: 0, day: s.day, year: s.year, ctx };
  s.inbox.push({ id, kind: 'new', ctx });
  return true;
}

export function applyLesson(s, id, ctx = '') {
  const l = s.lessons[id];
  // Spaced practice: an application counts at most once every 5 days, so mastery takes weeks.
  if (!l || l.level === 0 || (l.lastApplied != null && s.day - l.lastApplied < 5 && l.lastYear === s.year)) return;
  l.lastYear = s.year;
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

  if (r.occupancy === 1 && r.wanted >= rooms * 1.25 && r.priceRatio < 1.05) {
    discover(s, 'demanda_precio', `Hoy te llenaste con precio normal, pero ${r.wanted - rooms} personas más querían cuarto. Pudiste cobrar más.`);
  } else if (learned('demanda_precio') && r.priceRatio >= 1.1 && r.occupancy >= 0.9) {
    applyLesson(s, 'demanda_precio', `Subiste tu precio ${Math.round((r.priceRatio - 1) * 100)}% en un día lleno y vendiste ${r.soldTotal} de ${rooms}.`);
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
    const recent = s.history.slice(-8, -1);
    const avg = recent.reduce((a, x) => a + x.profit, 0) / (recent.length || 1);
    if (!discover(s, 'duena', 'Hoy pasó algo que no dependía de ti, y tuviste que decidir qué hacer.') && r.profit > 0 && r.profit >= avg) {
      applyLesson(s, 'duena', `Después de un problema, cerraste el día con ${money(r.profit)} de ganancia.`);
    }
  }

  // Chapter 3: agency commissions.
  if (r.channels && r.channels.bookings.agencia >= 0.5) {
    discover(s, 'canal', `Hoy ${Math.round(r.channels.bookings.agencia)} reservas llegaron por agencia en línea y le pagaste ${money(r.channels.cost.agencia)} de comisión. Una reserva directa no paga comisión.`);
  }
  // Chapter 4: complaints solved (or not) at the front desk.
  if (r.chapter >= 4) {
    if (s.policy.power >= 1 && r.resolved >= 1) {
      const ctx = `Kevin resolvió ${plural(r.resolved, 'queja', 'quejas')} en el momento, sin tener que preguntarte.`;
      if (!discover(s, 'empodera', ctx)) applyLesson(s, 'empodera', ctx);
    } else if (s.policy.power === 0 && r.complaints >= 2) {
      discover(s, 'empodera', `Hoy ${plural(r.complaints, 'queja se quedó', 'quejas se quedaron')} sin resolver porque Kevin no podía decidir nada sin ti.`);
    }
  }
  // Chapter 5: cross-sell.
  if (r.cross && r.cross.revenue > 0) {
    const n = Object.values(r.cross.takers).reduce((a, b) => a + b, 0);
    discover(s, 'cross_sell', `Hoy ${plural(n, 'huésped compró', 'huéspedes compraron')} algo extra: ${money(r.cross.revenue)} más sin traer a nadie nuevo.`);
  }
  // Chapter 7: overbooking and uncertain forecasts.
  if (r.walked > 0) discover(s, 'sobreventa', `Sobrevendiste y llegaron todos: ${plural(r.walked, 'huésped se quedó', 'huéspedes se quedaron')} sin cuarto. Tuviste que pagarles otro hotel y te dejaron una reseña mala.`);
  if (r.chapter >= 7 && r.forecastTotal > 2 && Math.abs(r.potential - r.forecastTotal) / r.forecastTotal > 0.08) {
    discover(s, 'decide_info', `El pronóstico decía unas ${Math.round(r.forecastTotal)} personas y buscaron ${Math.round(r.potential)}. Nadie sabe el futuro exacto.`);
  }

  if (r.labels.includes('Descuento de Marea Inn')) {
    if (!discover(s, 'guerra_precios', 'Marea Inn bajó sus precios 20% para quitarte clientes.') && r.priceRatio >= 0.95 && r.profit > 0) {
      applyLesson(s, 'guerra_precios', `Marea Inn bajó precios, tú defendiste los tuyos y ganaste ${money(r.profit)}.`);
    }
  }
}

export function afterWeek(s, w, prev) {
  const days = s.history.slice(-7);
  const op = (r) => r.profit + (r.costs.loan || 0) + (r.costs.isr || 0) + (r.costs.socio || 0);
  const best = days.reduce((a, b) => (op(b) > op(a) ? b : a));
  const worst = days.reduce((a, b) => (op(b) < op(a) ? b : a));
  discover(s, 'numeros_historia', `Tu mejor día fue el ${DAYS[best.dow].toLowerCase()} (${money(op(best))}) y el peor el ${DAYS[worst.dow].toLowerCase()} (${money(op(worst))}). ¿Por qué crees que fue así?`);
  if (prev) {
    if (prev.profit < 0 && w.profit > prev.profit) {
      const ctx = `La semana pasada perdiste ${money(-prev.profit)} y esta ${w.profit >= 0 ? `ganaste ${money(w.profit)}` : `perdiste solo ${money(-w.profit)}`}. Mejoraste.`;
      if (!discover(s, 'practica', ctx)) applyLesson(s, 'practica', ctx);
    }
    if (w.revenue > prev.revenue && w.profit < prev.profit) {
      discover(s, 'revenue_vanity', `Esta semana vendiste más (${money(w.revenue)}) pero ganaste menos (${money(w.profit)}) que la anterior.`);
    } else if (level(s, 'revenue_vanity') > 0 && w.profit > prev.profit && w.profit > 0) {
      applyLesson(s, 'revenue_vanity', `Tu ganancia subió a ${money(w.profit)} esta semana.`);
    }
  }
  // Chapter 3: what each channel cost per booking.
  if (w.chapter >= 3 && w.bookings) {
    const cpb = (c) => (w.bookings[c] >= 0.5 ? w.chanCost[c] / w.bookings[c] : null);
    const names = { agencia: 'agencia', redes: 'redes', alianzas: 'alianzas', club: 'club' };
    const parts = Object.keys(names).filter((c) => cpb(c) != null).map((c) => `${names[c]} ${money(cpb(c))}`);
    if (parts.length) discover(s, 'medir', `Esta semana cada reserva te costó: ${parts.join(', ')}. La directa: $0.`);
    const mkt = w.costs.marketing + w.costs.commission;
    if (mkt > w.revenue * 0.25 && w.profit < 0) discover(s, 'decir_si', `Esta semana gastaste ${money(mkt)} en publicidad y comisiones de agencias, y la semana cerró con pérdida.`);
    const total = Object.values(w.bookings).reduce((a, b) => a + b, 0);
    if (s.mkt.ota && total > 0 && (w.bookings.directo + w.bookings.club) / total >= 0.6 && level(s, 'canal') > 0) {
      applyLesson(s, 'canal', `Con agencias activas, ${Math.round(((w.bookings.directo + w.bookings.club) / total) * 100)}% de tus reservas fueron directas: te ahorraste comisiones.`);
    }
  }
  if (prev && w.crossRevenue > 0 && prev.crossRevenue > 0 && w.crossRevenue / (w.soldTotal || 1) > prev.crossRevenue / (prev.soldTotal || 1) * 1.05) {
    applyLesson(s, 'cross_sell', `Cada huésped te dejó ${money(w.crossRevenue / (w.soldTotal || 1))} extra esta semana, más que la anterior.`);
  }
  if (w.chapter >= 7 && s.comp.open && w.occupancy >= occTargetFor(s, Math.ceil(s.day / 28)) && w.priceRatio >= 0.95) {
    applyLesson(s, 'diferencia', `Con GlobalStay enfrente llenaste ${Math.round(w.occupancy * 100)}% sin bajar tus precios.`);
  }
  if (w.chapter >= 7 && s.comp.overbook > 0 && w.walked === 0 && w.cancels > 0) {
    applyLesson(s, 'sobreventa', `Sobrevendiste con cuidado: hubo ${plural(w.cancels, 'cancelación', 'cancelaciones')} y nadie se quedó sin cuarto.`);
  }
  if (prev && w.chapter >= 7 && s.comp.auto.on && w.profit > prev.profit) {
    applyLesson(s, 'decide_info', `Tus reglas de precio automático decidieron con el pronóstico y la ganancia subió a ${money(w.profit)}.`);
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
    applyLesson(s, 'location', `${s.hotelName} cerró el mes con ganancia: la ubicación funciona.`);
    applyLesson(s, 'conoce_cliente', 'Tu propuesta de valor atrajo huéspedes todo el mes.');
  }
  monthLessons(s, m);
}

// Lessons whose practice shows over a whole month (chapters 2–8).
function monthLessons(s, m) {
  const prev = s.months[s.months.length - 2];
  if (m.quits === 0 && m.morale >= 65) applyLesson(s, 'retener', `Nadie renunció este mes y el ánimo cerró en ${Math.round(m.morale)}.`);
  if (s.team.skill > 0 && s.day - s.team.lastTrain <= 35 && prev && m.profit > prev.profit) {
    applyLesson(s, 'largo_plazo', `La capacitación costó al principio, y este mes ganaste ${money(m.profit)}: más que el anterior.`);
  }
  const mkt = m.costs.marketing + m.costs.commission;
  if (m.chapter >= 3 && level(s, 'decir_si') > 0 && m.profit > 0 && mkt <= m.revenue * 0.12) {
    applyLesson(s, 'decir_si', `Gastaste en publicidad y comisiones solo ${Math.round((mkt / m.revenue) * 100)}% de tus ingresos y el mes cerró con ganancia.`);
  }
  if (m.chapter >= 6) {
    if (m.breakdowns === 0 && s.maint.level >= 1 && s.maint.condition >= 70) {
      applyLesson(s, 'techo', `Con mantenimiento ${s.maint.level === 2 ? 'completo' : 'básico'}, el hotel cerró el mes en ${Math.round(s.maint.condition)}/100 y nada se descompuso.`);
    }
    if (s.maint.level >= 1 && s.maint.condition >= 75) applyLesson(s, 'barato_caro', `Pagaste mantenimiento cada día y el hotel está en ${Math.round(s.maint.condition)}/100.`);
    if (s.maint.insurance && s.maint.level >= 1) applyLesson(s, 'seguridad', 'Tu hotel tuvo seguro y mantenimiento todo el mes.');
    if (s.maint.controls && m.leak === 0) applyLesson(s, 'confia_verifica', 'Con el corte de caja diario no faltó ni un peso este mes.');
    if (season(s, s.day) < 0.97 && m.cash >= 2 * weekCost(s)) applyLesson(s, 'guarda', `Temporada baja y tu caja tiene ${money(m.cash)}: más de dos semanas de gastos.`);
  }
  if (s.manager && m.profit > 0 && m.lostDirty <= 3) applyLesson(s, 'delegar', `Tu gerente manejó la limpieza y el mes cerró con ${money(m.profit)} de ganancia. Tú revisaste los resultados.`);
}

export function afterHire(s) {
  const ctx = `Contrataste a una recamarista más. Ahora tu equipo de limpieza es de ${s.housekeepers}.`;
  if (!discover(s, 'rodeate', ctx)) applyLesson(s, 'rodeate', ctx);
}
