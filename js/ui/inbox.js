// Shows queued messages one by one: new lessons (with the family's audio), applied/mastered
// lessons, badges and rank-ups.

import { h } from '../util.js';
import { LESSON_BY_ID } from '../data/lessons.js';
import { BADGE_BY_ID } from '../data/badges.js';
import { BOARD } from '../data/world.js';
import { modal, avatar, audioPlayer, confetti, sfx, hasAudio } from './core.js';

export async function drainInbox(s, save) {
  while (s.inbox.length) {
    const item = s.inbox.shift();
    save?.();
    if (item.kind === 'new') await lessonNew(item.id);
    else if (item.kind === 'applied' || item.kind === 'mastered') await lessonLevel(item.id, item.kind);
    else if (item.kind === 'badge') await badge(item.badge);
    else if (item.kind === 'rank') await rankUp(item.rank);
  }
}

export function lessonNew(id) {
  const l = LESSON_BY_ID[id];
  const who = BOARD[l.by];
  sfx('bell');
  return modal((close) => {
    const player = audioPlayer(id, { autoplay: true });
    return h('div', { class: 'msg-card' },
      avatar(l.by),
      h('div', { class: 'from' }, `Mensaje de ${who.name}`),
      h('div', { class: 'quote' }, `“${l.phrase}”`),
      player || h('p', { class: 'muted', style: { fontSize: '13px' } }, hasAudio(id) ? '' : `${who.name} todavía no graba este mensaje.`),
      h('p', { class: 'meaning' }, l.meaning),
      h('span', { class: 'level-pill' }, '📖 Nueva carta en tu Libro de Lecciones'),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => { player?.stop(); close(); } }, 'Lo tengo'),
    );
  });
}

function lessonLevel(id, kind) {
  const l = LESSON_BY_ID[id];
  const mastered = kind === 'mastered';
  sfx(mastered ? 'fanfare' : 'good');
  if (mastered) confetti(1);
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'badge-big' }, mastered ? '🥇' : '✅'),
    h('div', { class: 'from' }, mastered ? 'Lección dominada' : 'Lección aplicada'),
    h('div', { class: 'quote' }, `“${l.phrase}”`),
    h('p', { class: 'meaning' }, mastered
      ? 'La aplicaste tres veces en situaciones distintas. Tu carta ahora es dorada.'
      : 'Lo que aprendiste lo usaste en una decisión real. Tu carta subió de nivel. Aplícala dos veces más para dominarla.'),
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
