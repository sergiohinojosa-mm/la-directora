// The business areas that open chapter by chapter: team (ch2), sales channels (ch3), service (ch4),
// restaurant and cross-sell (ch5), maintenance, taxes and controls (ch6), competition (ch7),
// the big bet (ch8) and the manager (Año 2). Pure rules, no DOM; sim.js calls these each day.
// Money amounts scale with the hotel's size (potRev: one full night at normal prices).

import { clamp, rng, calendar, DAYS_PER_MONTH } from '../util.js';
import { LOCATIONS, ATTRIBUTES } from '../data/world.js';
import { chapterFor, hotelMonth } from '../data/chapters.js';

const L = (s) => LOCATIONS.find((l) => l.id === s.locationId);

// Rooms with the big-bet extension added to the standard type.
export function roomsOf(s) {
  return L(s).rooms.map((r, i) => (i === 0 && s.extraRooms ? { ...r, count: r.count + s.extraRooms } : r));
}
export const potRev = (s) => roomsOf(s).reduce((n, r) => n + r.count * r.ref, 0);
export const avgRef = (s) => potRev(s) / roomsOf(s).reduce((n, r) => n + r.count, 0);
const k = (s, frac) => Math.round((potRev(s) * frac) / 10) * 10;

// Older saves get the new areas with defaults.
export function ensure(s) {
  s.team ??= { wage: 1, skill: 0, lastTrain: -99, quits: [] };
  s.mkt ??= { ota: false, social: 0, alliance: false, club: false };
  s.policy ??= { cancel: 'moderada', power: 0, set: false };
  s.rest ??= { open: false, menu: 1, buy: 1 };
  s.offers ??= { tours: false, late: false, upgrade: false, breakfast: false };
  s.maint ??= { level: 0, condition: null, insurance: false, controls: false, leak: 0, leakFound: 0 };
  s.comp ??= { open: false, unique: null, auto: { on: false, up: 0.15, down: 0.1 }, overbook: 0 };
  s.plan ??= { project: null, funding: null, status: null, negotiated: false };
  s.manager ??= false;
  s.extraRooms ??= 0;
  s.chapterShown ??= 1;
  s.lateYesterday ??= 0;
  s.flags ??= {};
  return s;
}

// ---------------- Chapter 2 · Team ----------------
export const WAGES = [
  { v: 0.9, name: 'Abajo del mercado', morale: 60, quit: 1.6 },
  { v: 1, name: 'Justo', morale: 70, quit: 1 },
  { v: 1.15, name: 'Arriba del mercado', morale: 80, quit: 0.45 },
];
export const wageInfo = (s) => WAGES.find((w) => w.v === s.team.wage) || WAGES[1];
export const STAFF_NAMES = ['Doña Chela', 'Rosa', 'Lupita', 'Toño', 'Mari', 'Beto', 'Juana', 'Paco', 'Lalo', 'Carmen'];
export const recruitCost = (s) => (chapterFor(s) >= 2 ? 2500 : 0);
export const trainCost = (s) => 1500 * s.housekeepers;
export const MAX_SKILL = 3;

// Housekeepers beyond what a full hotel needs (with a small cushion): paid but idle.
export function extraStaff(s) {
  const rooms = roomsOf(s).reduce((n, r) => n + r.count, 0);
  const need = Math.max(1, Math.ceil((rooms * 1.1) / 12));
  return Math.max(0, s.housekeepers - need);
}
export const idleWages = (s) => extraStaff(s) * 480 * (chapterFor(s) >= 2 ? s.team.wage : 1);
export const canTrain = (s) => s.team.skill < MAX_SKILL && s.day - s.team.lastTrain >= 7;

// Daily chance that one person quits: tired or underpaid teams lose people.
export function quitChance(s) {
  if (chapterFor(s) < 2) return 0;
  const tired = Math.max(0, (58 - s.morale) / 58);
  return s.housekeepers * (0.0015 + tired * 0.035) * wageInfo(s).quit;
}

