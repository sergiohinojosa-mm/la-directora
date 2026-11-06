// Weekly challenges: a short, concrete goal each week with a cash reward from the board.
// check(s, w, days) runs on the week's summary at the end of the week.

import { money } from '../util.js';

const PROFIT_WEEK = { playa: 40_000, centro: 18_000, carretera: 10_000 };

export const CHALLENGES = [
  { id: 'sin_perdidos', icon: '🧽', title: 'Semana impecable', text: 'Que ningún huésped se quede sin cuarto por limpieza.',
    check: (s, w) => w.lostDirty === 0, reward: 8000 },
  { id: 'sabado_lleno', icon: '🏨', title: 'Sábado lleno', text: 'Vende todos los cuartos el sábado.',
    check: (s, w, days) => days.some((r) => r.dow === 5 && r.soldTotal === r.rooms), reward: 6000 },
  { id: 'ganancia', icon: '💰', title: 'Semana de oro', text: (s) => `Gana más de ${money(PROFIT_WEEK[s.locationId])} esta semana.`,
    check: (s, w) => w.profit > PROFIT_WEEK[s.locationId], reward: 10000 },
  { id: 'resenas', icon: '⭐', title: 'Huéspedes felices', text: 'Sube tus reseñas al menos 0.1★ esta semana.',
    check: (s, w) => w.reputation - w.repStart >= 0.1, reward: 7000 },
  { id: 'animo', icon: '💛', title: 'Equipo contento', text: 'Termina la semana con el ánimo del equipo en 75 o más.',
    check: (s, w) => w.morale >= 75, reward: 6000 },
  { id: 'entre_semana', icon: '📅', title: 'Martes con vida', text: 'Llena al menos 60% del hotel el martes.',
    check: (s, w, days) => days.some((r) => r.dow === 1 && r.occupancy >= 0.6), reward: 7000 },
];

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
export const challengeText = (c, s) => (typeof c.text === 'function' ? c.text(s) : c.text);
