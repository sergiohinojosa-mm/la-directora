// Libro de Lecciones: lesson cards (by level), badges and career rank.

import { h } from '../util.js';
import { LESSONS, CHAPTER_NAMES, LEVELS } from '../data/lessons.js';
import { BADGES, RANKS, rank } from '../data/badges.js';
import { BOARD } from '../data/world.js';
import { saveGame } from '../store.js';
import { app, mount, modal, avatar, audioPlayer, sfx } from './core.js';

let tab = 'lessons';

export function renderBook(back) {
  const s = app.s;
  const discovered = LESSONS.filter((l) => (s.lessons[l.id]?.level ?? 0) > 0).length;
  const r = rank(s);
  const draw = () => {
    mount(h('div', { class: 'page' },
      h('div', { class: 'page-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'Volver al hotel', onclick: back }, '←'),
        h('h2', null, 'Mi Libro de Directora')),
      h('div', { class: 'tabs', role: 'tablist' },
        tabBtn('lessons', `📖 Lecciones ${discovered}/${LESSONS.length}`),
        tabBtn('badges', `🏅 Insignias ${(s.badges || []).length}/${BADGES.length}`),
        tabBtn('career', `🎖️ ${r.name}`),
        tabBtn('diary', '📓 Diario')),
      tab === 'lessons' ? lessons(s) : tab === 'badges' ? badges(s) : tab === 'diary' ? diary(s) : career(s)));
  };
  const tabBtn = (id, label) => h('button', { class: `tab ${tab === id ? 'on' : ''}`, role: 'tab', 'aria-selected': tab === id, onclick: () => { tab = id; sfx('tap'); draw(); } }, label);
  draw();
}

function lessons(s) {
  const groups = {};
  for (const l of LESSONS) (groups[l.chapter] ||= []).push(l);
  return h('div', { class: 'stack', style: { gap: '20px' } },
    h('p', { class: 'muted-dark' }, 'Cada lección tiene 3 niveles: Descubierta (la viviste), Aplicada (la usaste en una decisión) y Dominada (la usaste 3 veces: carta dorada).'),
    Object.entries(groups).map(([ch, list]) => h('div', { class: 'stack' },
      h('h3', { style: { fontSize: '20px' } }, CHAPTER_NAMES[ch]),
      h('div', { class: 'lesson-grid' }, list.map((l) => {
        const st = s.lessons[l.id];
        const lv = st?.level ?? 0;
        return h('button', { class: `lcard l${lv}`, onclick: () => lv && openLesson(s, l) , disabled: !lv, 'aria-label': lv ? l.phrase : 'Lección por descubrir' },
          h('div', { class: 'row between' }, avatar(l.by, 'sm'), st && !st.seen ? h('span', { class: 'level-pill', style: { background: '#FFE8E4', color: '#9E2E1F' } }, 'Nueva') : h('span', { class: 'level-pill' }, LEVELS[lv])),
          h('div', { class: 'q' }, lv ? `“${l.phrase}”` : '¿ ? ?'),
          h('small', { class: lv ? 'muted' : 'muted-dark' }, lv ? `${BOARD[l.by].name} · ${'●'.repeat(lv)}${'○'.repeat(3 - lv)}` : 'Sigue jugando para descubrirla'));
      })))));
}

function openLesson(s, l) {
  s.lessons[l.id].seen = true;
  saveGame(s);
  const st = s.lessons[l.id];
  modal((close) => {
    const player = audioPlayer(l.id);
    return h('div', { class: 'msg-card' },
      avatar(l.by),
      h('div', { class: 'from' }, BOARD[l.by].name),
      h('div', { class: 'quote' }, `“${l.phrase}”`),
      player,
      h('p', { class: 'meaning' }, l.meaning),
      h('span', { class: 'level-pill' }, `${LEVELS[st.level]} · aplicada ${st.applied} ${st.applied === 1 ? 'vez' : 'veces'}`),
      st.level < 3 ? h('p', { class: 'muted', style: { fontSize: '14px' } }, st.level === 1 ? 'Úsala en una decisión real para que suba a Aplicada.' : `Aplícala ${3 - st.applied} ${3 - st.applied === 1 ? 'vez' : 'veces'} más para dominarla.`) : null,
      h('button', { class: 'btn btn-primary btn-block', onclick: () => { player?.stop(); close(); renderBookAgain(); } }, 'Cerrar'));
  }, { dismissable: true }).then(() => renderBookAgain());
}

let renderBookAgain = () => {};
export function setBookRedraw(fn) { renderBookAgain = fn; }

function diary(s) {
  const entries = (s.diary || []).slice().reverse();
  if (!entries.length) return h('div', { class: 'card' }, 'Al final de cada semana puedes escribir aquí lo que aprendiste. Tus notas te ayudan a preparar la junta con el Consejo.');
  return h('div', { class: 'stack' }, entries.map((d) => h('div', { class: 'card stack' },
    h('small', { class: 'muted' }, `Año ${d.year} · Semana ${d.week}`), h('b', null, d.q), h('p', null, d.answer))));
}

function badges(s) {
  const got = new Set(s.badges || []);
  return h('div', { class: 'badge-grid' }, BADGES.map((b) => h('div', { class: `bcard ${got.has(b.id) ? 'got' : 'locked'}` },
    h('div', { class: 'ic' }, b.icon), h('b', null, got.has(b.id) ? b.name : '???'), h('small', null, b.desc))));
}

function career(s) {
  const r = rank(s);
  const progress = r.next ? (r.pts - r.points) / (r.next.points - r.points) : 1;
  const stars = Object.values(s.monthStars || {}).reduce((a, b) => a + b, 0);
  return h('div', { class: 'stack', style: { gap: '16px' } },
    h('div', { class: 'card-dark card stack' },
      h('div', { class: 'row between' }, h('h3', null, r.name), h('b', { class: 'num' }, `${r.pts} puntos`)),
      h('div', { class: 'rank-bar' }, h('i', { style: { width: Math.round(progress * 100) + '%' } })),
      h('small', { class: 'muted-dark' }, r.next ? `Te faltan ${r.next.points - r.pts} puntos para ${r.next.name}.` : '¡Llegaste al rango más alto!'),
      h('div', { class: 'ranks' }, RANKS.map((x, i) => h('span', { class: i < r.index ? 'done' : i === r.index ? 'now' : '' }, x.name)))),
    h('div', { class: 'card stack' },
      h('b', null, 'Cómo ganas puntos'),
      h('div', { class: 'pl' },
        h('div', { class: 'ln' }, h('span', null, '🏅 Cada insignia'), h('b', null, '1 punto')),
        h('div', { class: 'ln' }, h('span', null, '⭐ Cada estrella del Consejo'), h('b', null, '2 puntos')),
        h('div', { class: 'ln' }, h('span', null, '✅ Cada lección aplicada (y dominada)'), h('b', null, '1 punto por nivel'))),
      h('div', { class: 'pl' },
        h('div', { class: 'ln' }, h('span', null, 'Estrellas ganadas'), h('b', null, stars)),
        h('div', { class: 'ln' }, h('span', null, 'Año como Directora'), h('b', null, s.year)))));
}
