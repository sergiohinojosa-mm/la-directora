// The year as a story: each chapter opens a new area of the business with its own decisions.
// Chapter follows the hotel's month: 1 → ch1 … 5–6 → ch5, 7–8 → ch6, 9–10 → ch7, 11–12 → ch8, 13+ → Año 2.

import { DAYS_PER_MONTH } from '../util.js';

export const hotelMonth = (s, day = s.day) => Math.floor((day - 1) / DAYS_PER_MONTH) + 1;

const START = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 9, 8: 11, 9: 13 };

export function chapterFor(s, day = s.day) {
  const m = hotelMonth(s, day);
  let ch = 1;
  for (const [c, month] of Object.entries(START)) if (m >= month) ch = +c;
  return ch;
}

export const chapterStartMonth = (ch) => START[ch];

// The business areas (tabs on the morning screen) and the chapter that opens each one.
export const AREAS = [
  { id: 'hoy', icon: '🏨', name: 'Hoy', ch: 1 },
  { id: 'equipo', icon: '👥', name: 'Equipo', ch: 2 },
  { id: 'ventas', icon: '📣', name: 'Ventas', ch: 3 },
  { id: 'servicio', icon: '🛎️', name: 'Servicio', ch: 4 },
  { id: 'restaurante', icon: '🍽️', name: 'Restaurante', ch: 5 },
  { id: 'hotel', icon: '🔧', name: 'Hotel', ch: 6 },
  { id: 'competencia', icon: '🆚', name: 'Competencia', ch: 7 },
  { id: 'plan', icon: '💼', name: 'Gran apuesta', ch: 8 },
];

export const has = (s, area) => chapterFor(s) >= AREAS.find((a) => a.id === area).ch;

