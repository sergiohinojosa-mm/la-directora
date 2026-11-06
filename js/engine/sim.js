// Hotel simulation: pure game rules, no DOM. One call to simulateDay() plays one day.

import { clamp, rng, calendar, DAYS_PER_MONTH, DAYS } from '../util.js';
import {
  LOCATIONS, LOAN_OPTIONS, ATTRIBUTES, monthlyPayment,
  HOUSEKEEPER_DAILY, ROOMS_PER_HOUSEKEEPER, TRAINING_DAYS,
} from '../data/world.js';

export const loc = (s) => LOCATIONS.find((l) => l.id === s.locationId);
export const attrs = (s) => ATTRIBUTES.filter((a) => s.attributes.includes(a.id));
export const totalRooms = (s) => loc(s).rooms.reduce((n, r) => n + r.count, 0);

const WEEKDAY = {
  playa: [0.62, 0.6, 0.66, 0.8, 1.35, 1.55, 0.85],
  centro: [0.9, 1.0, 1.0, 0.9, 1.15, 1.35, 0.55],
  carretera: [1.0, 1.05, 1.05, 1.0, 1.1, 0.9, 0.7],
};
const YEAR_DAYS = DAYS_PER_MONTH * 12;
const SEASON_PEAK = 100;

export function newGame({ locationId, loanPct, attributes, hotelName, seed, year = 1, lessons, diary }) {
  const L = LOCATIONS.find((l) => l.id === locationId);
  const loan = LOAN_OPTIONS.find((o) => o.pct === loanPct);
  const principal = Math.round(L.price * loanPct);
  const payment = monthlyPayment(principal);
  const s = {
    v: 1,
    seed: seed ?? Math.floor(Math.random() * 1e9),
    year,
    hotelName,
    locationId,
    loanPct,
    attributes: [...attributes],
    principal,
    payment,
    day: 1,
    phase: 'morning',
    cash: 0,
    reputation: 3.4,
    morale: 70,
    housekeepers: L.startHousekeepers,
    hiredEver: 0,
    overtime: false,
    prices: Object.fromEntries(L.rooms.map((r) => [r.id, r.ref])),
    dirty: Object.fromEntries(L.rooms.map((r) => [r.id, 0])),
    mods: [],
    contracts: [],
    promises: [],
    varCostMult: 1,
    ratingPenalty: 0,
    giftRooms: 0,
    history: [],
    weeks: [],
    months: [],
    confidence: 60,
    rescues: 0,
    lessons: lessons ? structuredClone(lessons) : {},
    inbox: [],
    diary: diary ? [...diary] : [],
    stars: {},
    eventsSeen: [],
    event: null,
    eventResult: null,
    flags: {},
    closed: false,
  };
  const monthlyCosts = L.fixedMonthly + attrMonthly(s) + payment + s.housekeepers * HOUSEKEEPER_DAILY * DAYS_PER_MONTH;
  s.cash = Math.round((loan.cashMonths * monthlyCosts) / 1000) * 1000;
  s.startCash = s.cash;
  return s;
}

export const attrMonthly = (s) => attrs(s).reduce((n, a) => n + a.monthly, 0);
export const attrPerNight = (s) => attrs(s).reduce((n, a) => n + a.perNight, 0);

// Extra demand from the value proposition, weighted by who visits this location.
export function attrDemandBonus(s) {
  const L = loc(s);
  let bonus = 0;
  for (const a of attrs(s)) for (const [seg, share] of Object.entries(L.mix)) bonus += share * a.appeal[seg];
  return bonus;
}

export function expectationPenalty(s) {
  const e = loc(s).expects;
  return e && !s.attributes.includes(e.attr) ? 0.2 : 0;
}

export function season(s, day) {
  const doy = (day - 1) % YEAR_DAYS;
  return 1 + loc(s).seasonAmp * Math.cos((2 * Math.PI * (doy - SEASON_PEAK)) / YEAR_DAYS);
}

const activeMods = (s, day, type) => s.mods.filter((m) => m.type === type && day >= m.from && day <= m.to);

export function demandMult(s, day) {
  return activeMods(s, day, 'demand').reduce((m, x) => m * x.mult, 1);
}

// People looking for each room type on `day` if the price were the reference price.
export function forecast(s, day) {
  const L = loc(s);
  const dow = calendar(day).dow;
  const base = L.baseOcc * season(s, day) * WEEKDAY[L.id][dow] * (0.8 + 0.06 * s.reputation)
    * (1 + attrDemandBonus(s)) * demandMult(s, day);
  const byType = Object.fromEntries(L.rooms.map((r) => [r.id, r.count * base]));
  const total = Object.values(byType).reduce((a, b) => a + b, 0);
  const labels = activeMods(s, day, 'demand').map((m) => m.label);
  return { day, byType, total, labels };
}

