// The three hotels for sale in the prologue, the guest segments and the value-proposition attributes.
// Money is MXN; a game month is 28 days.

export const SEGMENTS = {
  lujo: { name: 'Parejas y lujo', icon: '💎' },
  familias: { name: 'Familias', icon: '👨‍👩‍👧' },
  trabajo: { name: 'Viajes de trabajo', icon: '💼' },
  paso: { name: 'De paso y mochileros', icon: '🎒' },
};

export const LOCATIONS = [
  {
    id: 'playa',
    name: 'Frente al mar',
    zone: 'Playa Dorada',
    blurb: 'Arena blanca y atardeceres. Aquí llegan clientes que pagan mucho y exigen mucho.',
    price: 18_000_000,
    fixedMonthly: 520_000,
    varPerNight: 900,
    baseOcc: 0.63,
    seasonAmp: 0.35,
    elasticity: 2.6,
    mix: { lujo: 0.6, familias: 0.3, trabajo: 0.05, paso: 0.05 },
    rooms: [
      { id: 'std', name: 'Estándar', count: 10, ref: 3200 },
      { id: 'mar', name: 'Vista al mar', count: 5, ref: 4300 },
      { id: 'suite', name: 'Suite', count: 1, ref: 7800 },
    ],
    startHousekeepers: 3,
    expects: { attr: 'spa', note: 'Los clientes de lujo esperan un spa.' },
    risk: 'Temporada baja muy vacía; un mes malo duele mucho.',
  },
  {
    id: 'centro',
    name: 'Centro del pueblo',
    zone: 'Plaza Mayor',
    blurb: 'Cerca de restaurantes, museos y oficinas. Familias y viajes de trabajo.',
    price: 7_000_000,
    fixedMonthly: 180_000,
    varPerNight: 400,
    baseOcc: 0.62,
    seasonAmp: 0.15,
    elasticity: 3.2,
    mix: { lujo: 0.1, familias: 0.45, trabajo: 0.35, paso: 0.1 },
    rooms: [
      { id: 'std', name: 'Estándar', count: 10, ref: 1600 },
      { id: 'fam', name: 'Familiar', count: 4, ref: 2300 },
    ],
    startHousekeepers: 2,
    expects: { attr: 'desayuno', note: 'Las familias y los viajeros de trabajo esperan desayuno.' },
    risk: 'Más competencia directa: Marea Inn está enfrente.',
  },
  {
    id: 'carretera',
    name: 'Junto a la carretera',
    zone: 'Entrada a Bahía Lunar',
    blurb: 'Barato y fácil de llegar en coche. Viajeros de paso y mochileros.',
    price: 2_500_000,
    fixedMonthly: 42_000,
    varPerNight: 200,
    baseOcc: 0.6,
    seasonAmp: 0.1,
    elasticity: 3.6,
    mix: { lujo: 0, familias: 0.15, trabajo: 0.35, paso: 0.5 },
    rooms: [{ id: 'std', name: 'Estándar', count: 12, ref: 850 }],
    startHousekeepers: 2,
    expects: null,
    risk: 'Poca demanda; difícil pasar de 50% de cuartos llenos.',
  },
];

export const LOAN_OPTIONS = [
  { pct: 0.4, name: 'Poca deuda', cashMonths: 1.2, note: 'Mensualidad baja, pero te queda poco colchón de dinero.' },
  { pct: 0.6, name: 'Equilibrado', cashMonths: 2.2, note: 'Mensualidad media y un colchón razonable.' },
  { pct: 0.75, name: 'Mucha deuda', cashMonths: 3.4, note: 'Mucho colchón para empezar, pero una mensualidad alta todos los meses.' },
];

export const ANNUAL_RATE = 0.13;
export const LOAN_MONTHS = 120;

export function monthlyPayment(principal) {
  const r = ANNUAL_RATE / 12;
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -LOAN_MONTHS)));
}

export const ATTRIBUTES = [
  { id: 'spa', name: 'Spa', icon: '🧖', monthly: 120_000, perNight: 0, rating: 0.3,
    appeal: { lujo: 0.18, familias: 0.04, trabajo: 0.02, paso: 0 } },
  { id: 'desayuno', name: 'Desayuno incluido', icon: '🥐', monthly: 0, perNight: 160, rating: 0.25,
    appeal: { lujo: 0.03, familias: 0.1, trabajo: 0.1, paso: 0.08 } },
  { id: 'wifi', name: 'Wifi rápido y área de trabajo', icon: '💻', monthly: 8_000, perNight: 0, rating: 0.1,
    appeal: { lujo: 0.02, familias: 0.02, trabajo: 0.18, paso: 0.06 } },
  { id: 'kids', name: 'Club infantil', icon: '🧸', monthly: 40_000, perNight: 0, rating: 0.2,
    appeal: { lujo: -0.06, familias: 0.2, trabajo: 0, paso: 0 } },
  { id: 'mascotas', name: 'Acepta mascotas', icon: '🐶', monthly: 5_000, perNight: 80, rating: 0.1,
    appeal: { lujo: -0.02, familias: 0.06, trabajo: 0, paso: 0.12 } },
  { id: 'shuttle', name: 'Transporte al aeropuerto', icon: '🚐', monthly: 30_000, perNight: 0, rating: 0.15,
    appeal: { lujo: 0.1, familias: 0.04, trabajo: 0.06, paso: 0 } },
];

export const MAX_ATTRIBUTES = 2;
export const HOUSEKEEPER_DAILY = 480;
export const ROOMS_PER_HOUSEKEEPER = 6;
export const BOARD = {
  papa: { name: 'Papá', role: 'Presidente del Consejo', color: '#FFC24B', initial: 'P' },
  alma: { name: 'Abuela Alma', role: 'Consejera de Finanzas', color: '#2BB3C0', initial: 'A' },
  marcela: { name: 'Mamá Marcela', role: 'Consejera de Huéspedes y Equipo', color: '#7ED6A8', initial: 'M' },
};
