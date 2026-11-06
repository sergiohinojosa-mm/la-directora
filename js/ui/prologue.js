// Prologue: the board's letter, choosing where to buy, the loan, the value proposition and the hotel's name.

import { h, money, pct } from '../util.js';
import {
  LOCATIONS, LOAN_OPTIONS, ATTRIBUTES, SEGMENTS, MAX_ATTRIBUTES, monthlyPayment,
  HOUSEKEEPER_DAILY,
} from '../data/world.js';
import { newGame, attrDemandBonus, expectationPenalty } from '../engine/sim.js';
import { discover } from '../engine/lessons.js';
import { startMorning, pickChallenge } from '../engine/flow.js';
import { app, mount, avatar, sfx, botones } from './core.js';
import { playerName } from '../store.js';
import { lessonNew } from './inbox.js';
import { hotelSvg } from './hotel.js';

const DAYS_PER_MONTH = 28;

export function startPrologue(onDone, carry = null) {
  const pick = { locationId: null, loanPct: 0.6, attributes: [], hotelName: 'Hotel Coral' };
  let step = 0;
  const total = 5;

  const stepsBar = () => h('div', { class: 'steps', 'aria-label': `Paso ${step + 1} de ${total}` },
    Array.from({ length: total }, (_, i) => h('i', { class: i <= step ? 'on' : '' })));

  const go = (n) => { step = n; sfx('tap'); render(); window.scrollTo(0, 0); };

  function render() {
    const views = [letter, location, loan, value, name];
    mount(h('div', { class: 'page' }, views[step]()));
  }

  function letter() {
    return h('div', { class: 'stack', style: { gap: '18px', maxWidth: '640px', margin: '0 auto' } },
      stepsBar(),
      h('div', { class: 'card', style: { display: 'grid', gap: '14px' } },
        h('div', { class: 'row' }, avatar('papa', 'sm'), avatar('alma', 'sm'), avatar('marcela', 'sm'),
          h('div', null, h('b', null, 'El Consejo'), h('div', { class: 'muted', style: { fontSize: '13px' } }, 'Grupo Bahía Corasol'))),
        h('h2', { style: { fontSize: '30px' } }, carry ? `Año ${carry.year}: una nueva oportunidad` : `Querida ${playerName()}:`),
        h('p', null, carry
          ? 'El hotel anterior cerró, pero lo que aprendiste se queda contigo. El Consejo confía en ti para intentarlo de nuevo en Bahía Corasol.'
          : 'El Consejo quiere entrar al negocio de los hoteles en Bahía Corasol, un pueblo de playa que se está poniendo de moda. Te elegimos como Directora General.'),
        h('p', null, 'Tu primera decisión es la más importante y la única que no se puede deshacer: ', h('b', null, 'dónde'), ' comprar el hotel. El Consejo pone una parte del dinero y el banco presta el resto.'),
        h('p', null, 'Después, cada día tú decides. Cada mes nos rindes cuentas. Mucho éxito, Directora.'),
        h('p', { class: 'muted' }, '— Papá, abuela Alma y mamá Marcela'),
      ),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => {
        if (discover(app.s, 'location')) app.s.inbox = app.s.inbox.filter((m) => m.id !== 'location');
        await showPending();
        if (app.s.lessons.location && !app.s.lessons.location.heard) { app.s.lessons.location.heard = true; await lessonNew('location', 'Estás por elegir dónde comprar tu hotel.'); }
        go(1);
      } }, 'Ver los hoteles en venta'),
    );
  }

  function location() {
    return h('div', { class: 'stack', style: { gap: '16px' } },
      stepsBar(),
      h('div', { class: 'page-head' }, h('h2', null, '¿Dónde compras tu hotel?')),
      botones('Mira <b>quién llega</b> a cada zona, cuánto pagan y <b>cuántos cuartos</b> necesitas llenar para no perder dinero.'),
      h('div', { class: 'grid3' }, LOCATIONS.map((L) => {
        const rooms = L.rooms.reduce((n, r) => n + r.count, 0);
        const avgRef = L.rooms.reduce((n, r) => n + r.ref * r.count, 0) / rooms;
        const pay = monthlyPayment(L.price * 0.6);
        const fixed = L.fixedMonthly + pay + L.startHousekeepers * HOUSEKEEPER_DAILY * DAYS_PER_MONTH;
        const breakEven = fixed / ((avgRef - L.varPerNight) * rooms * DAYS_PER_MONTH);
        const sel = pick.locationId === L.id;
        return h('button', { class: `choice ${sel ? 'sel' : ''}`, 'aria-pressed': sel, onclick: () => { pick.locationId = L.id; sfx('tap'); render(); } },
          h('div', { class: 'art', html: miniArt(L.id) }),
          h('div', { class: 'body' },
            h('div', { class: 'muted', style: { fontSize: '12px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' } }, L.zone),
            h('h3', null, L.name),
            h('p', { class: 'muted', style: { fontSize: '14px' } }, L.blurb),
            segBars(L.mix),
            h('div', { class: 'facts' },
              fact('Cuartos', rooms),
              fact('Precio por noche', money(avgRef)),
              fact('Precio de compra', money(L.price)),
              fact('Gastos fijos al mes', money(L.fixedMonthly)),
              fact('Cuartos llenos para no perder', pct(breakEven)),
            ),
            h('p', { style: { fontSize: '13px', color: '#9E2E1F', fontWeight: 600 } }, '⚠️ ', L.risk),
          ));
      })),
      h('div', { class: 'row', style: { gap: '10px' } },
        h('button', { class: 'btn btn-ghost', onclick: () => go(0) }, 'Atrás'),
        h('button', { class: 'btn btn-primary btn-big', style: { flex: 1 }, disabled: !pick.locationId, onclick: () => go(2) }, pick.locationId ? 'Elegir este' : 'Elige un hotel'),
      ),
    );
  }

  function loan() {
    const L = LOCATIONS.find((l) => l.id === pick.locationId);
    return h('div', { class: 'stack', style: { gap: '16px' } },
      stepsBar(),
      h('div', { class: 'page-head' }, h('h2', null, '¿Cuánto le pides al banco?')),
      botones(`El hotel cuesta <b>${money(L.price)}</b>. Lo que no pone el Consejo lo presta el banco, y cada mes hay que pagarle, <b>haya huéspedes o no</b>.`),
      h('div', { class: 'grid3' }, LOAN_OPTIONS.map((o) => {
        const g = newGame({ locationId: L.id, loanPct: o.pct, attributes: [], hotelName: '', seed: 1 });
        const sel = pick.loanPct === o.pct;
        return h('button', { class: `choice ${sel ? 'sel' : ''}`, 'aria-pressed': sel, onclick: () => { pick.loanPct = o.pct; sfx('tap'); render(); } },
          h('div', { class: 'body' },
            h('h3', null, o.name),
            h('div', { class: 'facts' },
              fact('Presta el banco', `${pct(o.pct)} · ${money(L.price * o.pct)}`),
              fact('Pone el Consejo', money(L.price * (1 - o.pct))),
              fact('Mensualidad al banco', money(g.payment)),
              fact('Dinero para arrancar', money(g.cash)),
            ),
            h('p', { class: 'muted', style: { fontSize: '14px' } }, o.note),
          ));
      })),
      h('div', { class: 'row', style: { gap: '10px' } },
        h('button', { class: 'btn btn-ghost', onclick: () => go(1) }, 'Atrás'),
        h('button', { class: 'btn btn-primary btn-big', style: { flex: 1 }, onclick: () => go(3) }, 'Firmar el crédito'),
      ),
    );
  }

  function value() {
    const L = LOCATIONS.find((l) => l.id === pick.locationId);
    const probe = newGame({ locationId: L.id, loanPct: pick.loanPct, attributes: pick.attributes, hotelName: '', seed: 1 });
    const bonus = attrDemandBonus(probe);
    const missing = expectationPenalty(probe) > 0;
    const monthly = pick.attributes.reduce((n, id) => n + ATTRIBUTES.find((a) => a.id === id).monthly, 0);
    return h('div', { class: 'stack', style: { gap: '16px' } },
      stepsBar(),
      h('div', { class: 'page-head' }, h('h2', null, 'Tu propuesta de valor')),
      botones(`Elige <b>${MAX_ATTRIBUTES} cosas</b> que hagan especial a tu hotel. Ojo: lo que a un cliente le encanta, a otro le molesta. Y todo cuesta.`),
      h('div', { class: 'card', style: { display: 'grid', gap: '8px' } },
        h('span', { class: 'kicker' }, `Quién llega a ${L.zone}`), segBars(L.mix)),
      h('div', { class: 'grid3' }, ATTRIBUTES.map((a) => {
        const sel = pick.attributes.includes(a.id);
        const full = !sel && pick.attributes.length >= MAX_ATTRIBUTES;
        return h('button', { class: `attr ${sel ? 'sel' : ''}`, 'aria-pressed': sel, disabled: full, onclick: () => {
          pick.attributes = sel ? pick.attributes.filter((x) => x !== a.id) : [...pick.attributes, a.id];
          sfx('tap'); render();
        } },
          h('div', { class: 'top' }, h('span', null, a.icon), h('b', null, a.name)),
          h('div', { class: 'likes' }, Object.entries(a.appeal).filter(([, v]) => v !== 0).map(([seg, v]) =>
            h('em', { class: v < 0 ? 'no' : '' }, `${v < 0 ? 'Molesta a' : 'Le gusta a'} ${SEGMENTS[seg].name.toLowerCase()}`))),
          h('small', { class: 'muted' }, [a.monthly ? `${money(a.monthly)} al mes` : '', a.perNight ? `${money(a.perNight)} por huésped` : ''].filter(Boolean).join(' · ')),
        );
      })),
      h('div', { class: 'card', style: { display: 'grid', gap: '8px' } },
        h('div', { class: 'row between' }, h('b', null, 'Más huéspedes por tu propuesta'), h('b', { class: 'num', style: { color: bonus >= 0 ? 'var(--good)' : 'var(--bad)' } }, `${bonus >= 0 ? '+' : ''}${Math.round(bonus * 100)}%`)),
        h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Costo fijo extra'), h('b', { class: 'num' }, `${money(monthly)} al mes`)),
        missing ? h('div', { class: 'alert bad' }, '⚠️ ', L.expects.note, ' Sin eso, tus reseñas bajarán.') : null,
      ),
      h('div', { class: 'row', style: { gap: '10px' } },
        h('button', { class: 'btn btn-ghost', onclick: () => go(2) }, 'Atrás'),
        h('button', { class: 'btn btn-primary btn-big', style: { flex: 1 }, disabled: pick.attributes.length === 0, onclick: async () => {
          if (discover(app.s, 'conoce_cliente')) { app.s.inbox = app.s.inbox.filter((m) => m.id !== 'conoce_cliente'); await lessonNew('conoce_cliente', 'Acabas de elegir qué hace especial a tu hotel.'); }
          go(4);
        } }, pick.attributes.length ? 'Listo' : 'Elige al menos una'),
      ),
    );
  }

  function name() {
    const input = h('input', { class: 'text-input', id: 'hotel-name', value: pick.hotelName, maxlength: 22, 'aria-label': 'Nombre del hotel', oninput: (e) => {
      pick.hotelName = e.target.value;
      preview.replaceChildren(hotelSvg(null, { mode: 'morning', name: pick.hotelName.trim() || 'Hotel Coral' }));
    } });
    const preview = h('div', { class: 'scene' }, hotelSvg(null, { mode: 'morning', name: pick.hotelName }));
    return h('div', { class: 'stack', style: { gap: '16px', maxWidth: '640px', margin: '0 auto' } },
      stepsBar(),
      h('div', { class: 'page-head' }, h('h2', null, 'Ponle nombre a tu hotel')),
      preview,
      input,
      h('div', { class: 'row', style: { gap: '10px' } },
        h('button', { class: 'btn btn-ghost', onclick: () => go(3) }, 'Atrás'),
        h('button', { class: 'btn btn-primary btn-big', style: { flex: 1 }, onclick: () => {
          const s = newGame({
            locationId: pick.locationId, loanPct: pick.loanPct, attributes: pick.attributes,
            hotelName: pick.hotelName.trim() || 'Hotel Coral',
            year: carry ? carry.year : 1, lessons: app.s?.lessons, diary: carry?.diary,
          });
          if (carry) { s.badges = carry.badges; s.stars = carry.stars; s.monthStars = carry.monthStars; }
          startMorning(s);
          pickChallenge(s);
          app.s = s;
          sfx('fanfare');
          onDone(s);
        } }, '🔑 Abrir las puertas'),
      ),
    );
  }

  render();
}

