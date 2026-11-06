// The main play screen: morning decisions, the day animation, the evening report and the weekly report.

import { h, money, pct, calendar, dateLabel, DAYS_SHORT, DAYS, clamp } from '../util.js';
import { loc, preview, forecast, refEff, cleaningCapacity, totalRooms, weekCost } from '../engine/sim.js';
import { resolveEvent, playDay, finishEvening, advanceAfterDay, nextDay, hire, fire } from '../engine/flow.js';
import { EVENT_BY_ID } from '../data/events.js';
import { HOUSEKEEPER_DAILY, ROOMS_PER_HOUSEKEEPER, TRAINING_DAYS } from '../data/world.js';
import { rank } from '../data/badges.js';
import { mandateFor, profitGoalFor, monthProgress } from '../engine/board.js';
import { saveGame } from '../store.js';
import { app, mount, sfx, botones, toast, modal, confetti } from './core.js';
import { hotelSvg, animateDay } from './hotel.js';
import { drainInbox, pendingLessons } from './inbox.js';
import { CHALLENGE_BY_ID, challengeText } from '../data/challenges.js';
import { LESSON_BY_ID } from '../data/lessons.js';
import { reviewFor } from '../data/reviews.js';

let nav = {};
export function setNav(n) { nav = n; }

const save = () => saveGame(app.s);
// replaceChildren/append would print "null" for skipped optional pieces.
const clean = (kids) => kids.flat().filter((k) => k != null && k !== false);
const put = (el, ...kids) => el.replaceChildren(...clean(kids));
const add = (el, ...kids) => el.append(...clean(kids));

const isPhone = () => window.innerWidth < 700;

const KIND = {
  noticia: ['Noticia', '#2EC4C9', '📰'], equipo: ['Equipo', '#E2513E', '🧑‍🤝‍🧑'], operacion: ['Operación', '#D98E04', '🔧'],
  oportunidad: ['Oportunidad', '#1FA971', '✨'], crisis: ['Crisis', '#E2513E', '🚨'], mercado: ['Mercado', '#2EC4C9', '📈'],
};

export function renderGame() {
  const s = app.s;
  if (s.phase === 'board') return nav.board();
  if (s.phase === 'closed') return closedScreen();
  const scene = h('div', { class: 'scene' }, hotelSvg(s, { ...sceneOpts(s), compact: isPhone() }));
  const panel = h('div', { class: 'panel' });
  mount(h('div', { class: 'shell' },
    topbar(s),
    h('div', { class: 'stage' },
      h('div', { class: 'scene-wrap' }, scene, legend(sceneOpts(s).mode === 'evening')),
      panel)));
  if (s.phase === 'morning') morning(s, panel, scene);
  else if (s.phase === 'evening') evening(s, panel);
  else if (s.phase === 'week') week(s, panel);
  else if (s.phase === 'rescue') rescue(s, panel);
  // Lessons come after she reads the evening/week report: experience first, then the lesson.
  const deferLessons = s.phase === 'evening' || s.phase === 'week';
  drainInbox(s, save, { onlyRewards: deferLessons }).then(save);
}

function sceneOpts(s) {
  if (s.phase === 'evening' || s.phase === 'week' || s.phase === 'rescue') return { mode: 'evening', result: s.lastResult };
  return { mode: 'morning' };
}

function legend(night) {
  return h('div', { class: 'scene-caption legend' },
    h('span', null, h('i', { style: { background: night ? '#FFE28A' : '#7FE0B1' } }), night ? 'Ocupado (luz prendida)' : 'Ocupado'),
    h('span', null, h('i', { style: { background: '#FFFFFF' } }), 'Libre y limpio'),
    h('span', null, h('i', { style: { background: '#FFC8C0' } }), 'Por limpiar'));
}

