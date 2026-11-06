// Monthly board meeting: she picks what to present, answers the board's questions,
// and the board grades the month against the mandate it set.

import { clamp, money, pct, DAYS, DAYS_PER_MONTH } from '../util.js';
import { loc } from './sim.js';
import { discover, applyLesson } from './lessons.js';

const OCC_TARGET = { playa: 0.62, centro: 0.6, carretera: 0.5 };
// Monthly profit that earns the third star.
export const PROFIT_GOAL = { playa: 150_000, centro: 60_000, carretera: 25_000 };

export const MANDATES = [
  { id: 'llenar', title: 'Llenar el hotel',
    text: (s) => `Este mes queremos ver el hotel con vida: al menos ${pct(OCC_TARGET[s.locationId])} de cuartos llenos en promedio, sin quedarte sin dinero.`,
    met: (s, m) => m.occupancy >= OCC_TARGET[s.locationId] && m.cash > 0 },
  { id: 'caja', title: 'Cuidar la caja',
    text: () => 'Este mes necesitamos que el hotel gane dinero y que termines con más caja de la que empezaste.',
    met: (s, m) => m.profit > 0 && m.cash >= m.startCash },
  { id: 'felices', title: 'Huéspedes felices',
    text: () => 'Este mes queremos reseñas de 4.0★ o más y un equipo con buen ánimo (60 o más).',
    met: (s, m) => m.reputation >= 4.0 && m.morale >= 60 },
  { id: 'crecer', title: 'Crecer',
    text: (s) => `Este mes queremos ingresos al menos 10% más altos que el mes pasado (${money((s.months[s.months.length - 1]?.revenue ?? 0) * 1.1)}).`,
    met: (s, m) => m.revenue >= (s.months[s.months.length - 2]?.revenue ?? 0) * 1.1 },
];

const plural = (d) => { const x = d.toLowerCase(); return x.endsWith('s') ? x : x + 's'; };

export const mandateFor = (month) => MANDATES[(month - 1) % MANDATES.length];

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
  ];
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
  else if (m.reputation < 3.6 || m.morale < 50) fix = 'equipo';
  const fixes = {
    limpieza: 'Tener más capacidad de limpieza los días llenos',
    precio: 'Ajustar precios: más caros los días llenos, más baratos los días flojos',
    equipo: 'Cuidar al equipo y la calidad para subir las reseñas',
  };

  return [
    { by: 'alma', text: 'Directora, ¿cuál fue el gasto más grande del hotel este mes?',
      options: shuffle(Object.keys(costNames), month * 7).map((k) => ({ label: costNames[k], correct: k === biggest })),
      explain: `El gasto más grande fue "${costNames[biggest]}": ${money(m.costs[biggest])}.` },
    { by: 'marcela', text: '¿Qué día de la semana se llenó más tu hotel?',
      options: shuffle([best, worst, other], month * 13).map((d) => ({ label: DAYS[d], correct: d === best })),
      explain: `Los ${plural(DAYS[best])} se llenó ${pct(byDow[best])} en promedio y los ${plural(DAYS[worst])} solo ${pct(byDow[worst])}. Los días llenos aguantan precios más altos.` },
    { by: 'papa', text: 'Si el próximo mes quieres ganar más, ¿qué cambiarías primero?',
      options: shuffle(Object.keys(fixes), month * 3).map((k) => ({ label: fixes[k], correct: k === fix })),
      explain: fix === 'limpieza' ? `Perdiste ${m.lostDirty} huéspedes por cuartos sucios. Ese dinero ya estaba en la puerta.`
        : fix === 'equipo' ? `Tus reseñas (${m.reputation.toFixed(1)}★) y el ánimo (${Math.round(m.morale)}) frenan la demanda.`
        : 'Tus cuartos se llenan distinto cada día. El precio es tu herramienta para aprovecharlo.' },
  ];
}

export function starsFor(s, m) {
  const mandate = mandateFor(m.month);
  if (!mandate.met(s, m)) return 0;
  let n = 1;
  if (m.profit > 0) n++;
  if (n === 2 && m.profit >= PROFIT_GOAL[s.locationId] && m.reputation >= 3.8) n++;
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
    discover(s, 'malas_noticias');
  } else if (shown.length) {
    delta += 3;
    notes.push({ by: 'papa', text: 'Gracias por poner sobre la mesa lo que no salió bien. Así podemos ayudarte.' });
    applyLesson(s, 'malas_noticias');
  }
  let correct = 0;
  qs.forEach((q, i) => {
    if (q.options[answers[i]]?.correct) correct++;
  });
  delta += correct * 3 - (qs.length - correct) * 2;
  if (correct === qs.length) applyLesson(s, 'numeros_historia');

  const before = s.confidence;
  s.confidence = clamp(s.confidence + delta, 0, 100);
  if (m.month === 1) s.stars[1] = stars;
  s.monthStars = s.monthStars || {};
  s.monthStars[`${s.year}-${m.month}`] = stars;
  if (stars >= 2) { if (!discover(s, 'celebra')) applyLesson(s, 'celebra'); }

  let verdict;
  if (s.confidence <= 0) verdict = 'closed';
  else if (s.confidence < 30) verdict = 'warning';
  else if (stars >= 2) verdict = 'bonus';
  else verdict = 'ok';
  if (verdict === 'bonus') s.cash += 10_000;

  return { stars, delta: s.confidence - before, correct, total: qs.length, notes, verdict, mandate: mandateFor(m.month) };
}

export const occTarget = (s) => OCC_TARGET[loc(s).id];
