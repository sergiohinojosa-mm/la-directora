// Chapter openings: the story card that introduces each new area of the business,
// and the year-close screen with the annual report and the diploma.

import { h, money, pct } from '../util.js';
import { CHAPTERS, AREAS } from '../data/chapters.js';
import { BOARD } from '../data/world.js';
import { yearSummary } from '../engine/board.js';
import { modal, avatar, sfx, confetti } from './core.js';
import { playerAvatar } from './avatar.js';
import { currentProfile, playerName } from '../store.js';

export function chapterIntro(s, ch) {
  const c = CHAPTERS[ch];
  const area = AREAS.find((a) => a.ch === ch);
  sfx('fanfare');
  confetti(0.6);
  return modal((close) => h('div', { class: 'msg-card chapter-card' },
    h('div', { class: 'chapter-num' }, ch === 9 ? 'Año 2' : `Capítulo ${ch}`),
    h('div', { class: 'chapter-icon', 'aria-hidden': 'true' }, c.icon),
    h('div', { class: 'quote' }, c.title),
    h('div', { class: 'row', style: { alignItems: 'flex-start', textAlign: 'left' } },
      avatar(c.by, 'sm'),
      h('div', null, h('b', null, BOARD[c.by].name), c.story.map((p) => h('p', { class: 'meaning', style: { margin: '4px 0 0' } }, p)))),
    h('div', { class: 'unlock-list' },
      h('small', null, '🔓 Lo nuevo'),
      c.unlocks.map(([icon, text]) => h('div', { class: 'unlock' }, h('span', null, icon), h('p', null, text)))),
    area ? h('div', { class: 'tip-box' }, h('b', null, `${area.icon} Nueva pestaña: ${area.name}. `), 'La encuentras arriba de tus decisiones de cada mañana.') : null,
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, '¡Vamos!')));
}

export function yearClose(s) {
  const y = yearSummary(s);
  sfx('fanfare');
  confetti(1.6);
  return modal((close) => h('div', { class: 'msg-card year-card' },
    h('div', { class: 'chapter-num' }, `Cierre del año ${Math.ceil(s.day / 336)}`),
    playerAvatar('big', currentProfile()?.look),
    h('div', { class: 'diploma' },
      h('small', null, 'El Consejo de Grupo Bahía Corasol otorga este reconocimiento a'),
      h('div', { class: 'quote' }, `${playerName()}, Directora General`),
      h('small', null, `por dirigir ${s.hotelName} durante un año completo.`)),
    h('div', { class: 'pl' },
      h('div', { class: 'ln' }, h('span', null, 'Ingresos del año'), h('b', null, money(y.revenue))),
      h('div', { class: 'ln' }, h('span', null, 'Ganancia del año'), h('b', { style: { color: y.profit >= 0 ? 'var(--good)' : 'var(--bad)' } }, money(y.profit))),
      h('div', { class: 'ln' }, h('span', null, 'Cuartos llenos en promedio'), h('b', null, pct(y.occupancy))),
      h('div', { class: 'ln' }, h('span', null, 'Precio promedio (ADR)'), h('b', null, money(y.adr))),
      h('div', { class: 'ln' }, h('span', null, 'Reseñas al cierre'), h('b', null, y.reputation.toFixed(1) + '★')),
      h('div', { class: 'ln' }, h('span', null, 'Estrellas del Consejo'), h('b', null, `${y.stars} de 36`)),
      y.bestMonth ? h('div', { class: 'ln' }, h('span', null, 'Mejor mes'), h('b', null, `Mes ${y.bestMonth.month} · ${money(y.bestMonth.profit)}`)) : null,
      h('div', { class: 'ln' }, h('span', null, 'Lecciones · doradas'), h('b', null, `${y.lessons} · ${y.mastered}`))),
    h('div', { class: 'row', style: { alignItems: 'flex-start', textAlign: 'left' } }, avatar('papa', 'sm'),
      h('p', { class: 'meaning', style: { margin: 0 } }, h('b', null, 'Papá: '), 'Hace un año no sabías qué era un Consejo. Hoy le presentas números, defiendes a tu equipo y convences inversionistas. Estoy muy orgulloso de ti.')),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, '🚀 Empezar el Año 2')));
}