function topbar(s) {
  const r = rank(s);
  const lowCash = s.cash < weekCost(s);
  const newLessons = Object.values(s.lessons).some((l) => !l.seen);
  return h('header', { class: 'topbar' },
    h('div', { class: 'brand' }, h('b', null, s.hotelName), h('small', null, `${r.name} · ${dateLabel(s.day)}`)),
    h('div', { class: 'chips' },
      stat('💰', '#FFC24B', money(s.cash), 'Caja', lowCash),
      stat('⭐', '#2EC4C9', s.reputation.toFixed(1), 'Reseñas'),
      stat(s.morale >= 60 ? '😊' : s.morale >= 45 ? '😐' : '😣', '#4FD69C', Math.round(s.morale), 'Ánimo', s.morale < 45),
      stat('🏛️', '#A78BFA', Math.round(s.confidence), 'Consejo', s.confidence < 30)),
    h('div', { class: 'actions' },
      h('button', { class: 'icon-btn', 'aria-label': 'Libro de Lecciones e insignias', onclick: () => nav.book() }, '📖', newLessons ? h('span', { class: 'dot' }) : null),
      h('button', { class: 'icon-btn', 'aria-label': 'Menú', onclick: () => menu() }, '☰')));
}

function stat(icon, color, value, label, warn) {
  return h('div', { class: `stat ${warn ? 'warn' : ''}` },
    h('span', { class: 'ic', style: { background: color + '33' } }, icon),
    h('div', null, h('b', null, value), h('small', null, label)));
}

async function menu() {
  const choice = await modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'quote', style: { fontSize: '26px' } }, 'Menú'),
    h('button', { class: 'btn btn-secondary btn-block', onclick: () => close('mandate') }, '🎯 Ver el mandato del Consejo'),
    h('button', { class: 'btn btn-secondary btn-block', onclick: () => close('sound') }, app.settings.sound ? '🔊 Sonido: activado' : '🔈 Sonido: apagado'),
    h('button', { class: 'btn btn-secondary btn-block', onclick: () => close('title') }, '🏠 Ir a la portada'),
    h('button', { class: 'btn btn-ghost btn-block', style: { color: 'var(--ink)' }, onclick: () => close(null) }, 'Cerrar'),
  ), { dismissable: true });
  if (choice === 'sound') { app.settings.sound = !app.settings.sound; nav.saveSettings(); toast(app.settings.sound ? 'Sonido activado' : 'Sonido apagado'); }
  if (choice === 'title') nav.title();
  if (choice === 'mandate') showMandate(app.s);
}

export function showMandate(s) {
  const m = mandateFor(calendar(s.day).month);
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'from' }, `Mandato del Consejo · Mes ${calendar(s.day).month}`),
    h('div', { class: 'quote' }, m.title),
    h('p', { class: 'meaning' }, m.text(s)),
    h('p', { class: 'muted', style: { fontSize: '14px' } }, `⭐ Cumplir el mandato · ⭐⭐ y además ganar dinero · ⭐⭐⭐ y además ganar ${money(profitGoalFor(s, calendar(s.day).month))} o más con reseñas de 3.8★`),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, 'Entendido')), { dismissable: true });
}

// ---------------- Morning ----------------
function morning(s, panel, scene) {
  const ev = s.event && s.event.chosen == null ? EVENT_BY_ID[s.event.id] : null;
  if (ev) {
    add(panel, eventCard(s, ev));
    return;
  }
  const L = loc(s);
  const draw = () => {
    const p = preview(s);
    put(panel, 
      header(s),
      progressCard(s),
      s.eventResult ? h('div', { class: 'alert info' }, '📣 ', s.eventResult) : null,
      tip(s, p),
      forecastCard(s),
      pricesCard(s, L, draw),
      staffCard(s, p, draw),
      projectionCard(s, p),
      h('div', { class: 'cta-bar' },
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => openDay(s, panel, scene) }, '☀️ Abrir el día')),
    );
  };
  draw();
}

function header(s) {
  const c = calendar(s.day);
  return h('div', { class: 'row between', style: { padding: '0 4px' } },
    h('div', null,
      h('h2', { style: { fontSize: '26px' } }, `Buenos días, Directora`),
      h('div', { class: 'muted-dark', style: { fontSize: '14px' } }, `${dateLabel(s.day)} · Semana ${c.week} · Día ${c.dayOfMonth} de 28 del mes`)),
    h('button', { class: 'btn btn-ghost', style: { minHeight: '40px', padding: '0 14px', fontSize: '14px' }, onclick: () => showHint(s) }, '💡 Pista'));
}

