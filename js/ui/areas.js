// The business-area tabs on the morning screen: one per chapter (team, sales, service,
// restaurant, hotel, competition, big bet). Settings stay until she changes them.

import { h, money, pct, calendar } from '../util.js';
import { act, train } from '../engine/flow.js';
import { chapterFor } from '../data/chapters.js';
import {
  WAGES, wageInfo, trainCost, canTrain, MAX_SKILL, recruitCost, quitChance,
  SOCIAL, OTA_FEE, OTA_BOOST, ALLIANCE, CLUB, potRev,
  CANCEL, POWER, MENUS, BUY, OFFERS, offerAvailable, activeOffers, restaurantInvestment, restaurantStaff, menuCheck, avgRef,
  MAINT, INSURANCE, CONTROLS_COST, ISH, ISR,
  UNIQUE, uniqueCost, compSteal, chainPrice,
  PROJECTS, projectAvailable, projectEstimate, paybackMonths, newLoanPayment, goodPayer, BANK_RATE, BANK_RATE_NEGOTIATED, BANK_MONTHS, SOCIO_SHARE,
  managerCost,
} from '../engine/systems.js';
import { refEff, roomsOf, season } from '../engine/sim.js';
import { planVotes } from '../engine/board.js';
import { sfx, toast, modal } from './core.js';

const k = (s, f) => Math.round((potRev(s) * f) / 10) * 10;

// Segmented control: one row of choices.
function seg(options, current, onPick) {
  return h('div', { class: 'seg-ctl', role: 'radiogroup' }, options.map((o, i) => h('button', {
    class: current === (o.value ?? i) ? 'on' : '', role: 'radio', 'aria-checked': current === (o.value ?? i),
    onclick: () => { sfx('tap'); onPick(o.value ?? i); },
  }, h('b', null, o.label), o.sub ? h('small', null, o.sub) : null)));
}

function sw(on, label, sub, onChange, disabled) {
  return h('label', { class: `toggle ${disabled ? 'disabled' : ''}` },
    h('input', { type: 'checkbox', checked: on, disabled, onchange: (e) => { sfx('tap'); onChange(e.target.checked); } }),
    h('span', null, h('b', null, label), sub ? [h('br'), h('small', { class: 'muted' }, sub)] : null));
}

const card = (kicker, ...kids) => h('div', { class: 'card stack' }, h('span', { class: 'kicker' }, kicker), ...kids);
const fact = (label, value, cls = '') => h('div', { class: 'ln' }, h('span', null, label), h('b', { class: cls }, value));
const last7 = (s) => s.history.slice(-7);

// A banner on top of each area: what she decides here and its key number.
function hero(s, id) {
  const d = last7(s);
  const sum = (f) => d.reduce((a, r) => a + (f(r) || 0), 0);
  const info = {
    equipo: ['👥', 'Equipo', 'Cuánto pagas, cuánto capacitas y si alguien se va.', `Ánimo ${Math.round(s.morale)}/100`, s.morale >= 60],
    ventas: ['📣', 'Ventas', 'Dónde te anuncias y cuánto te cuesta cada huésped.', `Publicidad y comisiones: ${money(sum((r) => r.costs.marketing + r.costs.commission))} en 7 días`, true],
    servicio: ['🛎️', 'Servicio', 'Tus reglas y qué puede resolver recepción.', `Quejas sin resolver: ${sum((r) => r.complaints - r.resolved)} en 7 días`, sum((r) => r.complaints - r.resolved) <= 2],
    restaurante: ['🍽️', 'Restaurante', 'Comida y extras para tus huéspedes.', s.rest.open ? `Le quedó ${money(sum((r) => r.rest ? r.rest.revenue - r.rest.food - r.rest.staff : 0))} en 7 días` : 'Todavía cerrado', !s.rest.open || sum((r) => r.rest ? r.rest.revenue - r.rest.food - r.rest.staff : 0) >= 0],
    hotel: ['🔧', 'Hotel', 'Mantenimiento, seguro, impuestos y la caja.', `Estado ${Math.round(s.maint.condition ?? 100)}/100`, (s.maint.condition ?? 100) >= 70],
    competencia: ['🆚', 'Competencia', 'GlobalStay, tus precios y lo que te hace única.', `GlobalStay te quita ${pct(compSteal(s))} de clientes`, compSteal(s) < 0.06],
    plan: ['💼', 'Gran apuesta', 'El proyecto que presentarás al Consejo.', s.plan.status === 'done' ? 'Terminada ✅' : s.plan.status === 'building' ? 'En obra 🏗️' : s.plan.project ? 'En preparación' : 'Sin elegir', true],
  }[id];
  if (!info) return null;
  const [icon, name, what, kpi, ok] = info;
  return h('div', { class: `area-hero a-${id}` },
    h('span', { class: 'ah-icon', 'aria-hidden': 'true' }, icon),
    h('div', null, h('b', null, name), h('small', null, what)),
    h('span', { class: `ah-kpi ${ok ? 'ok' : 'warn'}` }, kpi));
}

