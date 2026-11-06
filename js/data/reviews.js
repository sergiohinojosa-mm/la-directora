// The guest review shown each evening: the day's numbers seen through a guest's eyes.
// Picked from what actually happened (lost guests, price vs value, cleaning rush, a great day).

const GUESTS = ['Familia Ramírez', 'Sofía y Leo', 'Don Chuy', 'La maestra Paty', 'Valentina, 13 años', 'El señor Kim', 'Mochilera Ana', 'Los Garza', 'Abuelo Ernesto', 'Chef Mariana'];

const TEMPLATES = {
  lost: [
    'Llegamos y no había cuarto listo. Nos fuimos a Marea Inn. 😤',
    'Esperé dos horas en recepción porque “estaban limpiando”. No vuelvo.',
  ],
  rush: [
    'Bonito hotel, pero encontré una calceta que no era mía debajo de la cama. 🧦',
    'La recamarista se veía agotadísima. El cuarto quedó a medias.',
  ],
  expensive: [
    'Lindo, pero carísimo para lo que ofrece. 💸',
    'Pagué como hotel de lujo y la toalla raspaba.',
  ],
  bargain: [
    '¡Qué precio tan bueno! Ya reservé para el próximo puente. 🙌',
    'Por este precio esperaba menos. ¡Me sorprendieron!',
  ],
  great: [
    'La cama más cómoda del mundo. Botones durmió en mi maleta. 🐱',
    'Todo limpio, todos amables. Cinco estrellas sin pensarlo.',
    'Mis hijos no querían irse. Ya es nuestro hotel favorito.',
  ],
  ok: [
    'Todo bien, sin sorpresas. Volvería.',
    'Buen hotel. El desayuno podría mejorar.',
    'Cómodo y tranquilo. Justo lo que necesitaba.',
  ],
  empty: [
    'El hotel estaba tan vacío que oía mi eco. 👻',
    'Muy tranquilo… demasiado tranquilo.',
  ],
};

export function reviewFor(r) {
  let kind = 'ok';
  if (r.lostDirty > 0) kind = 'lost';
  else if (r.workload > 1.15 && !r.overtime) kind = 'rush';
  else if (r.priceRatio > 1.25) kind = 'expensive';
  else if (r.occupancy < 0.35) kind = 'empty';
  else if (r.dayRating >= 4.3) kind = 'great';
  else if (r.priceRatio < 0.88) kind = 'bargain';
  const list = TEMPLATES[kind];
  const i = (r.day * 7 + r.soldTotal) % list.length;
  const stars = kind === 'lost' ? 1 : kind === 'rush' || kind === 'expensive' || kind === 'empty' ? 3 : kind === 'great' || kind === 'bargain' ? 5 : 4;
  return { stars, text: list[i], who: GUESTS[(r.day * 3 + r.soldTotal) % GUESTS.length] };
}
