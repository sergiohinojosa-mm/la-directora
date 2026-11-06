// Panel del Consejo (for the family): PIN-protected progress, Luciana's diary and the audio checklist.

import { h, money, pct, dateLabel } from '../util.js';
import { LESSONS, LEVELS, CHAPTER_NAMES } from '../data/lessons.js';
import { BOARD } from '../data/world.js';
import { rank } from '../data/badges.js';
import { loadGame, deleteGame } from '../store.js';
import { app, mount, modal, avatar, hasAudio, saveSettingsNow, toast } from './core.js';

export function renderParent(back) {
  if (!app.settings.pin) return pinScreen(back, true);
  return pinScreen(back, false);
}

function pinScreen(back, creating) {
  const inputs = Array.from({ length: 4 }, (_, i) => h('input', {
    inputmode: 'numeric', maxlength: 1, 'aria-label': `Dígito ${i + 1}`, autocomplete: 'off',
    oninput: (e) => { e.target.value = e.target.value.replace(/\D/g, ''); if (e.target.value && inputs[i + 1]) inputs[i + 1].focus(); check(); },
  }));
  const msg = h('p', { class: 'muted', style: { minHeight: '1.4em' } });
  const check = () => {
    const pin = inputs.map((x) => x.value).join('');
    if (pin.length < 4) return;
    if (creating) { app.settings.pin = pin; saveSettingsNow(); toast('PIN guardado'); panel(back); }
    else if (pin === app.settings.pin) panel(back);
    else { msg.textContent = 'PIN incorrecto.'; inputs.forEach((x) => (x.value = '')); inputs[0].focus(); }
  };
  mount(h('div', { class: 'page', style: { maxWidth: '480px' } },
    h('div', { class: 'page-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Volver', onclick: back }, '←'), h('h2', null, 'Panel del Consejo')),
    h('div', { class: 'card stack', style: { textAlign: 'center' } },
      h('div', { class: 'row', style: { justifyContent: 'center' } }, avatar('papa', 'sm'), avatar('alma', 'sm'), avatar('marcela', 'sm')),
      h('h3', null, creating ? 'Crea un PIN de 4 dígitos' : 'Escribe el PIN'),
      h('p', { class: 'muted' }, creating ? 'Solo para el Consejo. Luciana no lo debe saber.' : 'Esta sección es solo para el Consejo.'),
      h('div', { class: 'pin' }, inputs),
      msg)));
  setTimeout(() => inputs[0].focus(), 50);
}

function panel(back) {
  const s = app.s || loadGame();
  let tab = 'progress';
  const draw = () => mount(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Volver', onclick: back }, '←'), h('h2', null, 'Panel del Consejo')),
    h('div', { class: 'tabs' },
      ['progress:📈 Progreso', 'diary:📓 Diario', 'audio:🎙️ Audios', 'settings:⚙️ Ajustes'].map((t) => {
        const [id, label] = t.split(':');
        return h('button', { class: `tab ${tab === id ? 'on' : ''}`, onclick: () => { tab = id; draw(); } }, label);
      })),
    tab === 'progress' ? progress(s) : tab === 'diary' ? diary(s) : tab === 'audio' ? audios(s) : settings(back)));
  draw();
}