// On-demand hint: Botones only speaks unasked during the first weeks; after that she asks when stuck.
function showHint(s) {
  const p = preview(s);
  const text = tipText(s, p, true) || 'Todo se ve en orden. Revisa el pronóstico: ¿qué día viene más gente? Ahí está tu oportunidad.';
  sfx('tap');
  return modal((close) => h('div', { class: 'msg-card' },
    botones(text),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, 'Gracias, Botones')), { dismissable: true });
}

function progressCard(s) {
  const c = calendar(s.day);
  const monthDays = s.history.filter((r) => calendar(r.day).month === c.month && Math.ceil(r.day / 28) === Math.ceil(s.day / 28));
  const p = monthProgress(s, monthDays);
  const left = 28 - c.dayOfMonth + 1;
  return h('div', { class: 'card card-dark stack progress-card' },
    h('div', { class: 'row between' },
      h('div', null, h('span', { class: 'kicker' }, `Mandato del mes ${c.month}`), h('h3', null, `🎯 ${p.mandate.title}`)),
      h('div', { class: 'days-left' }, h('b', null, left), h('small', null, left === 1 ? 'día' : 'días'))),
    p.rows.map((r) => h('div', { class: `goal ${r.ok ? 'ok' : ''}` },
      h('span', { class: 'gstars' }, '⭐'.repeat(r.stars)),
      h('div', { class: 'gbody' },
        h('div', { class: 'row between' }, h('small', null, r.label), h('b', null, r.value)),
        h('div', { class: 'gbar' }, h('i', { style: { width: Math.round(Math.max(0, Math.min(1, r.fill)) * 100) + '%' } }))),
      h('span', { class: 'gcheck', 'aria-label': r.ok ? 'Cumplida' : 'Pendiente' }, r.ok ? '✓' : ''))),
    monthDays.length === 0 ? h('small', { class: 'muted-dark' }, 'El Consejo revisa estas metas en la junta del día 28.') : null,
    s.challenge ? challengeRow(s) : null);
}

function challengeRow(s) {
  const c = CHALLENGE_BY_ID[s.challenge.id];
  const daysLeft = 7 - calendar(s.day).dow;
  return h('div', { class: 'challenge' },
    h('span', { class: 'cicon' }, c.icon),
    h('div', null, h('small', null, `Reto de la semana · ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} · premio ${money(c.reward)}`), h('b', null, `${c.title}: `), challengeText(c, s)));
}

function eventCard(s, ev) {
  const [label, color, icon] = KIND[ev.kind] || KIND.noticia;
  sfx('bell');
  return h('div', { class: 'stack', style: { justifyItems: 'center' } },
    h('div', { class: 'event-card' },
      h('div', { class: 'ev-icon', style: { background: color + '22' } }, ev.icon || icon),
      h('div', { class: 'kind', style: { color } }, label),
      h('h3', null, ev.title),
      h('p', null, ev.text),
      ev.options.map((o, i) => h('button', { class: 'option', onclick: () => {
        sfx('tap');
        resolveEvent(s, i);
        save();
        renderGame();
      } },
        h('b', null, o.label),
        o.fx ? h('div', { class: 'fx' }, o.fx.map(([t, c]) => h('span', { class: c }, t))) : null))),
    ev.kind !== 'noticia' ? h('p', { class: 'muted-dark', style: { fontSize: '13px', textAlign: 'center' } }, 'No hay respuesta perfecta. Cada opción tiene un costo.') : null);
}

function tip(s, p) {
  const text = tipText(s, p, false);
  return text ? botones(text) : null;
}

