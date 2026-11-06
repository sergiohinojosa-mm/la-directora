// Lesson progression: Descubierta (lived it, heard the audio) → Aplicada (acted on it later)
// → Dominada (applied it three times). Each step carries `ctx`: what just happened in her hotel,
// so the saying is tied to a concrete memory. Messages queue in s.inbox and the UI shows them.

import { LESSON_BY_ID } from '../data/lessons.js';
import { totalRooms, weekCost, season } from './sim.js';
import { money, DAYS, calendar, DAYS_PER_MONTH } from '../util.js';
import { chapterFor, hotelMonth } from '../data/chapters.js';
import { occTargetFor, lowSeason, profitGoalFor } from './board.js';
import { CANCEL, wageInfo, activeOffers, PROJECTS, projectEstimate, paybackMonths } from './systems.js';

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

  // Chapter 2: the right-size team (too many hands, or too few several days in a row).
  if (r.chapter >= 2) {
    const tired = s.history.slice(-3);
    if (r.extraStaff > 0) {
      discover(s, 'equipo_justo', `Tienes ${r.housekeepers} recamaristas para ${r.rooms} cuartos y ${r.extraStaff === 1 ? 'una no se necesitaba' : `${r.extraStaff} no se necesitaban`}: pagaste ${money(r.idleWages)} de sueldos de más.`);
    } else if (tired.length === 3 && tired.every((x) => x.workload > 1 && x.chapter >= 2)) {
      discover(s, 'equipo_justo', 'Tres días seguidos tu equipo tuvo más cuartos de los que podía limpiar bien.');
    }
  }
  // Chapter 4: a cancellation under her own rules.
  if (r.chapter >= 4 && r.cancels > 0) {
    const charge = CANCEL[s.policy.cancel].charge;
    discover(s, 'reglas_claras', `Hoy ${plural(r.cancels, 'huésped canceló', 'huéspedes cancelaron')} y tu política ${CANCEL[s.policy.cancel].name.toLowerCase()} ya decía qué pasaba: ${r.cancels === 1 ? 'pagó' : 'pagaron'} ${charge === 0 ? 'nada' : charge < 1 ? 'la mitad' : 'todo'}. Nadie tuvo que discutir.`);
  }
  // Chapter 5: food bought to the guess, and too many offers at once.
  if (r.rest && r.rest.turnedAway > 0) {
    discover(s, 'inventario', `Hoy se acabó la comida y ${plural(r.rest.turnedAway, 'comensal se fue', 'comensales se fueron')} sin comer.`);
  } else if (r.rest && r.rest.waste > r.rest.food * 0.15) {
    discover(s, 'inventario', `Hoy sobró comida y se tiraron ${money(r.rest.waste)}. Esa comida también la pagaste.`);
  }
  if (r.cross?.tooMany) discover(s, 'menos_es_mas', `Hoy les ofreciste ${activeOffers(s).length} cosas a la vez a tus huéspedes: compraron menos y calificaron peor.`);
  // Chapter 7: what the chain takes.
  if (r.chainPrice && r.steal >= 0.01) discover(s, 'conoce_rival', `GlobalStay cobró ${money(r.chainPrice)} por noche y se llevó cerca de ${Math.round(r.steal * 100)}% de tus clientes.`);
  if (r.costs.socio > 0) discover(s, 'socio', `Hoy Don Rodrigo recibió ${money(r.costs.socio)}: su parte de la ganancia del mes.`);

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
    if (!discover(s, 'sobreventa', `Sobrevendiste con cuidado: hubo ${plural(w.cancels, 'cancelación', 'cancelaciones')} y nadie se quedó sin cuarto. Pero si un día llegan todos, alguien se queda fuera.`)) applyLesson(s, 'sobreventa', `Sobrevendiste con cuidado: hubo ${plural(w.cancels, 'cancelación', 'cancelaciones')} y nadie se quedó sin cuarto.`);
  }
  if (prev && w.chapter >= 7 && s.comp.auto.on && w.profit > prev.profit) {
    applyLesson(s, 'decide_info', `Tus reglas de precio automático decidieron con el pronóstico y la ganancia subió a ${money(w.profit)}.`);
  }

  if (w.chapter >= 2 && w.idleWages === 0 && w.lostDirty === 0 && w.occupancy >= 0.6) {
    applyLesson(s, 'equipo_justo', `Esta semana tu equipo alcanzó para ${Math.round(w.occupancy * 100)}% de ocupación y nadie sobró.`);
  }
  if (w.chapter >= 3 && w.bookings) {
    const total = Object.values(w.bookings).reduce((a, b) => a + b, 0);
    if (total > 0 && w.bookings.club / total >= 0.1) applyLesson(s, 'repite', `Esta semana ${Math.round((w.bookings.club / total) * 100)}% de tus reservas fueron de huéspedes que regresaron.`);
  }
  // Chapter 5: what each guest leaves.
  if (w.chapter >= 5 && w.soldTotal > 0) {
    const extras = w.revenue - w.roomRevenue;
    discover(s, 'ingreso_huesped', `Esta semana cada huésped te dejó ${money(w.revenue / w.soldTotal)}: ${money(w.roomRevenue / w.soldTotal)} por el cuarto y ${money(extras / w.soldTotal)} en comida y extras.`);
    if (extras / w.revenue >= 0.12) applyLesson(s, 'ingreso_huesped', `${Math.round((extras / w.revenue) * 100)}% de lo que vendiste esta semana no fueron cuartos.`);
  }
  if (w.restFood > 0 && w.restWaste <= w.restFood * 0.1) applyLesson(s, 'inventario', `Esta semana se tiró menos de 10% de la comida que compraste.`);
  if (w.chapter >= 5 && w.crossRevenue > 0 && activeOffers(s).length <= 2) {
    const n = activeOffers(s).length;
    const ctx = `Con ${n === 1 ? 'una sola oferta bien elegida' : `solo ${n} ofertas bien elegidas`}, tus huéspedes compraron ${money(w.crossRevenue)} en extras esta semana.`;
    if (hotelMonth(s) < 6 || !discover(s, 'menos_es_mas', ctx)) applyLesson(s, 'menos_es_mas', ctx);
  }
  // Chapter 7: RevPAR, the rival and her own rules.
  if (w.chapter >= 7 && w.soldTotal > 0) {
    const before = s.months.find((x) => x.month === 8);
    if (hotelMonth(s) >= 10) discover(s, 'revpar', `Esta semana llenaste ${Math.round(w.occupancy * 100)}% de tus cuartos a ${money(w.adr)} en promedio. Cada cuarto, lleno o vacío, te dejó ${money(w.revpar)} por noche (RevPAR)${before ? `; antes de GlobalStay, ${money(before.revpar)}` : ''}.`);
    if (prev?.revpar && w.revpar > prev.revpar * 1.05) applyLesson(s, 'revpar', `Tu RevPAR subió de ${money(prev.revpar)} a ${money(w.revpar)} por noche.`);
    const steal = (list) => list.reduce((a, x) => a + (x.steal || 0), 0) / (list.length || 1);
    const lastWeek = s.history.slice(-14, -7);
    if (lastWeek.length === 7 && steal(lastWeek) > 0 && steal(days) < steal(lastWeek) * 0.9) applyLesson(s, 'conoce_rival', `Esta semana GlobalStay se llevó menos clientes tuyos que la anterior.`);
    if (s.comp.auto.on && w.occupancy >= occTargetFor(s, Math.ceil(s.day / 28))) applyLesson(s, 'reglas_precio', `Con tus reglas de precio automático llenaste ${Math.round(w.occupancy * 100)}% esta semana.`);
    if (s.comp.unique && w.reputation >= 4 && w.reputation >= w.repStart) applyLesson(s, 'experiencia', `Con tu experiencia única, tus reseñas siguen en ${w.reputation.toFixed(1)}★.`);
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
  if (s.team.skill > 0 && s.day - s.team.lastTrain <= 35 && prev && m.profit > 0 && m.profit > prev.profit) {
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
    if (m.month >= 8) {
      discover(s, 'confia_verifica', s.maint.controls
        ? `Con el corte de caja diario revisaste el dinero todos los días${m.leak === 0 ? ' y no faltó ni un peso' : ''}.`
        : 'Este mes nadie contó la caja al final del día: si faltó dinero, no lo sabrías.');
    }
    if (s.maint.insurance && s.maint.level >= 1) applyLesson(s, 'seguridad', 'Tu hotel tuvo seguro y mantenimiento todo el mes.');
    if (s.maint.controls && m.leak === 0) applyLesson(s, 'confia_verifica', 'Con el corte de caja diario no faltó ni un peso este mes.');
    if (season(s, s.day) < 0.97 && m.cash >= 2 * weekCost(s)) applyLesson(s, 'guarda', `Temporada baja y tu caja tiene ${money(m.cash)}: más de dos semanas de gastos.`);
  }
  monthGuaranteed(s, m, prev);
  if (s.manager && m.profit > 0 && m.lostDirty <= 3) applyLesson(s, 'delegar', `Tu gerente manejó la limpieza y el mes cerró con ${money(m.profit)} de ganancia. Tú revisaste los resultados.`);
}

