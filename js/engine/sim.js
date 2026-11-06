// Hotel simulation: pure game rules, no DOM. One call to simulateDay() plays one day.

import { clamp, rng, calendar, DAYS_PER_MONTH, DAYS } from '../util.js';
import {
  LOCATIONS, LOAN_OPTIONS, ATTRIBUTES, monthlyPayment,
  HOUSEKEEPER_DAILY, ROOMS_PER_HOUSEKEEPER, TRAINING_DAYS,
} from '../data/world.js';
import { chapterFor } from '../data/chapters.js';
import {
  ensure, roomsOf, avgRef, marketing, marketingCost, channels, cancelPolicy, POWER, MENUS,
  restaurantDay, crossSellDay, maintCost, maintainDay, leakDay, compSteal, overbookOn, chainPrice,
  wageInfo, ISH, ISR, SOCIO_SHARE, terraceDay, managerCost, recruitCost, restaurantStaff, extraStaff, idleWages,
} from './systems.js';

export const loc = (s) => LOCATIONS.find((l) => l.id === s.locationId);
export const attrs = (s) => ATTRIBUTES.filter((a) => s.attributes.includes(a.id));
export const totalRooms = (s) => roomsOf(s).reduce((n, r) => n + r.count, 0);
export { roomsOf };

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
  ensure(s);
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

// What the business areas add or take away from demand: marketing, cancellation policy,
// the restaurant, the competitor and her unique experience.
export function systemsDemand(s, day) {
  let m = marketing(s, day).mult;
  const cp = cancelPolicy(s, day);
  if (cp) m *= cp.demand;
  m *= 1 - compSteal(s, day);
  if (chapterFor(s, day) >= 5 && s.rest.open) m *= 1 + MENUS[s.rest.menu].demand;
  if (s.comp.unique) m *= 1.03;
  return m;
}

// People looking for each room type on `day` if the price were the reference price.
export function forecast(s, day) {
  const L = loc(s);
  const dow = calendar(day).dow;
  const base = L.baseOcc * season(s, day) * WEEKDAY[L.id][dow] * (0.8 + 0.06 * s.reputation)
    * (1 + attrDemandBonus(s)) * demandMult(s, day) * systemsDemand(s, day);
  const byType = Object.fromEntries(roomsOf(s).map((r) => [r.id, r.count * base]));
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
  const eff = (0.75 + 0.35 * (s.morale / 100)) * (1 + 0.06 * (s.team?.skill || 0));
  // New hires clean at 60% while they learn.
  const trainees = (s.hires || []).filter((d) => day - d < TRAINING_DAYS).length;
  const people = Math.max(0, s.housekeepers - off - trainees * 0.4);
  // Late check-outs from last night leave less time to clean.
  const late = day === s.day ? (s.lateYesterday || 0) * 0.5 : 0;
  return {
    nominal: Math.max(0, people * ROOMS_PER_HOUSEKEEPER * mult - late),
    real: Math.max(0, Math.floor(people * ROOMS_PER_HOUSEKEEPER * eff * mult * (s.overtime ? 1.4 : 1) - late)),
  };
}

// Cleans the rooms left by last night's guests, most expensive rooms first.
function clean(s, capacity, day = s.day) {
  let left = capacity;
  const avail = {};
  let dirtyStart = 0;
  let cleaned = 0;
  const out = roomsOutOf(s, day);
  for (const r of [...roomsOf(s)].sort((a, b) => b.ref - a.ref)) {
    const d = s.dirty[r.id] || 0;
    dirtyStart += d;
    const c = Math.min(d, left);
    left -= c;
    cleaned += c;
    avail[r.id] = r.count - (d - c);
  }
  const std = roomsOf(s)[0].id;
  avail[std] = Math.max(0, avail[std] - out);
  return { avail, dirtyStart, cleaned };
}

// Rooms closed for repairs (breakdowns in chapter 6).
export const roomsOutOf = (s, day = s.day) => activeMods(s, day, 'roomsOut').reduce((n, m) => n + m.n, 0);

const contractsToday = (s, day, type) => s.contracts.filter((c) => c.type === type && day >= c.from && day <= c.to);