export function areaPanel(s, id, redraw, save) {
  const run = (what, v) => { act(s, what, v); save(); redraw(); };
  return [hero(s, id), {
    equipo: () => equipo(s, run, redraw, save),
    ventas: () => ventas(s, run),
    servicio: () => servicio(s, run),
    restaurante: () => restaurante(s, run),
    hotel: () => hotelArea(s, run),
    competencia: () => competencia(s, run),
    plan: () => plan(s, run),
  }[id]()];
}

// ---------------- Equipo ----------------
function equipo(s, run, redraw, save) {
  const w = wageInfo(s);
  const quits = s.team.quits.filter((d) => d > s.day - 28).length;
  const risk = quitChance(s);
  return [
    card('Sueldos',
      h('p', { class: 'muted' }, 'Pagar más cuesta cada día, pero el equipo está más contento y casi nadie renuncia.'),
      seg(WAGES.map((x) => ({ value: x.v, label: x.name, sub: `${money(480 * x.v)}/día por persona` })), s.team.wage, (v) => run('wage', v)),
      h('div', { class: 'pl' },
        fact('Ánimo normal con este sueldo', `${w.morale}/100`),
        fact('Riesgo de que alguien renuncie hoy', risk > 0.05 ? 'Alto 🔴' : risk > 0.015 ? 'Medio 🟡' : 'Bajo 🟢'),
        fact('Renuncias en los últimos 28 días', String(quits), quits ? 'neg' : ''))),
    card('Capacitación',
      h('div', { class: 'skill' }, Array.from({ length: MAX_SKILL }, (_, i) => h('span', { class: i < s.team.skill ? 'on' : '' }, '🎓'))),
      h('p', { class: 'muted' }, `Cada nivel hace que tu equipo limpie 6% más rápido y atienda mejor, para siempre. Hoy limpiarían menos por estar en el curso.`),
      h('button', { class: 'btn btn-secondary btn-block', disabled: !canTrain(s), onclick: () => {
        if (train(s)) { sfx('coin'); save(); toast(`Equipo capacitado: nivel ${s.team.skill}. Hoy limpian menos.`, 3200); redraw(); }
      } }, s.team.skill >= MAX_SKILL ? '🎓 Equipo con capacitación máxima' : canTrain(s) ? `🎓 Capacitar hoy (${money(trainCost(s))})` : `🎓 Próxima capacitación en ${7 - (s.day - s.team.lastTrain)} días`)),
    card('Contratar',
      h('p', { class: 'muted' }, `Buscar, entrevistar y entrenar a alguien nuevo cuesta ${money(recruitCost(s))}. Los primeros 5 días aprende y limpia más lento. Contrata desde la pestaña Hoy.`)),
    chapterFor(s) >= 9 ? card('Gerente',
      h('p', { class: 'muted' }, `Un gerente maneja la limpieza, las horas extra y las contrataciones por ti. Cuesta ${money(managerCost(s))} al día. Tú sigues respondiendo por los resultados.`),
      sw(s.manager, s.manager ? 'Tienes gerente' : 'Contratar gerente', 'Puedes quitarlo cuando quieras.', (v) => run('manager', v))) : null,
  ];
}