function progress(s) {
  if (!s) return h('div', { class: 'card' }, 'Luciana todavía no empieza a jugar.');
  const last = s.months[s.months.length - 1];
  const r = rank(s);
  const lv = (n) => Object.values(s.lessons).filter((l) => l.level >= n).length;
  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' },
      h('h3', null, `${s.hotelName} · Año ${s.year}`),
      h('div', { class: 'pl' },
        ln('Hoy en el juego', dateLabel(s.day)),
        ln('Rango', `${r.name} (${r.pts} puntos)`),
        ln('Caja', money(s.cash)),
        ln('Reseñas', s.reputation.toFixed(2) + '★'),
        ln('Ánimo del equipo', Math.round(s.morale)),
        ln('Confianza del Consejo', Math.round(s.confidence)),
        ln('Rescates del Consejo', s.rescues),
        ln('Insignias', (s.badges || []).length),
        ln('Lecciones descubiertas / aplicadas / dominadas', `${lv(1)} / ${lv(2)} / ${lv(3)}`))),
    last ? h('div', { class: 'card stack' },
      h('h3', null, `Último mes cerrado (mes ${last.month})`),
      h('div', { class: 'pl' }, ln('Ganancia', money(last.profit)), ln('Ingresos', money(last.revenue)), ln('Cuartos llenos', pct(last.occupancy)), ln('Huéspedes perdidos por limpieza', last.lostDirty)),
      h('p', { class: 'muted', style: { fontSize: '14px' } }, 'Idea para la junta real: pídele que te explique por qué la ganancia fue así y qué cambiaría el próximo mes.')) : null,
    h('div', { class: 'card stack' },
      h('h3', null, 'Lecciones'),
      LESSONS.filter((l) => s.lessons[l.id]).map((l) => h('div', { class: 'row between' }, h('span', null, `“${l.phrase}”`), h('b', null, LEVELS[s.lessons[l.id].level])))));
}

function diary(s) {
  const entries = (s?.diary || []).slice().reverse();
  if (!entries.length) return h('div', { class: 'card' }, 'Todavía no hay entradas. Al final de cada semana del juego, Luciana puede escribir una reflexión.');
  return h('div', { class: 'stack' }, entries.map((d) => h('div', { class: 'card stack' },
    h('small', { class: 'muted' }, `Año ${d.year} · Semana ${d.week}`), h('b', null, d.q), h('p', null, d.answer))));
}

function audios() {
  const done = LESSONS.filter((l) => hasAudio(l.id)).length;
  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' },
      h('h3', null, `Audios grabados: ${done} de ${LESSONS.length}`),
      h('p', null, 'Cada quien graba sus lecciones en la grabadora. Al terminar, mándenle los archivos a Sergio para subirlos al juego.'),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, Object.keys(BOARD).map((who) =>
        h('a', { class: 'btn btn-secondary', href: `grabar.html?quien=${who}`, target: '_blank', rel: 'noopener' }, `🎙️ ${BOARD[who].name}`)))),
    Object.keys(BOARD).map((who) => h('div', { class: 'stack' },
      h('h3', { style: { fontSize: '20px' } }, `${BOARD[who].name}`),
      LESSONS.filter((l) => l.by === who).map((l) => h('div', { class: 'audio-row' },
        avatar(who, 'sm'),
        h('div', null, h('div', { class: 'q' }, `“${l.phrase}”`), h('small', null, `${CHAPTER_NAMES[l.chapter]} · ${l.when}`)),
        h('span', { class: 'has-audio', style: { color: hasAudio(l.id) ? 'var(--good)' : 'var(--ink-2)' } }, hasAudio(l.id) ? '✓ Grabado' : 'Falta'))))));
}

function settings(back) {
  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' },
      h('h3', null, 'Cambiar PIN'),
      h('p', { class: 'muted' }, 'El PIN solo protege este panel. Luciana juega sin él.'),
      h('button', { class: 'btn btn-secondary', onclick: () => { app.settings.pin = null; saveSettingsNow(); renderParent(back); } }, 'Crear un PIN nuevo en este dispositivo')),
    h('div', { class: 'card stack' },
      h('h3', null, 'Borrar la partida'),
      h('p', { class: 'muted' }, 'Borra el hotel, las lecciones, las insignias y el diario. No se puede deshacer.'),
      h('button', { class: 'btn btn-primary', onclick: async () => {
        const ok = await modal((close) => h('div', { class: 'msg-card' },
          h('div', { class: 'quote', style: { fontSize: '24px' } }, '¿Borrar todo el progreso?'),
          h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, 'Sí, borrar'),
          h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, 'Cancelar')), { dismissable: true });
        if (ok) { deleteGame(); app.s = null; toast('Partida borrada'); back(); }
      } }, 'Borrar la partida')));
}

function ln(label, value) {
  return h('div', { class: 'ln' }, h('span', null, label), h('b', null, value));
}
