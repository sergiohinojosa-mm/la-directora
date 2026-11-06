// Monthly board meeting: she picks what to present, answers the board's questions,
// and the board grades the month against the mandate it set.

import { clamp, money, pct, DAYS, DAYS_PER_MONTH } from '../util.js';
import { loc, weekCost, season } from './sim.js';
import { discover, applyLesson } from './lessons.js';
import { LESSONS } from '../data/lessons.js';
import { chapterFor } from '../data/chapters.js';
import {
  PROJECTS, projectEstimate, paybackMonths, newLoanPayment, startProject, potRev, OTA_FEE,
} from './systems.js';

const curMonth = (s) => Math.floor((s.day - 1) / DAYS_PER_MONTH) + 1;
const OCC_TARGET = { playa: 0.62, centro: 0.6, carretera: 0.5 };
// Monthly profit that earns the third star.
export const PROFIT_GOAL = { playa: 150_000, centro: 70_000, carretera: 50_000 };

export const MANDATES = [
  { id: 'llenar', title: 'Llenar el hotel',
    text: (s) => `Este mes queremos ver el hotel con vida: al menos ${pct(occTargetFor(s, curMonth(s)))} de cuartos llenos en promedio, sin quedarte sin dinero.`,
    met: (s, m) => m.occupancy >= occTargetFor(s, m.month) && m.cash > 0 },
  { id: 'caja', title: 'Cuidar la caja',
    text: (s) => (lowSeason(s, curMonth(s))
      ? `Es temporada baja: no pierdas más de ${money(-profitFloorFor(s, curMonth(s)))} y termina con al menos dos semanas de gastos en caja.`
      : 'Este mes necesitamos que el hotel gane dinero y que termines con más caja de la que empezaste.'),
    met: (s, m) => (lowSeason(s, m.month) ? m.profit > profitFloorFor(s, m.month) && m.cash >= 2 * weekCost(s) : m.profit > 0 && m.cash >= m.startCash) },
  { id: 'felices', title: 'Huéspedes felices',
    text: () => 'Este mes queremos reseñas de 3.9★ o más y un equipo con buen ánimo (60 o más).',
    met: (s, m) => m.reputation >= 3.9 && m.morale >= 60 },
  { id: 'crecer', title: 'Crecer',
    text: (s) => `Este mes queremos ingresos al menos 5% más altos que el mes pasado (${money((s.months[s.months.length - 1]?.revenue ?? 0) * 1.05)}).`,
    met: (s, m) => m.revenue >= (s.months[s.months.length - 2]?.revenue ?? 0) * 1.05 },
  { id: 'equipo', title: 'Un equipo estable',
    text: () => 'Este mes queremos que nadie renuncie y que el ánimo del equipo cierre en 65 o más.',
    met: (s, m) => m.quits === 0 && m.morale >= 65 },
  { id: 'canales', title: 'Que nos encuentren',
    text: (s) => `Este mes queremos ${pct(occTargetFor(s, curMonth(s)) + 0.03)} de cuartos llenos, gastando en ventas y marketing (incluidas comisiones) máximo 15% de tus ingresos.`,
    met: (s, m) => m.occupancy >= occTargetFor(s, m.month) + 0.03 && mktCost(m) <= m.revenue * 0.15 },
  { id: 'por_huesped', title: 'Más por cada huésped',
    text: () => 'Este mes queremos que cada huésped te deje en extras (restaurante y venta cruzada) al menos 10% de lo que paga por su cuarto.',
    met: (s, m) => m.extrasRevenue >= m.roomRevenue * 0.1 },
  { id: 'en_forma', title: 'Un hotel en forma',
    text: () => 'Este mes queremos el hotel en 70/100 o más de estado y la caja bajo control: corte de caja diario y cero faltantes.',
    met: (s, m) => (m.condition ?? 100) >= 70 && m.controls && m.leak === 0 },
  { id: 'defender', title: 'Defender nuestro lugar',
    text: (s) => `GlobalStay está enfrente. Queremos ${pct(occTargetFor(s, curMonth(s)))} de cuartos llenos sin bajar el precio promedio de 95% del normal.`,
    met: (s, m) => m.occupancy >= occTargetFor(s, m.month) && m.priceRatio >= 0.95 },
  { id: 'revpar', title: 'Más RevPAR',
    text: (s) => `Queremos un RevPAR (ingreso por cuarto disponible) mayor que el del mes pasado (${money(s.months[s.months.length - 1]?.revpar ?? 0)}).`,
    met: (s, m) => m.revpar > (s.months[s.months.length - 2]?.revpar ?? 0) },
  { id: 'cierre', title: 'El gran cierre del año',
    text: () => 'Termina el año con tu gran apuesta aprobada por el Consejo y sin perder dinero de más en el mes.',
    met: (s, m) => m.profit > profitFloorFor(s, m.month) && ['building', 'done'].includes(s.plan.status) },
];
const MANDATE_BY_ID = Object.fromEntries(MANDATES.map((x) => [x.id, x]));
// The year's story: each month's mandate matches its chapter. From month 13 they rotate.
const YEAR_PLAN = ['llenar', 'equipo', 'canales', 'felices', 'crecer', 'por_huesped', 'caja', 'en_forma', 'defender', 'felices', 'caja', 'cierre'];
const YEAR2 = ['llenar', 'caja', 'felices', 'canales', 'por_huesped', 'en_forma', 'defender', 'revpar', 'equipo', 'crecer'];
export const mktCost = (m) => (m.costs.marketing || 0) + (m.costs.commission || 0);

