// Badges reward business skills, not time spent playing. Each check runs after the moment named in `on`.

const RECORD_DAY = { playa: 45_000, centro: 16_000, carretera: 7_000 };

export const BADGES = [
  { id: 'abrir', icon: '🔑', name: 'Puertas abiertas', desc: 'Cerraste tu primer día como Directora.', on: 'day', check: (s) => s.history.length >= 1 },
  { id: 'casa_llena', icon: '🏨', name: 'Casa llena', desc: 'Vendiste todos los cuartos en un día.', on: 'day', check: (s, r) => r.soldTotal === r.rooms },
  { id: 'precio_maestro', icon: '🎯', name: 'Precio maestro', desc: 'Llenaste 90% del hotel cobrando más de lo normal.', on: 'day', check: (s, r) => r.occupancy >= 0.9 && r.priceRatio >= 1.1 },
  { id: 'dia_record', icon: '🚀', name: 'Día récord', desc: 'Una ganancia enorme en un solo día.', on: 'day', check: (s, r) => r.profit >= RECORD_DAY[s.locationId] },
  { id: 'buena_paga', icon: '🏦', name: 'Buena paga', desc: 'Pagaste 3 mensualidades del banco a tiempo.', on: 'day', check: (s, r) => r.loanPaid > 0 && r.cash >= 0 && s.history.filter((x) => x.loanPaid).length >= 3 },
  { id: 'equipo_feliz', icon: '💛', name: 'Equipo feliz', desc: 'El ánimo del equipo llegó a 85.', on: 'day', check: (s, r) => r.morale >= 85 },
  { id: 'cuatro_estrellas', icon: '⭐', name: 'Cuatro estrellas', desc: 'Tus reseñas llegaron a 4.0★.', on: 'day', check: (s, r) => r.reputation >= 4.0 },
  { id: 'cinco_estrellas', icon: '🌟', name: 'Hotel favorito', desc: 'Tus reseñas llegaron a 4.5★.', on: 'day', check: (s, r) => r.reputation >= 4.5 },
  { id: 'semana_limpia', icon: '🧽', name: 'Semana impecable', desc: 'Una semana entera sin perder huéspedes por cuartos sucios.', on: 'week', check: (s, w) => w.lostDirty === 0 && w.occupancy > 0.5 },
  { id: 'semana_ganancia', icon: '💰', name: 'Números negros', desc: 'Tu primera semana con ganancia.', on: 'week', check: (s, w) => w.profit > 0 },
  { id: 'remontada', icon: '📈', name: 'Remontada', desc: 'Pasaste de una semana con pérdida a una con ganancia.', on: 'week', check: (s, w, prev) => prev && prev.profit < 0 && w.profit > 0 },
  { id: 'diario', icon: '📓', name: 'Directora reflexiva', desc: 'Escribiste 4 veces en tu diario.', on: 'week', check: (s) => s.diary.filter((d) => d.answer).length >= 4 },
  { id: 'racha4', icon: '🔥', name: 'Racha de oro', desc: '4 semanas seguidas con ganancia.', on: 'week', check: (s) => s.weeks.length >= 4 && s.weeks.slice(-4).every((w) => w.profit > 0) },
  { id: 'diario10', icon: '✍️', name: 'Escritora de negocios', desc: 'Escribiste 10 veces en tu diario.', on: 'week', check: (s) => s.diary.filter((d) => d.answer).length >= 10 },
  { id: 'mes_ganancia', icon: '🏆', name: 'Mes rentable', desc: 'Cerraste un mes con ganancia.', on: 'month', check: (s, m) => m.profit > 0 },
  { id: 'caja_fuerte', icon: '🔐', name: 'Caja fuerte', desc: 'Terminaste un mes con más caja de la que empezaste.', on: 'month', check: (s, m) => m.cash > m.startCash },
  { id: 'trimestre', icon: '📅', name: 'Trimestre sólido', desc: '3 meses seguidos con ganancia.', on: 'month', check: (s) => s.months.length >= 3 && s.months.slice(-3).every((m) => m.profit > 0) },
  { id: 'junta_perfecta', icon: '🎓', name: 'Junta perfecta', desc: 'Respondiste bien todas las preguntas del Consejo.', on: 'board', check: (s, res) => res.correct === res.total },
  { id: 'transparente', icon: '🔍', name: 'Transparente', desc: 'Presentaste al Consejo un número malo sin esconderlo.', on: 'board', check: (s, res, picked, m) => res.notes.some((n) => n.by === 'papa') },
  { id: 'tres_estrellas', icon: '👑', name: 'Tres estrellas', desc: 'Cumpliste el mandato con excelencia.', on: 'board', check: (s, res) => res.stars === 3 },
  { id: 'estrellas9', icon: '💫', name: 'Constelación', desc: 'Juntaste 9 estrellas del Consejo.', on: 'board', check: (s) => Object.values(s.monthStars || {}).reduce((a, b) => a + b, 0) >= 9 },
  { id: 'escucha', icon: '👂', name: 'Buena escucha', desc: 'Probaste la idea de alguien de tu equipo.', on: 'event', check: (s) => s.event?.id === 'idea_kevin' && s.event.chosen === 0 },
  { id: 'primera_contratacion', icon: '🤝', name: 'Primera contratación', desc: 'Contrataste a alguien para tu equipo.', on: 'hire', check: (s) => s.hiredEver >= 1 },
  { id: 'coleccion5', icon: '📚', name: 'Aprendiz', desc: 'Descubriste 5 lecciones.', on: 'lesson', check: (s) => countLevel(s, 1) >= 5 },
  { id: 'coleccion12', icon: '🧠', name: 'Sabia', desc: 'Descubriste 12 lecciones.', on: 'lesson', check: (s) => countLevel(s, 1) >= 12 },
  { id: 'aplicada', icon: '✅', name: 'Lo puse en práctica', desc: 'Aplicaste una lección por primera vez.', on: 'lesson', check: (s) => countLevel(s, 2) >= 1 },
  { id: 'dorada', icon: '🥇', name: 'Lección dorada', desc: 'Dominaste una lección.', on: 'lesson', check: (s) => countLevel(s, 3) >= 1 },
  { id: 'doradas5', icon: '🏅', name: 'Maestra', desc: 'Dominaste 5 lecciones.', on: 'lesson', check: (s) => countLevel(s, 3) >= 5 },
  { id: 'rescate', icon: '🛟', name: 'Salí del hoyo', desc: 'Recuperaste la caja después de un rescate del Consejo.', on: 'week', check: (s, w) => s.rescues > 0 && w.cash > 0 && w.profit > 0 },
];