// ---------------- Chapter 3 · Sales channels ----------------
export const SOCIAL = [
  { name: 'Nada', cost: 0, boost: 0 },
  { name: 'Poco', cost: 0.012, boost: 0.06 },
  { name: 'Mucho', cost: 0.03, boost: 0.1 },
];
export const OTA_FEE = 0.18;
export const OTA_BOOST = 0.15;
export const ALLIANCE = { cost: 0.025, boost: 0.15 };
export const CLUB = { boost: 0.04, discount: 0.05, members: 0.3 };

export function marketing(s, day) {
  const parts = { ota: 0, social: 0, alliance: 0, club: 0 };
  if (chapterFor(s, day) < 3) return { mult: 1, parts, migrate: 0 };
  const m = s.mkt;
  if (m.ota) parts.ota = OTA_BOOST;
  parts.social = SOCIAL[m.social].boost;
  if (m.alliance && calendar(day).dow <= 3) parts.alliance = ALLIANCE.boost;
  if (m.club) parts.club = CLUB.boost;
  // Guests who would have found you anyway start booking through the agency (and pay its fee).
  const migrate = m.ota ? (m.club ? 0.12 : 0.3) : 0;
  return { mult: 1 + Object.values(parts).reduce((a, b) => a + b, 0), parts, migrate };
}

export function marketingCost(s, day) {
  if (chapterFor(s, day) < 3) return 0;
  return k(s, SOCIAL[s.mkt.social].cost) + (s.mkt.alliance ? k(s, ALLIANCE.cost) : 0);
}

// Who booked through which channel today, and what each channel cost.
export function channels(s, day, sold, roomRevenue) {
  const mk = marketing(s, day);
  const base = 1 / mk.mult;
  const share = {
    directo: base * (1 - mk.migrate),
    agencia: mk.parts.ota / mk.mult + base * mk.migrate,
    redes: mk.parts.social / mk.mult,
    alianzas: mk.parts.alliance / mk.mult,
    club: mk.parts.club / mk.mult,
  };
  const bookings = Object.fromEntries(Object.entries(share).map(([c, v]) => [c, sold * v]));
  const avgPrice = sold ? roomRevenue / sold : 0;
  const commission = bookings.agencia * avgPrice * OTA_FEE;
  const club = s.mkt.club && chapterFor(s, day) >= 3 ? roomRevenue * CLUB.discount * CLUB.members : 0;
  const cost = {
    directo: 0,
    agencia: commission,
    redes: k(s, SOCIAL[s.mkt.social].cost) * (chapterFor(s, day) >= 3 ? 1 : 0),
    alianzas: s.mkt.alliance && chapterFor(s, day) >= 3 ? k(s, ALLIANCE.cost) : 0,
    club,
  };
  return { bookings, cost, commission, club };
}

// ---------------- Chapter 4 · Service ----------------
export const CANCEL = {
  flexible: { name: 'Flexible', demand: 1.05, rate: 0.09, charge: 0, note: 'Cancelan gratis hasta el último día. Atrae más reservas.' },
  moderada: { name: 'Moderada', demand: 1, rate: 0.06, charge: 0.5, note: 'Si cancelan tarde, pagan la mitad.' },
  estricta: { name: 'Estricta', demand: 0.94, rate: 0.035, charge: 1, note: 'Si cancelan, pagan todo. Algunos clientes se enojan.' },
};
export const POWER = [
  { name: 'Nada: me lo consultan', resolve: 0, cost: 0 },
  { name: 'Hasta un detalle (bebida, desayuno)', resolve: 0.7, cost: 0.08 },
  { name: 'Hasta una noche de descuento', resolve: 0.95, cost: 0.18 },
];
export const cancelPolicy = (s, day = s.day) => (chapterFor(s, day) >= 4 ? CANCEL[s.policy.cancel] : null);