// Each season (4 months) the board asks a bit more: the winning formula keeps moving.
// Targets also follow the tourist season: the board expects more in high season and less in low.
const cycle = (month) => Math.floor((month - 1) / 4);
const seasonOf = (s, month) => season(s, (month - 1) * DAYS_PER_MONTH + 14);
export const occTargetFor = (s, month) => (OCC_TARGET[s.locationId] + 0.04 * cycle(month)) * (0.6 + 0.4 * seasonOf(s, month));
// Second star: profit. In deep low season the board accepts a small loss if the cash holds.
export const profitFloorFor = (s, month) => (seasonOf(s, month) < 0.88 ? -Math.round(weekCost(s) / 1000) * 1000 : 0);
export const lowSeason = (s, month) => seasonOf(s, month) < 0.88;
// From chapter 6 the month pays 30% income tax, so the goal is measured after taxes.
export const profitGoalFor = (s, month) => Math.round(PROFIT_GOAL[s.locationId] * (1 + 0.2 * cycle(month)) * (month >= 7 ? 0.75 : 1)
  * Math.min(1.3, Math.max(0.3, (seasonOf(s, month) - 0.6) / 0.4)) / 1000) * 1000;

const plural = (d) => { const x = d.toLowerCase(); return x.endsWith('s') ? x : x + 's'; };

export const mandateFor = (month) => MANDATE_BY_ID[month <= 12 ? YEAR_PLAN[month - 1] : YEAR2[(month - 13) % YEAR2.length]];

export function kpis(s, m) {
  return [
    { id: 'profit', label: 'Ganancia del mes', value: money(m.profit), bad: m.profit < 0 },
    { id: 'revenue', label: 'Ingresos', value: money(m.revenue), bad: false },
    { id: 'occupancy', label: 'Cuartos llenos (promedio)', value: pct(m.occupancy), bad: m.occupancy < 0.5 },
    { id: 'adr', label: 'Precio promedio por cuarto', value: money(m.adr), bad: false },
    { id: 'reputation', label: 'Reseñas', value: m.reputation.toFixed(1) + '★', bad: m.reputation < 3.4 },
    { id: 'cash', label: 'Caja al cierre', value: money(m.cash), bad: m.cash < m.startCash },
    { id: 'morale', label: 'Ánimo del equipo', value: Math.round(m.morale) + '/100', bad: m.morale < 50 },
    { id: 'lostDirty', label: 'Huéspedes sin cuarto por limpieza', value: String(m.lostDirty), bad: m.lostDirty > 3 },
    m.chapter >= 2 && { id: 'quits', label: 'Renuncias', value: String(m.quits), bad: m.quits > 0 },
    m.chapter >= 3 && { id: 'mkt', label: 'Ventas y marketing (% de ingresos)', value: pct(mktCost(m) / (m.revenue || 1)), bad: mktCost(m) > m.revenue * 0.15 },
    m.chapter >= 4 && { id: 'unresolved', label: 'Quejas sin resolver', value: String(m.unresolved), bad: m.unresolved > 5 },
    m.chapter >= 5 && { id: 'perGuest', label: 'Ingreso por huésped', value: money(m.revenue / (m.soldTotal || 1)), bad: false },
    m.chapter >= 6 && { id: 'condition', label: 'Estado del hotel', value: Math.round(m.condition ?? 100) + '/100', bad: (m.condition ?? 100) < 60 },
    m.chapter >= 7 && { id: 'revpar', label: 'RevPAR', value: money(m.revpar), bad: false },
  ].filter(Boolean);
}

