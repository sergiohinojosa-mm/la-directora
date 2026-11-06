// "¿Quién juega?": one profile per player on this device, each with her own hotel and progress,
// and a small avatar builder so everyone sees herself in the game.

import { h } from '../util.js';
import { profiles, createProfile, updateProfile, deleteProfile, loadGameOf, selectProfile } from '../store.js';
import { rank } from '../data/badges.js';
import { mount, modal, sfx } from './core.js';
import { playerAvatar, playerMarkup, LOOKS, DEFAULT_LOOK } from './avatar.js';

export function pickPlayer(onPick) {
  const draw = () => {
    const list = profiles();
    mount(h('div', { class: 'page players' },
      h('div', { class: 'logo small' }, h('span', null, 'BAHÍA CORASOL'), 'La Directora'),
      h('h2', null, '¿Quién juega hoy?'),
      h('div', { class: 'player-grid' },
        list.map((p) => {
          const s = loadGameOf(p.id);
          const sub = s?.hotelName ? `${s.hotelName} · ${rank(s).name}` : 'Todavía sin hotel';
          return h('div', { class: 'player-card' },
            h('button', { class: 'pc-main', onclick: () => { sfx('tap'); selectProfile(p.id); onPick(p.id); } },
              playerAvatar('big', p.look, { badge: false }), h('b', null, p.name), h('small', null, sub)),
            h('div', { class: 'pc-tools' },
              h('button', { 'aria-label': `Editar a ${p.name}`, onclick: async () => {
                const r = await editor(p); if (r) { updateProfile(p.id, r); draw(); }
              } }, '✎ Editar'),
              h('button', { 'aria-label': `Borrar a ${p.name}`, onclick: async () => {
                const ok = await modal((close) => h('div', { class: 'msg-card' },
                  h('div', { class: 'quote', style: { fontSize: '24px' } }, `¿Borrar a ${p.name}?`),
                  h('p', { class: 'meaning' }, 'Se borra su hotel, sus lecciones, sus insignias y su diario. No se puede deshacer.'),
                  h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, 'Sí, borrar'),
                  h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, 'Cancelar')), { dismissable: true });
                if (ok) { deleteProfile(p.id); sfx('bad'); draw(); }
              } }, '🗑')));
        }),
        h('button', { class: 'player-card new', onclick: async () => {
          const r = await editor(null);
          if (r) { const id = createProfile(r.name, r.look); sfx('fanfare'); onPick(id); }
        } }, h('span', { class: 'plus' }, '＋'), h('b', null, 'Nueva jugadora'), h('small', null, 'Cada quien con su propio hotel')))));
  };
  draw();
}

// Name + look. Resolves to { name, look } or null.
export function editor(existing) {
  let name = existing?.name || '';
  let look = { ...DEFAULT_LOOK, ...(existing?.look || {}) };
  const canPortrait = existing?.look?.preset === 'luciana';
  return modal((close) => {
    const preview = h('div', { class: 'portrait big editor-prev', html: playerMarkup(look) });
    const input = h('input', { class: 'text-input', value: name, maxlength: 16, placeholder: 'Tu nombre', 'aria-label': 'Nombre', oninput: (e) => { name = e.target.value; save.disabled = !name.trim(); } });
    const save = h('button', { class: 'btn btn-primary btn-block', disabled: !name.trim(), onclick: () => close({ name: name.trim(), look }) }, existing ? 'Guardar' : '¡Listo, a jugar!');
    const refresh = () => { preview.innerHTML = playerMarkup(look); body.replaceChildren(...rows()); };
    const swatches = (key, colors) => h('div', { class: 'swatches' }, colors.map((c) => h('button', {
      class: `sw ${look[key] === c && look.preset !== 'luciana' ? 'on' : ''}`, style: { background: c }, 'aria-label': `Color ${c}`,
      onclick: () => { look = { ...look, preset: undefined, [key]: c }; sfx('tap'); refresh(); },
    })));
    const rows = () => [
      h('small', null, 'Peinado'),
      h('div', { class: 'seg-ctl' }, [
        ...(canPortrait ? [['luciana', '⭐ Retrato']] : []),
        ...LOOKS.style,
      ].map(([id, label]) => h('button', {
        class: (id === 'luciana' ? look.preset === 'luciana' : look.preset !== 'luciana' && look.style === id) ? 'on' : '',
        onclick: () => { look = id === 'luciana' ? { ...look, preset: 'luciana' } : { ...look, preset: undefined, style: id }; sfx('tap'); refresh(); },
      }, h('b', null, label)))),
      h('small', null, 'Color de pelo'), swatches('hair', LOOKS.hair),
      h('small', null, 'Piel'), swatches('skin', LOOKS.skin),
      h('small', null, 'Ropa'), swatches('top', LOOKS.top),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!look.glasses, onchange: (e) => { look = { ...look, preset: undefined, glasses: e.target.checked }; refresh(); } }), h('span', null, h('b', null, 'Lentes'))),
    ];
    const body = h('div', { class: 'editor-rows' }, ...rows());
    setTimeout(() => input.focus(), 80);
    return h('div', { class: 'msg-card editor' },
      h('div', { class: 'from' }, existing ? 'Editar jugadora' : 'Nueva jugadora'),
      preview, input, body, save,
      h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(null) }, 'Cancelar'));
  }, { dismissable: true });
}