export function afterHire(s) {
  const ctx = `Contrataste a una recamarista más. Ahora tu equipo de limpieza es de ${s.housekeepers}.`;
  if (!discover(s, 'rodeate', ctx)) applyLesson(s, 'rodeate', ctx);
}

const COST_NAMES = {
  fixed: 'luz, agua y gastos del edificio', variable: 'limpieza y amenidades', wages: 'sueldos', extra: 'horas extra', loan: 'pago al banco',
  promises: 'promesas a huéspedes', marketing: 'publicidad', commission: 'comisiones de agencias', service: 'quejas resueltas', restaurant: 'restaurante',
  maint: 'mantenimiento', tax: 'impuesto por hospedaje', isr: 'impuesto sobre la ganancia', socio: 'la parte de Don Rodrigo',
};
const yearMonths = (s, upTo) => s.months.filter((x) => x.month > upTo - 12 && x.month <= upTo);

// One lesson every month is sure to show up: it closes the month with her own numbers.
function monthGuaranteed(s, m, prev) {
  const pct = (v) => `${Math.round((v / (m.revenue || 1)) * 100)}%`;
  if (m.chapter === 2) {
    discover(s, 'sueldo_justo', `Este mes pagaste ${money(m.costs.wages)} de sueldos, con sueldo ${wageInfo(s).name.toLowerCase()}, y ${m.quits ? plural(m.quits, 'persona renunció', 'personas renunciaron') : 'nadie renunció'}.`);
  }
  if (m.chapter >= 2 && s.team.wage >= 1 && m.quits === 0 && m.profit > 0) applyLesson(s, 'sueldo_justo', `Pagaste sueldos justos, nadie renunció y el mes cerró con ${money(m.profit)} de ganancia.`);
  if (m.chapter === 3) {
    const club = Math.round(m.bookings.club || 0);
    discover(s, 'repite', club ? `Este mes ${plural(club, 'reserva vino', 'reservas vinieron')} de huéspedes del club que regresaron, sin pagar comisión.` : 'Este mes ninguna reserva vino de huéspedes que regresan. Para eso sirve el club de huéspedes.');
  }
  if (m.chapter === 4) {
    discover(s, 'responde', m.complaints ? `Este mes ${m.complaints === 1 ? 'llegó 1 queja' : `llegaron ${m.complaints} quejas`} y ${m.complaints - m.unresolved ? `recepción resolvió ${m.complaints - m.unresolved} en el momento` : 'recepción no pudo resolver ninguna en el momento'}.` : 'Este mes no llegó ni una queja. Cuando llegue, resuélvela rápido.');
  }
  if (m.chapter >= 4 && m.complaints >= 3 && m.unresolved <= m.complaints * 0.2) applyLesson(s, 'responde', `Recepción resolvió ${m.complaints - m.unresolved} de ${m.complaints} quejas en el momento.`);
  if (m.chapter >= 4 && s.policy.set && m.cancels > 0) applyLesson(s, 'reglas_claras', `Este mes hubo ${plural(m.cancels, 'cancelación', 'cancelaciones')} y tus reglas se cumplieron sin pleitos.`);
  if (m.chapter === 5) {
    const net = m.restRevenue - m.restFood - m.restStaff;
    discover(s, 'cada_negocio', s.rest.open || m.restRevenue
      ? `Este mes el restaurante vendió ${money(m.restRevenue)} y gastó ${money(m.restFood + m.restStaff)} en comida y cocina: ${net >= 0 ? `le quedaron ${money(net)}` : `perdió ${money(-net)}`}.`
      : 'Este mes no abriste restaurante. Si un día lo abres, revisa si deja más de lo que cuesta.');
  }
  if (m.chapter >= 5 && m.restRevenue > 0 && m.restRevenue - m.restFood - m.restStaff > 0) applyLesson(s, 'cada_negocio', `Tu restaurante se pagó solo y dejó ${money(m.restRevenue - m.restFood - m.restStaff)} este mes.`);
  if (m.month === 6) {
    const rest = m.restRevenue || 0;
    discover(s, 'huevos', `Este mes ${pct(m.roomRevenue)} de tus ventas vino de los cuartos${rest ? `, ${pct(rest)} del restaurante` : ''} y ${pct(m.revenue - m.roomRevenue - rest)} de extras.`);
  }
  if (m.chapter >= 5 && m.revenue > 0 && (m.revenue - m.roomRevenue) / m.revenue >= 0.15) applyLesson(s, 'huevos', `${pct(m.revenue - m.roomRevenue)} de tus ventas vino de algo distinto a los cuartos.`);
  if (m.month >= 7 && m.month <= 12) {
    const first = s.months.filter((x) => x.month <= 5);
    const avg = first.reduce((a, x) => a + x.profit, 0) / (first.length || 1);
    if (first.length && m.profit > avg) applyLesson(s, 'mitad_camino', `Este mes ganaste ${money(m.profit)}: más que tu promedio de los primeros cinco meses.`);
  }
  if (m.chapter === 6) {
    discover(s, 'impuestos', `Este mes pagaste ${money(m.costs.tax)} de impuesto por hospedaje (3% de cada noche)${m.costs.isr ? ` y ${money(m.costs.isr)} de impuesto sobre la ganancia (30%)` : ''}.`);
  }
  if (m.chapter >= 6 && m.costs.isr > 0 && m.cash >= 2 * weekCost(s)) applyLesson(s, 'impuestos', `Pagaste ${money(m.costs.isr)} de impuestos y tu caja siguió sana.`);
  const smallCosts = (x) => Math.max(0, x.costs.marketing) + Math.max(0, x.costs.extra);
  if (m.chapter >= 6 && prev && smallCosts(m) < smallCosts(prev) * 0.9 && m.profit > 0) applyLesson(s, 'hormiga', `Tus gastos pequeños (publicidad y horas extra) bajaron ${money(smallCosts(prev) - smallCosts(m))} este mes y cerraste con ganancia.`);
  if (m.chapter >= 7 && prev && m.profit > prev.profit && m.reputation >= 4) applyLesson(s, 'valor_hotel', `Tu hotel ganó más que el mes pasado y tiene ${m.reputation.toFixed(1)}★: hoy vale más.`);
  if (m.chapter >= 7 && s.comp.overbook > 0 && m.walked === 0) applyLesson(s, 'riesgo_premio', 'Sobrevendiste un poco para ganar más, mediste el riesgo y nadie se quedó sin cuarto.');
  if (m.chapter >= 6 && prev && m.costTotal < prev.costTotal && m.profit > 0) applyLesson(s, 'presupuesto', `Gastaste ${money(prev.costTotal - m.costTotal)} menos que el mes pasado y cerraste con ganancia.`);
  if (m.month === 8) {
    const fixed = m.costs.fixed + m.costs.wages + m.costs.loan + m.costs.maint;
    discover(s, 'costos_fijos', `Este mes pagaste ${money(fixed)} en sueldos, luz, banco y mantenimiento: ${money(fixed / DAYS_PER_MONTH)} cada día, aunque el hotel estuviera vacío.`);
  }
  if (m.chapter >= 6 && lowSeason(s, m.month) && m.profit >= 0) applyLesson(s, 'costos_fijos', `Temporada baja y aun así cubriste todos tus gastos fijos.`);
  if (m.month === 10) {
    discover(s, 'marca', `Con GlobalStay enfrente cerraste el mes con ${m.reputation.toFixed(1)}★ y ${Math.round(m.occupancy * 100)}% de ocupación.`);
  }
  if (m.chapter >= 7 && m.reputation >= 4.2) applyLesson(s, 'marca', `Tus huéspedes hablan bien de ti: ${m.reputation.toFixed(1)}★ al cerrar el mes.`);
  if (m.chapter >= 8 && m.costs.socio > 0 && m.profit > 0) applyLesson(s, 'socio', `Aun después de darle su parte a Don Rodrigo, el mes cerró con ${money(m.profit)} de ganancia.`);
  if (m.month === 11 && level(s, 'recuperacion') === 0) {
    const id = s.plan.project || 'terraza';
    const est = Math.max(0, projectEstimate(s, id));
    const p = paybackMonths(s, id);
    discover(s, 'recuperacion', `La obra (${PROJECTS[id].short.toLowerCase()}) costaría ${money(PROJECTS[id].cost(s))} y dejaría unos ${money(est)} al mes: ${p === Infinity ? 'nunca se pagaría' : `se pagaría en ${plural(p, 'mes', 'meses')}`}.`);
  }
  if (m.month === 12) {
    const year = yearMonths(s, 12);
    const best = year.reduce((a, b) => (b.profit > a.profit ? b : a));
    const worst = year.reduce((a, b) => (b.profit < a.profit ? b : a));
    discover(s, 'aprende_ano', `Tu mejor mes del año fue el mes ${best.month} (${money(best.profit)}) y el más difícil, el mes ${worst.month} (${money(worst.profit)}). ¿Qué hiciste distinto?`);
  }
  if ((s.diary || []).some((d) => d.answer && d.day > s.day - DAYS_PER_MONTH)) applyLesson(s, 'aprende_ano', 'Este mes escribiste en tu diario lo que aprendiste.');
  // Año 2: compare with herself a year ago, and keep checking when things go well.
  if (m.month === 13) {
    const goal = profitGoalFor(s, 13);
    const was = profitGoalFor(s, 1);
    discover(s, 'exito', goal > was
      ? `El Consejo subió la meta de ganancia: hace un año pedía ${money(was)} al mes y ahora pide ${money(goal)}. Lo que bastaba antes ya no alcanza.`
      : 'Empezar el Año 2 con lo que aprendiste no garantiza que todo salga igual: cambian los clientes, la competencia y los precios.');
  }
  if (m.month >= 13) {
    const ago = s.months.find((x) => x.month === m.month - 12);
    if (ago) {
      const ctx = `Hace un año, en este mes ${ago.profit >= 0 ? `ganaste ${money(ago.profit)}` : `perdiste ${money(-ago.profit)}`}; ahora ${m.profit >= 0 ? `ganaste ${money(m.profit)}` : `perdiste ${money(-m.profit)}`}.`;
      if (!discover(s, 'mejora_continua', ctx) && m.profit > ago.profit) applyLesson(s, 'mejora_continua', ctx);
    }
    if (prev && m.profit < prev.profit) discover(s, 'exito', `El mes pasado ${prev.profit >= 0 ? `ganaste ${money(prev.profit)}` : `perdiste ${money(-prev.profit)}`} y este ${m.profit >= 0 ? `ganaste ${money(m.profit)}` : `perdiste ${money(-m.profit)}`}. Lo que funcionó antes no siempre vuelve a funcionar.`);
    else if (m.profit >= profitGoalFor(s, m.month)) applyLesson(s, 'exito', `Cumpliste la meta de ganancia del mes: ${money(m.profit)}.`);
  }
}