// ---------------- Chapter 5 · Restaurant & cross-sell ----------------
const FOOD_FACTOR = { playa: 1.6, centro: 1, carretera: 0.7 };
const OUTSIDE = { playa: 8, centro: 14, carretera: 12 };
export const MENUS = [
  { name: 'Sencillo', check: 180, food: 0.38, outside: 0.3, rating: 0.05, demand: 0.02 },
  { name: 'Rico', check: 280, food: 0.32, outside: 0.6, rating: 0.12, demand: 0.03 },
  { name: 'Gourmet', check: 450, food: 0.34, outside: 1, rating: 0.2, demand: 0.05 },
];
export const BUY = [
  { name: 'Poca', mult: 0.85 },
  { name: 'Justa', mult: 1 },
  { name: 'De sobra', mult: 1.2 },
];
export const restaurantInvestment = (s) => k(s, 1.5);
export const restaurantStaff = (s) => k(s, 0.06);
export const menuCheck = (s, menu = s.rest.menu) => Math.round(MENUS[menu].check * FOOD_FACTOR[s.locationId] / 10) * 10;
const restOn = (s, day) => chapterFor(s, day) >= 5 && s.rest.open;

export function expectedDiners(s, day, guests) {
  const menu = MENUS[s.rest.menu];
  const weekend = calendar(day).dow >= 4 && calendar(day).dow <= 5 ? 1.4 : 1;
  const down = s.mods.some((m) => m.type === 'restDown' && day >= m.from && day <= m.to) ? 0.6 : 1;
  return (guests * 1.8 * 0.45 + OUTSIDE[s.locationId] * menu.outside * (0.6 + 0.1 * s.reputation) * weekend) * down;
}

export function restaurantDay(s, day, sold, guessSold) {
  if (!restOn(s, day)) return null;
  const check = menuCheck(s);
  const menu = MENUS[s.rest.menu];
  const planned = expectedDiners(s, day, guessSold);
  const supply = Math.round(planned * BUY[s.rest.buy].mult);
  const actual = Math.round(expectedDiners(s, day, sold) * (0.78 + rng(s) * 0.44));
  const served = Math.min(actual, supply);
  return {
    diners: actual, served, turnedAway: actual - served, supply,
    revenue: served * check,
    food: supply * check * menu.food,
    waste: (supply - served) * check * menu.food,
    staff: restaurantStaff(s),
  };
}

export const OFFERS = {
  tours: { name: 'Tours con socios', icon: '🗺️', take: 0.12, price: 0.07, cost: 0, note: 'Tú cobras la comisión del tour.' },
  late: { name: 'Salida tarde', icon: '🕐', take: 0.12, price: 0.15, cost: 0, note: 'Pagan por quedarse hasta las 3 pm, pero mañana se limpia menos.' },
  upgrade: { name: 'Mejor cuarto', icon: '⬆️', take: 0.1, price: 0.25, cost: 0, note: 'Solo si hay un cuarto mejor libre.' },
  breakfast: { name: 'Desayuno', icon: '🥐', take: 0.3, price: 0.08, cost: 0.5, note: 'La mitad de lo que cobras se va en ingredientes.' },
};
export const offerAvailable = (s, id) => {
  if (id === 'upgrade') return roomsOf(s).length > 1;
  if (id === 'breakfast') return !s.attributes.includes('desayuno');
  return true;
};
export const activeOffers = (s) => Object.keys(OFFERS).filter((id) => s.offers[id] && offerAvailable(s, id));

export function crossSellDay(s, day, soldByType) {
  if (chapterFor(s, day) < 5) return null;
  const list = activeOffers(s);
  if (!list.length) return null;
  const sold = Object.values(soldByType).reduce((a, b) => a + b, 0);
  const tooMany = list.length > 2;
  const ref = avgRef(s);
  const out = { revenue: 0, cost: 0, takers: {}, tooMany, late: 0 };
  const rooms = roomsOf(s);
  for (const id of list) {
    const o = OFFERS[id];
    let base = sold;
    if (id === 'upgrade') {
      // Upgrades need a free room of a better type.
      const freeBetter = rooms.slice(1).reduce((n, r) => n + Math.max(0, r.count - (soldByType[r.id] || 0)), 0);
      base = Math.min(soldByType[rooms[0].id] || 0, freeBetter / o.take);
    }
    const p = o.take * (tooMany ? 0.65 : 1);
    let n = 0;
    for (let i = 0; i < Math.round(base); i++) if (rng(s) < p) n++;
    out.takers[id] = n;
    out.revenue += n * ref * o.price;
    out.cost += n * ref * o.price * o.cost;
    if (id === 'late') out.late = n;
  }
  return out;
}

