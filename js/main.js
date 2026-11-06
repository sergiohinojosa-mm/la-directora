// Entry point: title screen and navigation between screens.

import { h } from './util.js';
import { loadGame, saveGame, profiles, currentProfile, currentId, selectProfile, playerName, wipeAll, familyCode } from './store.js';
import { cloudOn, syncPlayers, pullSave, onConflict, parseCode, joinFamily, flushAll } from './cloud.js';
import { renderRanking, importResults } from './ui/ranking.js';
import { dateLabel, money } from './util.js';
import { app, mount, sfx, saveSettingsNow, modal, toast } from './ui/core.js';
import { hotelSvg } from './ui/hotel.js';
import { startPrologue } from './ui/prologue.js';
import { renderGame, setNav } from './ui/game.js';
import { renderBoard, setBoardNav } from './ui/board.js';
import { renderBook, setBookRedraw } from './ui/book.js';
import { discover } from './engine/lessons.js';
import { LESSONS } from './data/lessons.js';
import { BOARD } from './data/world.js';
import { playerAvatar } from './ui/avatar.js';
import { pickPlayer, editor, sameName } from './ui/players.js';
import { createProfile } from './store.js';

const nav = {
  title: () => titleScreen(),
  players: () => choosePlayer(),
  game: () => renderGame(),
  board: () => renderBoard(),
  book: () => { const back = () => renderGame(); setBookRedraw(() => renderBook(back)); renderBook(back); },
  ranking: () => renderRanking(() => renderGame()),
  saveSettings: () => saveSettingsNow(),
  newYear: () => newYear(),
};
setNav(nav);
setBoardNav(nav);

// Who's playing: everyone on this device has her own profile and hotel. With Familia en línea,
// everyone in the family appears here, and her game continues from wherever she played last.
let picked = false;
function choosePlayer() {
  pickPlayer(async (id) => { picked = true; await bringLatest(id); app.s = loadGame(); titleScreen(); });
}

function waiting(text) {
  mount(h('div', { class: 'title-screen' }, h('div', { class: 'title-content', style: { paddingTop: '18vh' } },
    h('div', { class: 'logo' }, h('span', null, 'BAHÍA CORASOL'), 'La Directora'),
    h('p', { class: 'title-sub' }, text))));
}

// Waits for the cloud, but never more than a few seconds: the game must open even without internet.
const atMost = (p, ms) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(r, ms))]);

async function bringLatest(id) {
  if (!cloudOn()) return;
  waiting('Buscando tu partida más reciente…');
  await atMost(pullSave(id, chooseVersion), 8000);
}

// Both this device and another one have new progress for the same player: she picks which continues.
function chooseVersion({ local, cloud }) {
  const line = (s) => (s ? `${s.hotelName} · ${dateLabel(s.day)} · Caja ${money(s.cash)}` : 'Sin hotel');
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'quote', style: { fontSize: '22px' } }, `${currentProfile()?.name || 'Esta jugadora'} jugó en dos dispositivos`),
    h('p', { class: 'meaning' }, '¿Con cuál partida sigues? La otra se pierde.'),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, h('span', null, '☁️ La del otro dispositivo', h('br'), h('small', null, line(cloud)))),
    h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, h('span', null, '📱 La de este dispositivo', h('br'), h('small', null, line(local))))));
}

// A save was refused because another device saved first.
onConflict(async (id) => {
  if (id !== currentId()) return;
  const r = await pullSave(id, chooseVersion).catch(() => null);
  if (r === 'pulled') { app.s = loadGame(); toast('Seguimos con la partida más nueva.'); titleScreen(); }
});