function shuffle(arr, seed) {
  const a = [...arr];
  let x = seed;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function questions(s, m) {
  const month = m.month;
  const history = s.history.slice(-DAYS_PER_MONTH);
  const costNames = { fixed: 'Operación fija del hotel', variable: 'Costo por cuarto ocupado', wages: 'Sueldos de limpieza', loan: 'Pago al banco' };
  const biggest = Object.keys(costNames).sort((a, b) => m.costs[b] - m.costs[a])[0];

  const byDow = Array.from({ length: 7 }, (_, d) => {
    const ds = history.filter((r) => r.dow === d);
    return ds.reduce((a, r) => a + r.occupancy, 0) / (ds.length || 1);
  });
  const best = byDow.indexOf(Math.max(...byDow));
  const worst = byDow.indexOf(Math.min(...byDow));
  const other = [0, 1, 2, 3, 4, 5, 6].find((d) => d !== best && d !== worst);

  let fix = 'precio';
  if (m.lostDirty > 3) fix = 'limpieza';
  else if ((m.idleWages || 0) > m.revenue * 0.03) fix = 'sobra';
  else if (m.reputation < 3.6 || m.morale < 50) fix = 'equipo';
  const fixes = {
    limpieza: 'Tener más capacidad de limpieza los días llenos',
    precio: 'Ajustar precios: más caros los días llenos, más baratos los días flojos',
    equipo: 'Cuidar al equipo y la calidad para subir las reseñas',
    ...(fix === 'sobra' ? { sobra: 'Ajustar el equipo: tengo más gente de la que necesito' } : {}),
  };

  const qs = [
    { by: 'alma', text: 'Directora, ¿cuál fue el gasto más grande del hotel este mes?',
      options: shuffle(Object.keys(costNames), month * 7).map((k) => ({ label: costNames[k], correct: k === biggest })),
      explain: `El gasto más grande fue "${costNames[biggest]}": ${money(m.costs[biggest])}.` },
    { by: 'marcela', text: '¿Qué día de la semana se llenó más tu hotel?',
      options: shuffle([best, worst, other], month * 13).map((d) => ({ label: DAYS[d], correct: d === best })),
      explain: `Los ${plural(DAYS[best])} se llenó ${pct(byDow[best])} en promedio y los ${plural(DAYS[worst])} solo ${pct(byDow[worst])}. Los días llenos aguantan precios más altos.` },
    { by: 'papa', text: 'Si el próximo mes quieres ganar más, ¿qué cambiarías primero?',
      options: shuffle(Object.keys(fixes), month * 3).map((k) => ({ label: fixes[k], correct: k === fix })),
      explain: fix === 'limpieza' ? `Perdiste ${m.lostDirty} huéspedes por cuartos sucios. Ese dinero ya estaba en la puerta.`
        : fix === 'sobra' ? `Pagaste ${money(m.idleWages)} en sueldos de limpieza que no se necesitaban.`
        : fix === 'equipo' ? `Tus reseñas (${m.reputation.toFixed(1)}★) y el ánimo (${Math.round(m.morale)}) frenan la demanda.`
        : 'Tus cuartos se llenan distinto cada día. El precio es tu herramienta para aprovecharlo.' },
  ];
  const chq = chapterQuestion(s, m);
  if (chq) qs[1] = chq;
  const recall = recallQuestion(s, month);
  if (recall) qs.push(recall);
  return qs;
}

// A numbers question about the chapter's area: reading her own data is the skill.
function numberOptions(correct, fmt, seed) {
  const a = Math.round(correct * 0.55);
  const b = Math.round(correct * 1.7) + (correct === 0 ? 3 : 0);
  const vals = [...new Set([correct, a === correct ? correct + 2 : a, b])];
  return shuffle(vals, seed).map((v) => ({ label: fmt(v), correct: v === correct }));
}

function chapterQuestion(s, m) {
  const ch = m.chapter;
  const round1000 = (v) => Math.round(v / 1000) * 1000;
  if (ch === 2) return { by: 'marcela', text: '¿Cuánto pagaste este mes en sueldos del equipo?',
    options: numberOptions(round1000(m.costs.wages), money, m.month * 5),
    explain: `Fueron ${money(m.costs.wages)}. ${m.quits ? `Además renunciaron ${m.quits}: reemplazar gente también cuesta.` : 'Y nadie renunció: eso también es ahorro.'}` };
  if (ch === 3) {
    const cpb = (c) => (m.bookings[c] >= 0.5 ? m.chanCost[c] / m.bookings[c] : -1);
    const names = { agencia: 'Agencias en línea', redes: 'Redes sociales', alianzas: 'Alianzas', directo: 'Reservas directas' };
    const list = Object.keys(names);
    const worst = list.sort((a, b) => cpb(b) - cpb(a))[0];
    if (cpb(worst) <= 0) return null;
    return { by: 'alma', text: '¿Qué canal te costó más por cada reserva este mes?',
      options: shuffle(Object.keys(names), m.month * 7).map((c) => ({ label: names[c], correct: c === worst })),
      explain: `${names[worst]}: ${money(cpb(worst))} por reserva. Las directas no cuestan nada${m.bookings.agencia >= 0.5 ? `, y la agencia cobra ${Math.round(OTA_FEE * 100)}%` : ''}.` };
  }
  if (ch === 4) return { by: 'marcela', text: '¿Cuántas quejas se quedaron sin resolver este mes?',
    options: numberOptions(m.unresolved, String, m.month * 3),
    explain: `Fueron ${m.unresolved} de ${m.complaints}. ${s.policy.power ? 'Kevin resolvió las demás en el momento.' : 'Recepción no podía resolver nada sin ti.'}` };
  if (ch === 5 && m.restRevenue > 0) {
    const pc = Math.round((m.restFood / m.restRevenue) * 100);
    return { by: 'alma', text: 'De cada $100 que vendió el restaurante, ¿cuánto se fue en ingredientes?',
      options: numberOptions(pc, (v) => `$${v}`, m.month * 11),
      explain: `$${pc} de cada $100. En los restaurantes reales es entre $28 y $35. ${m.restWaste > m.restFood * 0.12 ? `Se tiraron ${money(m.restWaste)} de comida.` : ''}` };
  }
  if (ch === 5) return { by: 'marcela', text: '¿Cuánto ganaste este mes con venta cruzada (extras para tus huéspedes)?',
    options: numberOptions(round1000(m.crossRevenue), money, m.month * 13),
    explain: `${money(m.crossRevenue)} sin traer a nadie nuevo.` };
  if (ch === 6) return { by: 'alma', text: '¿Cuánto pagaste de impuestos este mes (hospedaje + ganancia)?',
    options: numberOptions(round1000(m.costs.tax + m.costs.isr), money, m.month * 17),
    explain: `${money(m.costs.tax)} de impuesto al hospedaje y ${money(m.costs.isr)} de impuesto sobre la ganancia.` };
  if (ch === 7) return { by: 'papa', text: '¿Cuál fue tu RevPAR este mes (ingreso por cuarto disponible cada noche)?',
    options: numberOptions(Math.round(m.revpar / 10) * 10, money, m.month * 19),
    explain: `RevPAR = ingreso por cuartos ÷ cuartos disponibles = ${money(m.revpar)}. Junta precio y ocupación en un solo número.` };
  if (ch >= 8) return { by: 'alma', text: '¿Cuánto pagas al banco cada mes?',
    options: numberOptions(round1000(s.payment), money, m.month * 23),
    explain: `${money(s.payment)} al mes. Antes de pedir más prestado, revisa que puedas pagarlo en un mes flojo.` };
  return null;
}

// ---------------- The big bet (chapter 8): the board votes on her plan ----------------
export const planReady = (s) => s.plan.project && s.plan.funding && !['building', 'done'].includes(s.plan.status);

export function planVotes(s, m) {
  const cost = PROJECTS[s.plan.project].cost(s);
  const est = projectEstimate(s, s.plan.project);
  const payback = paybackMonths(s, s.plan.project);
  const monthCosts = weekCost(s) * 4;
  let alma;
  if (s.plan.funding === 'caja') alma = { yes: s.cash - cost >= monthCosts, why: s.cash - cost >= monthCosts ? `Después de pagar te queda ${money(s.cash - cost)}: más de un mes de gastos.` : `Si pagas con caja te quedan ${money(s.cash - cost)}. Necesito ver al menos un mes de gastos (${money(monthCosts)}).` };
  else if (s.plan.funding === 'banco') {
    const pay = s.payment + newLoanPayment(s, cost);
    alma = { yes: pay <= m.revenue * 0.25, why: pay <= m.revenue * 0.25 ? `El pago al banco quedaría en ${money(pay)} al mes: se puede pagar.` : `El pago al banco subiría a ${money(pay)}: más de 25% de lo que vendes. Es demasiado riesgo.` };
  } else alma = { yes: true, why: 'Don Rodrigo pone el dinero y nuestra caja no corre riesgo. Pero recuerda que se llevará 20% de la ganancia.' };
  const marcela = { yes: s.morale >= 60 && s.reputation >= 3.8, why: s.morale >= 60 && s.reputation >= 3.8 ? 'El equipo está bien y los huéspedes contentos: estamos listos para crecer.' : `Primero cuida lo que ya tienes: ánimo ${Math.round(s.morale)} (necesito 60) y reseñas ${s.reputation.toFixed(1)}★ (necesito 3.8).` };
  const rodrigo = { yes: payback <= 30, why: payback <= 30 ? `Recuperamos la inversión en unos ${payback} meses. Me gusta.` : `Con ${money(est)} al mes tardaríamos ${payback === Infinity ? 'una eternidad' : payback + ' meses'} en recuperar ${money(cost)}. No me convence.` };
  return { alma, marcela, rodrigo, cost, est, payback };
}

// Papá's vote: can she explain her own plan?
export function planQuestion(s) {
  const p = paybackMonths(s, s.plan.project);
  const correct = p === Infinity ? 999 : p;
  const opts = correct === 999 ? [999, 24, 12] : [correct, Math.max(1, Math.round(correct / 2)), correct * 2];
  return {
    by: 'papa',
    text: `Directora, si la obra cuesta ${money(PROJECTS[s.plan.project].cost(s))} y deja unos ${money(Math.max(0, projectEstimate(s, s.plan.project)))} al mes, ¿en cuántos meses recuperamos el dinero?`,
    options: shuffle([...new Set(opts)], 31).map((v) => ({ label: v === 999 ? 'Nunca: no deja ganancia' : `${v} meses`, correct: v === correct })),
    explain: correct === 999 ? 'Si el proyecto no deja ganancia, nunca se recupera.' : `Costo ÷ ganancia mensual = ${correct} meses. A eso se le llama "periodo de recuperación".`,
  };
}

export function resolvePlan(s, m, papaYes) {
  const v = planVotes(s, m);
  const yes = [v.alma.yes, v.marcela.yes, v.rodrigo.yes, papaYes].filter(Boolean).length;
  const approved = yes >= 3;
  s.plan.lastVote = { month: m.month, yes, approved };
  if (approved) {
    startProject(s);
    applyLesson(s, 'mismo_barco', `Convenciste al Consejo con números: ${yes} de 4 votaron a favor de tu plan.`);
    applyLesson(s, 'largo_plazo', 'Hiciste un plan que cuesta hoy y paga durante años.');
  } else s.plan.status = 'rejected';
  return { ...v, papaYes, yes, approved };
}

// ---------------- Dividends at year close ----------------
export const DIVIDENDS = [
  { id: 0, name: 'No repartir nada', pct: 0, note: 'Todo se queda en el hotel.' },
  { id: 1, name: 'Repartir 25% de la caja', pct: 0.25, note: 'Los dueños reciben algo y el hotel sigue fuerte.' },
  { id: 2, name: 'Repartir 50% de la caja', pct: 0.5, note: 'Los dueños felices hoy, la caja más débil.' },
];

export function payDividends(s, choice, teamBonus) {
  const d = DIVIDENDS[choice];
  const amount = Math.round((Math.max(0, s.cash) * d.pct) / 1000) * 1000;
  s.cash -= amount;
  const bonus = teamBonus ? 1500 * s.housekeepers : 0;
  s.cash -= bonus;
  if (teamBonus) s.morale = clamp(s.morale + 12, 0, 100);
  const safe = s.cash >= 2 * weekCost(s);
  const notes = [];
  if (choice === 0) notes.push({ by: 'alma', text: 'Los dueños también arriesgaron su dinero. El próximo año espero algo.' }, { by: 'marcela', text: 'Me gusta que el hotel quede fuerte.' });
  if (choice === 1) notes.push({ by: 'alma', text: 'Justo. Los dueños reciben su parte y la caja sigue sana.' }, { by: 'rodrigo', text: 'Un retorno razonable. Bien.' });
  if (choice === 2) notes.push({ by: 'rodrigo', text: '¡Excelente retorno!' }, { by: 'marcela', text: safe ? 'Ojalá no nos haga falta ese dinero en la temporada baja.' : 'La caja quedó muy baja. Me preocupa.' });
  if (teamBonus) notes.push({ by: 'marcela', text: 'El bono al equipo dice mucho de ti, Directora.' });
  const delta = (choice === 1 ? 6 : choice === 2 ? (safe ? 4 : -6) : -2) + (teamBonus ? 2 : 0);
  s.confidence = clamp(s.confidence + delta, 0, 100);
  if (safe && choice >= 1) applyLesson(s, 'mismo_barco', `Repartiste ${money(amount)} a los dueños y la caja quedó con ${money(s.cash)}: todos ganan.`);
  if (!safe) discover(s, 'cash_king', `Después de repartir dividendos, la caja quedó en ${money(s.cash)}: menos de dos semanas de gastos.`);
  s.dividends = [...(s.dividends || []), { year: Math.ceil(s.day / 336), amount, bonus }];
  return { amount, bonus, notes, delta };
}

// The year in numbers, for the closing screen.
export function yearSummary(s) {
  const months = s.months.slice(-12);
  const sum = (f) => months.reduce((a, m) => a + (f(m) || 0), 0);
  const sold = sum((m) => m.soldTotal);
  return {
    revenue: sum((m) => m.revenue),
    profit: sum((m) => m.profit),
    occupancy: sold / (sum((m) => m.soldTotal / (m.occupancy || 1)) || 1),
    adr: sold ? sum((m) => m.roomRevenue) / sold : 0,
    stars: Object.entries(s.monthStars || {}).filter(([k]) => k.startsWith(`${s.year}-`)).reduce((a, [, v]) => a + v, 0),
    bestMonth: months.reduce((a, b) => (b.profit > a.profit ? b : a), months[0]),
    reputation: s.reputation,
    lessons: Object.values(s.lessons).filter((l) => l.level > 0).length,
    mastered: Object.values(s.lessons).filter((l) => l.level >= 3).length,
  };
}

// Retrieval practice: complete one of the sayings she has already discovered.
const WORD = /[A-Za-zÁÉÍÓÚÑáéíóúñü']{5,}/g;
function recallQuestion(s, month) {
  const known = LESSONS.filter((l) => (s.lessons[l.id]?.level ?? 0) > 0);
  if (known.length < 2) return null;
  const l = known[(month * 7) % known.length];
  const words = l.phrase.match(WORD) || [];
  if (!words.length) return null;
  const answer = words.reduce((a, b) => (b.length > a.length ? b : a));
  const pool = LESSONS.filter((x) => x.id !== l.id).flatMap((x) => x.phrase.match(WORD) || []).filter((w) => w.toLowerCase() !== answer.toLowerCase());
  const distractors = [...new Set(pool)].sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length) || a.localeCompare(b));
  const picks = [distractors[month % Math.min(6, distractors.length)], distractors[(month + 3) % Math.min(6, distractors.length)]].filter((w, i, arr) => w && arr.indexOf(w) === i);
  return {
    by: l.by,
    text: `Completa la frase que te enseñé: “${l.phrase.replace(answer, '_____')}”`,
    options: shuffle([answer, ...picks], month * 11).map((w) => ({ label: w, correct: w === answer })),
    explain: `“${l.phrase}”. ${l.tip}`,
    recall: l.id,
  };
}