// Story beats inside the long chapters: the first day and the middle of some months.
export function monthBeats(s) {
  const { dayOfMonth } = calendar(s.day);
  const month = hotelMonth(s);
  const last = s.months[s.months.length - 1];
  if (month === 6 && dayOfMonth === 1) {
    const first = s.months.filter((x) => x.month <= 5);
    if (first.length) {
      const total = first.reduce((a, x) => a + x.profit, 0);
      const best = first.reduce((a, b) => (b.profit > a.profit ? b : a));
      const worst = first.reduce((a, b) => (b.profit < a.profit ? b : a));
      discover(s, 'mitad_camino', `En 5 meses ${s.hotelName} lleva ${money(Math.abs(total))} ${total >= 0 ? 'de ganancia' : 'de pérdida'}. Tu mejor mes fue el mes ${best.month} (${money(best.profit)}) y el más difícil, el mes ${worst.month} (${money(worst.profit)}).`);
    }
  }
  if (month === 7 && dayOfMonth === 15) {
    const two = s.history.slice(-14);
    const small = two.reduce((a, x) => a + Math.max(0, x.costs.marketing || 0) + Math.max(0, x.costs.extra || 0), 0);
    const r100 = (v) => Math.round(v / 100) * 100;
    discover(s, 'hormiga', `En dos semanas, publicidad, horas extra y otros gastos pequeños de cada día sumaron ${money(r100(small))}: unos ${money(2 * r100(small))} al mes.`);
  }
  if (month === 13 && dayOfMonth === 15) {
    discover(s, 'delegar', 'Papá te sugirió contratar un gerente para el día a día. Puedes hacerlo, pero tú sigues respondiendo por los resultados.');
  }
  if (month === 8 && dayOfMonth === 1 && last) {
    const top = Object.entries(last.costs).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
    discover(s, 'presupuesto', `El mes pasado gastaste ${money(last.costTotal)}. Lo más grande: ${top.map(([k, v]) => `${COST_NAMES[k]} (${money(v)})`).join('; ')}.`);
  }
  if (month === 10 && dayOfMonth === 1) {
    const a = s.months.find((x) => x.month === 8);
    const b = s.months.find((x) => x.month === 9);
    discover(s, 'innovar', a && b
      ? `Antes de GlobalStay llenabas ${Math.round(a.occupancy * 100)}% de tus cuartos; con GlobalStay enfrente, ${Math.round(b.occupancy * 100)}%. Ellos también van a seguir mejorando.`
      : 'GlobalStay ya lleva un mes enfrente, y va a seguir mejorando.');
  }
  if (month === 8 && dayOfMonth === 15) {
    const c = Math.round(s.maint.condition ?? 72);
    discover(s, 'barato_caro', s.maint.level === 0
      ? `Alma revisó el hotel: sin mantenimiento bajó a ${c} de 100. Lo que hoy ahorras, mañana se descompone.`
      : `Alma revisó el hotel: con el mantenimiento que pagas está en ${c} de 100. Ese gasto evita reparaciones más caras.`);
  }
  if (month === 12 && dayOfMonth === 8) {
    discover(s, 'escucha_todos', 'Alma quiere repartir ganancias a los dueños, Marcela quiere reinvertir en el equipo y Don Rodrigo quiere ganar más este año. Cada quien cuida algo distinto.');
  }
  if (month === 12 && dayOfMonth === 1) {
    const total = yearMonths(s, 11).reduce((a, x) => a + x.profit, 0);
    discover(s, 'reinvertir', `En 11 meses ${s.hotelName} lleva ${money(Math.abs(total))} ${total >= 0 ? 'de ganancia' : 'de pérdida'}. Al cerrar el año vas a decidir cuánto repartir y cuánto dejar en el hotel para crecer.`);
  }
  if (month === 12 && dayOfMonth === 15) {
    const rooms = yearMonths(s, 11).reduce((a, x) => a + x.soldTotal, 0) + s.history.slice(-14).reduce((a, x) => a + x.soldTotal, 0);
    discover(s, 'gracias_equipo', `Este año tu equipo preparó ${rooms.toLocaleString('es-MX')} cuartos para tus huéspedes. Sin tus recamaristas, el hotel no abre.`);
  }
}