async function start() {
  if (cloudOn()) { waiting('Conectando con tu familia…'); await atMost(syncPlayers(), 5000); }
  const list = profiles();
  if (!list.length) {
    // First time on this device: create the first player.
    mount(h('div', { class: 'title-screen' }, h('div', { class: 'title-content', style: { paddingTop: '18vh' } },
      h('div', { class: 'logo' }, h('span', null, 'BAHÍA CORASOL'), 'La Directora'))));
    const r = await editor(null);
    if (!r) return start();
    createProfile(r.name, r.look);
    picked = true;
    app.s = null;
    return titleScreen();
  }
  if (list.length > 1 && !picked) return choosePlayer();
  if (!picked) {
    const id = currentProfile() ? currentId() : list[0].id;
    selectProfile(id);
    await bringLatest(id);
  }
  picked = true;
  titleScreen();
}

function titleScreen() {
  if (!currentProfile()) return profiles().length ? choosePlayer() : start();
  const saved = app.s || loadGame();
  app.s = saved;
  const me = currentProfile();
  const name = playerName();
  const scene = h('div', { class: 'title-scene' }, hotelSvg(saved, { mode: 'title', name: saved?.hotelName || 'La Directora', compact: true }));
  mount(h('div', { class: 'title-screen' },
    scene,
    h('div', { class: 'title-content' },
      h('div', { class: 'title-hero' },
        playerAvatar('hero', me.look),
        h('div', { class: 'logo' }, h('span', null, 'BAHÍA CORASOL'), 'La Directora', h('em', null, name))),
      h('p', { class: 'title-sub' }, saved
        ? `${saved.hotelName} te espera, ${name}. El Consejo quiere resultados.`
        : `${name}, dirige tu propio hotel. Toma decisiones, cuida a tu equipo y rinde cuentas al Consejo.`),
      sayingOfTheDay(saved),
      h('div', { class: 'title-actions' },
        saved && saved.phase !== 'closed'
          ? h('button', { class: 'btn btn-primary btn-big', onclick: () => { sfx('tap'); renderGame(); } }, '▶ Continuar')
          : null,
        h('button', { class: `btn ${saved ? 'btn-ghost' : 'btn-primary btn-big'}`, onclick: () => newGame(!!saved) }, saved ? 'Nueva partida' : '🔑 Empezar'),
        h('button', { class: 'btn btn-ghost', onclick: () => { sfx('tap'); renderRanking(() => titleScreen()); } }, '🏆 Tablero de Directoras'),
        h('button', { class: 'btn btn-ghost', onclick: () => { sfx('tap'); flushAll(); choosePlayer(); } }, `👥 No soy ${name}: cambiar de jugadora`)))));
}

// Each session opens with one saying she already learned: a small, daily retrieval cue.
function sayingOfTheDay(saved) {
  const known = LESSONS.filter((l) => saved?.lessons?.[l.id]?.level);
  if (!known.length) return null;
  const l = known[(new Date().getDate() + known.length) % known.length];
  return h('div', { class: 'saying' }, h('small', null, `📖 Frase para hoy · ${BOARD[l.by].name}`), h('b', null, `${l.icon} “${l.phrase}”`));
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
  const carry = { year: (old.year || 1) + 1, lessons: old.lessons, diary: old.diary, badges: old.badges || [], stars: old.stars || {}, monthStars: old.monthStars || {} };
  app.s = { lessons: old.lessons, inbox: [], day: 0 };
  discover(app.s, 'practica', `Tu hotel anterior cerró. Empiezas el año ${carry.year} con todo lo que aprendiste.`);
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

// ?borrar=1 wipes every player and saved game on this device so everyone starts clean.
if (new URLSearchParams(location.search).has('borrar')) {
  wipeAll();
  app.s = null;
  history.replaceState(null, '', location.pathname);
}

// Links from the family chat: #familia=… joins this device, #r=… brings someone's results.
async function fromLink() {
  const hash = location.hash;
  if (!hash) return;
  history.replaceState(null, '', location.pathname + location.search);
  const code = parseCode(hash);
  if (code && code !== familyCode()) {
    waiting('Uniendo este dispositivo a tu familia…');
    try { await joinFamily(code, sameName); toast('¡Listo! Este dispositivo ya está con tu familia.'); } catch { toast('No pude conectarme. Revisa el internet e intenta otra vez.'); }
  } else if (hash.startsWith('#r=')) importResults(hash);
}

fromLink().finally(start);
