// The hotel diorama: a cut-away building whose rooms show free / dirty / occupied.
// mode: 'morning' (sunrise, dirty rooms waiting), 'day' (animation), 'evening' (sunset, results).

import { loc } from '../engine/sim.js';

const SKY = {
  morning: ['#FFD9B8', '#BFE7EE'],
  day: ['#8FD3F4', '#D9F4FA'],
  evening: ['#3A2E6E', '#FF8C69'],
  title: ['#2B2F6B', '#FF9A76'],
};

const COLORS = { free: '#FFFFFF', dirty: '#FFC8C0', occ: '#7FE0B1', ready: '#E6F7F8' };

// One entry per room: { type, state }. Rooms are listed most expensive first (top floors).
export function roomStates(s, result) {
  const L = loc(s);
  const out = [];
  for (const r of [...L.rooms].sort((a, b) => b.ref - a.ref)) {
    const sold = result ? result.sold[r.id] : 0;
    const dirty = result ? 0 : s.dirty[r.id];
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

export function hotelSvg(s, { mode = 'morning', result = null, name } = {}) {
  const rooms = s ? roomStates(s, result) : demoRooms();
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
      <rect x="${x + 8}" y="${y + roomH - 20}" width="34" height="12" rx="4" fill="#A0AEC8" opacity=".55"/>
      <text x="${x + 8}" y="${y + 17}" font-size="11" font-weight="800" fill="#18203B" opacity=".55" font-family="Plus Jakarta Sans, sans-serif">${label}</text>
      ${r.state === 'dirty' ? `<g class="dirt"><circle cx="${x + 62}" cy="${y + 42}" r="6" fill="#fff" opacity=".8"/><circle cx="${x + 74}" cy="${y + 34}" r="4" fill="#fff" opacity=".8"/><text x="${x + roomW / 2}" y="${y + 60}" font-size="10" font-weight="800" text-anchor="middle" fill="#B23A2A" font-family="Plus Jakarta Sans, sans-serif">SUCIO</text></g>` : ''}
      ${r.state === 'occ' ? `<g class="guest" style="transition-delay:${delay}s"><circle cx="${x + 64}" cy="${y + 36}" r="10" fill="${guestColor}"/><rect x="${x + 53}" y="${y + 46}" width="22" height="16" rx="6" fill="${guestColor}"/>${night ? `<text class="zzz" x="${x + 78}" y="${y + 26}" font-size="12" font-weight="800" fill="#18203B">z</text>` : ''}</g>` : ''}
    </g>`;
  });

  const ly = by + bh - lobbyH;
  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vista del hotel">
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
    <g filter="url(#soft)">
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="14" fill="url(#wall)"/>
      <rect x="${bx - 14}" y="${by - 30}" width="${bw + 28}" height="36" rx="10" fill="#FF6B57"/>
    </g>
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
    ${mode === 'day' ? `<g class="walker" transform="translate(${bx + bw + 60} ${groundY - 46})"><circle cx="0" cy="0" r="12" fill="#18203B"/><rect x="-12" y="12" width="24" height="30" rx="8" fill="#18203B"/><rect x="14" y="20" width="18" height="22" rx="4" fill="#FF6B57"/></g>` : ''}
    <g transform="translate(${bx + bw + 30} ${groundY - 180})" opacity="${s ? 1 : 0.9}">
      <rect width="120" height="180" rx="8" fill="${night ? '#3B3F72' : '#D4DDE8'}"/>
      <text x="60" y="22" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-size="13" font-weight="800" fill="${night ? '#C9CDF2' : '#5A6485'}">MAREA INN</text>
      <g fill="${night ? '#FFE28A' : '#EEF2F7'}"><rect x="12" y="36" width="44" height="30" rx="4"/><rect x="64" y="36" width="44" height="30" rx="4" opacity=".6"/><rect x="12" y="76" width="44" height="30" rx="4" opacity=".6"/><rect x="64" y="76" width="44" height="30" rx="4"/><rect x="12" y="116" width="44" height="30" rx="4"/><rect x="64" y="116" width="44" height="30" rx="4" opacity=".6"/></g>
    </g>
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
        g.querySelector('.dirt')?.remove();
        if (t.state === 'occ' && !g.querySelector('.guest')) {
          const x = +rect.getAttribute('x');
          const y = +rect.getAttribute('y');
          const color = ['#18203B', '#FF6B57', '#2EC4C9', '#A78BFA'][i % 4];
          const ns = 'http://www.w3.org/2000/svg';
          const gg = document.createElementNS(ns, 'g');
          gg.setAttribute('class', 'guest');
          gg.innerHTML = `<circle cx="${x + 64}" cy="${y + 36}" r="10" fill="${color}"/><rect x="${x + 53}" y="${y + 46}" width="22" height="16" rx="6" fill="${color}"/>`;
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

function starsSvg(W) {
  let out = '';
  for (let i = 0; i < 26; i++) {
    const x = (i * 137) % W;
    const y = 20 + ((i * 53) % 140);
    out += `<circle cx="${x}" cy="${y}" r="${(i % 3) * 0.6 + 0.8}" fill="#fff" opacity="${0.4 + (i % 4) * 0.15}"/>`;
  }
  return out;
}

function demoRooms() {
  const states = ['occ', 'occ', 'free', 'occ', 'occ', 'dirty', 'occ', 'free', 'occ', 'occ', 'occ', 'free'];
  return states.map((state, i) => ({ type: i === 0 ? 'suite' : 'std', state }));
}

function escapeXml(t) {
  return t.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}
