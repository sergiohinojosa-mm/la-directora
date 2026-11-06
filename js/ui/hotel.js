// The hotel diorama: a cut-away building whose rooms show free / dirty / occupied.
// mode: 'morning' (sunrise, dirty rooms waiting), 'day' (animation), 'evening' (sunset, results).

import { loc, roomsOf } from '../engine/sim.js';
import { rank } from '../data/badges.js';
import { chapterFor } from '../data/chapters.js';
import { currentProfile } from '../store.js';
import { lookColors } from './avatar.js';

const SKY = {
  morning: ['#FFD9B8', '#BFE7EE'],
  day: ['#8FD3F4', '#D9F4FA'],
  evening: ['#3A2E6E', '#FF8C69'],
  title: ['#2B2F6B', '#FF9A76'],
};

const COLORS = { free: '#FFFFFF', dirty: '#FFC8C0', occ: '#7FE0B1', ready: '#E6F7F8' };

// One entry per room: { type, state }. Rooms are listed most expensive first (top floors).
export function roomStates(s, result) {
  const out = [];
  for (const r of [...roomsOf(s)].sort((a, b) => b.ref - a.ref)) {
    const sold = result ? result.sold[r.id] || 0 : 0;
    const dirty = result ? 0 : s.dirty[r.id] || 0;
    for (let i = 0; i < r.count; i++) {
      let state = 'free';
      if (result) state = i < sold ? 'occ' : 'free';
      else if (i < dirty) state = 'dirty';
      out.push({ type: r.id, name: r.name, state });
    }
  }
  if (result) {
    // Rooms left dirty at the end of the day (not cleaned) are shown after the occupied ones.
    let leftover = result.dirtyStart - result.cleaned;
    for (const room of out) {
      if (leftover <= 0) break;
      if (room.state === 'free') { room.state = 'dirty'; leftover--; }
    }
  }
  return out;
}