// Returns Botones' advice for this morning. Unprompted advice fades after week 3 (scaffolding);
// when she already learned the saying that fits the situation, Botones reminds her of it instead.
function tipText(s, p, asked) {
  const fcToday = p.forecast.total;
  const rooms = totalRooms(s);
  const L = loc(s);
  const avgRatio = L.rooms.reduce((a, r) => a + s.prices[r.id] / refEff(s, r), 0) / L.rooms.length;
  const early = s.day <= 21 || asked;
  const recall = (id, fallback) => (s.lessons[id]?.level ? `${fallback}<br><b>📖 Recuerda: “${LESSON_BY_ID[id].phrase}”</b>` : fallback);
  if (s.day === 1) return '¡Bienvenida, Directora! Soy <b>Botones</b>. Cada mañana decides <b>precios</b> y <b>limpieza</b>. Mira el pronóstico: entre semana viene menos gente que el fin de semana. Cuando estés lista, toca <b>Abrir el día</b>.';
  if (p.lostDirty > 0) return recall('ejecucion', `Hoy hay <b>${p.dirtyStart} cuartos por limpiar</b> y tu equipo solo puede limpiar <b>${p.capacity}</b>. Un cuarto sucio no se puede vender. ¿Horas extra o contratar?`);
  if (s.cash < weekCost(s)) return recall('cash_king', 'Tu caja está muy baja. Cuida cada gasto y busca días donde puedas ganar más.');
  if (s.morale < 50) return recall('equipo', 'Tu equipo está cansado. Un equipo cansado limpia más lento y atiende peor.');
  if (s.day === 2) return 'Cada cuarto ocupado anoche hay que <b>limpiarlo hoy</b>. Si no alcanza tu equipo, ese cuarto no se vende.';
  if (s.day === 3) return 'Mira el <b>pronóstico</b>: las barras rojas son días con más gente que cuartos. ¿Cobrarías lo mismo esos días?';
  if (s.day === 4) return 'Dato real: en México los hoteles se llenan en promedio <b>60%</b>. Casi nunca están llenos, por eso cada cuarto vendido cuenta.';
  if (s.mods.some((m) => m.label === 'Descuento de Marea Inn' && s.day >= m.from && s.day <= m.to)) return recall('guerra_precios', 'Marea Inn bajó sus precios. ¿Los igualas o defiendes lo que te hace distinta?');
  if (early && fcToday > rooms * 1.05 && avgRatio <= 1.02) return recall('demanda_precio', 'Hoy viene <b>más gente de la que cabe</b>. Cuando hay mucha demanda, un precio un poco más alto puede darte más ganancia.');
  if (early && fcToday < rooms * 0.6 && avgRatio > 1.05) return recall('cuarto_vacio', 'Hoy hay <b>poca demanda</b> y tu precio está alto. Un cuarto vacío esta noche no se puede vender mañana.');
  if (calendar(s.day).dayOfMonth === 28) return recall('palabra', 'Hoy es día de pago al banco. ¿Tienes suficiente en caja?');
  if (s.day === 6) return 'Al final de cada semana verás tu <b>reporte</b>, y al final del mes tendrás <b>junta con el Consejo</b>. ¡Prepárate!';
  return null;
}

function forecastCard(s) {
  const days = Array.from({ length: 7 }, (_, i) => forecast(s, s.day + i));
  const rooms = totalRooms(s);
  const max = Math.max(rooms * 1.4, ...days.map((d) => d.total));
  const labels = [...new Set(days.flatMap((d) => d.labels))];
  return h('div', { class: 'card' },
    h('span', { class: 'kicker' }, 'Pronóstico de 7 días'),
    h('div', { class: 'row between' }, h('h3', null, 'Gente buscando cuarto'), h('small', { class: 'muted' }, `Tienes ${rooms} cuartos`)),
    h('div', { class: 'forecast', role: 'img', 'aria-label': 'Demanda esperada por día' }, days.map((d, i) => {
      const hot = d.total > rooms;
      return h('div', { class: `fbar ${hot ? 'hot' : ''} ${i === 0 ? 'today' : ''}` },
        h('div', { class: 'b', style: { height: Math.max(6, (d.total / max) * 100) + '%' }, title: `${Math.round(d.total)} personas` }),
        h('small', null, i === 0 ? 'Hoy' : DAYS_SHORT[calendar(d.day).dow]));
    })),
    h('div', { class: 'cap-line', style: { marginTop: '6px' } }, '🔴 Más gente que cuartos · 🔵 Menos gente que cuartos (al precio normal)'),
    labels.length ? h('div', { class: 'alert info', style: { marginTop: '8px' } }, '📅 ', labels.join(' · ')) : null);
}

