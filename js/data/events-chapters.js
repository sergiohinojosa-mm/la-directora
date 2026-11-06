// Event cards for chapters 2–8. `ch` is the first chapter where a card can appear; `when` adds
// conditions; `forced` cards are triggered by the systems (a resignation, a breakdown, a cash gap)
// instead of drawn at random. An option with `wise` is the one that applies the card's lesson.
// `month` holds a card back until that month of the year, so a two-month chapter has news in both.

import { clamp, money } from '../util.js';
import { potRev, avgRef, STAFF_NAMES, recruitCost, trainCost, MAX_SKILL, WAGES, repairCost } from '../engine/systems.js';

const k = (s, frac) => Math.round((potRev(s) * frac) / 100) * 100;
const add = (s, mod) => s.mods.push({ from: s.day, to: s.day, ...mod });
const mood = (s, d) => { s.morale = clamp(s.morale + d, 0, 100); };
const rep = (s, d) => { s.reputation = clamp(s.reputation + d, 1, 5); };
const conf = (s, d) => { s.confidence = clamp(s.confidence + d, 0, 100); };
const name = (s, i = 0) => STAFF_NAMES[(s.day + i) % STAFF_NAMES.length];
const priceStd = (s) => Object.values(s.prices)[0];

export const CHAPTER_EVENTS = [
  // ---------------- Capítulo 2 · Mi equipo ----------------
  {
    id: 'renuncia', ch: 2, kind: 'equipo', forced: true, negative: true, icon: '🚪',
    lesson: 'retener', lessonCtx: (s) => `${s.flags.quitName || 'Una recamarista'} renunció con el ánimo del equipo en ${Math.round(s.morale)}. Reemplazarla cuesta ${money(recruitCost(s))} y una semana de aprendizaje.`,
    title: (s) => `${s.flags.quitName || 'Una recamarista'} renunció`,
    text: (s) => `Dice que estaba agotada${s.team.wage < 1 ? ' y que en otro hotel pagan más' : ''}. Hoy ya no viene. Tu equipo de limpieza queda en ${s.housekeepers}.`,
    options: [
      { label: (s) => `Buscar reemplazo (${money(recruitCost(s))})`, fx: [['Caja −', 'dn'], ['Aprende 5 días', 'q']],
        apply: (s) => { s.cash -= recruitCost(s); s.housekeepers += 1; s.hires = [...(s.hires || []), s.day]; s.hiredEver += 1; return 'Llega alguien nuevo. Los primeros días limpia más lento.'; } },
      { label: 'Repartir su trabajo entre las demás', when: (s) => s.housekeepers >= 1, fx: [['Caja =', 'up'], ['Ánimo −', 'dn']],
        apply: (s) => { mood(s, -6); return 'El equipo trabajará más. Cuida que no se agote.'; } },
      { label: 'Subir sueldos para que no se vaya nadie más', fx: [['Sueldos +', 'dn'], ['Ánimo +', 'up']], when: (s) => s.team.wage < 1.15 && s.housekeepers >= 1,
        apply: (s) => { s.team.wage = WAGES[Math.min(2, WAGES.findIndex((w) => w.v === s.team.wage) + 1)].v; mood(s, 8); return 'El equipo nota que lo valoras. Ahora cuesta más, pero se quedan.'; } },
    ],
  },
  {
    id: 'llega_tarde', ch: 2, kind: 'equipo', icon: '⏰', lesson: 'escucha_equipo', lessonCtx: (s) => `${name(s)} llegaba tarde y preferiste preguntarle qué pasaba.`,
    title: (s) => `${name(s)} llega tarde todos los días`,
    text: 'Ya van cinco días seguidos. Las demás están molestas porque tienen que cubrirle.',
    options: [
      { label: 'Hablar en privado y preguntar qué pasa', wise: true, fx: [['Ánimo +', 'up'], ['Se resuelve', 'up']],
        apply: (s) => { mood(s, 4); return `Su mamá está enferma y la lleva al doctor temprano. Le cambiaste el turno una hora y ya no llega tarde.`; } },
      { label: 'Regañarle frente a todo el equipo', fx: [['Ánimo −−', 'dn']],
        apply: (s) => { mood(s, -9); return 'Dejó de llegar tarde, pero todo el equipo quedó incómodo.'; } },
      { label: 'Dejarlo pasar', fx: [['Ánimo −', 'dn']],
        apply: (s) => { mood(s, -5); add(s, { type: 'cleanMult', mult: 0.92, to: s.day + 3, label: 'Equipo desorganizado' }); return 'Las demás siguen cubriéndole y se están cansando.'; } },
    ],
  },
  {
    id: 'pelea', ch: 2, kind: 'equipo', icon: '😤', negative: true, lesson: 'conflicto', lessonCtx: 'Dos recamaristas se pelearon por los turnos.',
    title: 'Dos recamaristas se pelean por los turnos',
    text: 'Las dos quieren el turno de la mañana. Ya no se hablan y se nota en la limpieza.',
    options: [
      { label: 'Reunirlas y acordar turnos que roten', wise: true, fx: [['Ánimo +', 'up'], ['Hoy limpian menos', 'q']],
        apply: (s) => { mood(s, 5); add(s, { type: 'cleanMult', mult: 0.9, label: 'Reunión del equipo' }); return 'Acordaron rotar cada semana. Hoy se fue un rato en la plática, pero el problema se acabó.'; } },
      { label: 'Decidir tú sin escucharlas', fx: [['Rápido', 'up'], ['Ánimo −', 'dn']],
        apply: (s) => { mood(s, -5); return 'Una quedó contenta y la otra muy molesta.'; } },
      { label: 'Que lo arreglen ellas', fx: [['Limpieza −', 'dn'], ['Ánimo −', 'dn']],
        apply: (s) => { mood(s, -7); add(s, { type: 'cleanMult', mult: 0.85, to: s.day + 3, label: 'Pelea en el equipo' }); return 'La pelea siguió y la limpieza lo resiente.'; } },
    ],
  },
  {
    id: 'aumento', once: true, ch: 2, kind: 'equipo', icon: '💵', when: (s) => s.team.wage < 1.15,
    title: 'El equipo pide aumento',
    text: 'Dicen que en GlobalStay y en Marea Inn pagan más. Te lo piden con respeto.',
    options: [
      { label: 'Subir sueldos un nivel', fx: [['Sueldos +', 'dn'], ['Ánimo ++', 'up'], ['Menos renuncias', 'up']],
        apply: (s) => { s.team.wage = WAGES[Math.min(2, WAGES.findIndex((w) => w.v === s.team.wage) + 1)].v; mood(s, 10); return 'El equipo está agradecido. Puedes ver el sueldo en la pestaña Equipo.'; } },
      { label: (s) => `Un bono único de ${money(800 * s.housekeepers)}`, fx: [['Caja −', 'dn'], ['Ánimo +', 'up']],
        apply: (s) => { s.cash -= 800 * s.housekeepers; mood(s, 5); return 'Les gustó el bono, aunque el sueldo sigue igual.'; } },
      { label: 'Decir que ahora no se puede', fx: [['Caja =', 'up'], ['Ánimo −−', 'dn']],
        apply: (s) => { mood(s, -10); return 'Entendieron, pero alguien podría empezar a buscar otro trabajo.'; } },
    ],
  },
  {
    id: 'recomendada', ch: 2, kind: 'oportunidad', icon: '🙋',
    title: 'Doña Chela recomienda a su sobrina',
    text: 'Dice que es muy trabajadora y que ya limpió en otro hotel.',
    options: [
      { label: 'Contratarla (sin costo de búsqueda)', fx: [['Más limpieza', 'up'], ['Sueldo diario +', 'dn']],
        apply: (s) => { s.housekeepers += 1; s.hires = [...(s.hires || []), s.day - 3]; s.hiredEver += 1; return 'Llegó con experiencia: aprende rápido.'; } },
      { label: 'Entrevistarla como a cualquiera', fx: [['Justo', 'up']],
        apply: (s) => 'La entrevistaste. Si necesitas a alguien, contrátala en la pestaña Hoy (paso 3).' },
      { label: 'Ahora no necesito a nadie', fx: [['Sin cambio', 'q']],
        apply: () => 'Doña Chela lo entendió.' },
    ],
  },
  {
    id: 'curso', once: true, ch: 2, kind: 'oportunidad', icon: '🎓', when: (s) => s.team.skill < MAX_SKILL,
    lesson: 'largo_plazo', lessonCtx: 'Una escuela de turismo te ofreció capacitar a tu equipo: cuesta hoy y paga después.',
    title: 'Curso de limpieza a mitad de precio',
    text: 'Una escuela de turismo ofrece capacitar a tu equipo esta semana. Hoy limpiarían menos.',
    options: [
      { label: (s) => `Tomar el curso (${money(Math.round(trainCost(s) / 2))})`, wise: true, wiseCtx: 'Invertiste en capacitar a tu equipo aunque hoy costara.', fx: [['Caja −', 'dn'], ['Hoy limpian menos', 'dn'], ['Limpian mejor para siempre', 'up']],
        apply: (s) => { s.cash -= Math.round(trainCost(s) / 2); s.team.skill += 1; s.team.lastTrain = s.day; add(s, { type: 'cleanMult', mult: 0.75, label: 'Capacitación' }); return `Tu equipo subió a nivel ${s.team.skill} de capacitación.`; } },
      { label: 'No, ahorita hay mucho trabajo', fx: [['Sin cambio', 'q']],
        apply: () => 'Será en otra ocasión.' },
    ],
  },

  // ---------------- Capítulo 3 · Que nos encuentren ----------------
  {
    id: 'ota_destacado', once: true, ch: 3, kind: 'mercado', icon: '🌐', when: (s) => s.mkt.ota, lesson: 'prueba_chico', lessonCtx: 'La agencia te ofreció aparecer destacada pagando más comisión.',
    title: 'La agencia ofrece "posición destacada"',
    text: 'Te pondrían hasta arriba en la búsqueda… si les pagas 25% de comisión en lugar de 18%, durante dos semanas.',
    options: [
      { label: 'Aceptar', fx: [['Demanda ++', 'up'], ['Comisión ++', 'dn']],
        apply: (s) => { add(s, { type: 'demand', mult: 1.12, to: s.day + 13, label: 'Posición destacada en agencia' }); add(s, { type: 'dailyCost', amount: k(s, 0.02), to: s.day + 13, label: 'Comisión extra de la agencia' }); return 'Dos semanas arriba en la búsqueda, pagando más comisión.'; } },
      { label: 'Negociar: 21% y una semana de prueba', wise: true, fx: [['Demanda +', 'up'], ['Comisión +', 'dn']],
        apply: (s) => { add(s, { type: 'demand', mult: 1.08, to: s.day + 6, label: 'Posición destacada (prueba)' }); add(s, { type: 'dailyCost', amount: k(s, 0.008), to: s.day + 6, label: 'Comisión extra de la agencia' }); return 'Aceptaron la prueba. Mide si valió la pena.'; } },
      { label: 'No, gracias', fx: [['Sin cambio', 'q']], apply: () => 'Sigues con la comisión normal.' },
    ],
  },
  {
    id: 'video_viral', ch: 3, kind: 'oportunidad', tone: 'good', icon: '📹',
    title: 'Un video de tu hotel se hizo viral',
    text: 'Una huésped subió un video de Botones durmiendo en recepción. ¡Tiene miles de vistas!',
    options: [
      { label: 'Aprovecharlo con una promoción en redes', fx: [['Caja −', 'dn'], ['Demanda ++', 'up']],
        apply: (s) => { s.cash -= k(s, 0.05); add(s, { type: 'demand', mult: s.mkt.social ? 1.2 : 1.06, from: s.day, to: s.day + 6, label: 'Video viral de Botones' }); return s.mkt.social ? 'Como ya tenías redes activas, el video llegó a mucha más gente.' : 'Sin redes activas, la promoción casi no llegó a nadie nuevo: gastaste de más.'; } },
      { label: 'Solo agradecerle a la huésped', fx: [['Demanda +', 'up']],
        apply: (s) => { add(s, { type: 'demand', mult: 1.06, from: s.day, to: s.day + 4, label: 'Video viral de Botones' }); return 'El video ayudó un poco por sí solo.'; } },
    ],
  },
  {
    id: 'convenio', ch: 3, kind: 'oportunidad', icon: '🏢',
    title: 'Una empresa quiere un convenio',
    text: (s) => `Te reservan ${Math.max(2, Math.round(s.housekeepers * 2))} cuartos cada martes y miércoles por 4 semanas, con 20% de descuento.`,
    options: [
      { label: 'Aceptar', fx: [['Cuartos seguros entre semana', 'up'], ['Precio −20%', 'dn']],
        apply: (s) => {
          const n = Math.max(2, Math.round(s.housekeepers * 2));
          const std = Object.keys(s.prices)[0];
          for (let d = s.day; d < s.day + 28; d++) if ((d - 1) % 7 === 1 || (d - 1) % 7 === 2) for (let i = 0; i < n; i++) s.contracts.push({ type: std, from: d, to: d, priceMult: 0.8, label: 'Convenio empresa' });
          return 'Tienes cuartos vendidos los martes y miércoles de este mes.';
        } },
      { label: 'Pedir un mejor trato: 10% de descuento', fx: [['Puede que acepten', 'q']],
        apply: (s) => {
          if ((s.day * 7) % 3 === 0) return 'Dijeron que no. Se fueron con GlobalStay.';
          const n = Math.max(2, Math.round(s.housekeepers * 2));
          const std = Object.keys(s.prices)[0];
          for (let d = s.day; d < s.day + 28; d++) if ((d - 1) % 7 === 1 || (d - 1) % 7 === 2) for (let i = 0; i < n; i++) s.contracts.push({ type: std, from: d, to: d, priceMult: 0.9, label: 'Convenio empresa' });
          return '¡Aceptaron con 10%! Buena negociación.';
        } },
      { label: 'No', fx: [['Sin cambio', 'q']], apply: () => 'Prefieres vender esos cuartos a precio normal.' },
    ],
  },
  {
    id: 'todos_quieren', once: true, ch: 3, kind: 'mercado', icon: '📢', lesson: 'decir_si', lessonCtx: 'Tres agencias de publicidad te ofrecieron sus servicios el mismo día.',
    title: 'Todos quieren venderte publicidad',
    text: (s) => `Un espectacular en la carretera, anuncios en radio y un paquete de influencers. Cada uno cuesta ${money(k(s, 0.4))}.`,
    options: [
      { label: (s) => `Contratar los tres (${money(k(s, 1.2))})`, fx: [['Caja −−−', 'dn'], ['Demanda +', 'up']],
        apply: (s) => { s.cash -= k(s, 1.2); add(s, { type: 'demand', mult: 1.1, to: s.day + 10, label: 'Campaña de publicidad' }); return 'Llegó más gente, pero no tanta como para pagar los tres.'; } },
      { label: 'Elegir solo uno y medir si funciona', wise: true, wiseCtx: 'Elegiste un solo anuncio y lo mediste, en lugar de decir que sí a todo.', fx: [['Caja −', 'dn'], ['Demanda +', 'up']],
        apply: (s) => { s.cash -= k(s, 0.4); add(s, { type: 'demand', mult: 1.06, to: s.day + 10, label: 'Anuncio en radio' }); return 'Gastaste menos y vas a poder ver si ese anuncio sirve.'; } },
      { label: 'Ninguno', fx: [['Caja =', 'up']], apply: () => 'Te quedas con tus canales actuales.' },
    ],
  },
  {
    id: 'resenas_falsas', once: true, ch: 3, kind: 'crisis', icon: '🤥', lesson: 'integridad', lessonCtx: 'Alguien te ofreció comprar reseñas falsas de 5 estrellas.',
    title: 'Te ofrecen reseñas falsas',
    text: (s) => `Un señor vende 50 reseñas de 5★ por ${money(k(s, 0.15))}. "Todos lo hacen", dice.`,
    options: [
      { label: 'No. Mis reseñas se ganan', wise: true, wiseCtx: 'Rechazaste comprar reseñas falsas.', fx: [['Tu nombre limpio', 'up']],
        apply: () => 'Le dijiste que no. Tus reseñas son reales.' },
      { label: 'Comprarlas', fx: [['Reseñas + hoy', 'up'], ['Riesgo', 'q']],
        apply: (s) => { s.cash -= k(s, 0.15); rep(s, 0.15); s.flags.fakeReviews = s.day; return 'Tus reseñas subieron… por ahora.'; } },
    ],
  },
  {
    id: 'resenas_descubiertas', ch: 3, kind: 'crisis', forced: true, negative: true, icon: '🚨',
    title: 'Descubrieron las reseñas falsas',
    text: 'La plataforma de reseñas detectó las reseñas compradas y puso una alerta en tu hotel.',
    options: [
      { label: 'Pedir disculpas públicamente', fx: [['Reseñas −', 'dn'], ['Confianza −', 'dn']],
        apply: (s) => { rep(s, -0.25); conf(s, -8); return 'Duele, pero decir la verdad evitó algo peor.'; } },
      { label: 'Negarlo', fx: [['Reseñas −−', 'dn'], ['Confianza −−', 'dn']],
        apply: (s) => { rep(s, -0.45); conf(s, -15); return 'Nadie te creyó y el Consejo se enteró.'; } },
    ],
  },

  // ---------------- Capítulo 4 · El cliente no siempre tiene la razón ----------------
  {
    id: 'exige_suite', ch: 4, kind: 'crisis', icon: '👑', negative: true, lesson: 'cliente_respeto', lessonCtx: 'Un huésped exigió la suite gratis y tuviste que decidir cómo responder.',
    title: 'Un huésped exige el mejor cuarto gratis',
    text: '"Soy cliente VIP en todos los hoteles. Exijo el mejor cuarto sin pagar más o pongo una reseña terrible."',
    options: [
      { label: 'Escucharlo y ofrecerle algo justo, con amabilidad', wise: true, wiseCtx: 'Pusiste un límite a un huésped difícil sin perder el respeto.', fx: [['Pequeño costo', 'q'], ['Reseñas =', 'up']],
        apply: (s) => { s.cash -= Math.round(avgRef(s) * 0.1); return 'Le ofreciste un desayuno de cortesía y le explicaste las reglas. Se calmó.'; } },
      { label: 'Darle lo que pide', fx: [['Ingreso −', 'dn'], ['Otros piden lo mismo', 'dn']],
        apply: (s) => { s.cash -= Math.round(avgRef(s) * 0.8); add(s, { type: 'ratingDay', delta: -0.05, to: s.day + 5, label: 'Huéspedes que exigen' }); return 'Se lo diste. Al día siguiente otros dos pidieron lo mismo.'; } },
      { label: 'Decirle que no, de mala manera', fx: [['Reseñas −', 'dn']],
        apply: (s) => { rep(s, -0.08); return 'Puso la reseña terrible y además contó que lo trataron mal.'; } },
    ],
  },
  {
    id: 'amenaza_resena', ch: 4, kind: 'crisis', icon: '😠', negative: true, lesson: 'cliente_respeto', lessonCtx: 'Una huésped amenazó con una mala reseña si no le hacías descuento.',
    title: '"Dame 50% de descuento o te pongo 1 estrella"',
    text: 'Una huésped se queja de que el agua salía tibia. Es cierto que hubo un problema una hora.',
    options: [
      { label: 'Reconocer el problema y compensar lo justo', wise: true, wiseCtx: 'Reconociste un problema real y compensaste lo justo, no lo que te exigían.', fx: [['Caja −', 'dn'], ['Reseña buena', 'up']],
        apply: (s) => { s.cash -= Math.round(avgRef(s) * 0.15); rep(s, 0.03); return 'Le diste 15% y una disculpa sincera. Escribió que "saben resolver".'; } },
      { label: 'Darle el 50%', fx: [['Caja −−', 'dn']],
        apply: (s) => { s.cash -= Math.round(avgRef(s) * 0.5); return 'Se fue contenta, pero aprendió que amenazar funciona.'; } },
      { label: 'No dar nada', fx: [['Reseña mala', 'dn']],
        apply: (s) => { rep(s, -0.07); return 'Puso su reseña de 1★ contando lo del agua.'; } },
    ],
  },
  {
    id: 'rompio_tv', ch: 4, kind: 'crisis', icon: '📺', negative: true,
    title: 'Un huésped rompió la televisión',
    text: (s) => `Dice que ya estaba rota. Reponerla cuesta ${money(k(s, 0.08))}. La recamarista revisó el cuarto al entregarlo y estaba bien.`,
    options: [
      { label: 'Mostrarle el reporte de entrega y cobrar con respeto', fx: [['Caja =', 'up']],
        apply: () => 'Vio el reporte firmado y pagó sin discutir. Tener registros te protegió.' },
      { label: 'No cobrar para evitar problemas', fx: [['Caja −', 'dn']],
        apply: (s) => { s.cash -= k(s, 0.08); return 'Pagaste tú la televisión nueva.'; } },
      { label: 'Acusarlo frente a otros huéspedes', fx: [['Reseñas −', 'dn']],
        apply: (s) => { rep(s, -0.06); return 'Pagó, pero el escándalo lo vieron todos.'; } },
    ],
  },
  {
    id: 'grita_recamarista', ch: 4, kind: 'equipo', icon: '🗯️', negative: true, lesson: 'defiende', lessonCtx: 'Un huésped le gritó a una recamarista de tu equipo.',
    title: 'Un huésped le grita a una recamarista',
    text: (s) => `${name(s, 1)} está llorando. El huésped dice que tardó mucho en limpiar su cuarto.`,
    options: [
      { label: 'Defender a tu equipo y pedirle respeto al huésped', wise: true, wiseCtx: 'Defendiste a tu equipo y pediste respeto con firmeza y educación.', fx: [['Ánimo ++', 'up'], ['El huésped se molesta', 'q']],
        apply: (s) => { mood(s, 9); return 'El huésped se disculpó a regañadientes. Tu equipo vio que los cuidas.'; } },
      { label: 'Pedirle a ella que aguante', fx: [['Ánimo −−', 'dn']],
        apply: (s) => { mood(s, -10); return 'El huésped se calmó, pero tu equipo se sintió solo.'; } },
      { label: 'Regalarle una noche al huésped para calmarlo', fx: [['Caja −', 'dn'], ['Ánimo −', 'dn']],
        apply: (s) => { s.cash -= priceStd(s); mood(s, -4); return 'Se calmó con la noche gratis. Tu equipo no entendió por qué lo premiaste.'; } },
    ],
  },
  {
    id: 'cancela_enfermo', ch: 4, kind: 'crisis', icon: '🤒', when: (s) => s.policy.cancel !== 'flexible', lesson: 'reglas_claras', lessonCtx: 'Una familia canceló porque su hijo se enfermó, y tu política decía qué pasaba.',
    title: 'Una familia cancela porque el niño se enfermó',
    text: (s) => `Tu política de cancelación es ${s.policy.cancel}: ${s.policy.cancel === 'estricta' ? 'no se regresa el dinero' : 'se regresa la mitad'}. Te piden que les regreses todo.`,
    options: [
      { label: 'Seguir la política, pero ofrecer cambiar la fecha', wise: true, fx: [['Justo', 'up'], ['Reseñas +', 'up']],
        apply: (s) => { rep(s, 0.03); return 'Les guardaste el dinero para otra fecha. Regresarán.'; } },
      { label: 'Regresarles todo', fx: [['Caja −', 'dn'], ['Reseñas +', 'up']],
        apply: (s) => { s.cash -= priceStd(s) * 2; rep(s, 0.02); return 'Agradecidos. Pero las reglas valen menos si cambian cada vez.'; } },
      { label: 'No regresar nada', fx: [['Te quedas el dinero', 'up'], ['Reseña mala', 'dn']],
        apply: (s) => { rep(s, -0.05); return 'Cobraste, y escribieron que "no tienen corazón".'; } },
    ],
  },

  // ---------------- Capítulo 5 · Comida y algo más ----------------
  {
    id: 'chef_aumento', once: true, ch: 5, kind: 'equipo', icon: '👩‍🍳', when: (s) => s.rest.open, lesson: 'negocia', lessonCtx: 'La chef te pidió 25% más de sueldo o se va.',
    title: 'La chef Mariana pide 25% más',
    text: 'Dice que otro restaurante le ofreció más. Su comida es la razón de que vengan de fuera.',
    options: [
      { label: 'Algo más de sueldo + bono si el restaurante gana', wise: true, wiseCtx: 'Negociaste con la chef un trato donde las dos ganan.', fx: [['Costo +', 'dn'], ['Se queda motivada', 'up']],
        apply: (s) => { add(s, { type: 'dailyCost', amount: k(s, 0.004), to: s.day + 365, label: 'Bono de la chef' }); return 'Aceptó. Ahora a ella también le conviene que el restaurante gane.'; } },
      { label: 'Pagarle el 25%', fx: [['Costo ++', 'dn']],
        apply: (s) => { add(s, { type: 'dailyCost', amount: k(s, 0.012), to: s.day + 365, label: 'Aumento de la chef' }); return 'Se queda, pero el restaurante ahora cuesta más.'; } },
      { label: 'Dejarla ir', fx: [['Costo =', 'up'], ['Restaurante −−', 'dn']],
        apply: (s) => { add(s, { type: 'restDown', to: s.day + 14, label: 'Sin chef' }); return 'Durante dos semanas el restaurante atenderá a menos gente.'; } },
    ],
  },
  {
    id: 'proveedor', once: true, ch: 5, kind: 'operacion', icon: '🥕', when: (s) => s.rest.open, lesson: 'negocia', lessonCtx: 'Un proveedor te ofreció descuento si le comprabas el doble.',
    title: 'Un proveedor ofrece 12% de descuento',
    text: 'Pero solo si le compras el doble de ingredientes cada semana por un año.',
    options: [
      { label: 'Pedir 6% de descuento comprando lo mismo', wise: true, wiseCtx: 'Negociaste un descuento sin comprar comida que se iba a tirar.', fx: [['Costo −', 'up']],
        apply: (s) => { add(s, { type: 'dailyCost', amount: -k(s, 0.003), to: s.day + 365, label: 'Descuento del proveedor' }); return 'Aceptó: le conviene tener un cliente fijo.'; } },
      { label: 'Aceptar y comprar el doble', fx: [['Ingredientes más baratos', 'up'], ['Desperdicio ++', 'dn']],
        apply: (s) => { add(s, { type: 'dailyCost', amount: k(s, 0.006), to: s.day + 365, label: 'Comida de más del proveedor' }); return 'La mitad de lo que compras se echa a perder.'; } },
      { label: 'Seguir igual', fx: [['Sin cambio', 'q']], apply: () => 'Sin cambio.' },
    ],
  },
  {
    id: 'critico', month: 6, ch: 5, kind: 'oportunidad', icon: '🍷', when: (s) => s.rest.open, lesson: 'calidad_constante', lessonCtx: 'Un crítico de comida llegó a tu restaurante sin avisar.',
    title: 'Viene un crítico de comida',
    text: 'Escribe en la revista más leída de la región. Hoy cena en tu restaurante.',
    options: [
      { label: 'Atenderlo igual que a todos', wise: true, fx: [['Depende de tu menú', 'q']],
        apply: (s) => { const good = s.rest.menu >= 1; add(s, { type: 'demand', mult: good ? 1.08 : 0.97, to: s.day + 7, label: 'Reseña del crítico' }); return good ? 'Escribió que tu restaurante "vale el viaje".' : 'Escribió que la comida es "correcta pero olvidable".'; } },
      { label: 'Prepararle un menú especial', fx: [['Caja −', 'dn'], ['Reseña buena', 'up']],
        apply: (s) => { s.cash -= k(s, 0.03); add(s, { type: 'demand', mult: 1.06, to: s.day + 7, label: 'Reseña del crítico' }); return 'Le encantó, aunque los demás comensales comieron lo de siempre.'; } },
    ],
  },
  {
    id: 'boda', month: 6, ch: 5, kind: 'oportunidad', icon: '💒', lesson: 'riesgo_premio', lessonCtx: 'Te ofrecieron una boda: mucho dinero en un día, y mucho trabajo.',
    title: 'Quieren hacer una boda en tu hotel',
    text: (s) => `Rentarían todo el hotel el próximo sábado con comida para 80 invitados. Pagan ${money(k(s, 1.6))}, pero la comida y el personal extra cuestan ${money(k(s, 1.05))} y ese sábado no vendes cuartos.`,
    options: [
      { label: 'Aceptar', fx: [['Ingreso +', 'up'], ['Sin cuartos ese sábado', 'dn'], ['Mucho trabajo', 'dn']],
        apply: (s) => { const sat = s.day + ((5 - ((s.day - 1) % 7) + 7) % 7 || 7); add(s, { type: 'dailyCost', amount: -k(s, 1.6) + k(s, 0.7) + k(s, 0.35), from: sat, to: sat, label: 'Boda (ingreso menos comida)' }); add(s, { type: 'demand', mult: 0.01, from: sat, to: sat, label: 'Hotel rentado para la boda' }); mood(s, -4); return 'El sábado el hotel es de la boda. Prepara a tu equipo.'; } },
      { label: 'No, prefiero mis huéspedes normales', fx: [['Sin cambio', 'q']], apply: () => 'Les recomendaste un salón de eventos.' },
    ],
  },
  {
    id: 'refri', ch: 5, kind: 'operacion', icon: '🧊', negative: true, when: (s) => s.rest.open,
    title: 'Se descompuso el refrigerador de la cocina',
    text: (s) => `Si no se arregla hoy, se echa a perder la comida. La reparación cuesta ${money(k(s, 0.06))}.`,
    options: [
      { label: 'Repararlo hoy', fx: [['Caja −', 'dn']], apply: (s) => { s.cash -= k(s, 0.06); return 'Listo, la comida se salvó.'; } },
      { label: 'Esperar al técnico barato mañana', fx: [['Sale más caro', 'dn'], ['Comida perdida', 'dn']],
        apply: (s) => { s.cash -= k(s, 0.1); add(s, { type: 'restDown', to: s.day + 1, label: 'Sin refrigerador' }); return 'Se echó a perder comida y el restaurante atendió menos. Salió más caro.'; } },
    ],
  },

  // ---------------- Capítulo 6 · Lo que no se ve ----------------
  {
    id: 'falla_aire', ch: 6, kind: 'operacion', forced: true, negative: true, icon: '🥵', lesson: 'techo',
    lessonCtx: (s) => `Se descompuso el aire acondicionado con el hotel en ${Math.round(s.maint.condition)}/100 de estado.`,
    title: 'Se descompuso el aire acondicionado',
    text: (s) => `Hay 2 cuartos sin aire. ${s.maint.insurance ? 'Tu seguro paga 70% de la reparación.' : 'No tienes seguro.'}`,
    options: [
      { label: (s) => `Reparación urgente hoy (${money(repairCost(s, 0.45))})`, fx: [['Caja −−', 'dn'], ['Sin cuartos perdidos', 'up']],
        apply: (s) => { s.cash -= repairCost(s, 0.45); s.maint.condition = clamp(s.maint.condition + 15, 0, 100); return 'Arreglado hoy mismo.'; } },
      { label: (s) => `Reparación normal en 3 días (${money(repairCost(s, 0.25))})`, fx: [['Caja −', 'dn'], ['2 cuartos cerrados 3 días', 'dn']],
        apply: (s) => { s.cash -= repairCost(s, 0.25); s.maint.condition = clamp(s.maint.condition + 15, 0, 100); add(s, { type: 'roomsOut', n: 2, to: s.day + 2, label: 'Aire descompuesto' }); return 'Dos cuartos no se pueden vender por tres días.'; } },
      { label: (s) => `Parche barato (${money(repairCost(s, 0.06))})`, fx: [['Caja =', 'up'], ['Puede fallar otra vez', 'q']],
        apply: (s) => { s.cash -= repairCost(s, 0.06); s.maint.condition = clamp(s.maint.condition - 5, 0, 100); s.flags.patched = s.day; add(s, { type: 'ratingDay', delta: -0.1, to: s.day + 4, label: 'Aire que no enfría bien' }); return 'Funciona… más o menos. Los huéspedes notan el calor.'; } },
    ],
  },
  {
    id: 'falla_agua', ch: 6, kind: 'operacion', forced: true, negative: true, icon: '🚿', lesson: 'barato_caro',
    lessonCtx: (s) => `El calentador falló${s.maint.level === 0 ? ' y no tenías mantenimiento' : ''}${s.flags.patched ? ', después de haber puesto un parche barato' : ''}.`,
    title: 'No hay agua caliente',
    text: 'El calentador principal se apagó. Los huéspedes se están bañando con agua fría.',
    options: [
      { label: (s) => `Cambiar el calentador (${money(repairCost(s, 0.35))})`, fx: [['Caja −−', 'dn'], ['Resuelto', 'up']],
        apply: (s) => { s.cash -= repairCost(s, 0.35); s.maint.condition = clamp(s.maint.condition + 12, 0, 100); return 'Calentador nuevo. Problema resuelto.'; } },
      { label: (s) => `Repararlo (${money(repairCost(s, 0.12))})`, fx: [['Caja −', 'dn'], ['Reseñas − 2 días', 'dn']],
        apply: (s) => { s.cash -= repairCost(s, 0.12); add(s, { type: 'ratingDay', delta: -0.35, to: s.day + 1, label: 'Sin agua caliente' }); return 'Tardó dos días. Algunos huéspedes se quejaron.'; } },
    ],
  },
  {
    id: 'proteccion_civil', month: 8, ch: 6, kind: 'gobierno', icon: '🧯', lesson: 'seguridad', lessonCtx: 'Protección Civil revisó tu hotel y encontró extintores vencidos.',
    title: 'Llegó Protección Civil',
    text: (s) => `Encontraron extintores vencidos y una salida de emergencia bloqueada con cajas.${s.maint.level === 0 ? ' Notaron que no hay mantenimiento.' : ''}`,
    options: [
      { label: (s) => `Corregir todo hoy (${money(k(s, 0.12))})`, wise: true, wiseCtx: 'Corregiste los problemas de seguridad completos y de inmediato.', fx: [['Caja −', 'dn'], ['Hotel seguro', 'up']],
        apply: (s) => { s.cash -= k(s, 0.12); s.maint.condition = clamp(s.maint.condition + 5, 0, 100); return 'Todo en regla. El inspector te felicitó.'; } },
      { label: 'Corregir solo lo mínimo', fx: [['Caja −', 'q'], ['Multa', 'dn']],
        apply: (s) => { s.cash -= k(s, 0.04) + k(s, 0.1); return 'Te pusieron una multa por la salida bloqueada. Salió más caro.'; } },
    ],
  },
  {
    id: 'mordida', once: true, ch: 6, kind: 'gobierno', icon: '🤫', negative: true, lesson: 'integridad', lessonCtx: 'Un inspector te ofreció "arreglarlo por fuera" en lugar de pagar la multa.',
    title: 'Un inspector ofrece "arreglarlo por fuera"',
    text: (s) => `Dice que la multa oficial es de ${money(k(s, 0.3))}, pero que con ${money(k(s, 0.08))} "en efectivo" se olvida del asunto. Eso es un soborno: es ilegal.`,
    options: [
      { label: 'Pagar la multa oficial y corregir', wise: true, wiseCtx: 'Pagaste lo oficial en lugar de aceptar un atajo.', fx: [['Caja −−', 'dn'], ['Conciencia tranquila', 'up']],
        apply: (s) => { s.cash -= k(s, 0.3); conf(s, 4); return 'Pagaste lo que tocaba. El Consejo se enteró y está orgulloso.'; } },
      { label: 'Darle el efectivo', fx: [['Caja −', 'q'], ['Riesgo grande', 'dn']],
        apply: (s) => { s.cash -= k(s, 0.08); s.flags.bribe = s.day; return 'Se fue contento. Ojalá nadie se entere.'; } },
    ],
  },
  {
    id: 'mordida_descubierta', ch: 6, kind: 'gobierno', forced: true, negative: true, icon: '📰',
    title: 'El periódico publicó lo del inspector',
    text: 'Detuvieron al inspector y salió la lista de los negocios que le pagaron. Tu hotel está en la lista.',
    options: [
      { label: 'Aceptar el error y pagar la multa', fx: [['Caja −−', 'dn'], ['Confianza −', 'dn']],
        apply: (s) => { s.cash -= k(s, 0.5); conf(s, -10); rep(s, -0.15); return 'Pagaste la multa y una más por el soborno. El Consejo está muy decepcionado.'; } },
    ],
  },
  {
    id: 'faltante', ch: 6, kind: 'crisis', forced: true, negative: true, icon: '🕳️', lesson: 'confia_verifica',
    lessonCtx: (s) => `Kevin contó la caja de recepción y faltaban ${money(s.maint.leak - s.maint.leakFound)}. Nadie la había revisado.`,
    title: 'Falta dinero en la caja de recepción',
    text: (s) => `Kevin contó el efectivo: faltan ${money(s.maint.leak - s.maint.leakFound)} que no aparecen en ningún lado.`,
    options: [
      { label: 'Poner corte de caja diario desde hoy', wise: true, wiseCtx: 'Pusiste controles para revisar la caja todos los días.', fx: [['Costo pequeño diario', 'q'], ['No vuelve a pasar', 'up']],
        apply: (s) => { s.maint.controls = true; s.maint.leakFound = s.maint.leak; return 'Desde hoy, cada noche se cuenta la caja y se firma.'; } },
      { label: 'Acusar a la recepcionista nueva', fx: [['Ánimo −−', 'dn'], ['Sin pruebas', 'dn']],
        apply: (s) => { mood(s, -14); s.maint.leakFound = s.maint.leak; return 'No tenías pruebas. El equipo se sintió acusado y el dinero sigue sin aparecer.'; } },
      { label: 'Dejarlo pasar', fx: [['Sigue pasando', 'dn']],
        apply: (s) => { s.maint.leakFound = s.maint.leak; return 'El dinero sigue saliendo y nadie sabe a dónde.'; } },
    ],
  },
  {
    id: 'temporada_baja', once: true, ch: 6, kind: 'noticia', icon: '🍂', lesson: 'guarda', lessonCtx: 'Alma te mostró que en unos meses llega la temporada baja.',
    when: (s) => !s.lessons.guarda,
    title: 'Se acerca la temporada baja',
    text: 'Alma revisó los números de años anteriores: en unos meses llegan menos turistas. ¿Cómo te preparas?',
    options: [
      { label: 'Apartar dinero cada semana desde ahora', wise: true, fx: [['Caja protegida', 'up']],
        apply: () => 'Buena idea: apaga gastos que no necesitas (como publicidad de más) y procura que tu caja crezca estos meses.' },
      { label: 'Ya veré cuando llegue', fx: [['Riesgo', 'q']], apply: () => 'Alma frunció el ceño: "Cuando llegue, ya será tarde para ahorrar".' },
    ],
  },

  // ---------------- Capítulo 7 · Llegó la competencia ----------------
  {
    id: 'guerra_global', ch: 7, kind: 'mercado', icon: '⚔️', negative: true, lesson: 'diferencia', lessonCtx: 'GlobalStay bajó sus precios 25% para quitarte clientes.',
    title: 'GlobalStay bajó sus precios 25%',
    text: 'Por una semana van a cobrar mucho menos. Tus clientes que buscan precio se pueden ir.',
    options: [
      { label: 'Mantener precios y promocionar lo que te hace única', wise: true, wiseCtx: 'Ante la guerra de precios defendiste tu diferencia en lugar de bajar precios.', fx: [['Caja −', 'dn'], ['Demanda −', 'q']],
        apply: (s) => { s.cash -= k(s, 0.06); add(s, { type: 'demand', mult: s.comp.unique ? 0.97 : 0.9, to: s.day + 6, label: 'Guerra de precios de GlobalStay' }); return s.comp.unique ? 'Tu experiencia única hizo que la mayoría se quedara contigo.' : 'Perdiste algunos clientes, pero no bajaste tus precios.'; } },
      { label: 'Igualar su precio', fx: [['Precio −−', 'dn'], ['Demanda =', 'up']],
        apply: (s) => { for (const id of Object.keys(s.prices)) s.prices[id] = Math.round(s.prices[id] * 0.75 / 50) * 50; return 'Tus precios bajaron 25%. Recuerda que volver a subirlos no es tan fácil.'; } },
      { label: 'No hacer nada', fx: [['Demanda −', 'dn']],
        apply: (s) => { add(s, { type: 'demand', mult: 0.88, to: s.day + 6, label: 'Guerra de precios de GlobalStay' }); return 'Algunos clientes se fueron a GlobalStay esta semana.'; } },
    ],
  },
  {
    id: 'roban_personal', month: 10, ch: 7, kind: 'equipo', icon: '🧲', negative: true, lesson: 'talento', lessonCtx: 'Otro hotel quiso llevarse a una de tus mejores recamaristas.',
    title: (s) => `GlobalStay le ofrece trabajo a ${name(s, 2)}`,
    text: 'Le ofrecen 20% más de sueldo. Es una de tus mejores recamaristas.',
    options: [
      { label: 'Hablar con ella: capacitarla y darle un puesto de líder', wise: true, fx: [['Costo +', 'dn'], ['Ánimo +', 'up']],
        apply: (s) => { s.cash -= 3000; s.team.skill = Math.min(MAX_SKILL, s.team.skill + 1); mood(s, 4); return 'Se queda como líder de limpieza. Le importaba crecer, no solo el dinero.'; } },
      { label: 'Igualar la oferta solo para ella', fx: [['Costo +', 'dn'], ['Otros se enteran', 'dn']],
        apply: (s) => { add(s, { type: 'dailyCost', amount: 100, to: s.day + 365, label: 'Aumento especial' }); mood(s, -4); return 'Se queda, pero las demás se enteraron y se sienten menos.'; } },
      { label: 'Dejarla ir', fx: [['Una persona menos', 'dn']],
        apply: (s) => { if (s.housekeepers > 1) s.housekeepers -= 1; mood(s, -3); return 'Se fue a GlobalStay.'; } },
    ],
  },
  {
    id: 'oferta_compra', month: 10, once: true, ch: 7, kind: 'mercado', icon: '💼', lesson: 'valor_hotel', lessonCtx: 'GlobalStay ofreció comprarte el hotel.',
    title: 'GlobalStay quiere comprar tu hotel',
    text: 'Ofrecen pagarle al Consejo lo mismo que costó el hotel. "Así se acaba la competencia", dicen.',
    options: [
      { label: 'Llevarlo al Consejo y recomendar no vender', wise: true, wiseCtx: 'Recomendaste no vender porque el hotel vale más a largo plazo.', fx: [['Confianza +', 'up']],
        apply: (s) => { conf(s, 5); return 'El Consejo está de acuerdo: el hotel vale más ahora que tiene clientes y reputación.'; } },
      { label: 'Recomendar vender', fx: [['Confianza −', 'dn']],
        apply: (s) => { conf(s, -5); return 'El Consejo decidió no vender. Papá dice: "Un hotel con buena reputación vale más de lo que costó".'; } },
    ],
  },
  {
    id: 'festival_incierto', ch: 7, kind: 'noticia', icon: '🎪', lesson: 'decide_info', lessonCtx: 'Había un festival que podía hacerse o cancelarse, y tuviste que decidir sin saberlo.',
    title: 'Quizá haya un festival el fin de semana',
    text: 'Dicen que viene un festival de música, pero el permiso no está confirmado. Puede llegar mucha gente… o nadie.',
    options: [
      { label: 'Esperar el pronóstico del jueves y decidir', wise: true, wiseCtx: 'Esperaste a tener mejor información, sin apostar todo antes de tiempo.', fx: [['Riesgo bajo', 'up']],
        apply: (s) => { const yes = s.day % 2 === 0; const w = s.day + ((4 - ((s.day - 1) % 7) + 7) % 7 || 7); add(s, { type: 'demand', mult: yes ? 1.4 : 1, from: w, to: w + 2, label: yes ? 'Festival de música' : 'Festival cancelado' }); return 'Buena idea: el jueves el pronóstico mostrará si viene el festival. Entonces ajusta precios y limpieza.'; } },
      { label: 'Apostar todo: contratar dos personas más', fx: [['Costo ++', 'dn'], ['Si hay festival, ganas', 'q']],
        apply: (s) => { const yes = s.day % 2 === 0; const w = s.day + ((4 - ((s.day - 1) % 7) + 7) % 7 || 7); add(s, { type: 'demand', mult: yes ? 1.4 : 1, from: w, to: w + 2, label: yes ? 'Festival de música' : 'Festival cancelado' }); s.housekeepers += 2; s.hires = [...(s.hires || []), s.day, s.day]; s.hiredEver += 2; s.cash -= 2 * (s.team ? 2500 : 0); return 'Ya tienes más equipo. Ojalá se haga el festival.'; } },
      { label: 'Bajar precios desde ya, por si no viene nadie', fx: [['Precio −10%', 'dn'], ['Si hay festival, pierdes', 'q']],
        apply: (s) => { const yes = s.day % 2 === 0; const w = s.day + ((4 - ((s.day - 1) % 7) + 7) % 7 || 7); add(s, { type: 'demand', mult: yes ? 1.4 : 1, from: w, to: w + 2, label: yes ? 'Festival de música' : 'Festival cancelado' }); for (const id of Object.keys(s.prices)) s.prices[id] = Math.round(s.prices[id] * 0.9 / 50) * 50; return 'Bajaste tus precios 10%. Si el festival se hace, los vas a querer subir.'; } },
    ],
  },

  // ---------------- Capítulo 8 · El Consejo dividido ----------------
  {
    id: 'rodrigo_recorte', once: true, ch: 8, kind: 'consejo', icon: '✂️', lesson: 'convencer', lessonCtx: 'Don Rodrigo te pidió recortar sueldos para ganar más este mes.',
    title: 'Don Rodrigo quiere recortar sueldos',
    text: '"Si bajamos 20% los sueldos, ganamos más este mes. Los números mandan."',
    options: [
      { label: 'Mostrarle con números lo que cuesta que la gente renuncie', wise: true, wiseCtx: 'Le explicaste a un inversionista con números por qué cuidar al equipo también le conviene a él.', fx: [['Confianza +', 'up']],
        apply: (s) => { conf(s, 5); return '"Buen punto, Directora. No había pensado en lo que cuesta reemplazar gente."'; } },
      { label: 'Hacer el recorte', fx: [['Sueldos −', 'up'], ['Ánimo −−−', 'dn']],
        apply: (s) => { s.team.wage = 0.9; mood(s, -18); return 'Ahorraste en sueldos. Tu equipo está muy molesto.'; } },
      { label: 'Negarte sin explicar', fx: [['Confianza −', 'dn']],
        apply: (s) => { conf(s, -6); return 'Don Rodrigo no quedó convencido.'; } },
    ],
  },
  {
    id: 'alma_dividendos', month: 12, once: true, ch: 8, kind: 'consejo', icon: '🧁', lesson: 'escucha_todos', lessonCtx: 'Alma y Marcela no se pusieron de acuerdo sobre qué hacer con la ganancia.',
    title: 'Alma quiere repartir ganancias',
    text: '"Los dueños pusieron su dinero hace casi un año. Es justo que reciban algo." Marcela opina que primero hay que cuidar al equipo.',
    options: [
      { label: 'Escuchar a las dos y prometer decidirlo con números en la junta', wise: true, fx: [['Confianza +', 'up']],
        apply: (s) => { conf(s, 3); return 'Las dos aceptaron. En la junta del mes 12 decidirás cuánto repartir.'; } },
      { label: 'Darle la razón a Alma', fx: [['Ánimo del equipo −', 'dn']],
        apply: (s) => { mood(s, -3); return 'Alma sonrió. Marcela te recordó que el equipo también rema.'; } },
      { label: 'Darle la razón a Marcela', fx: [['Confianza del Consejo −', 'dn']],
        apply: (s) => { mood(s, 3); conf(s, -2); return 'Marcela sonrió. Alma te pidió ver los números antes de decidir.'; } },
    ],
  },
];