// Cornell (2012): one more review point lets a hotel charge ~11% more at the same occupancy.
export const refEff = (s, room) => room.ref * (0.626 + 0.11 * s.reputation);

export function priceFactor(s, room, price) {
  const r = price / refEff(s, room);
  return Math.min(1.9, 2 / (1 + Math.exp(loc(s).elasticity * (r - 1))));
}

export function cleaningCapacity(s, day = s.day) {
  const off = activeMods(s, day, 'hkOff').reduce((n, m) => n + m.n, 0);
  const mult = activeMods(s, day, 'cleanMult').reduce((m, x) => m * x.mult, 1);
  const eff = 0.75 + 0.35 * (s.morale / 100);
  // New hires clean at 60% while they learn.
  const trainees = (s.hires || []).filter((d) => day - d < TRAINING_DAYS).length;
  const people = Math.max(0, s.housekeepers - off - trainees * 0.4);
  return {
    nominal: people * ROOMS_PER_HOUSEKEEPER * mult,
    real: Math.floor(people * ROOMS_PER_HOUSEKEEPER * eff * mult * (s.overtime ? 1.4 : 1)),
  };
}

// Cleans the rooms left by last night's guests, most expensive rooms first.
function clean(s, capacity) {
  const L = loc(s);
  let left = capacity;
  const avail = {};
  let dirtyStart = 0;
  let cleaned = 0;
  for (const r of [...L.rooms].sort((a, b) => b.ref - a.ref)) {
    const d = s.dirty[r.id];
    dirtyStart += d;
    const c = Math.min(d, left);
    left -= c;
    cleaned += c;
    avail[r.id] = r.count - (d - c);
  }
  return { avail, dirtyStart, cleaned };
}

const contractsToday = (s, day, type) => s.contracts.filter((c) => c.type === type && day >= c.from && day <= c.to);

// What she can expect today with the current prices, before opening the day.
export function preview(s) {
  const L = loc(s);
  const cap = cleaningCapacity(s);
  const { avail, dirtyStart } = clean(s, cap.real);
  const fc = forecast(s, s.day);
  let sold = 0;
  let revenue = 0;
  let lostDirty = 0;
  const byType = {};
  for (const r of L.rooms) {
    const reserved = contractsToday(s, s.day, r.id).length + (r === L.rooms[0] ? s.giftRooms : 0);
    const want = fc.byType[r.id] * priceFactor(s, r, s.prices[r.id]);
    const free = Math.max(0, avail[r.id] - reserved);
    const n = Math.min(Math.round(want), free);
    lostDirty += Math.max(0, Math.min(Math.round(want), r.count - reserved) - free);
    byType[r.id] = { want, sold: n + reserved, free: avail[r.id] };
    sold += n + reserved;
    revenue += n * s.prices[r.id];
  }
  return { sold, rooms: totalRooms(s), revenue, lostDirty, dirtyStart, capacity: cap.real, byType, forecast: fc };
}