export function hotelSvg(s, { mode = 'morning', result = null, name, compact = false } = {}) {
  // The title screen always shows a lively, lit-up hotel.
  const rooms = mode === 'title' || !s ? demoRooms(s ? roomStates(s, null) : null) : roomStates(s, result);
  const perFloor = 4;
  const floors = Math.ceil(rooms.length / perFloor);
  const roomW = 96;
  const roomH = 70;
  const gap = 10;
  const bw = perFloor * roomW + (perFloor + 1) * gap;
  const lobbyH = 96;
  const bh = floors * (roomH + gap) + gap + lobbyH;
  const W = 800;
  const groundY = 420 + Math.max(0, floors - 3) * 40;
  const H = groundY + 70;
  const bx = 190;
  const by = groundY - bh;
  const [skyTop, skyBottom] = SKY[mode] || SKY.morning;
  const night = mode === 'evening' || mode === 'title';
  const hotelName = (name || s?.hotelName || 'Hotel Coral').toUpperCase();
  const isBeach = !s || s.locationId === 'playa';
  // The hotel grows with her career rank: each rank adds something visible.
  const lvl = s ? rank(s).index : 3;

  let roomsSvg = '';
  rooms.forEach((r, i) => {
    const floor = Math.floor(i / perFloor);
    const col = i % perFloor;
    const x = bx + gap + col * (roomW + gap);
    const y = by + gap + floor * (roomH + gap);
    const fill = night && r.state === 'occ' ? '#FFE28A' : COLORS[r.state];
    const label = r.type === 'suite' ? 'SUITE' : `${floors - floor}0${col + 1}`;
    const guestColor = ['#18203B', '#FF6B57', '#2EC4C9', '#A78BFA'][i % 4];
    const delay = (i * 0.12).toFixed(2);
    roomsSvg += `<g class="room-g ${mode === 'day' ? 'hidden-guest' : ''}" data-i="${i}" data-state="${r.state}">
      <rect class="room" x="${x}" y="${y}" width="${roomW}" height="${roomH}" rx="9" fill="${mode === 'day' ? COLORS.ready : fill}" stroke="${r.state === 'free' ? '#DCE3EE' : 'none'}" stroke-width="2" style="transition-delay:${delay}s"/>
      ${furniture(x, y, r, i)}
      <text x="${x + 8}" y="${y + 17}" font-size="11" font-weight="800" fill="#18203B" opacity=".55" font-family="Plus Jakarta Sans, sans-serif">${label}</text>
      ${r.state === 'dirty' ? `<g class="dirt"><path d="M${x + 24} ${y + 44} q8 -6 16 0 t16 2 l-2 14 h-30z" fill="#E7DCCB"/><circle cx="${x + 70}" cy="${y + 30}" r="5" fill="#fff" opacity=".9"/><circle cx="${x + 80}" cy="${y + 22}" r="3.5" fill="#fff" opacity=".9"/><circle cx="${x + 62}" cy="${y + 22}" r="2.5" fill="#fff" opacity=".9"/><rect x="${x + roomW - 44}" y="${y + 6}" width="38" height="14" rx="7" fill="#E2513E"/><text x="${x + roomW - 25}" y="${y + 16}" font-size="8.5" font-weight="800" text-anchor="middle" fill="#fff" font-family="Plus Jakarta Sans, sans-serif">SUCIO</text></g>` : ''}
      ${r.state === 'occ' ? (night
        ? `<g class="guest"><circle cx="${x + 20}" cy="${y + 43}" r="6.5" fill="${guestColor}"/><rect x="${x + 25}" y="${y + 44}" width="33" height="14" rx="4" fill="${BLANKET[r.type] || '#A78BFA'}"/><text class="zzz" x="${x + 30}" y="${y + 34}" font-size="12" font-weight="800" fill="#18203B">z</text></g>`
        : `<g class="guest" style="transition-delay:${delay}s"><circle cx="${x + 80}" cy="${y + 34}" r="8" fill="${guestColor}"/><rect x="${x + 71}" y="${y + 42}" width="18" height="18" rx="6" fill="${guestColor}"/></g>`) : ''}
    </g>`;
  });

  const ly = by + bh - lobbyH;
  const left = s?.rest?.open ? 130 : 50;
  const vb = compact ? `${bx - left} ${by - 66} ${bw + left + 180} ${H - (by - 66)}` : `0 0 ${W} ${H}`;
  const svg = `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vista del hotel">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2EC4C9"/><stop offset="1" stop-color="#1B8FA0"/></linearGradient>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF9F1"/><stop offset="1" stop-color="#F3E6D3"/></linearGradient>
      <filter id="soft" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#18203B" flood-opacity=".25"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${night ? starsSvg(W) : ''}
    <circle cx="${night ? 660 : 680}" cy="${night ? 90 : 80}" r="${night ? 28 : 40}" fill="${night ? '#FFF4D6' : '#FFC24B'}" opacity="${night ? 0.95 : 1}"/>
    ${night ? '' : '<g opacity=".85"><ellipse cx="120" cy="90" rx="46" ry="16" fill="#fff"/><ellipse cx="150" cy="80" rx="30" ry="16" fill="#fff"/><ellipse cx="560" cy="130" rx="40" ry="12" fill="#fff"/></g>'}
    ${isBeach
      ? `<rect y="${groundY - 60}" width="${W}" height="90" fill="url(#sea)"/><path class="wave" d="M-40 ${groundY - 50} q40 -10 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 v8 h-920z" fill="#8BE3E6" opacity=".7"/>`
      : `<g fill="${night ? '#2D2A5C' : '#B9D7C9'}"><rect x="0" y="${groundY - 110}" width="80" height="110" rx="6"/><rect x="640" y="${groundY - 150}" width="70" height="150" rx="6"/><rect x="720" y="${groundY - 90}" width="90" height="90" rx="6"/></g>`}
    <rect y="${groundY}" width="${W}" height="${H - groundY}" fill="${isBeach ? '#F6DFA8' : '#9AD3A8'}"/>
    ${s?.locationId === 'carretera' ? `<rect y="${groundY + 30}" width="${W}" height="26" fill="#5A6485"/><path d="M0 ${groundY + 43} h${W}" stroke="#FFC24B" stroke-width="3" stroke-dasharray="24 18"/>` : ''}
    <g transform="translate(70 ${groundY - 160})"><rect x="16" y="20" width="10" height="145" rx="5" fill="#8B5E3C"/><path d="M21 22 q-55 -8 -80 22 q38 -18 80 -16 q-26 -36 -74 -34 q50 6 74 28 q18 -42 58 -46 q-46 20 -54 48 q44 -12 76 10 q-44 -6 -80 -12z" fill="#2FA36B"/></g>
    ${lvl >= 5 ? tower(bx, by, bw, groundY, night) : ''}
    ${isBeach && !night ? `<g class="boat"><path d="M600 ${groundY - 34} h56 l-8 12 h-40z" fill="#fff"/><path d="M628 ${groundY - 36} v-34 l20 30z" fill="#FF6B57"/></g>` : ''}
    ${!night ? `<g class="birds" fill="none" stroke="#18203B" stroke-width="2" stroke-linecap="round" opacity=".55"><path d="M90 140 q6 -6 12 0 q6 -6 12 0"/><path d="M130 120 q5 -5 10 0 q5 -5 10 0"/></g>` : ''}
    <g filter="url(#soft)">
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="14" fill="url(#wall)"/>
      <rect x="${bx - 14}" y="${by - 30}" width="${bw + 28}" height="36" rx="10" fill="#FF6B57"/>
    </g>
    ${s ? `<g transform="translate(${bx + bw - 70} ${by - 50})"><rect width="76" height="24" rx="12" fill="#18203B"/><text x="38" y="16.5" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="12" fill="#FFC24B">★ ${s.reputation.toFixed(1)}</text></g>` : ''}
    <text x="${bx + bw / 2}" y="${by - 6}" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="20" fill="#fff" letter-spacing="3">${escapeXml(hotelName)}</text>
    ${roomsSvg}
    <rect x="${bx + gap}" y="${ly}" width="${bw - 2 * gap}" height="${lobbyH - gap}" rx="9" fill="#FFE3B8"/>
    <rect x="${bx + 36}" y="${ly + 46}" width="130" height="38" rx="8" fill="#18203B"/>
    <text x="${bx + 101}" y="${ly + 70}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans, sans-serif" letter-spacing="1">RECEPCIÓN</text>
    <circle cx="${bx + 101}" cy="${ly + 30}" r="12" fill="#FF6B57"/><rect x="${bx + 89}" y="${ly + 38}" width="24" height="10" rx="4" fill="#FF6B57"/>
    <rect x="${bx + bw - 100}" y="${ly + 10}" width="70" height="${lobbyH - 20}" rx="8" fill="#2EC4C9"/><rect x="${bx + bw - 66}" y="${ly + 10}" width="2" height="${lobbyH - 20}" fill="#18203B" opacity=".4"/>
    <g transform="translate(${bx + 210} ${ly + 62})">
      <ellipse cx="0" cy="12" rx="20" ry="11" fill="#F28C38"/><circle cx="-16" cy="0" r="10" fill="#F28C38"/>
      <path d="M-24 -6 l3 -9 l5 6z M-12 -8 l4 -8 l3 8z" fill="#F28C38"/>
      ${night || mode === 'title' ? '<path d="M-20 0 h4 M-13 0 h4" stroke="#18203B" stroke-width="1.6"/><text class="zzz" x="-4" y="-14" font-size="12" font-weight="800" fill="#18203B">z</text>' : '<circle cx="-19" cy="0" r="1.8" fill="#18203B"/><circle cx="-12" cy="0" r="1.8" fill="#18203B"/>'}
      <path class="cat-tail" d="M16 8 q14 -4 12 -20" stroke="#F28C38" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
    ${decorations(lvl, { bx, bw, by, ly, lobbyH, groundY, night, isBeach, gap })}
    ${s ? business(s, { bx, bw, by, ly, groundY, night }) : ''}
    ${s && mode !== 'title' ? directora(bx + 270, ly + 48) : ''}
    ${mode === 'day' ? `<g class="walker" transform="translate(${bx + bw + 60} ${groundY - 46})"><circle cx="0" cy="0" r="12" fill="#18203B"/><rect x="-12" y="12" width="24" height="30" rx="8" fill="#18203B"/><rect x="14" y="20" width="18" height="22" rx="4" fill="#FF6B57"/></g>` : ''}
    ${s?.comp?.open && chapterFor(s) >= 7 ? '' : `<g transform="translate(${bx + bw + 30} ${groundY - 180})" opacity="${s ? 1 : 0.9}">
      <rect width="120" height="180" rx="8" fill="${night ? '#3B3F72' : '#D4DDE8'}"/>
      <text x="60" y="22" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-size="13" font-weight="800" fill="${night ? '#C9CDF2' : '#5A6485'}">MAREA INN</text>
      <g fill="${night ? '#FFE28A' : '#EEF2F7'}"><rect x="12" y="36" width="44" height="30" rx="4"/><rect x="64" y="36" width="44" height="30" rx="4" opacity=".6"/><rect x="12" y="76" width="44" height="30" rx="4" opacity=".6"/><rect x="64" y="76" width="44" height="30" rx="4"/><rect x="12" y="116" width="44" height="30" rx="4"/><rect x="64" y="116" width="44" height="30" rx="4" opacity=".6"/></g>
    </g>`}
  </svg>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = svg;
  return wrap.firstElementChild;
}

// Day animation: rooms get cleaned, then guests check in one by one.
export function animateDay(svg, result, s) {
  const target = roomStates(s, result);
  const groups = [...svg.querySelectorAll('.room-g')];
  return new Promise((resolve) => {
    groups.forEach((g, i) => {
      const t = target[i];
      setTimeout(() => {
        const rect = g.querySelector('.room');
        rect.setAttribute('fill', COLORS[t.state]);
        if (g.querySelector('.dirt') || g.dataset.state === 'dirty') {
          const sx = +rect.getAttribute('x') + 48;
          const sy = +rect.getAttribute('y') + 35;
          const sp = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          sp.setAttribute('x', sx); sp.setAttribute('y', sy); sp.setAttribute('font-size', '22'); sp.setAttribute('text-anchor', 'middle');
          sp.setAttribute('class', 'sparkle'); sp.style.transformOrigin = `${sx}px ${sy}px`;
          sp.textContent = '✨';
          g.append(sp);
        }
        g.querySelector('.dirt')?.remove();
        if (t.state === 'occ' && !g.querySelector('.guest')) {
          const x = +rect.getAttribute('x');
          const y = +rect.getAttribute('y');
          const color = ['#18203B', '#FF6B57', '#2EC4C9', '#A78BFA'][i % 4];
          const ns = 'http://www.w3.org/2000/svg';
          const gg = document.createElementNS(ns, 'g');
          gg.setAttribute('class', 'guest');
          gg.innerHTML = `<circle cx="${x + 80}" cy="${y + 34}" r="8" fill="${color}"/><rect x="${x + 71}" y="${y + 42}" width="18" height="18" rx="6" fill="${color}"/>`;
          g.append(gg);
        }
        if (t.state === 'dirty') {
          rect.setAttribute('fill', COLORS.dirty);
        }
        g.classList.remove('hidden-guest');
      }, 300 + i * 140);
    });
    setTimeout(resolve, 600 + groups.length * 140);
  });
}

export const UNLOCKS = [
  'Tu hotel, recién comprado',
  'Macetas en la entrada y bandera en el techo',
  'Toldo de rayas y luces en la entrada',
  'Alberca, fuente o jardín',
  'Letrero de neón con estrellas',
  'Una segunda torre para tu hotel',
];

function decorations(lvl, { bx, bw, by, ly, lobbyH, groundY, night, isBeach, gap }) {
  let out = '';
  if (lvl >= 1) {
    out += `<g><rect x="${bx + bw / 2 - 1}" y="${by - 74}" width="3" height="44" fill="#5A6485"/><path class="flag" d="M${bx + bw / 2 + 2} ${by - 74} h26 l-6 8 l6 8 h-26z" fill="#FF6B57"/></g>`;
    for (const px of [bx - 6, bx + bw - 14]) out += `<g transform="translate(${px} ${groundY - 26})"><path d="M0 8 h20 l-3 18 h-14z" fill="#E07A5F"/><circle cx="6" cy="4" r="7" fill="#2FA36B"/><circle cx="14" cy="2" r="8" fill="#3FBF7F"/><circle cx="10" cy="-4" r="4" fill="#FF8FB1"/></g>`;
  }
  if (lvl >= 2) {
    const dx = bx + bw - 108;
    out += `<g><path d="M${dx} ${ly + 8} h86 l-6 16 h-74z" fill="#fff"/>${[0, 1, 2, 3, 4].map((k) => `<path d="M${dx + 6 + k * 16} ${ly + 8} h8 l-1 16 h-8z" fill="#FF6B57"/>`).join('')}</g>`;
    if (night) out += [0, 1, 2, 3, 4, 5, 6].map((k) => `<circle cx="${bx + gap + 20 + k * 60}" cy="${ly + 4}" r="3.5" fill="#FFE28A"/>`).join('');
  }
  if (lvl >= 3) {
    out += isBeach
      ? `<g transform="translate(20 ${groundY + 8})"><rect width="130" height="34" rx="17" fill="#fff"/><rect x="6" y="5" width="118" height="24" rx="12" fill="#5FD4E8"/><path d="M20 17 q10 -5 20 0 t20 0 t20 0 t20 0" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/></g>`
      : `<g transform="translate(60 ${groundY + 6})"><ellipse cx="40" cy="22" rx="42" ry="12" fill="#C9D3E6"/><ellipse cx="40" cy="20" rx="34" ry="8" fill="#5FD4E8"/><rect x="36" y="2" width="8" height="18" rx="3" fill="#C9D3E6"/><circle cx="40" cy="2" r="5" fill="#8BE3E6"/></g>`;
  }
  if (lvl >= 4) {
    out += `<g transform="translate(${bx + 20} ${by - 66})"><rect width="110" height="30" rx="10" fill="#18203B" stroke="${night ? '#FF8FB1' : '#A78BFA'}" stroke-width="3"/><text x="55" y="21" text-anchor="middle" font-size="15" fill="${night ? '#FFE28A' : '#FFC24B'}" font-weight="800">★★★★★</text></g>`;
  }
  return out;
}

// What her decisions added to the building: restaurant, terrace, spa, and the rival chain.
function business(s, { bx, bw, by, ly, groundY, night }) {
  let out = '';
  if (s.rest?.open) {
    out += `<g transform="translate(${bx - 120} ${groundY - 96})"><rect width="112" height="96" rx="10" fill="${night ? '#3B2E4E' : '#FFF4E4'}" stroke="#E07A5F" stroke-width="2"/><path d="M-6 0 h124 l-8 18 h-108z" fill="#E07A5F"/>${[0, 1, 2, 3, 4, 5].map((k) => `<path d="M${2 + k * 19} 0 h9 l-2 18 h-9z" fill="#fff" opacity=".85"/>`).join('')}<text x="56" y="40" text-anchor="middle" font-size="11" font-weight="800" fill="${night ? '#FFE28A' : '#9E2E1F'}" font-family="Plus Jakarta Sans, sans-serif">RESTAURANTE</text><rect x="14" y="50" width="34" height="30" rx="5" fill="${night ? '#FFE28A' : '#BFE7EE'}"/><rect x="64" y="50" width="34" height="46" rx="5" fill="#8B5E3C"/><text x="31" y="72" text-anchor="middle" font-size="16">🍽️</text></g>`;
  }
  if (s.plan?.project === 'terraza' && s.plan.status === 'done') {
    out += `<g><rect x="${bx + 20}" y="${by - 64}" width="${bw - 40}" height="30" rx="6" fill="${night ? '#2D2A5C' : '#FFFFFF'}" opacity=".9"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<circle cx="${bx + 34 + k * ((bw - 68) / 7)}" cy="${by - 60}" r="3.5" fill="${['#FFC24B', '#FF6B57', '#2EC4C9', '#A78BFA'][k % 4]}"/>`).join('')}<text x="${bx + bw / 2}" y="${by - 42}" text-anchor="middle" font-size="11" font-weight="800" fill="${night ? '#FFE28A' : '#18203B'}" font-family="Plus Jakarta Sans, sans-serif">🍹 TERRAZA</text></g>`;
  }
  if (s.plan?.status === 'building') {
    out += `<g transform="translate(${bx + bw - 10} ${by - 120})"><rect x="0" y="0" width="6" height="110" fill="#FFC24B"/><rect x="-60" y="0" width="90" height="6" fill="#FFC24B"/><path d="M-50 6 v30" stroke="#18203B" stroke-width="2"/><rect x="-58" y="36" width="16" height="12" fill="#FF6B57"/></g>`;
  }
  if (s.attributes?.includes('spa') && s.plan?.project === 'spa' && s.plan.status === 'done') {
    out += `<g transform="translate(${bx + 20} ${ly - 4})"><rect width="58" height="20" rx="10" fill="#7ED6A8"/><text x="29" y="14" text-anchor="middle" font-size="10" font-weight="800" fill="#18203B" font-family="Plus Jakarta Sans, sans-serif">🧖 SPA</text></g>`;
  }
  // Her decisions, visible: social media buzz, a worn-out facade, her unique experience.
  if (chapterFor(s) >= 3 && s.mkt?.social > 0) {
    out += `<g transform="translate(${bx + 168} ${ly + 4})"><g class="buzz"><rect width="62" height="22" rx="11" fill="#fff" stroke="#FF8FB1" stroke-width="2"/><path d="M14 22 l-4 7 l9 -7z" fill="#fff"/><text x="31" y="15.5" text-anchor="middle" font-size="11" font-weight="800" fill="#E2513E" font-family="Plus Jakarta Sans, sans-serif">📱 ❤ ${s.mkt.social === 2 ? '2.4k' : '860'}</text></g></g>`;
  }
  if (chapterFor(s) >= 6 && s.maint?.condition != null && s.maint.condition < 60) {
    out += `<g stroke="#8A6A50" stroke-width="2" fill="none" opacity=".75"><path d="M${bx + 8} ${by + 60} l8 10 l-6 8 l9 12"/><path d="M${bx + bw - 10} ${by + 140} l-7 9 l5 7 l-8 10"/><path d="M${bx + bw / 2} ${ly - 4} l6 8 l-5 6"/></g><text x="${bx + bw - 30}" y="${groundY + 4}" font-size="22">🚧</text>`;
  }
  if (s.comp?.unique) {
    const icon = { fogata: '🔥', snorkel: '🐠', cena: '🌅', tour: '🌮', museo: '🏛️', cafe: '☕', trailero: '🍳', taller: '🔧', estrellas: '🔭' }[s.comp.unique] || '🦄';
    out += `<g transform="translate(${bx + bw / 2 - 16} ${groundY + 8})"><rect width="44" height="30" rx="10" fill="#fff" opacity=".92"/><text x="22" y="21" text-anchor="middle" font-size="18">${icon}</text></g>`;
  }
  if (s.comp?.open && chapterFor(s) >= 7) {
    out += `<g transform="translate(${bx + bw + 40} ${groundY - 250})" opacity=".95"><rect width="96" height="250" rx="6" fill="${night ? '#22305A' : '#9FB3C8'}"/><rect x="8" y="10" width="80" height="22" rx="4" fill="#1F6FEB"/><text x="48" y="25" text-anchor="middle" font-size="10" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans, sans-serif">GlobalStay</text>${Array.from({ length: 6 }, (_, r) => [0, 1, 2].map((c) => `<rect x="${10 + c * 27}" y="${42 + r * 32}" width="20" height="20" rx="3" fill="${night ? ((r + c) % 2 ? '#FFE28A' : '#33426E') : '#DCE8F5'}"/>`).join('')).join('')}</g>`;
  }
  return out;
}

