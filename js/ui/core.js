// Shared UI pieces: screen mounting, modals, toasts, confetti, sounds, avatars and the audio player.

import { h } from '../util.js';
import { BOARD } from '../data/world.js';
import { RECORDED } from '../../audio/audios.js';
import { loadSettings, saveSettings } from '../store.js';
import { papaMarkup } from './avatar.js';

export const app = { s: null, settings: loadSettings(), screen: null };

export function mount(node) {
  const root = document.getElementById('app');
  root.replaceChildren(node);
}

export function saveSettingsNow() {
  saveSettings(app.settings);
}

// ---- Modal (one at a time; resolves when closed) ----
export function modal(content, { dismissable = false } = {}) {
  const overlay = document.getElementById('overlay');
  return new Promise((resolve) => {
    const close = (value) => {
      overlay.replaceChildren();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(null); };
    document.addEventListener('keydown', onKey);
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, typeof content === 'function' ? content(close) : content);
    overlay.replaceChildren(box);
    if (dismissable) overlay.onclick = (e) => { if (e.target === overlay) close(null); };
    else overlay.onclick = null;
    setTimeout(() => box.querySelector('button')?.focus({ preventScroll: true }), 50);
  });
}

export function toast(text, ms = 2600) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

// ---- Confetti ----
export function confetti(power = 1) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.getElementById('confetti');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#FF6B57', '#FFC24B', '#2EC4C9', '#4FD69C', '#A78BFA', '#FF8FB1'];
  const parts = Array.from({ length: Math.round(140 * power) }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    r: Math.random() * 6 + 4, c: colors[Math.floor(Math.random() * colors.length)],
    a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.3,
  }));
  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (++frame < 150) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  tick();
}

// ---- Sounds (synthesized, no files) ----
let actx = null;
function tone(freq, start, dur, type = 'sine', vol = 0.12) {
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, actx.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, actx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + start + dur);
  o.connect(g).connect(actx.destination);
  o.start(actx.currentTime + start);
  o.stop(actx.currentTime + start + dur + 0.05);
}
export function sfx(kind) {
  if (!app.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    if (kind === 'tap') tone(660, 0, 0.06, 'triangle', 0.05);
    if (kind === 'coin') { tone(988, 0, 0.08, 'square', 0.05); tone(1319, 0.07, 0.18, 'square', 0.05); }
    if (kind === 'good') [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle'));
    if (kind === 'bad') [392, 311].forEach((f, i) => tone(f, i * 0.14, 0.3, 'sine', 0.1));
    if (kind === 'fanfare') [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle'));
    if (kind === 'bell') { tone(1568, 0, 0.6, 'sine', 0.08); tone(2093, 0.02, 0.5, 'sine', 0.04); }
  } catch { /* audio not available */ }
}

// ---- Board members ----
export function avatar(who, size = '') {
  const b = BOARD[who];
  if (who === 'papa') return h('div', { class: `avatar portrait-av ${size}`, style: { background: b.color }, 'aria-hidden': 'true', html: papaMarkup() });
  return h('div', { class: `avatar ${size}`, style: { background: b.color }, 'aria-hidden': 'true' }, b.initial);
}

// ---- Lesson audio (recorded by the family, shipped as files) ----
export const hasAudio = (id) => RECORDED.includes(id);

export function audioPlayer(id, { autoplay = false } = {}) {
  if (!hasAudio(id)) return null;
  const audio = new Audio(`audio/${id}.m4a`);
  const btn = h('button', { 'aria-label': 'Escuchar' }, '▶');
  const bar = h('i');
  const wrap = h('div', { class: 'player' }, btn, h('div', { class: 'track' }, bar));
  const sync = () => {
    btn.textContent = audio.paused ? '▶' : '❚❚';
    if (audio.duration) bar.style.width = (100 * audio.currentTime) / audio.duration + '%';
  };
  audio.addEventListener('timeupdate', sync);
  audio.addEventListener('play', sync);
  audio.addEventListener('pause', sync);
  audio.addEventListener('ended', sync);
  btn.onclick = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause());
  if (autoplay) setTimeout(() => audio.play().catch(() => {}), 350);
  wrap.stop = () => audio.pause();
  return wrap;
}

// ---- Botones the cat ----
export function catSvg() {
  const svg = `<svg viewBox="0 0 60 60" class="cat" aria-hidden="true">
    <circle cx="30" cy="30" r="29" fill="#FFE7C9"/>
    <path d="M14 22 l4 -14 l10 10z M46 22 l-4 -14 l-10 10z" fill="#F28C38"/>
    <ellipse cx="30" cy="34" rx="18" ry="16" fill="#F28C38"/>
    <ellipse cx="30" cy="40" rx="9" ry="7" fill="#FFE7C9"/>
    <circle cx="23" cy="31" r="3" fill="#18203B"/><circle cx="37" cy="31" r="3" fill="#18203B"/>
    <circle cx="24" cy="30" r="1" fill="#fff"/><circle cx="38" cy="30" r="1" fill="#fff"/>
    <path d="M28 37 q2 2 4 0" stroke="#18203B" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M14 38 h-8 M14 41 h-7 M46 38 h8 M46 41 h7" stroke="#18203B" stroke-width="1" opacity=".5"/>
    <rect x="22" y="46" width="16" height="5" rx="2.5" fill="#FF6B57"/>
  </svg>`;
  const d = h('div', { html: svg });
  return d.firstChild;
}

export function botones(text) {
  return h('div', { class: 'botones' }, catSvg(), h('div', { class: 'bubble', html: text }));
}
