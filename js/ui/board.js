// Monthly board meeting: present three numbers, answer the board, get the verdict and the next mandate.

import { h, money, pct } from '../util.js';
import { kpis, questions, resolveMeeting, mandateFor, planReady, planQuestion, planVotes, resolvePlan, DIVIDENDS, payDividends } from '../engine/board.js';
import { PROJECTS } from '../engine/systems.js';
import { lucianaAvatar } from './avatar.js';
import { yearClose } from './chapter.js';
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
  // Chapter 8+: the big-bet vote (if her plan is ready) and, at year close, the dividends.
  const withPlan = m.month >= 11 && planReady(s) && !m.resolved;
  const withDividends = m.month % 12 === 0 && !m.resolved;
  const pq = withPlan ? planQuestion(s) : null;
  let planAnswer = null;
  let planResult = null;
  let divChoice = null;
  let divBonus = false;
  let divResult = null;
  const STEPS = ['intro', 'present', ...qs.map((_, i) => `q${i}`), ...(withPlan ? ['plan'] : []), ...(withDividends ? ['dividends'] : []), 'verdict'];
  if (m.resolved) step = STEPS.length - 1;

  const members = m.chapter >= 8 || m.month >= 11 ? ['alma', 'papa', 'marcela', 'rodrigo'] : ['alma', 'papa', 'marcela'];
  const table = (speaker) => h('div', { class: `board-table n${members.length}` },
    members.map((who) => h('div', { class: 'seat', style: { opacity: speaker && speaker !== who ? 0.5 : 1 } },
      avatar(who), h('b', null, BOARD[who].name), h('small', null, BOARD[who].role))),
    h('div', { class: 'seat presenter' }, lucianaAvatar('sm', { badge: false }), h('b', null, 'Luciana'), h('small', null, 'Directora General')));

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
      botones('Primero presentas el mes. Elige los <b>3 números</b> que quieres mostrarle al Consejo. Una buena directora no esconde lo que salió mal.'),
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
      answered ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { step += 1; render(); } }, i < qs.length - 1 ? 'Siguiente pregunta' : STEPS[step + 1] === 'plan' ? '🗳️ Presentar mi gran apuesta' : STEPS[step + 1] === 'dividends' ? '💸 Decidir los dividendos' : 'Ver el veredicto') : null);
  }

  function report() {
    const c = m.costs;
    return h('div', { class: 'pl', style: { marginTop: '8px' } },
      ...[['Ingresos', m.revenue], ['Operación fija del hotel', -c.fixed], ['Costo por cuarto ocupado', -c.variable], ['Sueldos', -c.wages], ['Ventas, marketing y comisiones', -((c.marketing || 0) + (c.commission || 0))], ['Restaurante y extras', -(c.restaurant || 0)], ['Mantenimiento y controles', -(c.maint || 0)], ['Impuestos', -((c.tax || 0) + (c.isr || 0))], ['Pago al banco', -c.loan], ['Otros', -(c.extra + c.promises + (c.service || 0) + (c.socio || 0))]]
        .filter(([, v]) => v !== 0)
        .map(([l, v]) => h('div', { class: 'ln' }, h('span', null, l), h('span', { class: 'num' }, money(v)))),
      h('div', { class: 'ln tot' }, h('span', null, 'Ganancia'), h('span', { class: 'num' }, money(m.profit))),
      h('div', { class: 'ln' }, h('span', null, 'Cuartos llenos'), h('span', { class: 'num' }, pct(m.occupancy))));
  }

  function planStep() {
    const votes = planVotes(s, m);
    const p = PROJECTS[s.plan.project];
    const answered = planAnswer != null;
    if (answered && !planResult) { planResult = resolvePlan(s, m, pq.options[planAnswer].correct); checkBadges(s, 'project'); save(); }
    const voteRow = (who, v) => h('div', { class: `vote ${v.yes ? 'yes' : 'no'}` }, h('div', { class: 'row' }, avatar(who, 'sm'), h('b', null, `${v.yes ? '👍' : '👎'} ${BOARD[who].name}`)), h('small', null, v.why));
    frame(
      table(answered ? null : 'papa'),
      h('div', { class: 'card stack' },
        h('span', { class: 'kicker' }, '🗳️ Tu gran apuesta'),
        h('h3', null, `${p.icon} ${p.name}`),
        h('p', { class: 'muted' }, `Cuesta ${money(votes.cost)} · deja ~${money(votes.est)} al mes · ${s.plan.funding === 'caja' ? 'con la caja del hotel' : s.plan.funding === 'banco' ? 'con préstamo del banco' : 'con Don Rodrigo como socio'}`)),
      h('div', { class: 'card qcard stack' },
        h('div', { class: 'row' }, avatar('papa', 'sm'), h('b', null, BOARD.papa.name)),
        h('h3', null, pq.text),
        pq.options.map((o, j) => h('button', {
          class: `option ${answered ? (o.correct ? 'right' : j === planAnswer ? 'wrong' : '') : ''}`,
          disabled: answered,
          onclick: () => { planAnswer = j; sfx(o.correct ? 'good' : 'bad'); render(); },
        }, h('b', null, o.label))),
        answered ? h('div', { class: `alert ${pq.options[planAnswer].correct ? 'good' : 'bad'}` }, pq.explain) : null),
      answered ? h('div', { class: 'card stack' },
        h('span', { class: 'kicker' }, 'La votación'),
        voteRow('alma', votes.alma), voteRow('marcela', votes.marcela), voteRow('rodrigo', votes.rodrigo),
        voteRow('papa', { yes: planResult.papaYes, why: planResult.papaYes ? 'Conoces los números de tu plan. Tienes mi voto.' : 'Antes de pedir dinero, tienes que saber en cuánto tiempo se recupera.' }),
        h('div', { class: `alert ${planResult.approved ? 'good' : 'bad'}` }, planResult.approved
          ? `✅ ¡Aprobado con ${planResult.yes} de 4 votos! La obra empieza mañana y tarda ${p.days} días.`
          : `❌ Rechazado: ${planResult.yes} de 4 votos. Ajusta tu plan y preséntalo en la próxima junta.`)) : null,
      answered ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { if (planResult.approved) confetti(1); step += 1; render(); } }, 'Continuar') : null);
  }

  function dividendsStep() {
    if (divResult) {
      frame(
        table(),
        h('div', { class: 'card stack' },
          h('span', { class: 'kicker' }, '💸 Dividendos'),
          h('h3', null, divResult.amount ? `Repartiste ${money(divResult.amount)} a los dueños` : 'No repartiste dividendos'),
          divResult.bonus ? h('p', null, `Y le diste ${money(divResult.bonus)} de bono a tu equipo.`) : null,
          divResult.notes.map((n) => h('div', { class: 'row', style: { textAlign: 'left' } }, avatar(n.by, 'sm'), h('p', null, h('b', null, BOARD[n.by].name + ': '), n.text))),
          h('div', { class: 'alert info' }, `Caja después: ${money(s.cash)}`)),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { step += 1; render(); } }, 'Ver el veredicto'));
      return;
    }
    frame(
      table(),
      h('div', { class: 'card stack' },
        h('span', { class: 'kicker' }, '💸 Fin del año: ¿cuánto repartir?'),
        h('p', null, 'Los dueños pusieron su dinero para comprar el hotel. Alma quiere que reciban una parte de la ganancia; Marcela quiere que el dinero se quede para el equipo y el hotel; Don Rodrigo quiere ver su retorno.'),
        h('div', { class: 'alert info' }, `Caja hoy: ${money(s.cash)}`),
        DIVIDENDS.map((d) => h('button', { class: `option ${divChoice === d.id ? 'sel' : ''}`, onclick: () => { divChoice = d.id; sfx('tap'); render(); } },
          h('b', null, d.name), h('small', { class: 'muted' }, `${d.pct ? money(Math.round((Math.max(0, s.cash) * d.pct) / 1000) * 1000) + ' · ' : ''}${d.note}`))),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: divBonus, onchange: (e) => { divBonus = e.target.checked; } }),
          h('span', null, h('b', null, `Además, bono de fin de año al equipo (${money(1500 * s.housekeepers)})`), h('br'), h('small', { class: 'muted' }, 'Sube mucho el ánimo.')))),
      h('button', { class: 'btn btn-primary btn-big btn-block', disabled: divChoice == null, onclick: () => { divResult = payDividends(s, divChoice, divBonus); save(); sfx('coin'); render(); } }, 'Decidir'));
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
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => {
        if (res.verdict === 'closed') { s.phase = 'closed'; save(); nav.game(); return; }
        if (m.month === 1) { s.flags.chapter1Done = true; }
        if (m.month % 12 === 0 && !m.yearShown) { m.yearShown = true; save(); await yearClose(s); }
        nextDay(s);
        save();
        nav.game();
      } }, res.verdict === 'closed' ? 'Continuar' : m.month % 12 === 0 ? '🎓 Cerrar el año' : '🚀 Empezar el nuevo mes'));
    drainInbox(s, save).then(save);
  }

  function render() {
    const id = STEPS[step];
    if (id === 'intro') return intro();
    if (id === 'present') return present();
    if (id.startsWith('q')) return question(+id.slice(1));
    if (id === 'plan') return planStep();
    if (id === 'dividends') return dividendsStep();
    return verdict();
  }
  render();
}