// The player herself, standing in her lobby, in her own colors.
function directora(x, y) {
  const c = lookColors(currentProfile()?.look);
  return `<g transform="translate(${x} ${y})"><g class="directora">
    <path d="M-13 -14 q-4 14 0 26 h26 q4 -12 0 -26 q-2 -16 -13 -16 q-11 0 -13 16z" fill="${c.hair}"/>
    <rect x="-10" y="-2" width="20" height="24" rx="6" fill="${c.top}"/>
    <rect x="-3" y="-2" width="6" height="16" fill="#fff"/>
    <rect x="-8" y="22" width="7" height="14" rx="3" fill="#8FB3D9"/><rect x="1" y="22" width="7" height="14" rx="3" fill="#8FB3D9"/>
    <circle cx="0" cy="-14" r="10" fill="${c.skin}"/>
    <path d="M-11 -14 q0 -12 11 -12 q11 0 11 12 q-5 -5 -11 -6 q-6 1 -11 6z" fill="${c.hair}"/>
    <circle cx="-3.5" cy="-14" r="1.4" fill="#3B2416"/><circle cx="3.5" cy="-14" r="1.4" fill="#3B2416"/>
    <path d="M-3 -9 q3 3 6 0" stroke="#B5534A" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <rect x="6" y="2" width="10" height="13" rx="2" fill="#FFC24B" transform="rotate(10 11 8)"/>
  </g></g>`;
}