function countLevel(s, min) {
  return Object.values(s.lessons).filter((l) => l.level >= min).length;
}

// Rank grows with stars, badges and mastered lessons.
export const RANKS = [
  { name: 'Becaria', points: 0 },
  { name: 'Gerente Junior', points: 6 },
  { name: 'Gerente de Hotel', points: 16 },
  { name: 'Directora General', points: 30 },
  { name: 'Directora de Cadena', points: 48 },
  { name: 'Magnate Hotelera', points: 72 },
];

export function points(s) {
  const stars = Object.values(s.monthStars || {}).reduce((a, b) => a + b, 0);
  const lessons = Object.values(s.lessons).reduce((a, l) => a + Math.max(0, l.level - 1), 0);
  return (s.badges?.length ?? 0) + stars * 2 + lessons;
}

export function rank(s) {
  const p = points(s);
  let idx = 0;
  RANKS.forEach((r, i) => { if (p >= r.points) idx = i; });
  return { ...RANKS[idx], index: idx, pts: p, next: RANKS[idx + 1] || null };
}

function award(s, on, args) {
  for (const b of BADGES) {
    if (b.on !== on || s.badges.includes(b.id)) continue;
    if (b.check(s, ...args)) {
      s.badges.push(b.id);
      s.inbox.push({ badge: b.id, kind: 'badge' });
    }
  }
}

export function checkBadges(s, on, ...args) {
  s.badges = s.badges || [];
  const before = rank(s).index;
  award(s, on, args);
  if (on !== 'lesson') award(s, 'lesson', []);
  const after = rank(s).index;
  if (after > before) s.inbox.push({ kind: 'rank', rank: RANKS[after].name });
}

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));