// ---------------- Ventas ----------------
function ventas(s, run) {
  const days = last7(s).filter((r) => r.channels);
  const sum = (f) => days.reduce((a, r) => a + f(r), 0);
  const names = { directo: '🏨 Directo', agencia: '🌐 Agencias', redes: '📱 Redes', alianzas: '🤝 Alianzas', club: '💌 Club' };
  const rows = Object.keys(names).map((c) => {
    const b = sum((r) => r.channels.bookings[c]);
    const cost = sum((r) => r.channels.cost[c]);
    return { c, b, cost, cpb: b >= 0.5 ? cost / b : null };
  }).filter((x) => x.b >= 0.5 || x.cost > 0);
  return [
    card('Canales de venta',
      sw(s.mkt.ota, `🌐 Agencias en línea (+${pct(OTA_BOOST)} de gente)`, `Cobran ${pct(OTA_FEE)} de cada reserva que llega por ellas. Tip: los días llenos no las necesitas.`, (v) => run('ota', v)),
      h('div', null, h('b', null, '📱 Redes sociales'), h('br'), h('small', { class: 'muted' }, 'Pagas cada día. Anunciar mucho no trae el doble de gente.')),
      seg(SOCIAL.map((x) => ({ label: x.name, sub: x.cost ? `${money(k(s, x.cost))}/día · +${pct(x.boost)}` : 'Gratis' })), s.mkt.social, (v) => run('social', v)),
      sw(s.mkt.alliance, `🤝 Alianzas con empresas y tours (+${pct(ALLIANCE.boost)} lunes a jueves)`, `${money(k(s, ALLIANCE.cost))} al día, todos los días.`, (v) => run('alliance', v)),
      sw(s.mkt.club, '💌 Club de huéspedes frecuentes', `${pct(CLUB.discount)} de descuento a quienes regresan. Más reservas directas, menos por agencia.`, (v) => run('club', v))),
    card('¿Cuánto te costó cada reserva? (últimos 7 días)',
      rows.length ? h('div', { class: 'chan-table' },
        h('div', { class: 'ct-row head' }, h('span', null, 'Canal'), h('span', null, 'Reservas'), h('span', null, 'Costo'), h('span', null, 'Por reserva')),
        rows.map((x) => h('div', { class: 'ct-row' }, h('span', null, names[x.c]), h('span', null, x.b.toFixed(0)), h('span', null, money(x.cost)), h('b', null, x.cpb == null ? '—' : money(x.cpb)))))
        : h('p', { class: 'muted' }, 'Aquí verás cuánto te cuesta conseguir cada huésped por cada canal, después de unos días.')),
  ];
}

