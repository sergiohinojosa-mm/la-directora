// Tablero de Directoras: friendly competition between players on this device and on others.
// With Familia en línea the whole family appears on its own; without it, results can still travel
// as a link (WhatsApp, Mensajes…).

import { h } from '../util.js';
import { profiles, loadGameOf, currentProfile, rivals, addRivals, removeRival } from '../store.js';
import { summary, encode, decode, RECORDS, leaders } from '../engine/ranking.js';
import { LOCATIONS } from '../data/world.js';
import { mount, modal, toast, sfx, confetti } from './core.js';
import { playerAvatar } from './avatar.js';
import { cloudOn, syncPlayers } from '../cloud.js';

const STARS = ['☆☆☆', '★☆☆', '★★☆', '★★★'];

// Players on this device use their saved game; family players never opened here (or that went
// further on another device) use the summary the cloud keeps.
function everyone() {
  const local = profiles().map((p) => {
    const s = loadGameOf(p.id);
    const fromCloud = p.sum && (!s || (p.cloudVer || 0) > (p.ver || 0));
    return { ...(fromCloud ? { ...p.sum, n: p.name, k: p.look } : summary(p, s)), here: !p.synced || !!s, family: !!p.synced };
  });
  const uids = new Set(local.map((r) => r.u));
  return [...local, ...rivals().filter((r) => !uids.has(r.u))];
}

const names = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}` : list[0] || '');
const monthOf = (r) => (r.d ? Math.floor((r.d - 1) / 28) + 1 : 0);
const placeName = (id) => LOCATIONS.find((l) => l.id === id)?.name || '';
const ago = (t) => {
  const d = Math.floor((Date.now() - t) / 86_400_000);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};

export function renderRanking(back) {
  const me = currentProfile();
  const draw = () => {
    const list = everyone();
    const mine = list.find((r) => r.u === me?.uid);
    mount(h('div', { class: 'page ranking' },
      h('div', { class: 'page-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'Volver', onclick: back }, '←'),
        h('h2', null, 'Tablero de Directoras')),
      h('p', { class: 'muted-dark' }, 'Aquí no gana quien tiene más dinero: comparamos el mismo mes de cada hotel y qué tanto cumplió cada una la meta de su Consejo. Así es justo aunque tengan hoteles distintos o vayan en meses distintos.'),
      cloudOn()
        ? h('p', { class: 'rk-cloud' }, '☁️ Conectado con tu familia: los resultados de todas se actualizan solos.')
        : h('div', { class: 'rk-share' },
          h('button', { class: 'btn btn-primary', onclick: share }, '📤 Mandar mis resultados'),
          h('button', { class: 'btn btn-secondary', onclick: async () => { if (await paste()) draw(); } }, '📥 Pegar resultados')),
      players(list, draw),
      list.length < 2 ? h('div', { class: 'card rk-empty' },
        h('b', null, 'Todavía estás sola en el tablero'),
        h('p', null, cloudOn()
          ? 'Cuando alguien más de tu familia cree su jugadora en cualquier dispositivo conectado, aparecerá aquí.'
          : 'Manda tus resultados al chat de la familia. Cuando las demás abran tu enlace, te verán; y cuando ellas te manden el suyo, aparecerán aquí.')) : null,
      h('h3', { class: 'rk-title' }, '🏆 Récords de la familia'),
      h('div', { class: 'rk-records' }, RECORDS.map((rec) => recordCard(rec, list, mine))),
      h('h3', { class: 'rk-title' }, '📅 Mes contra mes'),
      monthTable(list),
      mine ? personal(mine) : null));
  };
  draw();
  if (cloudOn()) syncPlayers().then(() => { if (document.querySelector('.ranking')) draw(); }).catch(() => {});
}

function players(list, redraw) {
  return h('div', { class: 'rk-players' }, list.map((r) => h('div', { class: 'rk-player' },
    playerAvatar('mini', r.k, { badge: false }),
    h('div', null,
      h('b', null, r.n),
      h('small', null, r.h ? `${r.h} · ${placeName(r.l)} · Mes ${monthOf(r)}` : 'Todavía sin hotel'),
      h('small', null, r.family ? (r.t ? `☁️ Jugó ${ago(r.t)}` : '☁️ Familia en línea') : r.here ? 'En este dispositivo' : `Resultados de ${ago(r.t)}`)),
    r.here || r.family ? null : h('button', { class: 'rk-remove', 'aria-label': `Quitar a ${r.n} del tablero`, onclick: async () => {
      const ok = await modal((close) => h('div', { class: 'msg-card' },
        h('div', { class: 'quote', style: { fontSize: '22px' } }, `¿Quitar a ${r.n} del tablero?`),
        h('p', { class: 'meaning' }, 'Solo se quita de este dispositivo. Vuelve a aparecer si te manda sus resultados otra vez.'),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, 'Sí, quitar'),
        h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, 'Cancelar')), { dismissable: true });
      if (ok) { removeRival(r.u); redraw(); }
    } }, '✕'))));
}

function recordCard(rec, list, mine) {
  const { best, who } = leaders(rec, list);
  const myVal = mine ? rec.value(mine) : null;
  const iLead = who.some((r) => r.u === mine?.u);
  return h('div', { class: `card rk-record ${iLead ? 'mine' : ''}` },
    h('div', { class: 'rk-rec-head' }, h('span', { class: 'rk-ic' }, rec.icon), h('div', null, h('b', null, rec.name), h('small', null, rec.hint))),
    who.length
      ? h('div', { class: 'rk-leader' },
        h('div', { class: 'rk-faces' }, who.slice(0, 3).map((r) => playerAvatar('mini', r.k, { badge: false }))),
        h('div', null, h('b', null, names(who.map((r) => r.n))), h('small', null, rec.fmt(best))))
      : h('p', { class: 'muted' }, 'Todavía nadie. ¡Puede ser tuyo!'),
    myVal != null && who.length && !iLead ? h('small', { class: 'rk-mine' }, `Tu mejor: ${rec.fmt(myVal)}`) : null,
    iLead && list.length > 1 ? h('small', { class: 'rk-mine' }, '👑 ¡Es tuyo!') : null);
}

function monthTable(list) {
  const withMonths = list.filter((r) => r.m.length);
  if (!withMonths.length) return h('p', { class: 'muted-dark' }, 'Cuando alguien cierre su primer mes, aparecerá aquí.');
  const max = Math.max(...withMonths.map((r) => r.m[r.m.length - 1][0]));
  const rows = [];
  for (let month = 1; month <= max; month++) {
    const cells = withMonths.map((r) => r.m.find((x) => x[0] === month));
    const played = cells.filter(Boolean);
    const top = played.length > 1 ? Math.max(...played.map((x) => x[1] * 1000 + x[2])) : null;
    rows.push(h('tr', null,
      h('th', { scope: 'row' }, month === 13 ? 'Año 2' : month > 13 ? `A2 · ${month - 12}` : `Mes ${month}`),
      cells.map((x) => h('td', { class: x && top != null && x[1] * 1000 + x[2] === top ? 'top' : '' },
        x ? [h('span', { class: 'rk-stars', 'aria-label': `${x[1]} estrellas` }, STARS[x[1]]), h('small', null, `${x[2]}% meta`)] : h('span', { class: 'muted' }, '·')))));
  }
  return h('div', { class: 'card rk-table-wrap' },
    h('table', { class: 'rk-table' },
      h('thead', null, h('tr', null, h('th', null, ''), withMonths.map((r) => h('th', { scope: 'col' }, playerAvatar('mini', r.k, { badge: false }), h('span', null, r.n))))),
      h('tbody', null, rows)),
    h('small', { class: 'muted' }, '👑 El fondo dorado marca el mejor resultado de ese mes: primero las estrellas, luego el % de la meta.'));
}

// Her own progress: beating yourself counts as much as beating the others.
function personal(mine) {
  if (!mine.m.length) return null;
  const last = mine.m[mine.m.length - 1];
  const before = mine.m.slice(0, -1);
  const prevBest = before.length ? before.reduce((a, x) => (x[2] > a[2] ? x : a)) : null;
  const text = !prevBest
    ? `Cerraste tu primer mes con ${last[2]}% de la meta. Ese es tu récord para superar.`
    : last[2] > prevBest[2]
      ? `¡Nuevo récord personal! En el Mes ${last[0]} llegaste a ${last[2]}% de la meta (antes: ${prevBest[2]}% en el Mes ${prevBest[0]}).`
      : `Tu mejor mes sigue siendo el Mes ${prevBest[0]} con ${prevBest[2]}% de la meta. El último: ${last[2]}%. ¿Lo superas este mes?`;
  return h('div', { class: 'card rk-personal' }, h('b', null, '🪞 Tu mejor marca'), h('p', null, text));
}

async function share() {
  sfx('tap');
  const here = profiles().map((p) => summary(p, loadGameOf(p.id))).filter((r) => r.h);
  if (!here.length) return toast('Primero abre tu hotel para tener resultados.');
  const url = `${location.origin}${location.pathname}#r=${encode(here)}`;
  const names = here.map((r) => r.n).join(', ');
  const text = `🏨 Resultados de La Directora (${names}). Ábrelo para verlos en tu Tablero de Directoras:`;
  if (navigator.share) {
    try { await navigator.share({ title: 'La Directora', text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Copiado. Pégalo en el chat de la familia.'); return; } catch { /* no clipboard */ }
  await modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'quote', style: { fontSize: '22px' } }, 'Copia este enlace'),
    h('textarea', { class: 'text-input', readonly: true, onfocus: (e) => e.target.select() }, url),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, 'Listo')), { dismissable: true });
}

