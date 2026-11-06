// Turn structure: morning event → decisions → day → evening → (week report) → (board meeting).

import { rng, pickWeighted, calendar, clamp, money, DAYS_PER_MONTH } from '../util.js';
import { EVENTS, EVENT_BY_ID, txt } from '../data/events.js';
import { simulateDay, summarize, weekCost, forecast, refEff, totalRooms, preview, cleaningCapacity, roomsOf } from './sim.js';
import { afterDay, afterWeek, afterMonth, afterHire, discover, applyLesson, level, monthBeats } from './lessons.js';
import { checkBadges } from '../data/badges.js';
import { CHALLENGES, CHALLENGE_BY_ID } from '../data/challenges.js';
import { hire as hireOne, fire as fireOne } from './sim.js';
import { chapterFor, hotelMonth } from '../data/chapters.js';
import { ADVICE } from '../data/advice.js';
import {
  ensure, quitChance, STAFF_NAMES, breakdownChance, potRev, trainCost, canTrain, restaurantInvestment,
  uniqueCost, finishProject, managerCost, UNIQUE, PROJECTS, paybackMonths, projectEstimate, newLoanPayment, SOCIO_SHARE,
} from './systems.js';
import { mandateFor } from './board.js';

const EVENT_CHANCE = 0.5;

// A new weekly challenge every Monday, never the same as last week.
export function pickChallenge(s) {
  const last = s.challenge?.id;
  const pool = CHALLENGES.filter((c) => c.id !== last);
  s.challenge = { id: pool[Math.floor(rng(s) * pool.length)].id, week: calendar(s.day).week };
}

// The adaptive game director: a hotel doing well gets more bad news, one struggling gets less.
function difficulty(s) {
  const last = s.history.slice(-7);
  if (last.length < 3) return 0;
  const profit = last.reduce((a, r) => a + r.profit, 0);
  return clamp(profit / (weekCost(s) * 0.5), -1, 1);
}

// Cards the systems trigger: someone quits, something breaks, money is missing, a lie comes out.
function forcedEvent(s) {
  const ch = chapterFor(s);
  if (ch >= 2 && s.housekeepers > 0 && rng(s) < quitChance(s)) {
    s.flags.quitName = STAFF_NAMES[(s.hiredEver + s.team.quits.length + 1) % STAFF_NAMES.length];
    s.housekeepers -= 1;
    s.team.quits.push(s.day);
    return 'renuncia';
  }
  // The first breakdown always comes in the chapter's first month: things wear out even when you don't see it.
  if (ch === 6 && !(s.maint.breakdowns || []).length && calendar(s.day).dayOfMonth >= 10) return 'falla_aire';
  if (ch >= 6 && rng(s) < breakdownChance(s)) return s.eventsSeen.filter((e) => e === 'falla_aire').length <= s.eventsSeen.filter((e) => e === 'falla_agua').length ? 'falla_aire' : 'falla_agua';
  if (ch >= 6 && !s.flags.lowSeasonTold && calendar(s.day).dayOfMonth >= 3) { s.flags.lowSeasonTold = true; return 'temporada_baja'; }
  if (ch >= 6 && !s.maint.controls && !s.flags.faltanteShown && s.maint.leak - s.maint.leakFound >= potRev(s) * 0.12) { s.flags.faltanteShown = true; return 'faltante'; }
  if (s.flags.fakeReviews && s.day - s.flags.fakeReviews >= 10 && rng(s) < 0.25) { delete s.flags.fakeReviews; return 'resenas_descubiertas'; }
  if (s.flags.bribe && s.day - s.flags.bribe >= 12 && rng(s) < 0.2) { delete s.flags.bribe; return 'mordida_descubierta'; }
  return null;
}

