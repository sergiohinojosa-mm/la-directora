// Chapter 1 event deck. Events change the context before she decides (input randomness);
// effects are bounded so no single card can sink the hotel.
// fx chips are hints, not exact numbers: 'up' good, 'dn' bad, 'q' uncertain.

import { clamp, calendar } from '../util.js';
import { LOCATIONS } from './world.js';
import { CHAPTER_EVENTS } from './events-chapters.js';

const firstRoom = (s) => LOCATIONS.find((l) => l.id === s.locationId).rooms[0].id;

export function addMod(s, mod) {
  s.mods.push({ from: s.day, to: s.day, ...mod });
}

const nextWeekend = (s) => {
  const dow = calendar(s.day).dow;
  const toFri = (4 - dow + 7) % 7 || 7;
  return { from: s.day + toFri, to: s.day + toFri + 2 };
};

const CH1_EVENTS = [
  {
    id: 'puente', kind: 'noticia', tone: 'good', minDay: 3,
    title: 'Viene un fin de semana largo',
    text: 'Es puente y muchas familias van a viajar a la playa. Se espera mucha más gente de viernes a domingo.',
    options: [{ label: 'Entendido', apply: (s) => { addMod(s, { type: 'demand', mult: 1.35, ...nextWeekend(s), label: 'Fin de semana largo' }); return 'El pronóstico ya muestra el puente. ¿Tus precios y tu equipo están listos?'; } }],
  },
  {
    id: 'congreso', kind: 'noticia', tone: 'good', minDay: 4,
    title: 'Congreso de doctores en el pueblo',
    text: 'Un congreso médico llega mañana y pasado. Los viajeros de trabajo buscan cuarto.',
    options: [{ label: 'Entendido', apply: (s) => { addMod(s, { type: 'demand', mult: 1.3, from: s.day + 1, to: s.day + 2, label: 'Congreso' }); return 'Mañana y pasado habrá más demanda.'; } }],
  },
  {
    id: 'lluvia', kind: 'noticia', tone: 'bad', minDay: 2, negative: true,
    title: 'Pronóstico de lluvia',
    text: 'Viene una semana lluviosa. Menos turistas van a viajar los próximos tres días.',
    options: [{ label: 'Entendido', apply: (s) => { addMod(s, { type: 'demand', mult: 0.82, from: s.day, to: s.day + 2, label: 'Lluvia' }); return 'Menos demanda por tres días. ¿Bajarás precios o aguantarás?'; } }],
  },
  {
    id: 'rival_baja', kind: 'noticia', tone: 'bad', minDay: 6, negative: true,
    title: 'Marea Inn bajó sus precios',
    text: 'El hotel de enfrente anunció 20% de descuento por cuatro días para robarte clientes.',
    options: [{ label: 'Entendido', apply: (s) => { addMod(s, { type: 'demand', mult: 0.88, from: s.day, to: s.day + 3, label: 'Descuento de Marea Inn' }); return 'Algunos clientes se irán con ellos. Decide si igualas o defiendes tu valor.'; } }],
  },
  {
    id: 'enferma', kind: 'equipo', minDay: 3, negative: true,
    title: 'Una recamarista se enfermó',
    text: 'Hoy falta una persona de limpieza y hay cuartos que dejar listos.',
    options: [
      { label: 'Pagar horas extra a las demás', fx: [['Caja −', 'dn'], ['Ánimo −', 'dn'], ['Cuartos limpios', 'up']],
        apply: (s) => { s.cash -= 900; s.morale = clamp(s.morale - 5, 0, 100); return 'Las demás cubrieron el turno, cansadas pero cumplieron.'; } },
      { label: 'Tú ayudas a limpiar', fx: [['Ánimo +', 'up'], ['Menos limpieza', 'q']],
        apply: (s) => { s.morale = clamp(s.morale + 6, 0, 100); addMod(s, { type: 'hkOff', n: 0.5, label: 'Falta media recamarista' }); return 'El equipo agradeció verte con la escoba. Pero tú sola no limpias como una profesional.'; } },
      { label: 'Trabajar con una persona menos', fx: [['Caja =', 'q'], ['Cuartos sucios', 'dn']],
        apply: (s) => { addMod(s, { type: 'hkOff', n: 1, label: 'Falta una recamarista' }); return 'Hoy hay menos capacidad de limpieza.'; } },
    ],
  },
  {
    id: 'lavadora', kind: 'operacion', minDay: 5, negative: true,
    title: 'Se descompuso la lavadora',
    text: 'Sin sábanas limpias no se pueden preparar cuartos.',
    options: [
      { label: 'Repararla hoy ($6,000)', fx: [['Caja −−', 'dn'], ['Sin problema', 'up']],
        apply: (s) => { s.cash -= 6000; return 'Lavadora como nueva.'; } },
      { label: 'Lavandería externa 3 días ($1,500 diarios)', fx: [['Caja −', 'dn'], ['Pagas cada día', 'q']],
        apply: (s) => { addMod(s, { type: 'dailyCost', amount: 1500, from: s.day, to: s.day + 2, label: 'Lavandería externa' }); return 'Pagarás $1,500 por día durante tres días.'; } },
      { label: 'Esperar a que pase el técnico', fx: [['Caja =', 'up'], ['Limpieza −− 3 días', 'dn']],
        apply: (s) => { addMod(s, { type: 'cleanMult', mult: 0.65, from: s.day, to: s.day + 2, label: 'Lavadora descompuesta' }); return 'Durante tres días se podrán limpiar menos cuartos.'; } },
    ],
  },
  {
    id: 'influencer', kind: 'oportunidad', minDay: 4,
    title: 'Una influencer de viajes quiere venir',
    text: 'Pide una noche gratis a cambio de publicar sobre tu hotel. Tiene muchos seguidores.',
    options: [
      { label: 'Aceptar', fx: [['Un cuarto menos hoy', 'dn'], ['Publicidad', 'q']],
        apply: (s) => {
          s.giftRooms += 1;
          const good = s.reputation >= 3.8;
          addMod(s, { type: 'demand', mult: good ? 1.15 : 1.04, from: s.day + 1, to: s.day + 7, label: 'Publicación de la influencer' });
          if (!good) s.reputation = clamp(s.reputation - 0.05, 1, 5);
          return good ? 'Le encantó el hotel. Su publicación traerá más clientes esta semana.' : 'Publicó, pero mencionó detalles que no le gustaron. Ayudó poco.';
        } },
      { label: 'Agradecer y decir que no', fx: [['Sin cambio', 'q']],
        apply: () => 'Le dijiste que no con amabilidad.' },
    ],
  },
  {
    id: 'amenidades', once: true, kind: 'operacion', minDay: 7, negative: true,
    title: 'Subió el precio de los jabones y toallas',
    text: 'Tu proveedor de amenidades sube 15% sus precios desde hoy.',
    options: [
      { label: 'Aceptar el aumento', fx: [['Costo por cuarto +', 'dn']],
        apply: (s) => { s.varCostMult *= 1.15; return 'Cada cuarto ocupado te costará un poco más.'; } },
      { label: 'Cambiar a una marca más barata', fx: [['Costo =', 'up'], ['Reseñas −', 'dn']],
        apply: (s) => { s.ratingPenalty += 0.08; return 'Ahorraste, pero algunos huéspedes notan la diferencia.'; } },
      { label: 'Negociar un aumento menor', fx: [['Costo por cuarto + (poco)', 'q']],
        apply: (s) => { s.varCostMult *= 1.06; return 'Aceptaron subir solo 6% si les compras por un año.'; } },
    ],
  },
  {
    id: 'uniformes', once: true, kind: 'equipo', minDay: 6,
    title: 'El equipo pide uniformes nuevos',
    text: 'Los uniformes están viejos y rotos. El equipo dice que da pena atender así.',
    options: [
      { label: 'Comprarlos ($8,000)', fx: [['Caja −', 'dn'], ['Ánimo ++', 'up']],
        apply: (s) => { s.cash -= 8000; s.morale = clamp(s.morale + 12, 0, 100); return 'El equipo estrena uniforme y se nota.'; } },
      { label: 'Prometer comprarlos el próximo mes', fx: [['Ánimo +', 'up'], ['Promesa pendiente', 'q']],
        apply: (s) => { s.morale = clamp(s.morale + 3, 0, 100); s.promises.push({ id: 'uniformes', due: s.day + 28, cost: 8000 }); return 'Lo apuntaron. Esperan que cumplas.'; } },
      { label: 'Decir que no hay presupuesto', fx: [['Caja =', 'up'], ['Ánimo −', 'dn']],
        apply: (s) => { s.morale = clamp(s.morale - 7, 0, 100); return 'El equipo entendió, pero no le gustó.'; } },
    ],
  },
  {
    id: 'idea_kevin', kind: 'equipo', minDay: 8, lesson: 'escucha_equipo', lessonCtx: 'Kevin, de recepción, te propuso una idea para los huéspedes.',
    title: 'Kevin de recepción tiene una idea',
    text: 'Propone noches de cine al aire libre para los huéspedes. Costaría $3,000 y una tarde de su tiempo.',
    options: [
      { label: 'Probar la idea', wise: true, wiseCtx: 'Probaste la idea de alguien de tu equipo.', fx: [['Caja −', 'dn'], ['Reseñas +', 'up'], ['Ánimo +', 'up']],
        apply: (s) => { s.cash -= 3000; s.morale = clamp(s.morale + 5, 0, 100); addMod(s, { type: 'ratingDay', delta: 0.25, from: s.day, to: s.day + 5, label: 'Noches de cine' }); return 'A los huéspedes les encantó y Kevin está feliz.'; } },
      { label: 'Ahora no', fx: [['Caja =', 'up'], ['Ánimo −', 'dn']],
        apply: (s) => { s.morale = clamp(s.morale - 4, 0, 100); return 'Kevin se quedó un poco desanimado.'; } },
    ],
  },
  {
    id: 'descuento_largo', kind: 'oportunidad', minDay: 2,
    title: 'Un huésped quiere quedarse 5 noches',
    text: 'Pide 15% de descuento por quedarse tantos días.',
    options: [
      { label: 'Darle el 15%', fx: [['Un cuarto seguro 5 días', 'up'], ['Precio −', 'dn']],
        apply: (s) => { s.contracts.push({ type: firstRoom(s), from: s.day, to: s.day + 4, priceMult: 0.85, label: 'Huésped de 5 noches' }); return 'Tienes un cuarto vendido por cinco noches.'; } },
      { label: 'Ofrecer desayuno gratis en lugar de descuento', fx: [['Un cuarto seguro 5 días', 'up'], ['Pequeño costo', 'q']],
        apply: (s) => { s.contracts.push({ type: firstRoom(s), from: s.day, to: s.day + 4, priceMult: 1, extraCost: 160, label: 'Huésped de 5 noches' }); return 'Aceptó feliz. Cobraste precio completo.'; } },
      { label: 'No dar descuento', fx: [['Puede irse', 'q']],
        apply: () => 'Dijo que lo pensaría y se fue a Marea Inn.' },
    ],
  },
  {
    id: 'cartera', kind: 'equipo', minDay: 5,
    title: 'Doña Chela encontró una cartera',
    text: 'Un huésped olvidó su cartera con $5,000 y Doña Chela la entregó completa.',
    options: [
      { label: 'Reconocerla con un bono de $500', fx: [['Ánimo +', 'up'], ['Reseñas +', 'up']],
        apply: (s) => { s.cash -= 500; s.morale = clamp(s.morale + 6, 0, 100); s.reputation = clamp(s.reputation + 0.05, 1, 5); return 'El huésped escribió una reseña sobre la honestidad del equipo.'; } },
      { label: 'Agradecerle en la junta del equipo', fx: [['Ánimo +', 'up']],
        apply: (s) => { s.morale = clamp(s.morale + 3, 0, 100); return 'Doña Chela sonrió todo el día.'; } },
    ],
  },
  {
    id: 'resena_injusta', kind: 'crisis', minDay: 6, negative: true,
    title: 'Una reseña injusta',
    text: 'Alguien escribió que el hotel "es el peor del mundo" porque no había alberca. Nunca dijiste que tuvieras alberca.',
    options: [
      { label: 'Responder con amabilidad y explicar', fx: [['Reseñas +', 'up']],
        apply: (s) => { s.reputation = clamp(s.reputation + 0.03, 1, 5); return 'Otros clientes vieron tu respuesta y les pareció profesional.'; } },
      { label: 'Responder que está equivocado', fx: [['Reseñas −', 'dn']],
        apply: (s) => { s.reputation = clamp(s.reputation - 0.1, 1, 5); return 'La discusión se hizo más grande y se vio mal.'; } },
      { label: 'Ignorarla', fx: [['Sin cambio', 'q']],
        apply: () => 'La reseña sigue ahí, sin respuesta.' },
    ],
  },
];

export const EVENTS = [...CH1_EVENTS.map((e) => ({ ch: 1, ...e })), ...CHAPTER_EVENTS];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// Cards can have text that depends on the hotel (functions); this resolves them.
export const txt = (v, s) => (typeof v === 'function' ? v(s) : v);