function priceStep(ref) { return ref < 2000 ? 50 : 100; }

function pricesCard(s, L, redraw) {
  return h('div', { class: 'card stack' },
    h('span', { class: 'kicker' }, 'Precios de hoy'),
    L.rooms.map((r) => {
      const ref = refEff(s, r);
      const diff = s.prices[r.id] / ref - 1;
      const cls = diff > 0.05 ? 'hi' : diff < -0.05 ? 'lo' : 'eq';
      const txt = cls === 'eq' ? 'Precio normal' : `${diff > 0 ? '+' : '−'}${Math.round(Math.abs(diff) * 100)}% vs normal`;
      const step = priceStep(r.ref);
      const set = (d) => { s.prices[r.id] = clamp(s.prices[r.id] + d, Math.round(r.ref * 0.4 / step) * step, Math.round(r.ref * 2.5 / step) * step); sfx('tap'); save(); redraw(); };
      return h('div', { class: 'price-row' },
        h('div', { class: 'name' }, h('b', null, r.name), h('small', null, `${r.count} cuarto${r.count > 1 ? 's' : ''} · precio normal ${money(Math.round(ref / 50) * 50)}`), h('br'), h('span', { class: `vs-ref ${cls}` }, txt)),
        h('div', { class: 'stepper' },
          h('button', { 'aria-label': `Bajar precio ${r.name}`, onclick: () => set(-step) }, '−'),
          h('div', { class: 'val' }, money(s.prices[r.id])),
          h('button', { 'aria-label': `Subir precio ${r.name}`, onclick: () => set(step) }, '+')));
    }));
}

function staffCard(s, p, redraw) {
  const cap = cleaningCapacity(s);
  const short = p.dirtyStart > cap.real;
  return h('div', { class: 'card stack' },
    h('span', { class: 'kicker' }, 'Equipo de limpieza'),
    h('div', { class: 'row between' },
      h('div', { class: 'staff' }, Array.from({ length: s.housekeepers }, () => h('div', { class: 'person' }, '🧹'))),
      h('small', { class: 'muted' }, `Cada una limpia ~${ROOMS_PER_HOUSEKEEPER} cuartos por turno · ${money(HOUSEKEEPER_DAILY)} al día`)),
    h('div', { class: `alert ${short ? 'bad' : 'good'}` },
      short ? '⚠️ ' : '✅ ', `Cuartos por limpiar: ${p.dirtyStart}. Tu equipo puede limpiar: ${cap.real}.`),
    h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', id: 'overtime', checked: s.overtime, onchange: (e) => { s.overtime = e.target.checked; save(); redraw(); } }),
      h('span', null, h('b', null, 'Horas extra hoy'), h('br'), h('small', { class: 'muted' }, 'Limpian 40% más. Cuesta 50% más y cansa al equipo.'))),
    h('div', { class: 'row', style: { gap: '8px' } },
      h('button', { class: 'btn btn-secondary', style: { flex: 1 }, onclick: () => { hire(s); sfx('coin'); save(); toast(`Contrataste a una recamarista. Los primeros ${TRAINING_DAYS} días aprende y limpia menos.`, 3500); renderGame(); } }, '＋ Contratar'),
      h('button', { class: 'btn btn-secondary', style: { flex: 1 }, disabled: s.housekeepers <= 1, onclick: async () => {
        const ok = await modal((close) => h('div', { class: 'msg-card' },
          h('div', { class: 'quote', style: { fontSize: '24px' } }, '¿Despedir a una persona?'),
          h('p', { class: 'meaning' }, `Ahorras ${money(HOUSEKEEPER_DAILY)} al día, pero el resto del equipo se preocupa y baja su ánimo.`),
          h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, 'Sí, despedir'),
          h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, 'Mejor no')), { dismissable: true });
        if (ok) { fire(s); sfx('bad'); save(); renderGame(); }
      } }, '− Despedir')));
}