export function startMorning(s) {
  ensure(s);
  s.phase = 'morning';
  s.event = null;
  s.eventResult = null;
  s.eventAdvice = null;
  s.notices = [];
  if (s.flags.restorePrices) {
    s.prices = { ...s.prices, ...s.flags.restorePrices };
    delete s.flags.restorePrices;
    s.notices.push('🏷️ Terminó la promoción relámpago: tus precios regresaron a como estaban.');
  }
  const ch = chapterFor(s);
  if (s.plan.status === 'building' && s.day >= s.plan.readyDay) {
    finishProject(s);
    if (s.cash > weekCost(s)) applyLesson(s, 'crecer', `Terminó la obra y tu caja siguió con ${money(s.cash)}.`);
    s.notices.push(`🎉 ¡Terminó la obra! ${s.plan.project === 'cuartos' ? 'Ya tienes 4 cuartos más para vender.' : s.plan.project === 'spa' ? 'Tu spa ya está abierto.' : 'Tu terraza ya está abierta.'}`);
    checkBadges(s, 'project');
  }
  if (ch >= 7 && s.comp.auto.on) autoPrice(s);
  if (s.manager) manage(s);
  if (s.day === 1) return;
  const forced = forcedEvent(s);
  if (forced) {
    s.event = { id: forced };
    s.eventsSeen.push(forced);
    return;
  }
  if (rng(s) > EVENT_CHANCE) return quickDecision(s);
  const recent = s.eventsSeen.slice(-10);
  const d = difficulty(s);
  const pool = EVENTS.filter((e) => !e.forced && !e.quick && !(e.once && s.eventsSeen.includes(e.id)) && (e.ch ?? 1) <= ch && hotelMonth(s) >= (e.month ?? 0) && s.day >= (e.minDay ?? 0) && !recent.includes(e.id) && (!e.when || e.when(s)));
  if (!pool.length) return quickDecision(s);
  // Cards of the current chapter come up more often, so each chapter feels new.
  const ev = pickWeighted(s, pool, (e) => (e.negative ? 1 + d * 0.6 : 1 - d * 0.4) * ((e.ch ?? 1) === ch ? 2.5 : 1));
  s.event = { id: ev.id };
  s.eventsSeen.push(ev.id);
}

// Every morning without a story card still brings one quick choice, so no day is just "next".
// Slow days ask what to do with empty rooms and free hands; busy days bring guest requests.
function quickDecision(s) {
  const slow = forecast(s, s.day).total < totalRooms(s) * 0.8;
  const recent = s.eventsSeen.slice(-6);
  const pool = EVENTS.filter((e) => e.quick === (slow ? 'slow' : 'busy') && !recent.includes(e.id) && (!e.when || e.when(s)));
  if (!pool.length) return;
  const ev = pool[Math.floor(rng(s) * pool.length)];
  s.event = { id: ev.id };
  s.eventsSeen.push(ev.id);
}

export const eventOptions = (s, ev) => ev.options.map((o, i) => ({ ...o, i })).filter((o) => !o.when || o.when(s));

export function resolveEvent(s, optionIndex) {
  const ev = EVENT_BY_ID[s.event.id];
  const opt = ev.options[optionIndex];
  // The advice is judged on the situation she decided in, before the choice changes it.
  const adv = ADVICE[ev.id];
  const best = adv ? (typeof adv.best === 'function' ? adv.best(s) : adv.best) : null;
  s.eventResult = opt.apply(s) || '';
  s.eventAdvice = adv ? {
    why: adv.why, chosen: optionIndex, best,
    bestLabel: best != null && ev.options[best] ? txt(ev.options[best].label, s) : null,
    single: ev.options.length === 1,
  } : null;
  s.event.chosen = optionIndex;
  if (ev.negative) s.flags.badEventDay = s.day;
  if (ev.id.startsWith('falla')) s.maint.breakdowns = [...(s.maint.breakdowns || []), s.day];
  let fresh = false;
  if (ev.lesson) {
    const ctx = txt(ev.lessonCtx, s);
    fresh = discover(s, ev.lesson, ctx);
    if (!fresh && opt.wise) applyLesson(s, ev.lesson, opt.wiseCtx || ctx);
  }
  // Breakdowns teach what insurance is for (once the repair lesson itself is known).
  if (ev.id.startsWith('falla')) {
    if (s.maint.insurance) {
      const ctx = 'Se descompuso algo y el seguro pagó 70% de la reparación.';
      if (!discover(s, 'seguro', ctx)) applyLesson(s, 'seguro', ctx);
    } else if (!fresh) discover(s, 'seguro', 'Se descompuso algo otra vez y pagaste toda la reparación, porque no tenías seguro.');
  }
  checkBadges(s, 'event');
}