// Messages queued before the prologue (e.g. "La práctica hace al maestro" on a new year).
async function showPending() {
  const pending = app.s.inbox.filter((m) => m.kind === 'new');
  app.s.inbox = [];
  for (const m of pending) await lessonNew(m.id, m.ctx);
}

function fact(label, value) {
  return h('div', { class: 'ln' }, h('span', null, label), h('b', null, value));
}

function segBars(mix) {
  return h('div', { class: 'seg-bars' }, Object.entries(mix).map(([seg, share]) =>
    h('div', { class: 'seg' }, h('span', { title: SEGMENTS[seg].name }, SEGMENTS[seg].icon),
      h('div', { class: 'bar' }, h('i', { style: { width: share * 100 + '%' } })),
      h('small', { class: 'num' }, pct(share)))));
}

function miniArt(id) {
  const art = {
    playa: `<svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice"><rect width="300" height="120" fill="#FFD9B8"/><circle cx="240" cy="36" r="20" fill="#FFC24B"/><rect y="70" width="300" height="50" fill="#2EC4C9"/><rect y="98" width="300" height="22" fill="#F6DFA8"/><rect x="90" y="30" width="110" height="72" rx="8" fill="#FFF9F1"/><rect x="84" y="24" width="122" height="12" rx="5" fill="#FF6B57"/><g fill="#7FE0B1"><rect x="98" y="44" width="22" height="16" rx="3"/><rect x="134" y="44" width="22" height="16" rx="3"/><rect x="170" y="44" width="22" height="16" rx="3"/><rect x="98" y="68" width="22" height="16" rx="3"/><rect x="170" y="68" width="22" height="16" rx="3"/></g><rect x="40" y="50" width="6" height="52" fill="#8B5E3C"/><path d="M43 52 q-30 -4 -40 14 q20 -10 40 -8 q-10 -20 -36 -18 q26 4 36 14 q10 -22 30 -22 q-22 10 -26 24z" fill="#2FA36B"/></svg>`,
    centro: `<svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice"><rect width="300" height="120" fill="#BFE7EE"/><rect y="100" width="300" height="20" fill="#9AD3A8"/><rect x="10" y="40" width="60" height="60" rx="4" fill="#C9D3E6"/><rect x="230" y="30" width="60" height="70" rx="4" fill="#C9D3E6"/><rect x="95" y="26" width="110" height="76" rx="8" fill="#FFF9F1"/><rect x="89" y="20" width="122" height="12" rx="5" fill="#FF6B57"/><g fill="#7FE0B1"><rect x="103" y="40" width="22" height="16" rx="3"/><rect x="139" y="40" width="22" height="16" rx="3"/><rect x="175" y="40" width="22" height="16" rx="3"/><rect x="103" y="64" width="22" height="16" rx="3"/><rect x="139" y="64" width="22" height="16" rx="3"/></g><path d="M130 20 l20 -14 l20 14z" fill="#A78BFA"/></svg>`,
    carretera: `<svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice"><rect width="300" height="120" fill="#FFE7C9"/><rect y="84" width="300" height="36" fill="#9AD3A8"/><rect y="92" width="300" height="16" fill="#5A6485"/><path d="M0 100 h300" stroke="#FFC24B" stroke-width="2" stroke-dasharray="14 10"/><rect x="100" y="40" width="100" height="48" rx="6" fill="#FFF9F1"/><rect x="94" y="34" width="112" height="10" rx="4" fill="#FF6B57"/><g fill="#7FE0B1"><rect x="110" y="52" width="20" height="14" rx="3"/><rect x="140" y="52" width="20" height="14" rx="3"/><rect x="170" y="52" width="20" height="14" rx="3"/></g><rect x="230" y="30" width="6" height="56" fill="#5A6485"/><rect x="214" y="22" width="40" height="18" rx="4" fill="#FF6B57"/><text x="234" y="35" font-size="9" text-anchor="middle" fill="#fff" font-weight="800">MOTEL</text></svg>`,
  };
  return art[id];
}