export function starsFor(s, m) {
  const mandate = mandateFor(m.month);
  if (!mandate.met(s, m)) return 0;
  let n = 1;
  if (m.profit > profitFloorFor(s, m.month)) n++;
  if (n === 2 && m.profit >= profitGoalFor(s, m.month) && m.reputation >= 3.8) n++;
  return n;
}

// picked: KPI ids she chose to present; answers: index chosen per question.
export function resolveMeeting(s, m, picked, answers) {
  const qs = questions(s, m);
  const stars = starsFor(s, m);
  let delta = stars === 0 ? -8 : stars * 5 - 3;
  const notes = [];
  const all = kpis(s, m);
  const hidden = all.filter((k) => k.bad && !picked.includes(k.id));
  const shown = all.filter((k) => k.bad && picked.includes(k.id));
  if (hidden.some((k) => k.id === 'profit')) {
    delta -= 6;
    notes.push({ by: 'alma', text: 'Noté que no presentaste la ganancia. La encontré en el reporte. Prefiero que me lo digas tú.' });
    discover(s, 'malas_noticias', 'En la junta no presentaste la ganancia del mes, y el Consejo la encontró en el reporte.');
  } else if (shown.length) {
    delta += 3;
    notes.push({ by: 'papa', text: 'Gracias por poner sobre la mesa lo que no salió bien. Así podemos ayudarte.' });
    applyLesson(s, 'malas_noticias', 'Presentaste al Consejo un número que no salió bien.');
  }
  let correct = 0;
  qs.forEach((q, i) => {
    if (q.options[answers[i]]?.correct) correct++;
  });
  delta += correct * 3 - (qs.length - correct) * 2;
  const numbers = qs.filter((q) => !q.recall);
  if (numbers.every((q) => q.options[answers[qs.indexOf(q)]]?.correct)) applyLesson(s, 'numeros_historia', 'Respondiste bien las preguntas del Consejo leyendo tus números.');

  const before = s.confidence;
  s.confidence = clamp(s.confidence + delta, 0, 100);
  if (m.month === 1) s.stars[1] = stars;
  s.monthStars = s.monthStars || {};
  s.monthStars[`${s.year}-${m.month}`] = stars;

  let verdict;
  if (s.confidence <= 0) verdict = 'closed';
  else if (s.confidence < 30) verdict = 'warning';
  else if (stars >= 2) verdict = 'bonus';
  else verdict = 'ok';
  if (verdict === 'bonus') s.cash += 10_000;

  return { stars, delta: s.confidence - before, correct, total: qs.length, notes, verdict, mandate: mandateFor(m.month) };
}