// Dynamic pricing rules (chapter 7): up on busy days, down on slow ones.
export function autoPrice(s) {
  const fc = forecast(s, s.day);
  const ratio = fc.total / totalRooms(s);
  const mult = ratio > 1.05 ? 1 + s.comp.auto.up : ratio < 0.75 ? 1 - s.comp.auto.down : 1;
  for (const r of roomsOf(s)) {
    const step = r.ref < 2000 ? 50 : 100;
    s.prices[r.id] = Math.round((refEff(s, r) * mult) / step) * step;
  }
}

// Año 2: the manager runs cleaning day to day.
function manage(s) {
  const p = preview(s);
  if (p.lostDirty > 0) s.overtime = true;
  if (p.dirtyStart > cleaningCapacity(s).real * 1.3 && s.cash > weekCost(s)) { hireOne(s); s.notices.push('🧑‍💼 Tu gerente contrató a una recamarista más.'); }
  if (canTrain(s) && s.cash > weekCost(s) * 2 && s.team.skill < 2) { train(s); s.notices.push('🧑‍💼 Tu gerente organizó una capacitación.'); }
}

export function hire(s) {
  hireOne(s);
  afterHire(s);
  checkBadges(s, 'hire');
}

export const fire = fireOne;

export function train(s) {
  if (!canTrain(s)) return false;
  const cost = trainCost(s);
  s.cash -= cost;
  s.team.skill += 1;
  s.team.lastTrain = s.day;
  s.mods.push({ type: 'cleanMult', mult: 0.75, from: s.day, to: s.day, label: 'Capacitación del equipo' });
  const ctx = `Capacitaste a tu equipo: costó ${money(cost)} y hoy limpian menos, pero desde mañana limpian ${s.team.skill * 6}% más rápido para siempre.`;
  if (!discover(s, 'largo_plazo', ctx)) applyLesson(s, 'largo_plazo', ctx);
  if (chapterFor(s) >= 7) {
    const grow = 'Capacitaste a tu equipo con GlobalStay enfrente buscando gente: quien aprende contigo tiene razones para quedarse.';
    if (!discover(s, 'talento', grow)) applyLesson(s, 'talento', grow);
  }
  checkBadges(s, 'hire');
  return true;
}

