// Turn structure: morning event → decisions → day → evening → (week report) → (board meeting).

import { rng, pickWeighted, calendar, clamp, DAYS_PER_MONTH } from '../util.js';
import { EVENTS, EVENT_BY_ID } from '../data/events.js';
import { simulateDay, summarize, weekCost } from './sim.js';
import { afterDay, afterWeek, afterMonth, afterHire, discover, applyLesson } from './lessons.js';
import { checkBadges } from '../data/badges.js';
import { hire as hireOne, fire as fireOne } from './sim.js';

const EVENT_CHANCE = 0.5;

// The adaptive game director: a hotel doing well gets more bad news, one struggling gets less.
function difficulty(s) {
  const last = s.history.slice(-7);
  if (last.length < 3) return 0;
  const profit = last.reduce((a, r) => a + r.profit, 0);
  return clamp(profit / (weekCost(s) * 0.5), -1, 1);
}

export function startMorning(s) {
  s.phase = 'morning';
  s.event = null;
  s.eventResult = null;
  if (s.day === 1 || rng(s) > EVENT_CHANCE) return;
  const recent = s.eventsSeen.slice(-8);
  const d = difficulty(s);
  const pool = EVENTS.filter((e) => s.day >= e.minDay && !recent.includes(e.id));
  if (!pool.length) return;
  const ev = pickWeighted(s, pool, (e) => (e.negative ? 1 + d * 0.6 : 1 - d * 0.4));
  s.event = { id: ev.id };
  s.eventsSeen.push(ev.id);
}

export function resolveEvent(s, optionIndex) {
  const ev = EVENT_BY_ID[s.event.id];
  const opt = ev.options[optionIndex];
  s.eventResult = opt.apply(s) || '';
  s.event.chosen = optionIndex;
  if (ev.negative) s.flags.badEventDay = s.day;
  if (ev.lesson) {
    if (!discover(s, ev.lesson) && optionIndex === 0) applyLesson(s, ev.lesson);
  }
  checkBadges(s, 'event');
}

export function hire(s) {
  hireOne(s);
  afterHire(s);
  checkBadges(s, 'hire');
}

export const fire = fireOne;

export function playDay(s) {
  const r = simulateDay(s);
  afterDay(s, r);
  checkBadges(s, 'day', r);
  s.lastResult = r;
  s.phase = 'evening';
  return r;
}

// Called when she taps "Siguiente" on the evening report. Returns the next phase.
export function finishEvening(s) {
  const r = s.lastResult;
  if (r.cash < 0) {
    s.rescues += 1;
    s.phase = s.rescues >= 2 ? 'closed' : 'rescue';
    if (s.phase === 'rescue') {
      s.cash += Math.round(weekCost(s) * 2 / 1000) * 1000;
      s.confidence = clamp(s.confidence - 20, 0, 100);
    }
    return s.phase;
  }
  return advanceAfterDay(s);
}

export function advanceAfterDay(s) {
  const day = s.lastResult.day;
  if (day % 7 === 0 && !s.weeks.find((w) => w.week === day / 7)) {
    const w = { week: day / 7, ...summarize(s.history.slice(-7)) };
    const prev = s.weeks[s.weeks.length - 1];
    s.weeks.push(w);
    afterWeek(s, w, prev);
    checkBadges(s, 'week', w, prev);
    s.phase = 'week';
    return s.phase;
  }
  if (day % DAYS_PER_MONTH === 0 && !s.months.find((m) => m.month === day / DAYS_PER_MONTH)) {
    const m = { month: day / DAYS_PER_MONTH, startCash: s.monthStartCash ?? s.startCash, ...summarize(s.history.slice(-DAYS_PER_MONTH)) };
    s.months.push(m);
    afterMonth(s, m);
    checkBadges(s, 'month', m);
    s.phase = 'board';
    return s.phase;
  }
  nextDay(s);
  return s.phase;
}

export function nextDay(s) {
  if (calendar(s.day).dayOfMonth === DAYS_PER_MONTH) s.monthStartCash = s.cash;
  s.day += 1;
  startMorning(s);
}