// ---------------- Chapter 6 · Maintenance, taxes, controls ----------------
export const MAINT = [
  { name: 'Nada', cost: 0, gain: 0 },
  { name: 'Básico', cost: 0.012, gain: 0.5 },
  { name: 'Completo', cost: 0.025, gain: 0.9 },
];
export const INSURANCE = { cost: 0.005, covers: 0.7 };
export const CONTROLS_COST = 0.003;
export const ISH = 0.03;
export const ISR = 0.3;
export const maintCost = (s, day = s.day) => chapterFor(s, day) < 6 ? 0
  : k(s, MAINT[s.maint.level].cost) + (s.maint.insurance ? k(s, INSURANCE.cost) : 0) + (s.maint.controls ? k(s, CONTROLS_COST) : 0);
export const repairCost = (s, frac) => Math.round(k(s, frac) * (s.maint.insurance ? 1 - INSURANCE.covers : 1));

export function breakdownChance(s) {
  if (chapterFor(s) < 6 || s.maint.condition == null) return 0;
  return 0.01 + Math.max(0, (75 - s.maint.condition) / 75) * 0.16;
}

export function maintainDay(s, occupancy) {
  if (s.maint.condition == null) return;
  s.maint.condition = clamp(s.maint.condition - (0.2 + 0.4 * occupancy) + MAINT[s.maint.level].gain, 0, 100);
}

// Hidden cash leak when nobody counts the cash: the books say one thing, the drawer another.
export function leakDay(s, day, roomRevenue) {
  if (chapterFor(s, day) < 6 || s.maint.controls) return 0;
  if (rng(s) > 0.3) return 0;
  return Math.round(roomRevenue * 0.025);
}

// ---------------- Chapter 7 · Competition ----------------
export const UNIQUE = {
  playa: [['fogata', '🔥 Fogata y música en la playa'], ['snorkel', '🐠 Snorkel con guía local'], ['cena', '🌅 Cena en la arena']],
  centro: [['tour', '🌮 Tour de comida del pueblo'], ['museo', '🏛️ Noche de museo privada'], ['cafe', '☕ Café de olla en la terraza']],
  carretera: [['trailero', '🍳 Desayuno de trailero gigante'], ['taller', '🔧 Taller mecánico de cortesía'], ['estrellas', '🔭 Noche de estrellas']],
};
export const uniqueCost = (s) => k(s, 0.9);
const SENS = (s) => { const m = L(s).mix; return m.paso + m.trabajo + 0.5 * m.familias; };

export function compSteal(s, day = s.day) {
  if (chapterFor(s, day) < 7 || !s.comp.open) return 0;
  return SENS(s) * 0.18 * (s.comp.unique ? 0.5 : 1) * (s.reputation >= 4.2 ? 0.75 : 1);
}

export function chainPrice(s, day = s.day) {
  const r = roomsOf(s)[0];
  const wobble = 0.95 + ((day * 37) % 11) / 100;
  return Math.round((r.ref * (0.626 + 0.11 * 3.9) * 0.8 * wobble) / 50) * 50;
}

export const overbookOn = (s, day = s.day) => (chapterFor(s, day) >= 7 ? s.comp.overbook : 0);