// What she can expect today with the current prices, before opening the day.
export function preview(s) {
  const L = { rooms: roomsOf(s) };
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
    lostDirty += Math.max(0, Math.min(Math.round(want), r.count - reserved - (r === L.rooms[0] ? roomsOutOf(s) : 0)) - free);
    byType[r.id] = { want, sold: n + reserved, free: avail[r.id] };
    sold += n + reserved;
    revenue += n * s.prices[r.id];
  }
  return { sold, rooms: totalRooms(s), revenue, lostDirty, dirtyStart, capacity: cap.real, byType, forecast: fc };
}

export function simulateDay(s) {
  ensure(s);
  const rooms_ = roomsOf(s);
  const L = loc(s);
  const day = s.day;
  const ch = chapterFor(s, day);
  const cal = calendar(day);
  const cap = cleaningCapacity(s, day);
  const { avail, dirtyStart, cleaned } = clean(s, cap.real, day);
  const fc = forecast(s, day);
  const noise = 0.9 + rng(s) * 0.2;
  const cp = cancelPolicy(s, day);
  const overbook = overbookOn(s, day);
  const out = roomsOutOf(s, day);

  const sold = {};
  let soldTotal = 0;
  let roomRevenue = 0;
  let lostDirty = 0;
  let lostPrice = 0;
  let wantedTotal = 0;
  let priceRatioWeighted = 0;
  let contractExtra = 0;
  let refRevenue = 0;
  let cancels = 0;
  let cancelCharged = 0;
  let walked = 0;
  let walkCost = 0;
  let guessSold = 0;
  for (const r of rooms_) {
    const isStd = r === rooms_[0];
    const cs = contractsToday(s, day, r.id);
    const gift = isStd ? Math.min(s.giftRooms, r.count) : 0;
    const reserved = Math.min(cs.length + gift, avail[r.id]);
    const potential = fc.byType[r.id] * noise;
    const wantF = potential * priceFactor(s, r, s.prices[r.id]);
    const want = Math.floor(wantF) + (rng(s) < wantF % 1 ? 1 : 0);
    guessSold += Math.min(r.count, fc.byType[r.id] * priceFactor(s, r, s.prices[r.id]));
    const free = Math.max(0, avail[r.id] - reserved);
    // Bookings: up to the free rooms (plus the overbooked ones). Some cancel late; if everyone shows up
    // and there were more bookings than rooms, the extra guests are "walked" to another hotel.
    let booked = Math.min(want, free + (isStd ? overbook : 0));
    let cancelled = 0;
    if (cp) for (let i = 0; i < booked; i++) if (rng(s) < cp.rate) cancelled++;
    let stay = booked - cancelled;
    const walk = Math.max(0, stay - free);
    stay -= walk;
    const n = stay;
    cancels += cancelled;
    cancelCharged += cancelled * s.prices[r.id] * (cp ? cp.charge : 0);
    walked += walk;
    walkCost += walk * s.prices[r.id] * 1.5;
    lostDirty += Math.max(0, Math.min(want, r.count - reserved - (isStd ? out : 0)) - free);
    lostPrice += Math.max(0, Math.round(potential) - want);
    wantedTotal += want;
    sold[r.id] = n + reserved;
    soldTotal += n + reserved;
    roomRevenue += n * s.prices[r.id];
    for (const c of cs.slice(0, Math.max(0, reserved - gift))) {
      roomRevenue += s.prices[r.id] * c.priceMult;
      contractExtra += c.extraCost || 0;
    }
    priceRatioWeighted += sold[r.id] * (s.prices[r.id] / refEff(s, r));
    refRevenue += sold[r.id] * refEff(s, r);
  }
  roomRevenue += cancelCharged;
  const rooms = totalRooms(s);
  const priceRatio = soldTotal ? priceRatioWeighted / soldTotal : rooms_.reduce((a, r) => a + s.prices[r.id] / refEff(s, r), 0) / rooms_.length;

  // Extras: restaurant, cross-sell, terrace.
  const rest = restaurantDay(s, day, soldTotal, Math.min(rooms, guessSold));
  const cross = crossSellDay(s, day, sold);
  const terrace = terraceDay(s, soldTotal);
  const extras = { rest: rest ? rest.revenue : 0, cross: cross ? cross.revenue : 0, terrace: terrace ? terrace.revenue : 0 };
  const revenue = roomRevenue + extras.rest + extras.cross + extras.terrace;

  // Channels (chapter 3)
  const chans = ch >= 3 ? channels(s, day, soldTotal, roomRevenue) : null;

  // Guest satisfaction (before complaints)
  const workload = cap.nominal ? dirtyStart / cap.nominal : dirtyStart ? 2 : 0;
  const rush = workload > 1 && !s.overtime ? -0.35 * Math.min(1, workload - 1) : 0;
  const ratingBonus = activeMods(s, day, 'ratingDay').reduce((n, m) => n + m.delta, 0);
  const value = clamp((1 - priceRatio) * 1.6, -0.9, 0.6);
  const cond = ch >= 6 && s.maint.condition != null ? s.maint.condition : 100;
  const systemsRating = 0.04 * (s.team.skill || 0)
    + (rest ? MENUS[s.rest.menu].rating - (rest.turnedAway > 0 ? 0.1 : 0) : 0)
    + (s.comp.unique ? 0.1 : 0)
    - (cond < 60 ? (60 - cond) / 100 : 0)
    - (cross?.tooMany ? 0.06 : 0)
    + (terrace ? 0.08 : 0)
    - (cp && s.policy.cancel === 'estricta' ? 0.03 : 0);
  const dayRating = clamp(3.25 + attrs(s).reduce((n, a) => n + a.rating, 0) + value + rush
    + (s.morale - 60) / 120 + ratingBonus - expectationPenalty(s) - s.ratingPenalty + systemsRating, 1, 5);

  // Complaints (chapter 4): reception resolves them on the spot if she gave it the power to.
  let complaints = 0;
  let resolved = 0;
  if (ch >= 4) {
    const x = soldTotal * (0.04 + 0.15 * Math.max(0, workload - 1) + Math.max(0, 3.6 - dayRating) * 0.06)
      + (s.policy.cancel === 'estricta' ? cancels : 0);
    complaints = Math.floor(x) + (rng(s) < x % 1 ? 1 : 0);
    resolved = Math.round(complaints * POWER[s.policy.power].resolve);
  }
  const serviceCost = resolved * avgRef(s) * POWER[s.policy.power].cost;

  // Costs
  const fixed = (L.fixedMonthly + attrMonthly(s)) / DAYS_PER_MONTH;
  const variable = soldTotal * (L.varPerNight * s.varCostMult + attrPerNight(s)) + contractExtra;
  const wage = ch >= 2 ? wageInfo(s).v : 1;
  const wages = s.housekeepers * HOUSEKEEPER_DAILY * wage * (s.overtime ? 1.5 : 1) + (s.manager ? managerCost(s) : 0);
  const extra = activeMods(s, day, 'dailyCost').reduce((n, m) => n + m.amount, 0) + walkCost;
  const loanPaid = cal.dayOfMonth === DAYS_PER_MONTH ? s.payment : 0;
  let promisesPaid = 0;
  for (const p of s.promises.filter((p) => p.due === day)) promisesPaid += p.cost;
  const costs = {
    fixed, variable, wages, extra, loan: loanPaid, promises: promisesPaid,
    marketing: marketingCost(s, day),
    commission: chans ? chans.commission + chans.club : 0,
    service: serviceCost,
    restaurant: (rest ? rest.food + rest.staff : 0) + (cross ? cross.cost : 0) + (terrace ? terrace.cost : 0),
    maint: maintCost(s, day),
    tax: ch >= 6 ? roomRevenue * ISH : 0,
    isr: 0,
    socio: 0,
  };
  // Monthly income tax and the partner's share, paid at month close on the month's profit.
  if (cal.dayOfMonth === DAYS_PER_MONTH && (ch >= 6 || s.plan.socio)) {
    const monthStart = day - DAYS_PER_MONTH + 1;
    const before = s.history.filter((x) => x.day >= monthStart).reduce((a, x) => a + x.profit, 0);
    const today = revenue - Object.values(costs).reduce((a, b) => a + b, 0);
    const pre = before + today;
    if (ch >= 6) costs.isr = Math.max(0, pre) * ISR;
    if (s.plan.socio) costs.socio = Math.max(0, pre - costs.isr) * SOCIO_SHARE;
  }
  const costTotal = Object.values(costs).reduce((a, b) => a + b, 0);
  const profit = revenue - costTotal;
  const leak = leakDay(s, day, roomRevenue);
  s.cash = Math.round(s.cash + profit - leak);
  if (leak) s.maint.leak += leak;

  // Reputation
  const goodReviews = soldTotal * 0.35 + resolved * 0.3;
  const unresolved = complaints - resolved;
  const badReviews = lostDirty * 0.5 + unresolved * 0.5 + walked;
  const nReviews = goodReviews + badReviews;
  const repBefore = s.reputation;
  if (nReviews > 0) {
    const avgRating = (dayRating * soldTotal * 0.35 + 4.5 * resolved * 0.3 + 1 * (lostDirty * 0.5 + walked) + 1.5 * unresolved * 0.5) / nReviews;
    s.reputation = clamp(s.reputation + (avgRating - s.reputation) * Math.min(0.12, nReviews * 0.015), 1, 5);
  }

  // Team
  const moraleBefore = s.morale;
  if (workload > 1) s.morale -= 8 * (workload - 1) + 2;
  else if (workload < 0.5) s.morale += 0.5;
  if (s.overtime) s.morale -= 3;
  const target = ch >= 2 ? wageInfo(s).morale : 70;
  s.morale = clamp(s.morale + (target - s.morale) * 0.03, 0, 100);

  if (ch >= 6) maintainDay(s, soldTotal / rooms);

  // Tonight's guests leave dirty rooms for tomorrow.
  for (const r of rooms_) s.dirty[r.id] = sold[r.id] + (r.count - avail[r.id]) - (r === rooms_[0] ? out : 0);
  s.dirty[rooms_[0].id] = Math.max(0, s.dirty[rooms_[0].id]);

  const result = {
    day, dow: cal.dow, chapter: ch, revenue, roomRevenue, extras, costs, costTotal, profit, cash: s.cash,
    sold, soldTotal, rooms, occupancy: soldTotal / rooms,
    adr: soldTotal ? roomRevenue / soldTotal : 0, revpar: roomRevenue / rooms,
    potential: fc.total * noise, wanted: wantedTotal, lostDirty, lostPrice,
    dirtyStart, cleaned, capacity: cap.real, workload, overtime: s.overtime,
    priceRatio, dayRating, reputation: s.reputation, repDelta: s.reputation - repBefore,
    morale: s.morale, moraleDelta: s.morale - moraleBefore,
    labels: fc.labels, loanPaid, promisesPaid, refRevenue,
    lowDemand: fc.total < rooms * 0.65, forecastTotal: fc.total,
    event: s.event ? s.event.id : null,
    channels: chans ? { bookings: chans.bookings, cost: chans.cost } : null,
    ota: ch >= 3 && s.mkt.ota,
    complaints, resolved, cancels, walked, leak,
    extraStaff: extraStaff(s), idleWages: idleWages(s), housekeepers: s.housekeepers,
    rest: rest ? { diners: rest.diners, served: rest.served, turnedAway: rest.turnedAway, revenue: rest.revenue, food: rest.food, waste: rest.waste, staff: rest.staff } : null,
    cross: cross ? { takers: cross.takers, revenue: cross.revenue, tooMany: cross.tooMany } : null,
    roomsOut: out, condition: ch >= 6 ? s.maint.condition : null,
    chainPrice: ch >= 7 && s.comp.open ? chainPrice(s, day) : null, steal: compSteal(s, day),
  };
  result.causes = explain(s, result);

  s.history.push(result);
  s.lateYesterday = cross ? cross.late : 0;
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
  const extra = Math.round(r.roomRevenue - r.refRevenue);
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
  if (r.cross && r.cross.revenue > 0 && !r.cross.tooMany) {
    const n = Object.values(r.cross.takers).reduce((a, b) => a + b, 0);
    chains.push({ tone: 'good', steps: ['Ofreciste extras a tus huéspedes', `${n} compraron algo más`, `+${fmt(r.cross.revenue)} sin traer a nadie nuevo`] });
  }
  if (r.resolved > 0) chains.push({ tone: 'good', steps: [`Recepción resolvió ${r.resolved} ${r.resolved === 1 ? 'queja' : 'quejas'} en el momento`, 'huéspedes calmados', 'mejores reseñas'] });
  if (r.rest && r.rest.revenue - r.rest.food - r.rest.staff > 0 && r.rest.turnedAway === 0) {
    chains.push({ tone: 'good', steps: [`Restaurante: ${r.rest.served} comensales`, `ventas ${fmt(r.rest.revenue)}`, `le quedaron ${fmt(r.rest.revenue - r.rest.food - r.rest.staff)}`] });
  }
  if (r.ota && r.occupancy < 1 && r.channels) {
    chains.push({ tone: 'good', steps: ['Agencias en línea activas', `${Math.round(r.channels.bookings.agencia)} reservas por agencia`, `comisión ${fmt(r.channels.cost.agencia)}`] });
  }

  // Mistakes
  if (r.lostDirty > 0) {
    chains.push({ tone: 'bad', steps: [`${r.dirtyStart - r.cleaned} cuartos sin limpiar`, `${r.lostDirty} huéspedes sin cuarto`, 'reseñas malas'] });
  }
  if (r.walked > 0) {
    chains.push({ tone: 'bad', steps: ['Sobreventa y llegaron todos', `${r.walked} ${r.walked === 1 ? 'huésped' : 'huéspedes'} sin cuarto`, 'pagaste otro hotel y una reseña mala'] });
  }
  if (empty >= Math.max(2, r.rooms * 0.3) && r.priceRatio > 1.12) {
    chains.push({ tone: 'bad', steps: [`Precio ${Math.round((r.priceRatio - 1) * 100)}% arriba de lo normal`, 'menos reservas', `${empty} cuartos vacíos`] });
  } else if (r.priceRatio < 0.9 && r.wanted > r.rooms * 1.15) {
    chains.push({ tone: 'bad', steps: ['Precio bajo en un día con mucha demanda', 'el hotel se llenó igual', `dejaste de ganar unos ${fmt(r.refRevenue - r.roomRevenue)}`] });
  } else if (r.priceRatio < 1.05 && r.wanted >= r.rooms * 1.25 && r.occupancy === 1) {
    chains.push({ tone: 'bad', steps: [`${r.wanted - r.rooms} personas más querían cuarto`, 'te llenaste con precio normal', 'pudiste cobrar más'] });
  }
  if (r.ota && r.occupancy === 1 && r.channels && r.channels.cost.agencia > 0) {
    chains.push({ tone: 'bad', steps: ['Día lleno con agencias activas', 'te ibas a llenar de todos modos', `pagaste ${fmt(r.channels.cost.agencia)} de comisión`] });
  }
  if (r.complaints - r.resolved > 0) chains.push({ tone: 'bad', steps: [`${r.complaints - r.resolved} ${r.complaints - r.resolved === 1 ? 'queja' : 'quejas'} sin resolver`, 'recepción no podía hacer nada', 'malas reseñas'] });
  if (r.rest && r.rest.turnedAway > 0) chains.push({ tone: 'bad', steps: ['Compraste poca comida', 'se acabó', `${r.rest.turnedAway} comensales se fueron`] });
  else if (r.rest && r.rest.waste > r.rest.food * 0.15) chains.push({ tone: 'bad', steps: ['Compraste comida de más', 'sobró', `se tiraron ${fmt(r.rest.waste)}`] });
  if (r.cross?.tooMany) chains.push({ tone: 'bad', steps: ['Demasiadas ofertas a la vez', 'los huéspedes se fastidian', 'compran menos y califican peor'] });
  if (r.workload > 1 && !r.overtime) chains.push({ tone: 'bad', steps: ['Mucho trabajo de limpieza', 'equipo cansado', `ánimo ${Math.round(r.moraleDelta)}`] });
  if (r.extraStaff > 0) chains.push({ tone: 'bad', steps: [`Equipo de más: ${r.housekeepers} recamaristas para ${r.rooms} cuartos`, `${r.extraStaff === 1 ? 'una no se necesitaba' : `${r.extraStaff} no se necesitaban`}`, `pagaste ${fmt(r.idleWages)} de sueldos de más`] });

  // Context
  if (empty >= Math.max(2, r.rooms * 0.35) && r.lowDemand && r.priceRatio <= 1.12 && !chains.some((c) => c.steps[0].startsWith('Bajaste'))) {
    chains.push({ tone: 'neutral', steps: [`${DAYS[r.dow]} con poca demanda`, `${empty} cuartos vacíos`] });
  }
  if (r.roomsOut) chains.push({ tone: 'neutral', steps: ['Reparación en curso', `${r.roomsOut} ${r.roomsOut === 1 ? 'cuarto' : 'cuartos'} fuera de servicio`] });
  if (r.cancels) chains.push({ tone: 'neutral', steps: [`${r.cancels} ${r.cancels === 1 ? 'cancelación' : 'cancelaciones'} de último momento`, 'cuartos vacíos', s.policy.cancel === 'flexible' ? 'no pagaron nada' : s.policy.cancel === 'moderada' ? 'pagaron la mitad' : 'pagaron todo'] });
  if (r.chainPrice) chains.push({ tone: 'neutral', steps: [`GlobalStay cobró ${fmt(r.chainPrice)}`, `se llevó ~${Math.round(r.steal * 100)}% de tus clientes`] });
  if (r.overtime && !chains.some((c) => c.steps[0] === 'Pediste horas extra')) chains.push({ tone: 'neutral', steps: ['Horas extra', 'más cuartos limpios', 'pero más gasto y cansancio'] });
  for (const label of r.labels) chains.push({ tone: 'neutral', steps: [label, 'cambió la demanda'] });
  if (r.loanPaid) chains.push({ tone: 'neutral', steps: ['Día de pago al banco', `−${fmt(r.loanPaid)}`] });
  if (r.costs.isr) chains.push({ tone: 'neutral', steps: ['Impuesto del mes (30% de la ganancia)', `−${fmt(r.costs.isr)}`] });
  if (r.costs.socio) chains.push({ tone: 'neutral', steps: ['Parte de Don Rodrigo (20%)', `−${fmt(r.costs.socio)}`] });
  if (!chains.length) chains.push({ tone: 'neutral', steps: ['Día tranquilo', `${r.soldTotal} de ${r.rooms} cuartos vendidos`] });
  // Keep the report short: at most two of each tone.
  const pick = [];
  for (const tone of ['good', 'bad', 'neutral']) pick.push(...chains.filter((c) => c.tone === tone).slice(0, tone === 'neutral' ? 2 : 3));
  return pick.slice(0, 6);
}