// ---------------- Servicio ----------------
function servicio(s, run) {
  const days = last7(s);
  const complaints = days.reduce((a, r) => a + (r.complaints || 0), 0);
  const resolved = days.reduce((a, r) => a + (r.resolved || 0), 0);
  const cancels = days.reduce((a, r) => a + (r.cancels || 0), 0);
  return [
    card('Política de cancelación',
      seg(Object.entries(CANCEL).map(([id, c]) => ({ value: id, label: c.name })), s.policy.cancel, (v) => run('cancel', v)),
      h('p', { class: 'muted' }, CANCEL[s.policy.cancel].note)),
    card('¿Cuánto puede hacer recepción sin preguntarte?',
      h('p', { class: 'muted' }, 'Cuando un huésped se queja, Kevin puede resolverlo en el momento… si tú le das permiso.'),
      seg(POWER.map((p, i) => ({ label: ['Nada', 'Un detalle', 'Descuento'][i], sub: i ? `~${money(avgRef(s) * p.cost)} por queja` : 'Gratis' })), s.policy.power, (v) => run('power', v)),
      h('small', { class: 'muted' }, POWER[s.policy.power].name)),
    card('Últimos 7 días',
      h('div', { class: 'pl' },
        fact('Quejas', String(complaints)),
        fact('Resueltas por recepción', String(resolved), resolved ? 'pos' : ''),
        fact('Sin resolver (malas reseñas)', String(complaints - resolved), complaints - resolved ? 'neg' : ''),
        fact('Cancelaciones de último momento', String(cancels)))),
  ];
}

// ---------------- Restaurante ----------------
function restaurante(s, run) {
  const days = last7(s).filter((r) => r.rest);
  const sum = (f) => days.reduce((a, r) => a + f(r), 0);
  const restCard = !s.rest.open
    ? card('Restaurante',
      h('p', null, 'Un restaurante atrae gente de fuera y sube tus reseñas, pero la chef, los meseros y los ingredientes cuestan todos los días.'),
      h('div', { class: 'pl' },
        fact('Inversión para abrir', money(restaurantInvestment(s))),
        fact('Chef y meseros', `${money(restaurantStaff(s))}/día`),
        fact('Cuenta promedio por comensal', money(menuCheck(s, 1)))),
      h('button', { class: 'btn btn-primary btn-block', disabled: s.cash < restaurantInvestment(s), onclick: async () => {
        const ok = await modal((close) => h('div', { class: 'msg-card' },
          h('div', { class: 'quote', style: { fontSize: '24px' } }, '¿Abrir el restaurante?'),
          h('p', { class: 'meaning' }, `Pagas ${money(restaurantInvestment(s))} hoy y ${money(restaurantStaff(s))} cada día de sueldos, haya o no comensales.`),
          h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, 'Sí, abrirlo'),
          h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, 'Todavía no')), { dismissable: true });
        if (ok) { run('openRestaurant'); sfx('fanfare'); toast('¡Restaurante abierto! 🍽️'); }
      } }, s.cash < restaurantInvestment(s) ? 'No te alcanza la caja' : `👩‍🍳 Abrir restaurante (${money(restaurantInvestment(s))})`))
    : card('Restaurante',
      h('div', null, h('b', null, 'Menú')),
      seg(MENUS.map((m, i) => ({ label: m.name, sub: `${money(menuCheck(s, i))} por persona` })), s.rest.menu, (v) => run('menu', v)),
      h('small', { class: 'muted' }, ['Barato de preparar, atrae poca gente de fuera.', 'Buen equilibrio entre precio y sabor.', 'Atrae mucha gente de fuera y sube tus reseñas; los ingredientes cuestan más.'][s.rest.menu]),
      h('div', null, h('b', null, '¿Cuánta comida compras cada día?')),
      seg(BUY.map((b) => ({ label: b.name })), s.rest.buy, (v) => run('buy', v)),
      h('small', { class: 'muted' }, ['Si vienen muchos, se acaba y se van sin comer.', 'Lo que esperas según el pronóstico.', 'Nunca se acaba, pero lo que sobra se tira.'][s.rest.buy]),
      days.length ? h('div', { class: 'pl' },
        fact('Comensales (7 días)', String(sum((r) => r.rest.served))),
        fact('Ventas', money(sum((r) => r.rest.revenue))),
        fact('Ingredientes', `−${money(sum((r) => r.rest.food))}`),
        fact('Chef y meseros', `−${money(sum((r) => r.rest.staff))}`),
        fact('Comida tirada', money(sum((r) => r.rest.waste)), sum((r) => r.rest.waste) > 0 ? 'neg' : ''),
        fact('Se fueron sin comer', String(sum((r) => r.rest.turnedAway)), sum((r) => r.rest.turnedAway) ? 'neg' : ''),
        fact('Le quedó al restaurante', money(sum((r) => r.rest.revenue - r.rest.food - r.rest.staff)))) : null);
  const n = activeOffers(s).length;
  return [
    restCard,
    card('Venta cruzada: extras para tus huéspedes',
      h('p', { class: 'muted' }, 'Es la venta más barata: el huésped ya está aquí. Pero si le ofreces todo a la vez, se fastidia.'),
      Object.entries(OFFERS).map(([id, o]) => sw(!!s.offers[id], `${o.icon} ${o.name} (${money(avgRef(s) * o.price)})`, offerAvailable(s, id) ? o.note : id === 'upgrade' ? 'Tu hotel solo tiene un tipo de cuarto.' : 'Tu hotel ya incluye desayuno.', (v) => run('offer', { id, on: v }), !offerAvailable(s, id))),
      n > 2 ? h('div', { class: 'alert bad' }, '⚠️ Estás ofreciendo muchas cosas a la vez: compran menos y califican peor.') : null),
  ];
}