export const occTarget = (s) => OCC_TARGET[loc(s).id];

function extraRows(s, days, month, { occ, revenue, occGoal }) {
  const sum = (f) => days.reduce((a, r) => a + (f(r) || 0), 0);
  const quits = s.team ? s.team.quits.filter((d) => d > (month - 1) * DAYS_PER_MONTH).length : 0;
  const mkt = sum((r) => r.costs.marketing + r.costs.commission);
  const roomRev = sum((r) => r.roomRevenue ?? r.revenue);
  const extras = revenue - roomRev;
  const leak = sum((r) => r.leak);
  const cond = s.maint?.condition ?? 100;
  const sold = sum((r) => r.soldTotal);
  const ratio = sold ? sum((r) => r.priceRatio * r.soldTotal) / sold : 1;
  const revpar = roomRev / (sum((r) => r.rooms) || 1);
  const prevRevpar = s.months[s.months.length - 1]?.revpar ?? 0;
  return {
    equipo: { label: 'Cero renuncias y ánimo 65+', value: `${quits} · ${Math.round(s.morale)}`, ok: quits === 0 && s.morale >= 65, fill: quits ? 0 : s.morale / 65 },
    canales: { label: `Cuartos llenos ${pct(occGoal + 0.03)} y marketing ≤15%`, value: `${pct(occ)} · ${pct(mkt / (revenue || 1))}`, ok: occ >= occGoal + 0.03 && mkt <= revenue * 0.15, fill: occ / (occGoal + 0.03) },
    por_huesped: { label: 'Extras = 10% de lo que pagan por cuarto', value: pct(extras / (roomRev || 1)), ok: extras >= roomRev * 0.1, fill: extras / (roomRev * 0.1 || 1) },
    en_forma: { label: 'Hotel 70/100, corte de caja y 0 faltantes', value: `${Math.round(cond)} · ${s.maint?.controls ? '🔐' : '🔓'}`, ok: cond >= 70 && s.maint?.controls && leak === 0, fill: Math.min(cond / 70, s.maint?.controls ? 1 : 0.5) },
    defender: { label: `Cuartos llenos ${pct(occGoal)} y precio ≥95%`, value: `${pct(occ)} · ${pct(ratio)}`, ok: occ >= occGoal && ratio >= 0.95, fill: Math.min(occ / occGoal, ratio / 0.95) },
    revpar: { label: `RevPAR mayor que ${money(prevRevpar)}`, value: money(revpar), ok: revpar > prevRevpar, fill: revpar / (prevRevpar || 1) },
    cierre: { label: 'Gran apuesta aprobada (se vota en la junta)', value: ['building', 'done'].includes(s.plan?.status) ? '✅ Aprobada' : s.plan?.project && s.plan?.funding ? 'Lista para votar' : 'Prepárala en 💼', ok: sum((r) => r.profit) > profitFloorFor(s, month) && ['building', 'done'].includes(s.plan?.status), fill: ['building', 'done'].includes(s.plan?.status) ? 1 : s.plan?.project && s.plan?.funding ? 0.7 : 0.2 },
  };
}

