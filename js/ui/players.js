// "¿Quién juega?": one profile per player on this device, each with her own hotel and progress,
// and a small avatar builder so everyone sees herself in the game.

import { h } from '../util.js';
import { profiles, createProfile, updateProfile, deleteProfile, loadGameOf, selectProfile } from '../store.js';
import { rank } from '../data/badges.js';
import { mount, modal, sfx, toast } from './core.js';
import { cloudAvailable, cloudOn, newFamilyCode, formatCode, parseCode, joinLink, joinFamily, leaveFamily, syncPlayers } from '../cloud.js';
import { familyCode } from '../store.js';
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
          const sub = s?.hotelName && !((p.cloudVer || 0) > (p.ver || 0))
            ? `${s.hotelName} · ${rank(s).name}`
            : p.sum?.h ? `${p.sum.h} · Mes ${Math.floor(Math.max(0, p.sum.d - 1) / 28) + 1} · ☁️` : 'Todavía sin hotel';
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
                  h('p', { class: 'meaning' }, `Se borra su hotel, sus lecciones, sus insignias y su diario${cloudOn() ? ' en todos los dispositivos de la familia' : ''}. No se puede deshacer.`),
                  h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, 'Sí, borrar'),
                  h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, 'Cancelar')), { dismissable: true });
                if (ok) { deleteProfile(p.id); sfx('bad'); draw(); }
              } }, '🗑')));
        }),
        h('button', { class: 'player-card new', onclick: async () => {
          const r = await editor(null);
          if (r) { const id = createProfile(r.name, r.look); sfx('fanfare'); onPick(id); }
        } }, h('span', { class: 'plus' }, '＋'), h('b', null, 'Nueva jugadora'), h('small', null, 'Cada quien con su propio hotel'))),
      cloudAvailable() ? h('button', { class: 'btn btn-ghost family-btn', onclick: async () => { await family(); draw(); } },
        cloudOn() ? '☁️ Familia en línea: conectada' : '☁️ Jugar en varios dispositivos') : null));
  };
  draw();
  if (cloudOn()) syncPlayers().then((changed) => { if (changed && document.querySelector('.players')) draw(); }).catch(() => {});
}