// ---------------- Hotel (mantenimiento, impuestos, controles) ----------------
function hotelArea(s, run) {
  const cond = Math.round(s.maint.condition ?? 100);
  const lowSoon = [1, 2, 3].map((i) => season(s, s.day + i * 28));
  return [
    card('Estado del hotel',
      h('div', { class: 'meter big' }, h('i', { style: { width: cond + '%', background: cond >= 70 ? 'var(--good)' : cond >= 50 ? '#D98E04' : 'var(--bad)' } })),
      h('div', { class: 'row between' }, h('b', null, `${cond}/100`), h('small', { class: 'muted' }, cond >= 70 ? 'En buena forma' : cond >= 50 ? 'Algo se puede descomponer' : '¡Riesgo alto de fallas!')),
      h('p', { class: 'muted' }, 'Cada noche con huéspedes desgasta el hotel. Con poco mantenimiento, las cosas fallan en el peor momento.'),
      seg(MAINT.map((m) => ({ label: m.name, sub: m.cost ? `${money(k(s, m.cost))}/día` : 'Gratis' })), s.maint.level, (v) => run('maint', v)),
      sw(s.maint.insurance, `🛡️ Seguro del hotel (${money(k(s, INSURANCE.cost))}/día)`, `Paga ${pct(INSURANCE.covers)} de las reparaciones grandes.`, (v) => run('insurance', v))),
    card('Caja y controles',
      sw(s.maint.controls, `🔐 Corte de caja diario (${money(k(s, CONTROLS_COST))}/día)`, 'Cada noche se cuenta el efectivo y se firma. Sin esto, el dinero se puede perder sin que nadie lo note.', (v) => run('controls', v))),
    card('Impuestos',
      h('div', { class: 'pl' },
        fact('Impuesto al hospedaje', `${pct(ISH)} de cada noche vendida`),
        fact('Impuesto sobre la ganancia', `${pct(ISR)} de la ganancia del mes (día 28)`))),
    card('Temporada',
      h('div', { class: 'season' }, lowSoon.map((v, i) => h('div', { class: 'sbar' }, h('i', { style: { height: Math.round(v * 60) + 'px', background: v < 0.95 ? '#5FA8D3' : '#FFC24B' } }), h('small', null, `+${i + 1} mes`)))),
      h('small', { class: 'muted' }, lowSoon.some((v) => v < 0.95) ? '🍂 Viene temporada baja: guarda dinero ahora.' : '☀️ Vienen meses buenos.')),
  ];
}

