// Monthly board meeting: present three numbers, answer the board, get the verdict and the next mandate.

import { h, money, pct } from '../util.js';
import { kpis, questions, resolveMeeting, mandateFor } from '../engine/board.js';
import { nextDay } from '../engine/flow.js';
import { checkBadges } from '../data/badges.js';
import { BOARD } from '../data/world.js';
import { saveGame } from '../store.js';
import { app, mount, avatar, sfx, confetti, botones } from './core.js';
import { drainInbox } from './inbox.js';

let nav = {};
export function setBoardNav(n) { nav = n; }

export function renderBoard() {
  const s = app.s;
  const m = s.months[s.months.length - 1];
  const all = kpis(s, m);
  const qs = questions(s, m);
  const picked = [];
  const answers = [];
  let step = 0;
  const save = () => saveGame(s);
  if (m.resolved) step = 2 + qs.length;

  const table = (speaker) => h('div', { class: 'board-table' },
    ['alma', 'papa', 'marcela'].map((who) => h('div', { class: 'seat', style: { opacity: speaker && speaker !== who ? 0.5 : 1 } },
      avatar(who), h('b', null, BOARD[who].name), h('small', null, BOARD[who].role))));

  function frame(...children) {
    mount(h('div', { class: 'page', style: { maxWidth: '760px' } },
      h('div', { class: 'page-head' }, h('h2', null, `Junta de Consejo · Mes ${m.month}`)),
      ...children));
    window.scrollTo(0, 0);
  }

  function intro() {
    const mandate = mandateFor(m.month);
    frame(
      table(),
      h('div', { class: 'card stack' },
        h('span', { class: 'kicker' }, 'El mandato de este mes era'),
        h('h3', null, mandate.title),
        h('p', { class: 'muted' }, mandate.text(s))),
      botones('Primero presentas el mes. Elige los <b>3 números</b> que quieres mostrarle al Consejo. Un buen director no esconde lo que salió mal.'),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { step = 1; render(); } }, 'Preparar mi presentación'));
  }

  function present() {
    frame(
      h('p', { class: 'muted-dark' }, `Elegidos: ${picked.length} de 3`),
      h('div', { class: 'kpi-pick' }, all.map((k) => {
        const sel = picked.includes(k.id);
        return h('button', { class: `${sel ? 'sel' : ''} ${k.bad ? 'bad' : ''}`, 'aria-pressed': sel, onclick: () => {
          if (sel) picked.splice(picked.indexOf(k.id), 1);
          else if (picked.length < 3) picked.push(k.id);
          sfx('tap');
          render();
        } }, h('small', { class: 'muted' }, k.label), h('b', null, k.value));
      })),
      h('button', { class: 'btn btn-primary btn-big btn-block', disabled: picked.length !== 3, onclick: () => { step = 2; render(); } }, picked.length === 3 ? 'Presentar' : 'Elige 3 números'));
  }

  function question(i) {
    const q = qs[i];
    const answered = answers[i] != null;
    frame(
      table(q.by),
      h('div', { class: 'card qcard stack' },
        h('div', { class: 'row' }, avatar(q.by, 'sm'), h('b', null, BOARD[q.by].name)),
        h('h3', null, q.text),
        q.options.map((o, j) => h('button', {
          class: `option ${answered ? (o.correct ? 'right' : j === answers[i] ? 'wrong' : '') : ''}`,
          disabled: answered,
          onclick: () => { answers[i] = j; sfx(o.correct ? 'good' : 'bad'); render(); },
        }, h('b', null, o.label))),
        answered ? h('div', { class: `alert ${q.options[answers[i]].correct ? 'good' : 'bad'}` },
          q.options[answers[i]].correct ? '✅ ¡Exacto! ' : '💡 No exactamente. ', q.explain) : null,
        i === 0 && !answered ? h('details', { class: 'more' }, h('summary', null, 'Ver mi reporte del mes ▾'), report()) : null),
      answered ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { step += 1; render(); } }, i < qs.length - 1 ? 'Siguiente pregunta' : 'Ver el veredicto') : null);
  }

  function report() {
    const c = m.costs;
    return h('div', { class: 'pl', style: { marginTop: '8px' } },
      ...[['Ingresos', m.revenue], ['Operación fija del hotel', -c.fixed], ['Costo por cuarto ocupado', -c.variable], ['Sueldos de limpieza', -c.wages], ['Pago al banco', -c.loan], ['Otros', -(c.extra + c.promises)]]
        .map(([l, v]) => h('div', { class: 'ln' }, h('span', null, l), h('span', { class: 'num' }, money(v)))),
      h('div', { class: 'ln tot' }, h('span', null, 'Ganancia'), h('span', { class: 'num' }, money(m.profit))),
      h('div', { class: 'ln' }, h('span', null, 'Cuartos llenos'), h('span', { class: 'num' }, pct(m.occupancy))));
  }

  function verdict() {
    // Resolve once; a reload on this screen shows the same verdict instead of grading twice.
    if (!m.resolved) {
      m.resolved = resolveMeeting(s, m, picked, answers);
      checkBadges(s, 'board', m.resolved, picked, m);
      save();
    }
    const res = m.resolved;
    const next = mandateFor(m.month + 1);
    const texts = {
      bonus: 'Excelente mes, Directora. El Consejo aprueba un bono de $10,000 para el hotel.',
      ok: 'Buen trabajo. Sigue así y busca la siguiente estrella.',
      warning: 'El Consejo está preocupado. Necesitamos ver mejoras el próximo mes.',
      closed: 'El Consejo perdió la confianza. Tendremos que cerrar el hotel.',
    };
    if (res.stars >= 2) { sfx('fanfare'); confetti(1.2); } else sfx(res.stars ? 'good' : 'bad');
    frame(
      table('papa'),
      h('div', { class: 'card stack', style: { textAlign: 'center', justifyItems: 'center' } },
        h('span', { class: 'kicker' }, `Mandato: ${res.mandate.title}`),
        h('div', { class: 'star-row', 'aria-label': `${res.stars} de 3 estrellas` }, [1, 2, 3].map((n) => h('span', { class: n <= res.stars ? '' : 'off' }, '⭐'))),
        h('h3', null, texts[res.verdict]),
        res.notes.map((n) => h('div', { class: 'row', style: { textAlign: 'left' } }, avatar(n.by, 'sm'), h('p', null, h('b', null, BOARD[n.by].name + ': '), n.text))),
        h('p', { class: 'muted' }, `Respuestas correctas: ${res.correct} de ${res.total}`)),
      h('div', { class: 'card-dark card stack' },
        h('div', { class: 'row between' }, h('b', null, 'Confianza del Consejo'), h('b', { class: 'num' }, `${Math.round(s.confidence)} (${res.delta >= 0 ? '+' : ''}${Math.round(res.delta)})`)),
        h('div', { class: 'meter' }, h('i', { style: { width: s.confidence + '%' } }))),
      res.verdict === 'closed' ? null : h('div', { class: 'card stack' },
        h('span', { class: 'kicker' }, `Nuevo mandato para el mes ${m.month + 1}`),
        h('h3', null, next.title),
        h('p', { class: 'muted' }, next.text(s))),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => {
        if (res.verdict === 'closed') { s.phase = 'closed'; save(); nav.game(); return; }
        if (m.month === 1) { s.flags.chapter1Done = true; }
        nextDay(s);
        save();
        nav.game();
      } }, res.verdict === 'closed' ? 'Continuar' : '🚀 Empezar el nuevo mes'));
    drainInbox(s, save).then(save);
  }

  function render() {
    if (step === 0) return intro();
    if (step === 1) return present();
    if (step >= 2 && step < 2 + qs.length) return question(step - 2);
    return verdict();
  }
  render();
}