// Month-to-date progress toward the three stars, shown every morning so the goal is always in sight.
export function monthProgress(s, monthDays) {
  const month = Math.floor((s.day - 1) / DAYS_PER_MONTH) + 1;
  const mandate = mandateFor(month);
  const sum = (f) => monthDays.reduce((a, r) => a + f(r), 0);
  const rooms = sum((r) => r.rooms) || 1;
  const occ = sum((r) => r.soldTotal) / rooms;
  const profit = sum((r) => r.profit);
  const revenue = sum((r) => r.revenue);
  const startCash = s.monthStartCash ?? s.startCash;
  const prevRevenue = s.months[s.months.length - 1]?.revenue ?? 0;
  const goal = profitGoalFor(s, month);
  const occGoal = occTargetFor(s, month);
  const first = {
    llenar: { label: `Cuartos llenos del mes (meta ${pct(occGoal)})`, value: pct(occ), ok: occ >= occGoal && s.cash > 0, fill: occ / occGoal },
    caja: lowSeason(s, month)
      ? { label: `Temporada baja: caja de 2 semanas (${money(2 * weekCost(s))})`, value: money(s.cash), ok: profit > profitFloorFor(s, month) && s.cash >= 2 * weekCost(s), fill: s.cash / (2 * weekCost(s)) }
      : { label: `Caja vs. inicio del mes (${money(startCash)})`, value: money(s.cash), ok: profit > 0 && s.cash >= startCash, fill: s.cash / startCash },
    felices: { label: 'Reseñas 3.9★ y ánimo 60+', value: `${s.reputation.toFixed(1)}★ · ${Math.round(s.morale)}`, ok: s.reputation >= 3.9 && s.morale >= 60, fill: Math.min(s.reputation / 3.9, s.morale / 60) },
    crecer: { label: `Ingresos del mes (meta ${money(prevRevenue * 1.05)})`, value: money(revenue), ok: revenue >= prevRevenue * 1.05, fill: revenue / (prevRevenue * 1.05 || 1) },
    ...extraRows(s, monthDays, month, { occ, revenue, occGoal }),
  }[mandate.id];
  return {
    mandate,
    rows: [
      { stars: 1, ...first },
      { stars: 2, label: profitFloorFor(s, month) < 0 ? `Temporada baja: no perder más de ${money(-profitFloorFor(s, month))}` : 'Ganancia del mes mayor a $0', value: money(profit), ok: profit > profitFloorFor(s, month), fill: profit > profitFloorFor(s, month) ? 1 : 0 },
      { stars: 3, label: `Ganancia de ${money(goal)} y reseñas 3.8★`, value: `${money(profit)} · ${s.reputation.toFixed(1)}★`, ok: profit >= goal && s.reputation >= 3.8, fill: Math.max(0, profit) / goal },
    ],
  };
}