// ---------------- Competencia ----------------
function competencia(s, run) {
  const std = roomsOf(s)[0];
  const opts = UNIQUE[s.locationId];
  return [
    card('GlobalStay',
      h('div', { class: 'pl' },
        fact('Su precio hoy (cuarto estándar)', money(chainPrice(s))),
        fact('Tu precio hoy', money(s.prices[std.id])),
        fact('Clientes que te quita', pct(compSteal(s)))),
      h('small', { class: 'muted' }, 'Te quita sobre todo clientes que buscan precio. Con una experiencia única y reseñas de 4.2★ o más te quita menos.')),
    card('Experiencia única',
      s.comp.unique
        ? h('div', { class: 'alert good' }, `✅ ${opts.find(([id]) => id === s.comp.unique)?.[1] || 'Tu experiencia única'}: tus huéspedes no la encuentran en GlobalStay.`)
        : [h('p', { class: 'muted' }, `Algo que solo tu hotel ofrece. Cuesta ${money(uniqueCost(s))} una vez.`),
          opts.map(([id, label]) => h('button', { class: 'option', disabled: s.cash < uniqueCost(s), onclick: () => { run('unique', id); sfx('fanfare'); toast('¡Nueva experiencia única!'); } }, h('b', null, label)))]),
    card('Precios automáticos',
      sw(s.comp.auto.on, '🤖 Ajustar precios solos cada mañana', 'Según el pronóstico. Tú puedes cambiarlos después.', (v) => run('auto', { on: v })),
      h('div', null, h('small', null, 'Días con más gente que cuartos: subir')),
      seg([0.05, 0.15, 0.25].map((v) => ({ value: v, label: `+${pct(v)}` })), s.comp.auto.up, (v) => run('auto', { up: v })),
      h('div', null, h('small', null, 'Días flojos: bajar')),
      seg([0, 0.1, 0.2].map((v) => ({ value: v, label: v ? `−${pct(v)}` : 'Nada' })), s.comp.auto.down, (v) => run('auto', { down: v }))),
    card('Sobreventa',
      h('p', { class: 'muted' }, `Algunos huéspedes cancelan a última hora (${pct(CANCEL[s.policy.cancel].rate)} con tu política). Si vendes cuartos de más, cubres esas cancelaciones… pero si llegan todos, alguien se queda sin cuarto.`),
      seg([0, 1, 2].map((v) => ({ value: v, label: v ? `+${v} ${v === 1 ? 'cuarto' : 'cuartos'}` : 'No sobrevender' })), s.comp.overbook, (v) => run('overbook', v))),
    card('Tus números de directora',
      (() => {
        const d = last7(s);
        const sold = d.reduce((a, r) => a + r.soldTotal, 0);
        const roomRev = d.reduce((a, r) => a + (r.roomRevenue ?? r.revenue), 0);
        const avail = d.reduce((a, r) => a + r.rooms, 0);
        return h('div', { class: 'pl' },
          fact('ADR: lo que cobras en promedio por cuarto vendido', sold ? money(roomRev / sold) : '—'),
          fact('RevPAR: lo que gana cada cuarto, lleno o vacío', avail ? money(roomRev / avail) : '—'),
          h('small', { class: 'muted' }, 'RevPAR = precio promedio × % de cuartos llenos. Sube si cobras más o si llenas más.'));
      })()),
  ];
}