// Every setting change in the business areas goes through here so lessons can react to it.
export function act(s, what, value) {
  ensure(s);
  const before = s.weeks[s.weeks.length - 1];
  const wasOff = { ota: !s.mkt.ota, alliance: !s.mkt.alliance, club: !s.mkt.club, social: !s.mkt.social }[what];
  switch (what) {
    case 'wage': s.team.wage = value; break;
    case 'ota': case 'alliance': case 'club': {
      if (!value && s.mkt[what]) measured(s, { ota: 'agencia', alliance: 'alianzas', club: 'club' }[what], before);
      s.mkt[what] = value; break;
    }
    case 'social': {
      if (value < s.mkt.social) measured(s, 'redes', before);
      s.mkt.social = value; break;
    }
    case 'cancel': s.policy.cancel = value; s.policy.set = true; break;
    case 'power': s.policy.power = value; s.policy.set = true; break;
    case 'openRestaurant': s.cash -= restaurantInvestment(s); s.rest.open = true; checkBadges(s, 'project'); break;
    case 'menu': s.rest.menu = value; break;
    case 'buy': s.rest.buy = value; break;
    case 'offer': s.offers[value.id] = value.on; break;
    case 'maint': s.maint.level = value; break;
    case 'insurance': {
      s.maint.insurance = value;
      if (value) discover(s, 'seguro', 'Contrataste un seguro: pagas poco cada día y, si algo grande se rompe, cubre 70% de la reparación.');
      break;
    }
    case 'controls': s.maint.controls = value; break;
    case 'unique': {
      s.cash -= uniqueCost(s);
      s.comp.unique = value;
      const name = (UNIQUE[s.locationId].find(([id]) => id === value) || [])[1] || 'tu experiencia';
      discover(s, 'experiencia', `Creaste ${name.replace(/^\S+\s/, '')}: algo que GlobalStay no tiene.`);
      checkBadges(s, 'project');
      break;
    }
    case 'auto': {
      const was = s.comp.auto.on;
      s.comp.auto = { ...s.comp.auto, ...value };
      if (s.comp.auto.on) autoPrice(s);
      if (s.comp.auto.on && !was) discover(s, 'reglas_precio', `Encendiste tus reglas: subir ${Math.round(s.comp.auto.up * 100)}% cuando viene más gente que cuartos y bajar ${Math.round(s.comp.auto.down * 100)}% cuando viene poca.`);
      break;
    }
    case 'overbook': s.comp.overbook = value; break;
    case 'project': {
      s.plan.project = value;
      const p = paybackMonths(s, value);
      const ctx = `La obra (${PROJECTS[value].short.toLowerCase()}) cuesta ${money(PROJECTS[value].cost(s))} y dejaría unos ${money(Math.max(0, projectEstimate(s, value)))} al mes: ${p === Infinity ? 'nunca se pagaría' : `se pagaría en ${p} ${p === 1 ? 'mes' : 'meses'}`}.`;
      discover(s, 'recuperacion', ctx);
      break;
    }
    case 'funding': {
      s.plan.funding = value;
      const cost = s.plan.project ? PROJECTS[s.plan.project].cost(s) : 0;
      if (value === 'banco' && cost) discover(s, 'deuda', `Con el préstamo, tu pago al banco subiría a ${money(s.payment + newLoanPayment(s, cost))} al mes durante 5 años.`);
      if (value === 'socio') discover(s, 'socio', `Don Rodrigo pondría el dinero de la obra y se llevaría ${Math.round(SOCIO_SHARE * 100)}% de la ganancia de cada mes.`);
      break;
    }
    case 'negotiate': {
      s.plan.negotiated = value;
      if (value) applyLesson(s, 'deuda', 'Negociaste con el banco una tasa de interés más baja antes de pedir prestado.');
      break;
    }
    case 'manager': {
      s.manager = value;
      if (value) {
        const ctx = `Contrataste un gerente por ${money(managerCost(s))} al día para que maneje la limpieza y el equipo.`;
        if (!discover(s, 'delegar', ctx)) applyLesson(s, 'delegar', ctx);
      }
      break;
    }
    default: break;
  }
  // Ventas: turning a channel on is a small test worth measuring for a week before the next one.
  if (wasOff && value && chapterFor(s) >= 3) {
    const label = { ota: 'las agencias en línea', alliance: 'las alianzas', club: 'el club de huéspedes', social: 'los anuncios en redes' }[what];
    const waited = s.flags.lastChannelOn != null && s.day - s.flags.lastChannelOn >= 7;
    if (!discover(s, 'prueba_chico', `Encendiste ${label}. Mídelo una semana antes de agregar otro canal.`) && waited) {
      applyLesson(s, 'prueba_chico', `Mediste una semana antes de encender ${label}.`);
    }
    s.flags.lastChannelOn = s.day;
  }
  if (chapterFor(s) >= 7 && value && ['unique', 'auto', 'menu', 'offer'].includes(what) && (what !== 'offer' || value.on)) {
    applyLesson(s, 'innovar', 'Probaste algo nuevo en tu hotel en lugar de hacer lo de siempre.');
  }
  checkBadges(s, 'act');
}

// "Lo que no se mide no se mejora": turning off the channel that cost the most per booking last week.
function measured(s, channel, w) {
  if (!w?.bookings || level(s, 'medir') === 0) return;
  const cpb = (c) => (w.bookings[c] >= 0.5 ? w.chanCost[c] / w.bookings[c] : 0);
  const worst = ['agencia', 'redes', 'alianzas', 'club'].sort((a, b) => cpb(b) - cpb(a))[0];
  if (worst === channel && cpb(channel) > 0) applyLesson(s, 'medir', `Apagaste ${channel === 'agencia' ? 'las agencias en línea' : channel}, el canal que te costó más por reserva (${money(cpb(channel))}).`);
}