const COST_KEYS = ['fixed', 'variable', 'wages', 'extra', 'loan', 'promises', 'marketing', 'commission', 'service', 'restaurant', 'maint', 'tax', 'isr', 'socio'];
const CHANNELS = ['directo', 'agencia', 'redes', 'alianzas', 'club'];

export function summarize(list) {
  const n = list.length || 1;
  const sum = (f) => list.reduce((a, r) => a + (f(r) || 0), 0);
  const soldTotal = sum((r) => r.soldTotal);
  const revenue = sum((r) => r.revenue);
  const roomRevenue = sum((r) => r.roomRevenue ?? r.revenue);
  const rooms = sum((r) => r.rooms);
  const last = list[list.length - 1];
  return {
    days: list.length,
    revenue,
    roomRevenue,
    extrasRevenue: revenue - roomRevenue,
    costTotal: sum((r) => r.costTotal),
    profit: sum((r) => r.profit),
    soldTotal,
    occupancy: soldTotal / (rooms || 1),
    adr: soldTotal ? roomRevenue / soldTotal : 0,
    revpar: roomRevenue / (rooms || 1),
    priceRatio: soldTotal ? sum((r) => r.priceRatio * r.soldTotal) / soldTotal : 1,
    lostDirty: sum((r) => r.lostDirty),
    emptyNights: sum((r) => r.rooms - r.soldTotal),
    reputation: list.length ? last.reputation : 0,
    repStart: list.length ? list[0].reputation - list[0].repDelta : 0,
    morale: list.length ? last.morale : 0,
    cash: list.length ? last.cash : 0,
    costs: COST_KEYS.reduce((o, k) => ({ ...o, [k]: sum((r) => r.costs[k]) }), {}),
    avgRating: sum((r) => r.dayRating) / n,
    complaints: sum((r) => r.complaints),
    unresolved: sum((r) => r.complaints - r.resolved),
    walked: sum((r) => r.walked),
    idleWages: sum((r) => r.idleWages),
    cancels: sum((r) => r.cancels),
    leak: sum((r) => r.leak),
    condition: list.length ? last.condition : null,
    restRevenue: sum((r) => r.rest?.revenue),
    restFood: sum((r) => r.rest?.food),
    restWaste: sum((r) => r.rest?.waste),
    restStaff: sum((r) => r.rest?.staff),
    crossRevenue: sum((r) => r.cross?.revenue),
    bookings: CHANNELS.reduce((o, c) => ({ ...o, [c]: sum((r) => r.channels?.bookings[c]) }), {}),
    chanCost: CHANNELS.reduce((o, c) => ({ ...o, [c]: sum((r) => r.channels?.cost[c]) }), {}),
  };
}

export function hire(s) {
  s.cash -= recruitCost(s);
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
  return ((L.fixedMonthly + attrMonthly(s) + s.payment) / DAYS_PER_MONTH + s.housekeepers * HOUSEKEEPER_DAILY
    + (s.rest?.open ? restaurantStaff(s) : 0) + maintCost(s) + marketingCost(s, s.day)) * 7;
};
