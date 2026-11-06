// Illustrated portraits: Luciana (the Directora) and Papá (Presidente del Consejo).
// Drawn from a family photo (no photo is shipped): curly brown hair and a burgundy jacket for her;
// curly greying hair, full beard greying at the chin, honey glasses and a khaki jacket for him.

const svgEl = (markup) => {
  const d = document.createElement('div');
  d.innerHTML = markup.trim();
  return d.firstChild;
};

export function lucianaMarkup({ badge = true } = {}) {
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="lcClip"><circle cx="60" cy="60" r="58"/></clipPath></defs>
    <circle cx="60" cy="60" r="58" fill="#FFE3D3"/>
    <g clip-path="url(#lcClip)">
      <path d="M22 62 q-6 28 4 56 h68 q10 -28 4 -56 q-2 -34 -38 -36 q-36 2 -38 36z" fill="#6B4026"/>
      <g fill="#7A4A2C">
        <circle cx="26" cy="72" r="9"/><circle cx="24" cy="88" r="9"/><circle cx="28" cy="104" r="9"/>
        <circle cx="94" cy="72" r="9"/><circle cx="96" cy="88" r="9"/><circle cx="92" cy="104" r="9"/>
      </g>
      <g fill="none" stroke="#9C6640" stroke-width="2.4" stroke-linecap="round" opacity=".8">
        <path d="M24 66 q-5 6 0 12 q5 6 0 12"/><path d="M96 66 q5 6 0 12 q-5 6 0 12"/><path d="M28 94 q-5 6 0 12"/><path d="M92 94 q5 6 0 12"/>
      </g>
      <path d="M30 120 q4 -20 30 -22 q26 2 30 22z" fill="#6E1F33"/>
      <path d="M50 99 h20 l-4 21 h-12z" fill="#FFFFFF"/>
      <path d="M60 100 v20" stroke="#4E1424" stroke-width="1.6"/>
      <rect x="52" y="84" width="16" height="16" rx="6" fill="#F4C7A8"/>
      <ellipse cx="60" cy="64" rx="22" ry="25" fill="#F7D2B6"/>
      <path d="M36 58 q2 -26 26 -26 q22 2 24 24 q-8 -10 -22 -12 q-6 8 -18 9 q-6 1 -10 5z" fill="#6B4026"/>
      <g fill="#7A4A2C"><circle cx="40" cy="44" r="7"/><circle cx="52" cy="36" r="7"/><circle cx="66" cy="35" r="7"/><circle cx="79" cy="42" r="7"/></g>
      <ellipse cx="51" cy="64" rx="3" ry="3.6" fill="#3B2416"/><ellipse cx="69" cy="64" rx="3" ry="3.6" fill="#3B2416"/>
      <circle cx="52" cy="63" r="1" fill="#fff"/><circle cx="70" cy="63" r="1" fill="#fff"/>
      <path d="M46 57 q5 -3 9 0 M65 57 q5 -3 9 0" stroke="#5A3420" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="45" cy="73" rx="4.5" ry="2.6" fill="#F2A7A0" opacity=".55"/><ellipse cx="75" cy="73" rx="4.5" ry="2.6" fill="#F2A7A0" opacity=".55"/>
      <path d="M51 74 q9 9 18 0 q-9 4 -18 0z" fill="#fff" stroke="#B5534A" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M58 66 q2 3 0 5" stroke="#D9A486" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    </g>
    ${badge ? '<g transform="translate(78 92)"><circle r="13" fill="#FFC24B" stroke="#fff" stroke-width="3"/><text y="5" text-anchor="middle" font-size="14">⭐</text></g>' : ''}
  </svg>`;
}

export function papaMarkup() {
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="ppClip"><circle cx="60" cy="60" r="58"/></clipPath></defs>
    <circle cx="60" cy="60" r="58" fill="#FFE9B8"/>
    <g clip-path="url(#ppClip)">
      <path d="M22 120 q4 -26 38 -28 q34 2 38 28z" fill="#B8915A"/>
      <path d="M48 93 l12 14 l12 -14 v27 h-24z" fill="#1E2A44"/>
      <path d="M44 94 l16 16 l-6 10 z M76 94 l-16 16 l6 10 z" fill="#A47E49"/>
      <rect x="51" y="78" width="18" height="16" rx="6" fill="#E9B98F"/>
      <ellipse cx="60" cy="58" rx="24" ry="27" fill="#F1C59C"/>
      <path d="M36 52 q0 -24 24 -26 q24 2 24 26 q-4 -10 -10 -12 q-14 4 -28 0 q-8 4 -10 12z" fill="#2E2A2A"/>
      <g fill="#2E2A2A"><circle cx="40" cy="40" r="6"/><circle cx="50" cy="32" r="6.5"/><circle cx="62" cy="30" r="6.5"/><circle cx="74" cy="33" r="6"/><circle cx="81" cy="42" r="5.5"/></g>
      <g fill="#8E8A86" opacity=".9"><circle cx="45" cy="36" r="2"/><circle cx="58" cy="30" r="1.8"/><circle cx="70" cy="31" r="2"/><circle cx="79" cy="38" r="1.6"/></g>
      <path d="M36 60 q-1 30 24 32 q25 -2 24 -32 q-4 10 -10 12 q-14 -4 -28 0 q-6 -2 -10 -12z" fill="#2E2A2A"/>
      <path d="M50 84 q10 8 20 0 q-2 8 -10 9 q-8 -1 -10 -9z" fill="#B8B4B0"/>
      <path d="M48 76 q12 -6 24 0" stroke="#2E2A2A" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M51 77 q9 7 18 0 q-9 3 -18 0z" fill="#fff" stroke="#9E5A4A" stroke-width="1.4"/>
      <ellipse cx="50" cy="60" rx="2.6" ry="3" fill="#2B1E16"/><ellipse cx="70" cy="60" rx="2.6" ry="3" fill="#2B1E16"/>
      <g fill="#E8B56A" fill-opacity=".18" stroke="#D99A45" stroke-width="2.6"><rect x="39" y="52" width="19" height="16" rx="6"/><rect x="62" y="52" width="19" height="16" rx="6"/></g>
      <path d="M58 58 h4" stroke="#D99A45" stroke-width="2.4"/>
      <path d="M43 49 q6 -3 12 0 M65 49 q6 -3 12 0" stroke="#2E2A2A" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;
}

// ---------------- Every other player: a portrait she builds herself ----------------
export const LOOKS = {
  skin: ['#F7D2B6', '#EBC1A0', '#C98E6B', '#8D5A3B'],
  hair: ['#6B4026', '#2B1E16', '#C99A4A', '#A0472A', '#8E8A86'],
  style: [['rizado', 'Rizado'], ['lacio', 'Lacio'], ['corto', 'Corto'], ['coleta', 'Coleta']],
  top: ['#6E1F33', '#2EC4C9', '#A78BFA', '#FF6B57', '#2FA36B', '#1E2A44'],
};
export const DEFAULT_LOOK = { skin: LOOKS.skin[0], hair: LOOKS.hair[0], style: 'lacio', top: LOOKS.top[1], glasses: false };

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

function personMarkup(look) {
  const L = { ...DEFAULT_LOOK, ...look };
  const hair = L.hair;
  const hair2 = shade(hair, 1.18);
  const brow = shade(hair, 0.75);
  const back = {
    rizado: `<path d="M22 62 q-6 28 4 56 h68 q10 -28 4 -56 q-2 -34 -38 -36 q-36 2 -38 36z" fill="${hair}"/><g fill="${hair2}"><circle cx="26" cy="72" r="9"/><circle cx="24" cy="88" r="9"/><circle cx="28" cy="104" r="9"/><circle cx="94" cy="72" r="9"/><circle cx="96" cy="88" r="9"/><circle cx="92" cy="104" r="9"/></g>`,
    lacio: `<path d="M28 58 q-4 34 2 62 h60 q6 -28 2 -62 q-4 -30 -32 -30 q-28 0 -32 30z" fill="${hair}"/><path d="M34 70 v44 M86 70 v44" stroke="${hair2}" stroke-width="3" opacity=".6"/>`,
    corto: `<path d="M32 60 q-2 22 4 30 h48 q6 -8 4 -30 q-4 -30 -28 -30 q-24 0 -28 30z" fill="${hair}"/>`,
    coleta: `<path d="M34 58 q-2 16 2 22 h48 q4 -6 2 -22 q-4 -28 -26 -28 q-22 0 -26 28z" fill="${hair}"/><path d="M84 46 q22 6 18 40 q-2 14 -10 22 q4 -24 -10 -48z" fill="${hair}"/><circle cx="86" cy="46" r="5" fill="${L.top}"/>`,
  }[L.style] || '';
  const front = {
    rizado: `<path d="M36 58 q2 -26 26 -26 q22 2 24 24 q-8 -10 -22 -12 q-6 8 -18 9 q-6 1 -10 5z" fill="${hair}"/><g fill="${hair2}"><circle cx="40" cy="44" r="7"/><circle cx="52" cy="36" r="7"/><circle cx="66" cy="35" r="7"/><circle cx="79" cy="42" r="7"/></g>`,
    lacio: `<path d="M36 60 q0 -28 24 -28 q24 0 24 28 q-6 -12 -20 -14 q-10 6 -28 14z" fill="${hair}"/>`,
    corto: `<path d="M36 58 q0 -26 24 -26 q24 0 24 26 q-10 -10 -24 -10 q-14 0 -24 10z" fill="${hair}"/><path d="M38 52 q10 -12 26 -12" stroke="${hair2}" stroke-width="2.5" fill="none" opacity=".7"/>`,
    coleta: `<path d="M36 58 q0 -26 24 -26 q24 0 24 26 q-4 -12 -24 -14 q-20 2 -24 14z" fill="${hair}"/>`,
  }[L.style] || '';
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="pcClip"><circle cx="60" cy="60" r="58"/></clipPath></defs>
    <circle cx="60" cy="60" r="58" fill="#FFE3D3"/>
    <g clip-path="url(#pcClip)">
      ${back}
      <path d="M30 120 q4 -20 30 -22 q26 2 30 22z" fill="${L.top}"/>
      <path d="M50 99 h20 l-4 21 h-12z" fill="#FFFFFF"/>
      <rect x="52" y="84" width="16" height="16" rx="6" fill="${shade(L.skin, 0.95)}"/>
      <ellipse cx="60" cy="64" rx="22" ry="25" fill="${L.skin}"/>
      ${front}
      <ellipse cx="51" cy="64" rx="3" ry="3.6" fill="#3B2416"/><ellipse cx="69" cy="64" rx="3" ry="3.6" fill="#3B2416"/>
      <circle cx="52" cy="63" r="1" fill="#fff"/><circle cx="70" cy="63" r="1" fill="#fff"/>
      <path d="M46 57 q5 -3 9 0 M65 57 q5 -3 9 0" stroke="${brow}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="45" cy="73" rx="4.5" ry="2.6" fill="#F2A7A0" opacity=".5"/><ellipse cx="75" cy="73" rx="4.5" ry="2.6" fill="#F2A7A0" opacity=".5"/>
      <path d="M51 74 q9 9 18 0 q-9 4 -18 0z" fill="#fff" stroke="#B5534A" stroke-width="1.6" stroke-linejoin="round"/>
      ${L.glasses ? '<g fill="none" stroke="#5A3420" stroke-width="2.2"><rect x="41" y="57" width="18" height="14" rx="5"/><rect x="61" y="57" width="18" height="14" rx="5"/><path d="M59 63 h2"/></g>' : ''}
    </g>
  </svg>`;
}

// The look used by the hotel's lobby figure (hair, skin, top colors).
export const lookColors = (look) => (look?.preset === 'luciana' ? { skin: '#F7D2B6', hair: '#6B4026', top: '#6E1F33' } : { ...DEFAULT_LOOK, ...look });

export const playerMarkup = (look, opts) => (look?.preset === 'luciana' ? lucianaMarkup(opts) : personMarkup(look));
export const playerAvatar = (cls = '', look, opts) => svgEl(`<div class="portrait ${cls}">${playerMarkup(look, opts)}</div>`);
export const papaPortrait = () => papaMarkup();