// For when the game is installed on the home screen: a link opens in the browser instead, so she
// can paste the message here.
async function paste() {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch { /* ask instead */ }
  if (!decode(text)) {
    text = await modal((close) => {
      const area = h('textarea', { class: 'text-input', placeholder: 'Pega aquí el mensaje o el enlace', 'aria-label': 'Resultados' });
      setTimeout(() => area.focus(), 80);
      return h('div', { class: 'msg-card' },
        h('div', { class: 'quote', style: { fontSize: '22px' } }, 'Pegar resultados'),
        h('p', { class: 'meaning' }, 'Copia el mensaje que te mandaron por WhatsApp y pégalo aquí.'),
        area,
        h('button', { class: 'btn btn-primary btn-block', onclick: () => close(area.value) }, 'Agregar al tablero'),
        h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(null) }, 'Cancelar'));
    }, { dismissable: true });
    if (text == null) return false;
  }
  return importResults(text);
}

// Adds results from a message or link. Returns true if someone new or newer arrived.
export function importResults(text) {
  const list = decode(text);
  if (!list) { toast('Ese mensaje no trae resultados de La Directora.'); return false; }
  const added = addRivals(list);
  if (!added.length) { toast('Esos resultados ya estaban en tu tablero.'); return false; }
  sfx('fanfare');
  confetti(0.5);
  toast(`¡Llegaron los resultados de ${names(added.map((r) => r.n))}!`);
  return true;
}
