// Libro de Lecciones: lesson cards (by level), badges and career rank.

import { h } from '../util.js';
import { LESSONS, CHAPTER_NAMES, LEVELS, lessonMonth } from '../data/lessons.js';
import { BADGES, RANKS, rank, checkBadges } from '../data/badges.js';
import { REVIEW } from '../data/review.js';
import { toReview, reachedMonth, review } from '../engine/lessons.js';
import { BOARD } from '../data/world.js';
import { saveGame } from '../store.js';
import { UNLOCKS } from './hotel.js';
import { app, mount, modal, avatar, audioPlayer, sfx } from './core.js';

let tab = 'lessons';

export function renderBook(back) {
  const s = app.s;
  const discovered = LESSONS.filter((l) => (s.lessons[l.id]?.level ?? 0) > 0).length;
  const r = rank(s);
  // Opening the Libro is how she hears about lessons waiting for review: the 📖 dot goes away.
  if (toReview(s).length && s.reviewNotice !== reachedMonth(s)) { s.reviewNotice = reachedMonth(s); saveGame(s); }
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
  for (const l of LESSONS) (groups[lessonMonth(l)] ||= []).push(l);
  const title = (m, list) => (m === '0' ? 'Prólogo' : m === '13' ? 'Año 2' : `Mes ${m} · ${CHAPTER_NAMES[list[0].chapter]}`);
  const pending = new Set(toReview(s).map((l) => l.id));
  return h('div', { class: 'stack', style: { gap: '20px' } },
    h('p', { class: 'muted-dark' }, 'Cada lección tiene 3 niveles: Descubierta (la viviste o la repasaste con el Consejo), Aplicada (la usaste en una decisión) y Dominada (la usaste 3 veces: carta dorada).'),
    pending.size ? h('div', { class: 'review-banner' }, `📖 ${pending.size === 1 ? 'Tienes 1 lección' : `Tienes ${pending.size} lecciones`} por repasar de meses que ya pasaste. No te tocó vivirlas, pero el Consejo te las cuenta.`) : null,
    Object.entries(groups).map(([month, list]) => h('div', { class: 'stack' },
      h('h3', { style: { fontSize: '20px' } }, title(month, list)),
      h('div', { class: 'lesson-grid' }, list.map((l) => {
        const st = s.lessons[l.id];
        const lv = st?.level ?? 0;
        if (pending.has(l.id)) {
          return h('button', { class: 'lcard review', onclick: () => openReview(s, l), 'aria-label': `Repasar una lección con ${BOARD[l.by].name}` },
            h('div', { class: 'row between' }, avatar(l.by, 'sm'), h('span', { class: 'level-pill review' }, 'Por repasar')),
            h('div', { class: 'q' }, '📖 ¿Qué harías?'),
            h('small', { class: 'muted' }, `${BOARD[l.by].name} te la cuenta`));
        }
        return h('button', { class: `lcard l${lv}`, onclick: () => lv && openLesson(s, l) , disabled: !lv, 'aria-label': lv ? l.phrase : 'Lección por descubrir' },
          h('div', { class: 'row between' }, avatar(l.by, 'sm'), st && !st.seen ? h('span', { class: 'level-pill', style: { background: '#FFE8E4', color: '#9E2E1F' } }, 'Nueva') : h('span', { class: 'level-pill' }, levelName(st))),
          h('div', { class: 'q' }, lv ? `${l.icon} “${l.phrase}”` : '🔒 ¿ ? ?'),
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
      h('div', { class: 'lesson-head' }, avatar(l.by), h('span', { class: 'lesson-icon', 'aria-hidden': 'true' }, l.icon)),
      h('div', { class: 'from' }, BOARD[l.by].name),
      h('div', { class: 'quote' }, `“${l.phrase}”`),
      l.es ? h('div', { class: 'es' }, l.es) : null,
      player,
      h('p', { class: 'meaning' }, l.meaning),
      h('div', { class: 'tip-box' }, h('b', null, '💡 La próxima vez: '), l.tip),
      st.ctx ? h('div', { class: 'why' }, h('b', null, `Cómo la aprendiste (día ${st.day}): `), st.ctx) : null,
      st.reviewed ? h('div', { class: 'why' }, h('b', null, 'Cómo la aprendiste: '), `la repasaste con ${BOARD[l.by].name} (día ${st.day}).`) : null,
      st.lastCtx ? h('div', { class: 'why good' }, h('b', null, 'La última vez que la aplicaste: '), st.lastCtx) : null,
      h('span', { class: 'level-pill' }, `${levelName(st)} · aplicada ${st.applied} ${st.applied === 1 ? 'vez' : 'veces'}`),
      st.level < 3 ? h('p', { class: 'muted', style: { fontSize: '14px' } }, st.level === 1 ? 'Úsala en una decisión real para que suba a Aplicada.' : `Aplícala ${3 - st.applied} ${3 - st.applied === 1 ? 'vez' : 'veces'} más para dominarla.`) : null,
      h('button', { class: 'btn btn-primary btn-block', onclick: () => { player?.stop(); close(); } }, 'Cerrar'));
  }, { dismissable: true }).then(() => renderBookAgain());
}

const levelName = (st) => (st?.reviewed && st.level === 1 ? 'Repasada' : LEVELS[st?.level ?? 0]);

// Repaso del Consejo: she answers "¿Qué harías?" first (trying before being told makes it stick),
// then hears the lesson. Right or wrong, she learns it: the answer only changes the feedback.
function openReview(s, l) {
  const r = REVIEW[l.id];
  const who = BOARD[l.by];
  // The options rotate by lesson, so the right one isn't always in the same place.
  const k = [...l.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;
  const order = [k, (k + 1) % 3, (k + 2) % 3];
  let player = null;
  modal((close) => {
    const body = h('div', { class: 'stack', style: { width: '100%', justifyItems: 'center' } });
    const answer = (i) => {
      const right = i === r.ok;
      review(s, l.id, right);
      checkBadges(s, 'lesson');
      saveGame(s);
      sfx(right ? 'good' : 'tap');
      player = audioPlayer(l.id, { autoplay: true });
      body.replaceChildren(
        h('div', { class: `why ${right ? 'good' : ''}` }, h('b', null, right ? '✅ ¡Exacto! ' : `🤔 La mejor era: ${r.a[r.ok]}. `), r.why),
        h('div', { class: 'quote' }, `${l.icon} “${l.phrase}”`),
        l.es ? h('div', { class: 'es' }, l.es) : null,
        player,
        h('p', { class: 'meaning' }, l.meaning),
        h('div', { class: 'tip-box' }, h('b', null, '💡 La próxima vez: '), l.tip),
        h('p', { class: 'muted', style: { fontSize: '14px' } }, 'Ya está en tu Libro como Repasada. Úsala en una decisión real para que suba a Aplicada.'),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => { player?.stop(); close(); } }, '¡Lista!'));
    };
    body.append(
      h('p', { class: 'review-q' }, r.q),
      h('div', { class: 'review-opts' }, order.map((i) => h('button', { class: 'btn btn-secondary btn-block', onclick: () => answer(i) }, r.a[i]))));
    return h('div', { class: 'msg-card' },
      h('div', { class: 'lesson-head' }, avatar(l.by)),
      h('div', { class: 'from' }, `Repaso con ${who.name} · ¿Qué harías?`),
      body);
  }, { dismissable: true }).then(() => { player?.stop(); renderBookAgain(); });
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
      h('b', null, '🏗️ Tu hotel crece contigo'),
      h('div', { class: 'pl' }, RANKS.map((x, i) => h('div', { class: 'ln' },
        h('span', null, `${i <= r.index ? '✅' : '🔒'} ${x.name}`), h('span', { class: 'muted', style: { textAlign: 'right' } }, UNLOCKS[i]))))),
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
