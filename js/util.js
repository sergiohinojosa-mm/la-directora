// Small shared helpers: DOM building, formatting and a seeded random generator.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round = (v, step = 1) => Math.round(v / step) * step;

const mxn = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
export const money = (v) => (v < 0 ? '−$' : '$') + mxn.format(Math.abs(Math.round(v)));
export const pct = (v) => Math.round(v * 100) + '%';
export const stars = (v) => v.toFixed(1) + '★';
export const signed = (v, fmt = (x) => x) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));

// mulberry32: deterministic, so a saved game replays the same way.
export function rng(state) {
  let t = (state.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pickWeighted(state, items, weightOf) {
  const total = items.reduce((s, it) => s + weightOf(it), 0);
  let r = rng(state) * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const MONTHS = ['Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo'];
export const DAYS_PER_MONTH = 28;

export function calendar(day) {
  const d = day - 1;
  return {
    dow: d % 7,
    week: Math.floor(d / 7) + 1,
    month: Math.floor(d / DAYS_PER_MONTH) + 1,
    dayOfMonth: (d % DAYS_PER_MONTH) + 1,
  };
}

export function dateLabel(day) {
  const c = calendar(day);
  return `${DAYS[c.dow]} ${c.dayOfMonth} de ${MONTHS[(c.month - 1) % 12]}`;
}