// Familia en línea: the same players, games and board on every phone, tablet or laptop that has the code.
async function family() {
  sfx('tap');
  if (cloudOn()) {
    const choice = await modal((close) => h('div', { class: 'msg-card' },
      h('div', { class: 'quote', style: { fontSize: '24px' } }, '☁️ Familia en línea'),
      h('p', { class: 'meaning' }, 'Este dispositivo está conectado. Cada jugadora puede seguir su partida en cualquier dispositivo de la familia, y el Tablero de Directoras se actualiza solo.'),
      h('small', null, 'Código de la familia'),
      h('div', { class: 'family-code' }, formatCode(familyCode())),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => close('share') }, '📤 Mandar enlace a otro dispositivo'),
      h('button', { class: 'btn btn-secondary btn-block', onclick: () => close('leave') }, 'Desconectar este dispositivo'),
      h('button', { class: 'btn btn-ghost btn-block', style: { color: 'var(--ink)' }, onclick: () => close(null) }, 'Cerrar')), { dismissable: true });
    if (choice === 'share') return shareLink();
    if (choice === 'leave') {
      const ok = await modal((close) => h('div', { class: 'msg-card' },
        h('div', { class: 'quote', style: { fontSize: '22px' } }, '¿Desconectar este dispositivo?'),
        h('p', { class: 'meaning' }, 'Las partidas que se abrieron aquí se quedan aquí, pero ya no se comparten. Para volver a conectarlo necesitas el código.'),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => close(true) }, 'Sí, desconectar'),
        h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(false) }, 'Cancelar')), { dismissable: true });
      if (ok) { leaveFamily(); toast('Este dispositivo ya no comparte partidas.'); }
    }
    return;
  }
  const choice = await modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'quote', style: { fontSize: '24px' } }, '☁️ Jugar en varios dispositivos'),
    h('p', { class: 'meaning' }, 'Conecta los celulares y la computadora de la familia: cada jugadora sigue su partida donde sea y todas se comparan en el Tablero de Directoras.'),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close('new') }, 'Crear mi familia (primer dispositivo)'),
    h('button', { class: 'btn btn-secondary btn-block', onclick: () => close('code') }, 'Ya tengo un código'),
    h('button', { class: 'btn btn-ghost btn-block', style: { color: 'var(--ink)' }, onclick: () => close(null) }, 'Cancelar')), { dismissable: true });
  let code = null;
  if (choice === 'new') code = newFamilyCode();
  if (choice === 'code') {
    const text = await modal((close) => {
      const input = h('input', { class: 'text-input', placeholder: 'xxxxx-xxxxx-xxxxx-xxxxx', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Código de la familia' });
      setTimeout(() => input.focus(), 80);
      return h('div', { class: 'msg-card' },
        h('div', { class: 'quote', style: { fontSize: '22px' } }, 'Código de la familia'),
        h('p', { class: 'meaning' }, 'Escribe el código o pega el enlace que te mandaron.'),
        input,
        h('button', { class: 'btn btn-primary btn-block', onclick: () => close(input.value) }, 'Conectar'),
        h('button', { class: 'btn btn-secondary btn-block', onclick: () => close(null) }, 'Cancelar'));
    }, { dismissable: true });
    if (text == null) return;
    code = parseCode(text);
    if (!code) return toast('Ese código no está completo. Son 20 letras y números.');
  }
  if (!code) return;
  try {
    await joinFamily(code, sameName);
    sfx('fanfare');
    toast(choice === 'new' ? '¡Familia creada! Manda el enlace a los otros dispositivos.' : '¡Listo! Ya están todas las jugadoras de tu familia.');
    if (choice === 'new') await shareLink();
  } catch {
    toast('No pude conectarme. Revisa el internet e intenta otra vez.');
  }
}

// Joining a family that already has a player with her name.
export function sameName({ name, local, cloud }) {
  const month = (d) => Math.floor(Math.max(0, (d || 1) - 1) / 28) + 1;
  const here = local?.hotelName ? `${local.hotelName} · Mes ${month(local.day)}` : 'Sin hotel todavía';
  const there = cloud?.h ? `${cloud.h} · Mes ${month(cloud.d)}` : 'Sin hotel todavía';
  return modal((close) => h('div', { class: 'msg-card' },
    h('div', { class: 'quote', style: { fontSize: '22px' } }, `Ya hay una ${name} en tu familia`),
    h('p', { class: 'meaning' }, `Si es la misma ${name}, elige con qué partida sigue. La otra se borra.`),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => close('cloud') }, h('span', null, '☁️ La de la familia', h('br'), h('small', null, there))),
    h('button', { class: 'btn btn-secondary btn-block', onclick: () => close('local') }, h('span', null, '📱 La de este dispositivo', h('br'), h('small', null, here))),
    h('button', { class: 'btn btn-ghost btn-block', style: { color: 'var(--ink)' }, onclick: () => close('both') }, 'Son dos personas distintas')));
}

async function shareLink() {
  const url = joinLink();
  const text = 'Abre este enlace para jugar La Directora en este dispositivo con la familia:';
  if (navigator.share) {
    try { await navigator.share({ title: 'La Directora', text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Enlace copiado. Pégalo en el chat de la familia.'); } catch {
    await modal((close) => h('div', { class: 'msg-card' },
      h('div', { class: 'quote', style: { fontSize: '22px' } }, 'Copia este enlace'),
      h('textarea', { class: 'text-input', readonly: true, onfocus: (e) => e.target.select() }, url),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => close() }, 'Listo')), { dismissable: true });
  }
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