function projectionCard(s, p) {
  return h('div', { class: 'card stack' },
    h('span', { class: 'kicker' }, 'Lo que esperas hoy con estas decisiones'),
    h('div', { class: 'projection' },
      proj('Cuartos vendidos', `${p.sold} de ${p.rooms}`),
      proj('Ingreso esperado', money(p.revenue)),
      proj('Gente que busca', Math.round(p.forecast.total))),
    p.lostDirty > 0 ? h('div', { class: 'alert bad' }, `⚠️ ${p.lostDirty} huésped${p.lostDirty > 1 ? 'es' : ''} se quedaría${p.lostDirty > 1 ? 'n' : ''} sin cuarto por cuartos sucios.`) : null,
    h('small', { class: 'muted' }, 'Es un estimado. El día real puede variar un poco.'));
}

function proj(label, value) {
  return h('div', { class: 'proj' }, h('small', null, label), h('b', null, value));
}

async function openDay(s, panel, scene) {
  sfx('tap');
  const r = playDay(s);
  save();
  put(panel, h('div', { class: 'card stack', style: { textAlign: 'center', justifyItems: 'center' } },
    h('h3', null, 'El día está en marcha…'),
    h('p', { class: 'muted' }, 'Tu equipo limpia y los huéspedes llegan.')));
  const svg = hotelSvg(s, { mode: 'day', result: r, compact: isPhone() });
  scene.replaceChildren(svg);
  scene.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await animateDay(svg, r, s);
  sfx(r.profit >= 0 ? 'coin' : 'bad');
  const float = h('div', { class: `float-money ${r.profit >= 0 ? 'up' : 'down'}` }, `${r.profit >= 0 ? '+' : '−'}${money(Math.abs(r.profit)).replace('−', '')}`);
  scene.append(float);
  await new Promise((res) => setTimeout(res, 1100));
  renderGame();
}

// ---------------- Evening ----------------
function evening(s, panel) {
  const r = s.lastResult;
  const prev = s.history[s.history.length - 2];
  const c = calendar(r.day);
  const isWeekEnd = r.day % 7 === 0;
  const next = pendingLessons(s) ? '📩 Mensaje del Consejo' : r.cash < 0 ? '⚠️ Hablar con el Consejo' : isWeekEnd ? '📊 Ver el reporte de la semana' : '🌙 Siguiente día';
  add(panel, 
    h('div', { style: { padding: '0 4px' } },
      h('h2', { style: { fontSize: '26px' } }, `Cierre del ${DAYS[r.dow].toLowerCase()}`),
      h('div', { class: 'muted-dark', style: { fontSize: '14px' } }, `${dateLabel(r.day)} · Día ${c.dayOfMonth} de 28`)),
    h('div', { class: 'card stack' },
      h('div', { class: 'kpis' },
        kpi('Ganancia del día', money(r.profit), prev ? r.profit - prev.profit : null, money),
        kpi('Cuartos vendidos', `${r.soldTotal}/${r.rooms}`, prev ? r.soldTotal - prev.soldTotal : null, (v) => String(v)),
        kpi('Reseñas', r.reputation.toFixed(2) + '★', r.repDelta, (v) => v.toFixed(2))),
      reviewCard(r),
      h('div', null, h('b', null, '¿Por qué pasó esto?')),
      chainGroup(r.causes, 'good', '✅ Lo que salió bien'),
      chainGroup(r.causes, 'bad', '⚠️ Lo que puedes mejorar'),
      chainGroup(r.causes, 'neutral', '🌤️ Lo que no dependía de ti'),
      h('details', { class: 'more' },
        h('summary', null, 'Ver las cuentas del día ▾'),
        h('div', { class: 'pl', style: { marginTop: '8px' } },
          line('Ingresos por cuartos', r.revenue),
          line('Gastos fijos del hotel', -r.costs.fixed),
          line('Costo por cuarto ocupado', -r.costs.variable),
          line('Sueldos de limpieza', -r.costs.wages),
          r.costs.extra ? line('Gastos extra', -r.costs.extra) : null,
          r.costs.loan ? line('Pago al banco', -r.costs.loan) : null,
          r.costs.promises ? line('Promesa cumplida (uniformes)', -r.costs.promises) : null,
          h('div', { class: 'ln tot' }, h('span', null, 'Ganancia'), h('span', { class: 'num' }, money(r.profit))),
          h('div', { class: 'ln' }, h('span', null, 'Precio promedio cobrado'), h('span', { class: 'num' }, money(r.adr))),
          h('div', { class: 'ln' }, h('span', null, 'Caja al cierre'), h('span', { class: 'num' }, money(r.cash)))))),
    h('div', { class: 'cta-bar' },
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => {
        sfx('tap');
        await drainInbox(s, save);
        finishEvening(s);
        save();
        renderGame();
        window.scrollTo(0, 0);
      } }, next)));
}