export const CHAPTERS = {
  2: {
    title: 'Mi equipo', by: 'marcela', icon: '👥',
    story: [
      'El hotel ya camina, pero quien lo hace caminar es tu equipo.',
      'Este mes alguien puede renunciar en plena temporada, otro va a llegar tarde y dos se van a pelear. Así es dirigir personas.',
    ],
    unlocks: [
      ['💵', 'Sueldos: decide cuánto pagas. Pagar poco ahorra hoy, pero la gente se va.'],
      ['🎓', 'Capacitación: cuesta un día de trabajo y dinero, pero tu equipo limpia mejor para siempre.'],
      ['🚪', 'Renuncias: si el equipo está agotado o mal pagado, alguien se puede ir.'],
      ['🔎', 'Contratar ahora cuesta: buscar, entrevistar y entrenar a alguien nuevo.'],
    ],
  },
  3: {
    title: 'Que nos encuentren', by: 'alma', icon: '📣',
    story: [
      'Tu hotel es bueno, pero mucha gente todavía no sabe que existe.',
      'Este mes vas a decidir dónde anunciarte. Cada canal trae huéspedes, y cada uno cobra distinto. Mi consejo: mide cuánto te cuesta cada reserva.',
    ],
    unlocks: [
      ['🌐', 'Agencias en línea: traen mucha gente, pero se quedan con 18% de cada reserva.'],
      ['📱', 'Redes sociales: pagas cada día; anunciar más no siempre trae más.'],
      ['🤝', 'Alianzas con empresas y tours: más huéspedes entre semana.'],
      ['💌', 'Club de huéspedes: un pequeño descuento para que regresen y reserven directo.'],
    ],
  },
  4: {
    title: 'El cliente no siempre tiene la razón', by: 'marcela', icon: '🛎️',
    story: [
      'Van a llegar huéspedes que exigen, amenazan con malas reseñas o rompen cosas.',
      'Este mes escribes tus reglas: qué pasa si alguien cancela y cuánto puede hacer tu recepción para resolver una queja sin pedirte permiso.',
    ],
    unlocks: [
      ['📜', 'Política de cancelación: flexible atrae más reservas; estricta protege tu dinero.'],
      ['🔑', 'Poder de recepción: cuánto puede gastar Kevin para resolver una queja en el momento.'],
      ['💬', 'Quejas diarias: si nadie las resuelve, se vuelven malas reseñas.'],
      ['✍️', 'Responder reseñas: cada noche puedes contestar a tus huéspedes.'],
    ],
  },
  5: {
    title: 'Comida y algo más', by: 'papa', icon: '🍽️',
    story: [
      'Un buen restaurante atrae gente, incluso de fuera del hotel. Pero el chef, los ingredientes y la comida que se tira cuestan mucho.',
      'También vas a descubrir la venta más barata que existe: venderle algo más al huésped que ya está aquí.',
    ],
    unlocks: [
      ['👩‍🍳', 'Restaurante: tú decides si abrirlo, qué menú tener y cuánta comida comprar.'],
      ['🗑️', 'Si compras de más, se tira; si compras de menos, se acaba.'],
      ['🎁', 'Venta cruzada: tours, salida tarde y mejores cuartos para tus huéspedes.'],
      ['🧮', 'Nuevo número: ingreso por huésped.'],
    ],
  },
  6: {
    title: 'Lo que no se ve', by: 'alma', icon: '🔧',
    story: [
      'Tu hotel ya tiene meses de uso. Las cosas se desgastan aunque no las veas, y el gobierno también tiene reglas.',
      'Además, en unos meses llega la temporada baja. Lo que guardes ahora te va a salvar después.',
    ],
    unlocks: [
      ['🛠️', 'Estado del hotel: con poco mantenimiento, las cosas se descomponen en el peor momento.'],
      ['🛡️', 'Seguro: pagas poco cada mes para que una reparación grande no te hunda.'],
      ['🧾', 'Impuestos: 3% de cada noche vendida y 30% de la ganancia del mes.'],
      ['🔐', 'Corte de caja diario: sin controles, el dinero se puede perder sin que nadie lo note.'],
    ],
  },
  7: {
    title: 'Llegó la competencia', by: 'papa', icon: '🆚',
    story: [
      'Una cadena internacional, GlobalStay, abrió a dos cuadras. Es más barata y todo el mundo conoce su marca.',
      'Si solo bajas precios, siempre habrá alguien más barato. Vas a tener que leer la demanda y defender lo que te hace distinta.',
    ],
    unlocks: [
      ['🏢', 'GlobalStay: verás su precio cada día y cuántos clientes te quita.'],
      ['🦄', 'Experiencia única: algo que solo tu hotel ofrece.'],
      ['🤖', 'Precios automáticos: reglas que suben o bajan tu precio según la demanda.'],
      ['🎟️', 'Sobreventa: vender un cuarto de más por si alguien cancela… con riesgo.'],
      ['📐', 'Nuevos números: ADR (precio promedio) y RevPAR (ingreso por cuarto disponible).'],
    ],
  },
  8: {
    title: 'El Consejo dividido', by: 'papa', icon: '💼',
    story: [
      'Don Rodrigo, un inversionista nuevo y exigente, entra al Consejo. La abuela Alma quiere repartir ganancias; mamá Marcela quiere reinvertir en el equipo.',
      'Tu misión: armar un plan para la gran apuesta del hotel, conseguir el dinero y convencer al Consejo. Al final del mes 12 cerramos el año.',
    ],
    unlocks: [
      ['🏗️', 'Gran apuesta: más cuartos, spa o terraza. Cada una cuesta y paga distinto.'],
      ['🏦', 'Financiamiento: con tu caja, con el banco (puedes negociar) o con Don Rodrigo como socio.'],
      ['🗳️', 'Votación: cada consejero revisa algo distinto de tu plan.'],
      ['💸', 'Dividendos: al cerrar el año decides cuánto repartir y cuánto reinvertir.'],
    ],
  },
  9: {
    title: 'Año 2: la Directora crece', by: 'papa', icon: '🚀',
    story: [
      'Cerraste tu primer año completo. Ya conoces todas las áreas del negocio.',
      'Ahora puedes contratar a un gerente que se encargue del día a día. Pero ojo: tú sigues respondiendo por los resultados.',
    ],
    unlocks: [
      ['🧑‍💼', 'Gerente: se encarga de limpieza, horas extra y contrataciones por ti.'],
      ['📈', 'Las metas del Consejo siguen subiendo cada temporada.'],
    ],
  },
};
