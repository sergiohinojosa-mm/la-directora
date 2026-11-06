// Shows queued messages one by one: new lessons (with the family's audio), applied/mastered
// lessons, badges and rank-ups.

import { h } from '../util.js';
import { LESSON_BY_ID } from '../data/lessons.js';
import { BADGE_BY_ID } from '../data/badges.js';
import { BOARD } from '../data/world.js';
import { modal, avatar, audioPlayer, confetti, sfx } from './core.js';

const isLesson = (m) => m.kind === 'new' || m.kind === 'applied' || m.kind === 'mastered' || m.afterLesson;
export const pendingLessons = (s) => s.inbox.some(isLesson);

// onlyRewards: show badges/rank now and keep lesson messages for when she has read the report.
export async function drainInbox(s, save, { onlyRewards = false } = {}) {
  while (s.inbox.length) {
    const idx = onlyRewards ? s.inbox.findIndex((m) => !isLesson(m)) : 0;
    if (idx < 0) break;
    const [item] = s.inbox.splice(idx, 1);
    save?.();
    if (item.kind === 'new') await lessonNew(item.id, item.ctx);
    else if (item.kind === 'applied' || item.kind === 'mastered') await lessonLevel(item.id, item.kind, item.ctx);
    else if (item.kind === 'badge') await badge(item.badge);
    else if (item.kind === 'rank') await rankUp(item.rank);
  }
}

export function lessonNew(id, ctx) {
  const l = LESSON_BY_ID[id];
  const who = BOARD[l.by];
  sfx('bell');
  return modal((close) => {
    const player = audioPlayer(id, { autoplay: true });
    return h('div', { class: 'msg-card' },
      h('div', { class: 'lesson-head' }, avatar(l.by), h('span', { class: 'lesson-icon', 'aria-hidden': 'true' }, l.icon)),
      h('div', { class: 'from' }, `Mensaje de ${who.name}`),
      ctx ? h('div', { class: 'why' }, h('b', null, 'Por qué te llega ahora: '), ctx) : null,
      h('div', { class: 'quote' }, `“${l.phrase}”`),
      l.es ? h('div', { class: 'es' }, l.es) : null,
      player,
      h('p', { class: 'meaning' }, l.meaning),
      h('div', { class: 'tip-box' }, h('b', null, '💡 La próxima vez: '), l.tip),
      h('span', { class: 'level-pill' }, '📖 Nueva carta en tu Libro de Lecciones'),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => { player?.stop(); close(); } }, 'Lo tengo'),
    );
  });
}

function lessonLevel(id, kind, ctx) {
  const l = LESSON_BY_ID[id];
  const mastered = kind === 'mastered';
  sfx(mastered ? 'fanfare' : 'good');
  if (mastered) confetti(1);
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'badge-big' }, mastered ? '🥇' : '✅'),
    h('div', { class: 'from' }, mastered ? 'Lección dominada' : 'Lección aplicada'),
    h('div', { class: 'quote' }, `${l.icon} “${l.phrase}”`),
    ctx ? h('div', { class: 'why good' }, h('b', null, 'Lo que hiciste: '), ctx) : null,
    h('p', { class: 'meaning' }, mastered
      ? 'La aplicaste tres veces en situaciones distintas. Tu carta ahora es dorada.'
      : 'Usaste lo que aprendiste en una decisión real. Aplícala dos veces más para dominarla.'),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, mastered ? '¡Dorada!' : 'Seguir'),
  ));
}

function badge(id) {
  const b = BADGE_BY_ID[id];
  sfx('fanfare');
  confetti(0.7);
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'badge-big' }, b.icon),
    h('div', { class: 'from' }, 'Nueva insignia'),
    h('div', { class: 'quote' }, b.name),
    h('p', { class: 'meaning' }, b.desc),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, '¡Genial!'),
  ));
}

function rankUp(name) {
  sfx('fanfare');
  confetti(1.4);
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'badge-big' }, '🎖️'),
    h('div', { class: 'from' }, 'Subiste de rango'),
    h('div', { class: 'quote' }, name),
    h('p', { class: 'meaning' }, 'El Consejo reconoce tu crecimiento como directora. Tu nuevo título ya aparece en tu tarjeta.'),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, '¡Vamos!'),
  ));
}