function reviewCard(r) {
  if (!r.soldTotal && !r.lostDirty) return null;
  const rv = reviewFor(r);
  return h('div', { class: 'review' },
    h('div', { class: 'rv-head' }, h('span', { class: 'rv-ava' }, rv.who[0]), h('div', null, h('b', null, rv.who), h('small', null, 'Reseña de anoche')), h('span', { class: 'rv-stars' }, '★'.repeat(rv.stars) + '☆'.repeat(5 - rv.stars))),
    h('p', null, `“${rv.text}”`));
}

function chainGroup(causes, tone, title) {
  const list = causes.filter((c) => c.tone === tone);
  if (!list.length) return null;
  return h('div', { class: 'stack', style: { gap: '6px' } },
    h('small', { style: { fontWeight: 800, color: 'var(--ink-2)' } }, title),
    list.map((ch) => h('div', { class: `chain ${ch.tone}` }, ch.steps.flatMap((st, i) => i ? [h('i', null, '→'), h('span', null, st)] : [h('span', null, st)]))));
}

function kpi(label, value, delta, fmt) {
  return h('div', { class: 'kpi' }, h('small', null, label), h('b', null, value),
    delta != null && Math.abs(delta) > 0.004
      ? h('span', { class: `d ${delta > 0 ? 'up' : 'dn'}` }, `${delta > 0 ? '▲' : '▼'} ${fmt(Math.abs(delta))}`)
      : h('span', { class: 'd muted' }, delta == null ? '' : '='));
}

function line(label, v) {
  return h('div', { class: 'ln' }, h('span', null, label), h('span', { class: 'num', style: { color: v < 0 ? 'var(--bad)' : 'inherit' } }, money(v)));
}

// ---------------- Week ----------------
const DIARY_QUESTIONS = [
  '¿Qué decisión de esta semana te dio más miedo?',
  '¿Qué harías distinto si repitieras esta semana?',
  '¿Qué aprendiste de tu equipo esta semana?',
  '¿Qué día salió mejor y por qué crees que fue?',
  'Si fueras huésped de tu hotel, ¿qué cambiarías?',
];