export function simulateDay(s) {
  const L = loc(s);
  const day = s.day;
  const cal = calendar(day);
  const cap = cleaningCapacity(s, day);
  const { avail, dirtyStart, cleaned } = clean(s, cap.real);
  const fc = forecast(s, day);
  const noise = 0.9 + rng(s) * 0.2;

  const sold = {};
  let soldTotal = 0;
  let revenue = 0;
  let lostDirty = 0;
  let lostPrice = 0;
  let wantedTotal = 0;
  let priceRatioWeighted = 0;
  let contractExtra = 0;
  let refRevenue = 0;
  for (const r of L.rooms) {
    const cs = contractsToday(s, day, r.id);
    const gift = r === L.rooms[0] ? Math.min(s.giftRooms, r.count) : 0;
    const reserved = Math.min(cs.length + gift, avail[r.id]);
    const potential = fc.byType[r.id] * noise;
    const wantF = potential * priceFactor(s, r, s.prices[r.id]);
    const want = Math.floor(wantF) + (rng(s) < wantF % 1 ? 1 : 0);
    const free = Math.max(0, avail[r.id] - reserved);
    const n = Math.min(want, free);
    lostDirty += Math.max(0, Math.min(want, r.count - reserved) - free);
    lostPrice += Math.max(0, Math.round(potential) - want);
    wantedTotal += want;
    sold[r.id] = n + reserved;
    soldTotal += n + reserved;
    revenue += n * s.prices[r.id];
    for (const c of cs.slice(0, Math.max(0, reserved - gift))) {
      revenue += s.prices[r.id] * c.priceMult;
      contractExtra += c.extraCost || 0;
    }
    priceRatioWeighted += sold[r.id] * (s.prices[r.id] / refEff(s, r));
    refRevenue += sold[r.id] * refEff(s, r);
  }
  const rooms = totalRooms(s);
  const priceRatio = soldTotal ? priceRatioWeighted / soldTotal : L.rooms.reduce((a, r) => a + s.prices[r.id] / refEff(s, r), 0) / L.rooms.length;

  // Costs
  const fixed = (L.fixedMonthly + attrMonthly(s)) / DAYS_PER_MONTH;
  const variable = soldTotal * (L.varPerNight * s.varCostMult + attrPerNight(s)) + contractExtra;
  const wages = s.housekeepers * HOUSEKEEPER_DAILY * (s.overtime ? 1.5 : 1);
  const extra = activeMods(s, day, 'dailyCost').reduce((n, m) => n + m.amount, 0);
  const loanPaid = cal.dayOfMonth === DAYS_PER_MONTH ? s.payment : 0;
  let promisesPaid = 0;
  for (const p of s.promises.filter((p) => p.due === day)) promisesPaid += p.cost;
  const costs = { fixed, variable, wages, extra, loan: loanPaid, promises: promisesPaid };
  const costTotal = Object.values(costs).reduce((a, b) => a + b, 0);
  const profit = revenue - costTotal;
  s.cash = Math.round(s.cash + profit);

  // Guest satisfaction and reputation
  const workload = cap.nominal ? dirtyStart / cap.nominal : dirtyStart ? 2 : 0;
  const rush = workload > 1 && !s.overtime ? -0.35 * Math.min(1, workload - 1) : 0;
  const ratingBonus = activeMods(s, day, 'ratingDay').reduce((n, m) => n + m.delta, 0);
  const value = clamp((1 - priceRatio) * 1.6, -0.9, 0.6);
  const dayRating = clamp(3.25 + attrs(s).reduce((n, a) => n + a.rating, 0) + value + rush
    + (s.morale - 60) / 120 + ratingBonus - expectationPenalty(s) - s.ratingPenalty, 1, 5);
  const goodReviews = soldTotal * 0.35;
  const badReviews = lostDirty * 0.5;
  const nReviews = goodReviews + badReviews;
  const repBefore = s.reputation;
  if (nReviews > 0) {
    const avgRating = (dayRating * goodReviews + 1 * badReviews) / nReviews;
    s.reputation = clamp(s.reputation + (avgRating - s.reputation) * Math.min(0.12, nReviews * 0.015), 1, 5);
  }

  // Team
  const moraleBefore = s.morale;
  if (workload > 1) s.morale -= 8 * (workload - 1) + 2;
  else if (workload < 0.5) s.morale += 0.5;
  if (s.overtime) s.morale -= 3;
  s.morale = clamp(s.morale + (70 - s.morale) * 0.03, 0, 100);

  // Tonight's guests leave dirty rooms for tomorrow.
  for (const r of L.rooms) s.dirty[r.id] = sold[r.id] + (r.count - avail[r.id]);

  const result = {
    day, dow: cal.dow, revenue, costs, costTotal, profit, cash: s.cash,
    sold, soldTotal, rooms, occupancy: soldTotal / rooms,
    adr: soldTotal ? revenue / soldTotal : 0,
    potential: fc.total * noise, wanted: wantedTotal, lostDirty, lostPrice,
    dirtyStart, cleaned, capacity: cap.real, workload, overtime: s.overtime,
    priceRatio, dayRating, reputation: s.reputation, repDelta: s.reputation - repBefore,
    morale: s.morale, moraleDelta: s.morale - moraleBefore,
    labels: fc.labels, loanPaid, promisesPaid, refRevenue,
    lowDemand: fc.total < rooms * 0.65,
    event: s.event ? s.event.id : null,
  };
  result.causes = explain(s, result);

  s.history.push(result);
  s.overtime = false;
  s.giftRooms = 0;
  s.promises = s.promises.filter((p) => p.due !== day);
  s.mods = s.mods.filter((m) => m.to > day);
  s.contracts = s.contracts.filter((c) => c.to > day);
  return result;
}