// ---------------- Gran apuesta ----------------
function plan(s, run) {
  if (s.plan.status === 'building') return [card('Obra en construcción', h('div', { class: 'alert info' }, `🏗️ ${PROJECTS[s.plan.project].name}: lista en ${s.plan.readyDay - s.day} días.`))];
  if (s.plan.status === 'done') return [card('Tu gran apuesta', h('div', { class: 'alert good' }, `✅ ${PROJECTS[s.plan.project].name} ya está funcionando.`))];
  const last = s.months[s.months.length - 1] || { revenue: potRev(s) * 15 };
  const votes = s.plan.project && s.plan.funding ? planVotes(s, last) : null;
  return [
    s.plan.status === 'rejected' ? h('div', { class: 'alert bad' }, '🗳️ El Consejo rechazó tu plan. Ajústalo y preséntalo en la próxima junta.') : null,
    card('1 · Elige el proyecto',
      Object.entries(PROJECTS).map(([id, p]) => {
        const ok = projectAvailable(s, id);
        const est = projectEstimate(s, id);
        const pb = paybackMonths(s, id);
        return h('button', { class: `option ${s.plan.project === id ? 'sel' : ''}`, disabled: !ok, onclick: () => run('project', id) },
          h('b', null, `${p.icon} ${p.name}`),
          h('small', { class: 'muted' }, ok ? p.note : 'Ya tienes spa.'),
          ok ? h('div', { class: 'fx' }, h('span', { class: 'q' }, `Cuesta ${money(p.cost(s))}`), h('span', { class: est > 0 ? 'up' : 'dn' }, `Deja ~${money(est)}/mes`), h('span', { class: pb <= 30 ? 'up' : 'dn' }, pb === Infinity ? 'No se recupera' : `Se recupera en ${pb} meses`)) : null);
      })),
    s.plan.project ? card('2 · ¿Con qué dinero?',
      h('button', { class: `option ${s.plan.funding === 'caja' ? 'sel' : ''}`, onclick: () => run('funding', 'caja') },
        h('b', null, '💰 Con la caja del hotel'), h('small', { class: 'muted' }, `Tienes ${money(s.cash)}. No debes nada, pero la caja se vacía.`)),
      h('button', { class: `option ${s.plan.funding === 'banco' ? 'sel' : ''}`, onclick: () => run('funding', 'banco') },
        h('b', null, `🏦 Préstamo del banco (${((s.plan.negotiated ? BANK_RATE_NEGOTIATED : BANK_RATE) * 100).toFixed(1).replace('.0', '')}% de interés al año, ${BANK_MONTHS} meses)`),
        h('small', { class: 'muted' }, `El interés es lo que el banco te cobra por prestarte. Pagarías ${money(newLoanPayment(s, PROJECTS[s.plan.project].cost(s)))} más al mes.`)),
      s.plan.funding === 'banco' && !s.plan.negotiated ? h('button', { class: 'btn btn-secondary btn-block', onclick: () => {
        if (goodPayer(s)) { run('negotiate', true); sfx('good'); toast('El banco aceptó: como siempre pagaste a tiempo, te bajó la tasa.', 3800); } else { sfx('bad'); toast('El banco dice que primero quiere ver 3 mensualidades pagadas a tiempo.', 3800); }
      } }, '🤝 Pedirle al banco que te cobre menos interés') : null,
      h('button', { class: `option ${s.plan.funding === 'socio' ? 'sel' : ''}`, onclick: () => run('funding', 'socio') },
        h('b', null, '🤵 Don Rodrigo como socio (pone el dinero)'), h('small', { class: 'muted' }, `Él pone todo el dinero, pero se lleva ${pct(SOCIO_SHARE)} de la ganancia de cada mes, para siempre.`))) : null,
    votes ? card('3 · Lo que revisará cada consejero',
      [['alma', 'Abuela Alma', votes.alma], ['marcela', 'Mamá Marcela', votes.marcela], ['rodrigo', 'Don Rodrigo', votes.rodrigo]].map(([, n, v]) => h('div', { class: `vote ${v.yes ? 'yes' : 'no'}` }, h('b', null, `${v.yes ? '👍' : '👎'} ${n}`), h('small', null, v.why))),
      h('div', { class: 'vote' }, h('b', null, '❓ Papá'), h('small', null, 'Te va a preguntar en cuántos meses se recupera la inversión. Haz la cuenta: costo ÷ ganancia del mes.')),
      h('div', { class: 'alert info' }, '🗳️ Necesitas 3 de 4 votos. Lo presentas en la próxima junta del Consejo.')) : null,
  ];
}
