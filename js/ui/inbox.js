// Shows queued messages one by one: new lessons (with the family's audio), applied/mastered
// lessons, badges and rank-ups.

import { h } from '../util.js';
import { LESSON_BY_ID } from '../data/lessons.js';
import { BADGE_BY_ID, RANKS } from '../data/badges.js';
import { UNLOCKS } from './hotel.js';
import { CHALLENGE_BY_ID, challengeText } from '../data/challenges.js';
import { money } from '../util.js';
import { app } from './core.js';
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
    // Several rewards at once become one "Logros" card instead of a chain of pop-ups.
    const isReward = (m) => m.kind === 'badge' || m.kind === 'challenge' || m.kind === 'rank';
    if (isReward(item)) {
      const group = [item];
      for (let i = 0; i < s.inbox.length;) {
        const m = s.inbox[i];
        if (isReward(m) && (!onlyRewards || !isLesson(m))) group.push(...s.inbox.splice(i, 1));
        else i++;
      }
      if (group.length > 1) { save?.(); await rewards(group); continue; }
    }
    if (item.kind === 'new') await lessonNew(item.id, item.ctx);
    else if (item.kind === 'applied' || item.kind === 'mastered') await lessonLevel(item.id, item.kind, item.ctx);
    else if (item.kind === 'badge') await badge(item.badge);
    else if (item.kind === 'rank') await rankUp(item.rank);
    else if (item.kind === 'challenge') await challengeWon(item.id);
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

function rewards(group) {
  sfx('fanfare');
  confetti(1.1);
  const row = (icon, title, text) => h('div', { class: 'reward-row' }, h('span', { class: 'ric' }, icon), h('div', null, h('b', null, title), h('small', null, text)));
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'from' }, '¡Nuevos logros!'),
    h('div', { class: 'reward-list' }, group.map((m) => {
      if (m.kind === 'badge') { const b = BADGE_BY_ID[m.badge]; return row(b.icon, `Insignia: ${b.name}`, b.desc); }
      if (m.kind === 'challenge') { const c = CHALLENGE_BY_ID[m.id]; return row(c.icon, `Reto cumplido: ${c.title}`, `Premio: ${money(c.reward)} para el hotel`); }
      return row('🎖️', `Nuevo rango: ${m.rank}`, `Tu hotel se mejoró: ${UNLOCKS[RANKS.findIndex((r) => r.name === m.rank)] || ''}`);
    })),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, '¡Genial!')));
}

function challengeWon(id) {
  const c = CHALLENGE_BY_ID[id];
  sfx('fanfare');
  confetti(0.8);
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'badge-big' }, c.icon),
    h('div', { class: 'from' }, 'Reto semanal cumplido'),
    h('div', { class: 'quote' }, c.title),
    h('p', { class: 'meaning' }, challengeText(c, app.s)),
    h('div', { class: 'tip-box' }, h('b', null, '🎁 Premio del Consejo: '), `${money(c.reward)} para el hotel y 1 punto de carrera.`),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, '¡Lo logré!'),
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
    h('div', { class: 'tip-box' }, h('b', null, '🏗️ Tu hotel se mejoró: '), UNLOCKS[RANKS.findIndex((r) => r.name === name)] || ''),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, '¡Vamos!'),
  ));
}
