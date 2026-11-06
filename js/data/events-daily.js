// Quick daily decisions: when no story card comes up, every morning still asks for one choice.
// Slow days (little demand) bring "what do you do with the empty rooms?" plays; busy days bring
// small guest requests. They teach that slow days are for selling differently and preparing.

import { clamp, money } from '../util.js';
import { potRev, canTrain, trainCost, MAX_SKILL } from '../engine/systems.js';
import { chapterFor } from './chapters.js';

const k = (s, frac) => Math.round((potRev(s) * frac) / 100) * 100;
const add = (s, mod) => s.mods.push({ from: s.day, to: s.day, ...mod });
const mood = (s, d) => { s.morale = clamp(s.morale + d, 0, 100); };

export const DAILY_EVENTS = [
  // ---------------- Días flojos ----------------
  {
    id: 'promo_local', quick: 'slow', kind: 'oportunidad', icon: '⚡',
    title: 'Día flojo: ¿promoción relámpago?',
    text: 'Hoy viene poca gente. Puedes lanzar una promoción solo por hoy para la gente de los pueblos cercanos.',
    options: [
      { label: 'Promo de hoy: 20% menos en todos los cuartos', fx: [['Precio −20% hoy', 'dn'], ['Más reservas', 'up']],
        apply: (s) => { s.flags.restorePrices = { ...s.prices }; for (const id of Object.keys(s.prices)) s.prices[id] = Math.round(s.prices[id] * 0.8 / 50) * 50; add(s, { type: 'demand', mult: 1.15, label: 'Promoción relámpago' }); return 'Promo lanzada: precios 20% abajo solo hoy. Mañana regresan solos.'; } },
      { label: 'Promo con desayuno gratis, mismo precio', fx: [['Costo por huésped', 'q'], ['Más reservas', 'up']],
        apply: (s) => { add(s, { type: 'demand', mult: 1.12, label: 'Promo con desayuno' }); add(s, { type: 'dailyCost', amount: k(s, 0.015), label: 'Desayunos de la promo' }); return 'Mantienes tu precio y regalas algo que te cuesta poco.'; } },
      { label: 'No, mejor cuidar el precio', fx: [['Precio =', 'up']], apply: () => 'Tus precios se quedan igual.' },
    ],
  },
  {
    id: 'limpieza_profunda', quick: 'slow', kind: 'operacion', icon: '🧽',
    title: 'Hay tiempo de sobra: ¿limpieza profunda?',
    text: 'Con pocos huéspedes, tu equipo puede lavar cortinas, alfombras y colchones.',
    options: [
      { label: (s) => `Limpieza profunda (${money(k(s, 0.03))} de materiales)`, fx: [['Caja −', 'dn'], ['Reseñas + 5 días', 'up']],
        apply: (s) => { s.cash -= k(s, 0.03); add(s, { type: 'ratingDay', delta: 0.12, to: s.day + 4, label: 'Hotel recién limpiado a fondo' }); add(s, { type: 'cleanMult', mult: 0.85, label: 'Limpieza profunda' }); if (s.maint?.condition != null) s.maint.condition = clamp(s.maint.condition + 4, 0, 100); return 'El hotel brilla. Los huéspedes de esta semana lo van a notar.'; } },
      { label: 'Que descansen un poco', fx: [['Ánimo +', 'up']], apply: (s) => { mood(s, 4); return 'El equipo agradeció el respiro.'; } },
    ],
  },
  {
    id: 'medio_dia_libre', quick: 'slow', kind: 'equipo', icon: '🌴', when: (s) => s.morale < 85,
    title: '¿Medio día libre para el equipo?',
    text: 'Hoy hay poco trabajo. Tu equipo lleva días cansado.',
    options: [
      { label: 'Sí: medio día libre pagado', fx: [['Ánimo ++', 'up'], ['Hoy limpian menos', 'dn']],
        apply: (s) => { mood(s, 9); add(s, { type: 'cleanMult', mult: 0.6, label: 'Medio día libre' }); return 'El equipo regresa mañana con energía.'; } },
      { label: 'No, que adelanten trabajo', fx: [['Ánimo −', 'dn']], apply: (s) => { mood(s, -2); return 'Adelantaron pendientes, aunque esperaban un respiro.'; } },
    ],
  },
  {
    id: 'llamar_empresas', quick: 'slow', kind: 'mercado', icon: '📞',
    title: '¿Llamar a empresas del pueblo?',
    text: 'Puedes pasar la mañana llamando a empresas para ofrecerles cuartos entre semana.',
    options: [
      { label: 'Ofrecer 10% de descuento por reservar 3 noches', fx: [['Cuartos seguros', 'up'], ['Precio −10%', 'dn']],
        apply: (s) => { const std = Object.keys(s.prices)[0]; const n = 2; for (let d = s.day + 1; d <= s.day + 3; d++) for (let i = 0; i < n; i++) s.contracts.push({ type: std, from: d, to: d, priceMult: 0.9, label: 'Empresa del pueblo' }); return `Una empresa reservó ${n} cuartos por las próximas 3 noches.`; } },
      { label: 'Ofrecer tarifa normal', fx: [['Puede que no', 'q']],
        apply: (s) => { if (s.day % 3 === 0) { const std = Object.keys(s.prices)[0]; s.contracts.push({ type: std, from: s.day + 1, to: s.day + 1, priceMult: 1, label: 'Empresa del pueblo' }); return 'Una empresa reservó un cuarto para mañana a precio completo.'; } return 'Hoy nadie aceptó. Así son las ventas: unas sí, otras no.'; } },
      { label: 'No vale la pena', fx: [['Sin cambio', 'q']], apply: () => 'Usaste la mañana en otra cosa.' },
    ],
  },
  {
    id: 'fotos_redes', quick: 'slow', kind: 'mercado', icon: '📸',
    title: '¿Sesión de fotos para redes?',
    text: 'Con el hotel vacío es el mejor día para tomar fotos bonitas de los cuartos (y de Botones).',
    options: [
      { label: (s) => `Contratar fotógrafa (${money(k(s, 0.04))})`, fx: [['Caja −', 'dn'], ['Demanda + 4 días', 'up']],
        apply: (s) => { s.cash -= k(s, 0.04); add(s, { type: 'demand', mult: 1.08, from: s.day + 1, to: s.day + 4, label: 'Fotos nuevas en redes' }); return 'Las fotos quedaron increíbles. Atraerán reservas los próximos días.'; } },
      { label: 'Tomarlas tú con el celular', fx: [['Gratis', 'up'], ['Demanda + poquito', 'q']],
        apply: (s) => { add(s, { type: 'demand', mult: 1.03, from: s.day + 1, to: s.day + 3, label: 'Fotos nuevas en redes' }); return 'No son profesionales, pero ayudan un poco.'; } },
      { label: 'Hoy no', fx: [['Sin cambio', 'q']], apply: () => 'Será otro día.' },
    ],
  },
  {
    id: 'dia_curso', quick: 'slow', kind: 'equipo', icon: '🎓', when: (s) => chapterFor(s) >= 2 && canTrain(s) && s.team.skill < MAX_SKILL,
    title: 'Día flojo: ¿capacitar al equipo?',
    text: 'La capacitación hace que limpien menos el día del curso. Hoy casi no se nota porque hay poco trabajo.',
    options: [
      { label: (s) => `Capacitar hoy (${money(trainCost(s))})`, fx: [['Caja −', 'dn'], ['Limpian mejor para siempre', 'up']],
        apply: (s) => { s.cash -= trainCost(s); s.team.skill += 1; s.team.lastTrain = s.day; add(s, { type: 'cleanMult', mult: 0.75, label: 'Capacitación del equipo' }); return `Elegiste bien el día: tu equipo subió a nivel ${s.team.skill}.`; } },
      { label: 'Otro día', fx: [['Sin cambio', 'q']], apply: () => 'Lo dejas para después.' },
    ],
  },
  {
    id: 'reparaciones_chicas', quick: 'slow', kind: 'operacion', icon: '🪛', when: (s) => chapterFor(s) >= 6 && (s.maint?.condition ?? 100) < 90,
    title: '¿Arreglar pendientes pequeños?',
    text: 'Una llave que gotea, un foco fundido, una puerta que rechina. Con el hotel vacío se arreglan sin molestar.',
    options: [
      { label: (s) => `Arreglar todo hoy (${money(k(s, 0.04))})`, fx: [['Caja −', 'dn'], ['Hotel en mejor estado', 'up']],
        apply: (s) => { s.cash -= k(s, 0.04); s.maint.condition = clamp(s.maint.condition + 8, 0, 100); return `El hotel subió a ${Math.round(s.maint.condition)}/100.`; } },
      { label: 'Dejarlo para después', fx: [['Riesgo', 'q']], apply: () => 'Los pendientes siguen ahí.' },
    ],
  },
  {
    id: 'menu_del_dia', quick: 'slow', kind: 'oportunidad', icon: '🍲', when: (s) => chapterFor(s) >= 5 && s.rest?.open,
    title: '¿Menú del día para la gente del pueblo?',
    text: 'El restaurante está tranquilo. Un menú económico puede atraer gente que trabaja cerca.',
    options: [
      { label: 'Lanzar menú del día', fx: [['Más comensales', 'up'], ['Más ingredientes', 'dn']],
        apply: (s) => { s.cash += k(s, 0.025); return 'Llegaron oficinistas a comer. El restaurante ganó un poco más hoy.'; } },
      { label: 'No', fx: [['Sin cambio', 'q']], apply: () => 'Restaurante tranquilo.' },
    ],
  },

  // ---------------- Días llenos y normales ----------------
  {
    id: 'cumple', quick: 'busy', kind: 'oportunidad', icon: '🎂',
    title: 'Hoy es el cumpleaños de una huésped',
    text: 'Su familia te pregunta si pueden sorprenderla en su cuarto.',
    options: [
      { label: (s) => `Pastel y globos de cortesía (${money(k(s, 0.01))})`, fx: [['Caja −', 'dn'], ['Reseña ★★★★★', 'up']],
        apply: (s) => { s.cash -= k(s, 0.01); s.reputation = clamp(s.reputation + 0.03, 1, 5); return 'Lloró de emoción. Escribió la mejor reseña del mes.'; } },
      { label: 'Venderles el paquete de cumpleaños', fx: [['Ingreso +', 'up']],
        apply: (s) => { s.cash += k(s, 0.015); return 'Lo compraron felices. ¡Venta cruzada!'; } },
      { label: 'Solo prestarles la llave', fx: [['Sin costo', 'q']], apply: () => 'Ellos se encargaron de todo.' },
    ],
  },
  {
    id: 'checkin_temprano', quick: 'busy', kind: 'crisis', icon: '⏰',
    title: 'Llegaron a las 9 de la mañana',
    text: 'Una familia quiere entrar a su cuarto ya. La entrada es a las 3 pm y los cuartos están por limpiarse.',
    options: [
      { label: 'Limpiar su cuarto primero y dejarlos entrar', fx: [['Huésped feliz', 'up'], ['Limpieza más apretada', 'dn']],
        apply: (s) => { add(s, { type: 'cleanMult', mult: 0.94, label: 'Entrada temprana' }); s.reputation = clamp(s.reputation + 0.02, 1, 5); return 'Se instalaron felices. Tu equipo tuvo que reorganizarse.'; } },
      { label: 'Cobrar la entrada temprana', fx: [['Ingreso +', 'up']],
        apply: (s) => { s.cash += Math.round(Object.values(s.prices)[0] * 0.3); add(s, { type: 'cleanMult', mult: 0.94, label: 'Entrada temprana' }); return 'Pagaron 30% más por entrar temprano.'; } },
      { label: 'Guardarles las maletas y ofrecer la alberca', fx: [['Sin costo', 'up']], apply: () => 'Esperaron tranquilos en la alberca.' },
    ],
  },
  {
    id: 'mascota', quick: 'busy', kind: 'crisis', icon: '🐶', when: (s) => !s.attributes.includes('mascotas'),
    title: 'Un huésped llegó con su perrito',
    text: 'Tu hotel no acepta mascotas, pero él no lo sabía y viene de muy lejos.',
    options: [
      { label: 'Aceptarlo cobrando limpieza extra', fx: [['Ingreso +', 'up'], ['Más limpieza', 'q']],
        apply: (s) => { s.cash += 400; add(s, { type: 'cleanMult', mult: 0.96, label: 'Cuarto con mascota' }); return 'El perrito fue la estrella del día.'; } },
      { label: 'Explicar la regla con amabilidad y recomendar otro hotel', fx: [['Reglas claras', 'up']], apply: () => 'Entendió y te agradeció la recomendación.' },
      { label: 'Aceptarlo gratis', fx: [['Huésped feliz', 'up'], ['Otros piden lo mismo', 'dn']],
        apply: (s) => { add(s, { type: 'cleanMult', mult: 0.96, label: 'Cuarto con mascota' }); return 'Feliz… y mañana alguien más llegó con su gato.'; } },
    ],
  },
  {
    id: 'grupo_ultimo', quick: 'busy', kind: 'mercado', icon: '🚌',
    title: 'Un grupo quiere 3 cuartos para hoy',
    text: 'Un tour llegó sin reserva. Piden 15% de descuento por ser grupo.',
    options: [
      { label: 'Aceptar con descuento', fx: [['3 cuartos seguros', 'up'], ['Precio −15%', 'dn']],
        apply: (s) => { const std = Object.keys(s.prices)[0]; for (let i = 0; i < 3; i++) s.contracts.push({ type: std, from: s.day, to: s.day, priceMult: 0.85, label: 'Grupo de tour' }); return 'Tienes 3 cuartos vendidos hoy. ¿Los habrías vendido de todos modos?'; } },
      { label: 'Aceptar sin descuento', fx: [['Puede irse', 'q']],
        apply: (s) => { if (s.day % 2) { const std = Object.keys(s.prices)[0]; for (let i = 0; i < 3; i++) s.contracts.push({ type: std, from: s.day, to: s.day, priceMult: 1, label: 'Grupo de tour' }); return 'Aceptaron tu precio completo.'; } return 'Se fueron a GlobalStay. A veces negociar duro sale caro.'; } },
      { label: 'No hay lugar', fx: [['Sin cambio', 'q']], apply: () => 'Les recomendaste otro hotel.' },
    ],
  },
  {
    id: 'objeto_olvidado', quick: 'busy', kind: 'equipo', icon: '🧸',
    title: 'Un niño olvidó su peluche',
    text: 'La familia ya va camino al aeropuerto y el niño está llorando.',
    options: [
      { label: 'Enviarlo por paquetería, cortesía del hotel', fx: [['Caja −', 'dn'], ['Reseña ★★★★★', 'up']],
        apply: (s) => { s.cash -= 350; s.reputation = clamp(s.reputation + 0.02, 1, 5); return 'La mamá subió una foto del niño abrazando su peluche. ¡Mil likes!'; } },
      { label: 'Guardarlo hasta que lo reclamen', fx: [['Sin costo', 'q']], apply: () => 'Quedó guardado en recepción.' },
    ],
  },
];