function week(s, panel) {
  const w = s.weeks[s.weeks.length - 1];
  const prev = s.weeks[s.weeks.length - 2];
  const days = s.history.slice(-7);
  const best = days.reduce((a, b) => (b.profit > a.profit ? b : a));
  const worst = days.reduce((a, b) => (b.profit < a.profit ? b : a));
  const q = DIARY_QUESTIONS[(w.week - 1) % DIARY_QUESTIONS.length];
  const existing = s.diary.find((d) => d.year === s.year && d.week === w.week);
  const ta = h('textarea', { class: 'text-input', id: 'diary', placeholder: 'Escribe una o dos líneas (opcional)…', maxlength: 400 }, existing?.answer || '');
  const monthEnd = (w.week * 7) % 28 === 0;
  if (w.profit > 0) confetti(0.5);
  add(panel, 
    h('div', { style: { padding: '0 4px' } },
      h('h2', { style: { fontSize: '26px' } }, `Reporte de la semana ${w.week}`),
      h('div', { class: 'muted-dark', style: { fontSize: '14px' } }, w.profit >= 0 ? '¡Semana con ganancia!' : 'Semana con pérdida. Veamos por qué.')),
    h('div', { class: 'card stack' },
      h('div', { class: 'kpis' },
        kpi('Ganancia', money(w.profit), prev ? w.profit - prev.profit : null, money),
        kpi('Cuartos llenos', pct(w.occupancy), prev ? w.occupancy - prev.occupancy : null, (v) => Math.round(v * 100) + ' pts'),
        kpi('Precio promedio', money(w.adr), prev ? w.adr - prev.adr : null, money)),
      h('div', { class: 'pl' },
        h('div', { class: 'ln' }, h('span', null, '🏆 Mejor día'), h('b', null, `${DAYS[best.dow]} · ${money(best.profit)}`)),
        h('div', { class: 'ln' }, h('span', null, '🌧️ Día más flojo'), h('b', null, `${DAYS[worst.dow]} · ${money(worst.profit)}`)),
        h('div', { class: 'ln' }, h('span', null, '🧹 Huéspedes perdidos por cuartos sucios'), h('b', { style: { color: w.lostDirty ? 'var(--bad)' : 'var(--good)' } }, w.lostDirty)),
        h('div', { class: 'ln' }, h('span', null, '🛏️ Noches de cuarto vacías'), h('b', null, w.emptyNights)),
        h('div', { class: 'ln' }, h('span', null, '⭐ Reseñas'), h('b', null, `${w.repStart.toFixed(2)} → ${w.reputation.toFixed(2)}`)),
        w.challenge ? h('div', { class: 'ln' }, h('span', null, `🎯 Reto: ${CHALLENGE_BY_ID[w.challenge.id].title}`), h('b', { style: { color: w.challenge.won ? 'var(--good)' : 'var(--bad)' } }, w.challenge.won ? '✅ Cumplido' : '❌ No esta vez')) : null)),
    h('div', { class: 'card stack' },
      h('span', { class: 'kicker' }, '📓 Mi diario de Directora'),
      h('b', null, q),
      ta,
      h('small', { class: 'muted' }, 'Tu diario se guarda en tu Libro de Directora.')),
    h('div', { class: 'cta-bar' },
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => {
        await drainInbox(s, save);
        const answer = ta.value.trim();
        s.diary = s.diary.filter((d) => !(d.year === s.year && d.week === w.week));
        if (answer) s.diary.push({ year: s.year, week: w.week, q, answer, day: s.day });
        sfx('tap');
        advanceAfterDay(s);
        save();
        renderGame();
        window.scrollTo(0, 0);
      } }, pendingLessons(s) ? '📩 Mensaje del Consejo' : monthEnd ? '🏛️ Ir a la junta del Consejo' : 'Empezar la semana ' + (w.week + 1))));
}

// ---------------- Rescue & closed ----------------
function rescue(s, panel) {
  add(panel, h('div', { class: 'card stack' },
    h('span', { class: 'kicker', style: { color: 'var(--bad)' } }, 'Junta de emergencia'),
    h('h3', null, 'La caja se quedó sin dinero'),
    h('p', null, 'El Consejo puso dinero de emergencia para que el hotel no cierre. La confianza en ti bajó 20 puntos.'),
    h('p', { class: 'muted' }, 'Si vuelve a pasar, el Consejo cerrará el hotel. Revisa tus precios, tu equipo y tus gastos.'),
    h('div', { class: 'alert info' }, `Nueva caja: ${money(s.cash)}`),
    h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { advanceAfterDay(s); save(); renderGame(); } }, 'Entendido, a recuperarnos')));
}

function closedScreen() {
  const s = app.s;
  mount(h('div', { class: 'page', style: { maxWidth: '640px' } },
    h('div', { class: 'card stack', style: { textAlign: 'center', justifyItems: 'center' } },
      h('div', { class: 'badge-big' }, '🏚️'),
      h('h2', null, `${s.hotelName} cerró`),
      h('p', null, 'El Consejo decidió cerrar el hotel. Es duro, pero muchos grandes empresarios cerraron su primer negocio.'),
      h('p', { class: 'muted' }, 'Tus lecciones, insignias y tu diario se quedan contigo. Con lo que aprendiste, el siguiente hotel te saldrá mejor.'),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => nav.newYear() }, 'Empezar de nuevo con lo aprendido'))));
}