export function playDay(s) {
  const r = simulateDay(s);
  afterDay(s, r);
  checkBadges(s, 'day', r);
  s.lastResult = r;
  s.phase = 'evening';
  return r;
}

// Called when she taps "Siguiente" on the evening report. Returns the next phase.
export function finishEvening(s) {
  const r = s.lastResult;
  if (r.cash < 0) {
    s.rescues += 1;
    s.phase = s.rescues >= 2 ? 'closed' : 'rescue';
    if (s.phase === 'rescue') {
      s.cash += Math.round(weekCost(s) * 2 / 1000) * 1000;
      s.confidence = clamp(s.confidence - 20, 0, 100);
    }
    return s.phase;
  }
  return advanceAfterDay(s);
}

export function advanceAfterDay(s) {
  const day = s.lastResult.day;
  if (day % 7 === 0 && !s.weeks.find((w) => w.week === day / 7)) {
    const w = { week: day / 7, chapter: chapterFor(s, day), ...summarize(s.history.slice(-7)) };
    const prev = s.weeks[s.weeks.length - 1];
    s.weeks.push(w);
    afterWeek(s, w, prev);
    if (s.challenge) {
      const c = CHALLENGE_BY_ID[s.challenge.id];
      const won = c.check(s, w, s.history.slice(-7));
      w.challenge = { id: c.id, won };
      if (won) { s.cash += c.reward; s.challengesWon = (s.challengesWon || 0) + 1; s.inbox.push({ kind: 'challenge', id: c.id }); }
    }
    checkBadges(s, 'week', w, prev);
    s.phase = 'week';
    return s.phase;
  }
  if (day % DAYS_PER_MONTH === 0 && !s.months.find((m) => m.month === day / DAYS_PER_MONTH)) {
    const month = day / DAYS_PER_MONTH;
    const m = {
      month, chapter: chapterFor(s, day), startCash: s.monthStartCash ?? s.startCash,
      quits: s.team.quits.filter((d) => d > day - DAYS_PER_MONTH).length,
      breakdowns: (s.maint.breakdowns || []).filter((d) => d > day - DAYS_PER_MONTH).length, controls: s.maint.controls, maintLevel: s.maint.level,
      ...summarize(s.history.slice(-DAYS_PER_MONTH)),
    };
    s.months.push(m);
    afterMonth(s, m);
    checkBadges(s, 'month', m);
    s.phase = 'board';
    return s.phase;
  }
  nextDay(s);
  return s.phase;
}

export function nextDay(s) {
  if (calendar(s.day).dayOfMonth === DAYS_PER_MONTH) s.monthStartCash = s.cash;
  const chBefore = chapterFor(s);
  s.day += 1;
  const ch = chapterFor(s);
  if (ch > chBefore) startChapter(s, ch);
  monthBeats(s);
  if (calendar(s.day).dow === 0 || !s.challenge) pickChallenge(s);
  startMorning(s);
}

// What changes in the hotel when a new chapter begins (the story screen is in ui/chapter.js).
export function startChapter(s, ch) {
  ensure(s);
  if (ch >= 6 && s.maint.condition == null) {
    s.maint.condition = 72;
    discover(s, 'techo', 'Tu hotel ya tiene meses de uso y está en 72 de 100. Las cosas se desgastan aunque no las veas.');
  }
  if (ch >= 7 && !s.comp.open) {
    s.comp.open = true;
    discover(s, 'diferencia', `GlobalStay abrió a dos cuadras: cobra ${money(Math.round(refEff(s, roomsOf(s)[0]) * 0.8 / 50) * 50)} por un cuarto estándar y todos conocen su marca.`);
  }
  if (ch >= 8 && !s.flags.rodrigo) {
    s.flags.rodrigo = true;
    discover(s, 'mismo_barco', 'Don Rodrigo entró al Consejo como inversionista. Ahora también le rindes cuentas a él.');
  }
  if (ch >= 9 && !s.flags.yearTwo) {
    s.flags.yearTwo = true;
    discover(s, 'metas', `Empieza el Año 2 y el Consejo te puso una meta con número y fecha: ${mandateFor(13).text(s)}`);
  }
}