function tower(bx, by, bw, groundY, night) {
  const tx = bx + bw - 30;
  const th = groundY - by + 60;
  let win = '';
  for (let r = 0; r < Math.floor(th / 44); r++) for (let c = 0; c < 2; c++) win += `<rect x="${tx + 18 + c * 40}" y="${groundY - th + 20 + r * 44}" width="28" height="26" rx="5" fill="${night ? (r + c) % 3 ? '#FFE28A' : '#3B3F72' : '#BFE7EE'}"/>`;
  return `<g opacity=".95"><rect x="${tx}" y="${groundY - th}" width="104" height="${th}" rx="12" fill="${night ? '#2D2A5C' : '#F3E6D3'}"/>${win}</g>`;
}

const BLANKET = { std: '#A78BFA', mar: '#2EC4C9', suite: '#FFC24B', fam: '#FF8FB1' };

// Bed, pillow, nightstand and lamp; the blanket color tells the room type.
function furniture(x, y, r, i) {
  const blanket = BLANKET[r.type] || '#A78BFA';
  const made = r.state !== 'dirty';
  return `<g class="furn">
    <rect x="${x + 8}" y="${y + 34}" width="6" height="26" rx="2" fill="#B08463"/>
    <rect x="${x + 12}" y="${y + 46}" width="48" height="13" rx="4" fill="#fff" stroke="#E3E7F2"/>
    <rect x="${x + 14}" y="${y + 40}" width="12" height="7" rx="3" fill="#fff" stroke="#E3E7F2"/>
    ${made ? `<rect x="${x + 28}" y="${y + 45}" width="32" height="14" rx="4" fill="${blanket}" opacity=".9"/>` : ''}
    <rect x="${x + 64}" y="${y + 50}" width="12" height="10" rx="2" fill="#B08463"/>
    <path d="M${x + 66} ${y + 44} h8 l-2 -6 h-4z" fill="#FFC24B"/>
    <rect x="${x + 69.5}" y="${y + 44}" width="1" height="6" fill="#8A6A50"/>
    <rect x="${x + 40}" y="${y + 8}" width="${i % 2 ? 22 : 16}" height="14" rx="2" fill="#BFE7EE" stroke="#fff" stroke-width="2"/>
  </g>`;
}

function starsSvg(W) {
  let out = '';
  for (let i = 0; i < 26; i++) {
    const x = (i * 137) % W;
    const y = 20 + ((i * 53) % 140);
    out += `<circle cx="${x}" cy="${y}" r="${(i % 3) * 0.6 + 0.8}" fill="#fff" opacity="${0.4 + (i % 4) * 0.15}"/>`;
  }
  return out;
}

function demoRooms(real) {
  const states = ['occ', 'occ', 'free', 'occ', 'occ', 'occ', 'free', 'occ', 'occ', 'occ', 'occ', 'free', 'occ', 'occ', 'free', 'occ'];
  if (real) return real.map((r, i) => ({ ...r, state: states[i % states.length] }));
  return states.slice(0, 12).map((state, i) => ({ type: i === 0 ? 'suite' : 'std', state }));
}

function escapeXml(t) {
  return t.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}
