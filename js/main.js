// Entry point: title screen and navigation between screens.

import { h } from './util.js';
import { loadGame, saveGame } from './store.js';
import { app, mount, sfx, saveSettingsNow, modal } from './ui/core.js';
import { hotelSvg } from './ui/hotel.js';
import { startPrologue } from './ui/prologue.js';
import { renderGame, setNav } from './ui/game.js';
import { renderBoard, setBoardNav } from './ui/board.js';
import { renderBook, setBookRedraw } from './ui/book.js';
import { renderParent } from './ui/parent.js';
import { discover } from './engine/lessons.js';

const nav = {
  title: () => titleScreen(),
  game: () => renderGame(),
  board: () => renderBoard(),
  book: () => { const back = () => renderGame(); setBookRedraw(() => renderBook(back)); renderBook(back); },
  parent: () => renderParent(() => titleScreen()),
  saveSettings: () => saveSettingsNow(),
  newYear: () => newYear(),
};
setNav(nav);
setBoardNav(nav);

function titleScreen() {
  const saved = app.s || loadGame();
  if (saved) app.s = saved;
  const scene = h('div', { class: 'title-scene' }, hotelSvg(saved, { mode: 'title', name: saved?.hotelName || 'La Directora' }));
  scene.firstChild.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  mount(h('div', { class: 'title-screen' },
    scene,
    h('div', { class: 'title-content' },
      h('div', { class: 'logo' }, h('span', null, 'BAHÍA LUNAR'), 'La Directora'),
      h('p', { class: 'title-sub' }, saved
        ? `${saved.hotelName} te espera. El Consejo quiere resultados.`
        : 'Dirige tu propio hotel. Toma decisiones, cuida a tu equipo y rinde cuentas al Consejo.'),
      h('div', { class: 'title-actions' },
        saved && saved.phase !== 'closed'
          ? h('button', { class: 'btn btn-primary btn-big', onclick: () => { sfx('tap'); renderGame(); } }, '▶ Continuar')
          : null,
        h('button', { class: `btn ${saved ? 'btn-ghost' : 'btn-primary btn-big'}`, onclick: () => newGame(!!saved) }, saved ? 'Nueva partida' : '🔑 Empezar')),
      h('div', { class: 'title-foot' },
        h('button', { class: 'btn btn-ghost', style: { minHeight: '40px', fontSize: '14px' }, onclick: () => nav.parent() }, '🔒 Panel del Consejo')))));
}

async function newGame(hasSave) {
  if (hasSave) {
    const ok = await modal((close) => h('div', { class: 'msg-card' },
      h('div', { class: 'quote', style: { fontSize: '24px' } }, '¿Empezar un hotel nuevo?'),
      h('p', { class: 'meaning' }, 'Tu hotel actual se cierra. Tus lecciones, insignias y diario se quedan contigo.'),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, 'Sí, empezar de nuevo'),
      h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, 'Cancelar')), { dismissable: true });
    if (!ok) return;
    return newYear();
  }
  app.s = { lessons: {}, inbox: [], day: 0 };
  startPrologue(onPrologueDone);
}

function newYear() {
  const old = app.s;
  const carry = { year: (old.year || 1) + 1, lessons: old.lessons, diary: old.diary, badges: old.badges || [], stars: old.stars || {} };
  app.s = { lessons: old.lessons, inbox: [], day: 0 };
  discover(app.s, 'practica');
  startPrologue(onPrologueDone, carry);
}

function onPrologueDone(s) {
  s.inbox.push(...(app.prologueInbox || []));
  saveGame(s);
  renderGame();
}

// Offline support when served over http(s).
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

titleScreen();