// ---------------- Chapter 8 · The big bet ----------------
export const PROJECTS = {
  cuartos: { icon: '🏗️', name: 'Ampliación: 4 cuartos estándar más', short: 'Más cuartos', days: 21,
    cost: (s) => roomsOf(s)[0].ref * 4 * 250,
    note: 'Más cuartos para vender los días llenos. Más limpieza y más gasto por cuarto.' },
  terraza: { icon: '🌇', name: 'Terraza con bar en la azotea', short: 'Terraza', days: 14,
    cost: (s) => k(s, 12),
    note: 'Ingresos extra de huéspedes y visitantes por la noche. Sube un poco tus reseñas.' },
  spa: { icon: '🧖', name: 'Spa', short: 'Spa', days: 21,
    cost: (s) => k(s, 25),
    note: 'Encanta a parejas y lujo. Cuesta $120,000 al mes operarlo.' },
};
export const projectAvailable = (s, id) => !(id === 'spa' && s.attributes.includes('spa'));

// Rough monthly gain she can explain to the board: built from last month's real numbers.
export function projectEstimate(s, id) {
  const last = s.months[s.months.length - 1];
  const occ = last ? last.occupancy : 0.6;
  const r0 = roomsOf(s)[0];
  if (id === 'cuartos') return Math.round((4 * occ * DAYS_PER_MONTH * (r0.ref - L(s).varPerNight) - 480 * 10) / 1000) * 1000;
  if (id === 'terraza') {
    const guests = (last ? last.occupancy : 0.6) * roomsOf(s).reduce((n, r) => n + r.count, 0);
    const perNight = (guests * 1.8 * 0.3 + 5) * menuCheck(s, 1) * 0.65 - k(s, 0.03);
    return Math.round((perNight * DAYS_PER_MONTH) / 1000) * 1000;
  }
  const spa = ATTRIBUTES.find((a) => a.id === 'spa');
  const bonus = Object.entries(L(s).mix).reduce((n, [seg, sh]) => n + sh * spa.appeal[seg], 0);
  const rev = last ? last.revenue : potRev(s) * 0.6 * DAYS_PER_MONTH;
  return Math.round((rev * (bonus * 0.7 + 0.03) - spa.monthly) / 1000) * 1000;
}
export const paybackMonths = (s, id) => {
  const est = projectEstimate(s, id);
  return est > 0 ? Math.ceil(PROJECTS[id].cost(s) / est) : Infinity;
};

export const BANK_RATE = 0.14;
export const BANK_RATE_NEGOTIATED = 0.115;
export const BANK_MONTHS = 60;
export const SOCIO_SHARE = 0.2;
export function newLoanPayment(s, principal) {
  const r = (s.plan.negotiated ? BANK_RATE_NEGOTIATED : BANK_RATE) / 12;
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -BANK_MONTHS)));
}
export const goodPayer = (s) => s.history.filter((x) => x.loanPaid && x.cash >= 0).length >= 3;

export function startProject(s) {
  const p = PROJECTS[s.plan.project];
  const cost = p.cost(s);
  if (s.plan.funding === 'caja') s.cash -= cost;
  if (s.plan.funding === 'banco') s.payment += newLoanPayment(s, cost);
  if (s.plan.funding === 'socio') s.plan.socio = true;
  s.plan.status = 'building';
  s.plan.readyDay = s.day + p.days;
}

export function finishProject(s) {
  s.plan.status = 'done';
  if (s.plan.project === 'cuartos') {
    s.extraRooms += 4;
    const std = roomsOf(s)[0].id;
    s.dirty[std] = s.dirty[std] || 0;
  }
  if (s.plan.project === 'spa' && !s.attributes.includes('spa')) s.attributes.push('spa');
}

// Terraza: evening bar revenue once it's built.
export function terraceDay(s, sold) {
  if (s.plan.project !== 'terraza' || s.plan.status !== 'done') return null;
  const check = menuCheck(s, 1);
  const guests = Math.round(sold * 1.8 * 0.3 * (0.8 + rng(s) * 0.4)) + 5;
  return { revenue: guests * check, cost: guests * check * 0.35 + k(s, 0.03) };
}

// ---------------- Año 2 · Manager ----------------
export const managerCost = (s) => k(s, 0.04);

export const monthOf = hotelMonth;