// Cause → effect chains for the evening report: what went well (good), what to improve (bad)
// and context she didn't control (neutral). Both wins and mistakes teach.
export function explain(s, r) {
  const chains = [];
  const empty = r.rooms - r.soldTotal;
  const extra = Math.round(r.revenue - r.refRevenue);
  const fmt = (v) => '$' + Math.abs(Math.round(v)).toLocaleString('es-MX');

  // Wins
  if (r.priceRatio >= 1.08 && r.occupancy >= 0.85) {
    chains.push({ tone: 'good', steps: [`Precio ${Math.round((r.priceRatio - 1) * 100)}% arriba en día de mucha demanda`, `${r.soldTotal} de ${r.rooms} vendidos`, `${fmt(extra)} más que con precio normal`] });
  }
  if (r.priceRatio <= 0.95 && r.lowDemand && r.occupancy >= 0.6) {
    chains.push({ tone: 'good', steps: ['Bajaste el precio en un día flojo', `${r.soldTotal} cuartos vendidos`, 'mejor que dejarlos vacíos'] });
  }
  if (r.overtime && r.lostDirty === 0 && r.dirtyStart > 0) {
    chains.push({ tone: 'good', steps: ['Pediste horas extra', 'todos los cuartos listos', 'nadie se quedó sin cuarto'] });
  }
  if (r.occupancy === 1 && r.lostDirty === 0) {
    chains.push({ tone: 'good', steps: ['Hotel lleno', 'limpieza a tiempo', `${r.soldTotal} huéspedes contentos`] });
  }

  // Mistakes
  if (r.lostDirty > 0) {
    chains.push({ tone: 'bad', steps: [`${r.dirtyStart - r.cleaned} cuartos sin limpiar`, `${r.lostDirty} huéspedes sin cuarto`, 'reseñas malas'] });
  }
  if (empty >= Math.max(2, r.rooms * 0.3) && r.priceRatio > 1.12) {
    chains.push({ tone: 'bad', steps: [`Precio ${Math.round((r.priceRatio - 1) * 100)}% arriba de lo normal`, 'menos reservas', `${empty} cuartos vacíos`] });
  } else if (r.priceRatio < 0.9 && r.wanted > r.rooms * 1.15) {
    chains.push({ tone: 'bad', steps: ['Precio bajo en un día con mucha demanda', 'el hotel se llenó igual', `dejaste de ganar unos ${fmt(r.refRevenue - r.revenue)}`] });
  }
  if (r.workload > 1 && !r.overtime) chains.push({ tone: 'bad', steps: ['Mucho trabajo de limpieza', 'equipo cansado', `ánimo ${Math.round(r.moraleDelta)}`] });

  // Context
  if (empty >= Math.max(2, r.rooms * 0.35) && r.lowDemand && r.priceRatio <= 1.12 && !chains.some((c) => c.steps[0].startsWith('Bajaste'))) {
    chains.push({ tone: 'neutral', steps: [`${DAYS[r.dow]} con poca demanda`, `${empty} cuartos vacíos`] });
  }
  if (r.overtime && !chains.some((c) => c.steps[0] === 'Pediste horas extra')) chains.push({ tone: 'neutral', steps: ['Horas extra', 'más cuartos limpios', 'pero más gasto y cansancio'] });
  for (const label of r.labels) chains.push({ tone: 'neutral', steps: [label, 'cambió la demanda'] });
  if (r.loanPaid) chains.push({ tone: 'neutral', steps: ['Día de pago al banco', `−${fmt(r.loanPaid)}`] });
  if (!chains.length) chains.push({ tone: 'neutral', steps: ['Día tranquilo', `${r.soldTotal} de ${r.rooms} cuartos vendidos`] });
  return chains.slice(0, 4);
}

export function summarize(list) {
  const n = list.length || 1;
  const sum = (f) => list.reduce((a, r) => a + f(r), 0);
  const soldTotal = sum((r) => r.soldTotal);
  const revenue = sum((r) => r.revenue);
  return {
    days: list.length,
    revenue,
    costTotal: sum((r) => r.costTotal),
    profit: sum((r) => r.profit),
    occupancy: soldTotal / sum((r) => r.rooms),
    adr: soldTotal ? revenue / soldTotal : 0,
    lostDirty: sum((r) => r.lostDirty),
    emptyNights: sum((r) => r.rooms - r.soldTotal),
    reputation: list.length ? list[list.length - 1].reputation : 0,
    repStart: list.length ? list[0].reputation - list[0].repDelta : 0,
    morale: list.length ? list[list.length - 1].morale : 0,
    cash: list.length ? list[list.length - 1].cash : 0,
    costs: ['fixed', 'variable', 'wages', 'extra', 'loan', 'promises'].reduce((o, k) => ({ ...o, [k]: sum((r) => r.costs[k]) }), {}),
    avgRating: sum((r) => r.dayRating) / n,
  };
}

export function hire(s) {
  s.housekeepers += 1;
  s.hires = [...(s.hires || []), s.day];
  s.hiredEver += 1;
}

export function fire(s) {
  if (s.housekeepers <= 1) return false;
  s.housekeepers -= 1;
  s.morale = clamp(s.morale - 10, 0, 100);
  return true;
}

export const weekCost = (s) => {
  const L = loc(s);
  return ((L.fixedMonthly + attrMonthly(s) + s.payment) / DAYS_PER_MONTH + s.housekeepers * HOUSEKEEPER_DAILY) * 7;
};
