// What a great director would do on each card, shown right after she decides.
// best: index of the best option (as listed in the card), a function of the hotel's state, or
// null when "it depends" — then `why` gives the rule for deciding. Short, about consequences.

import { forecast, totalRooms } from '../engine/sim.js';

const busy = (s) => forecast(s, s.day).total > totalRooms(s);

export const ADVICE = {
  // Capítulo 1
  puente: { best: null, why: 'Cuando viene mucha gente, sube tus precios esos días y prepara a tu equipo de limpieza (horas extra o alguien más).' },
  congreso: { best: null, why: 'Los viajeros de trabajo pagan bien y reservan tarde: sube un poco el precio esos dos días.' },
  lluvia: { best: null, why: 'Con menos gente, bajar un poco el precio evita cuartos vacíos. Pero no lo regales: la lluvia pasa.' },
  rival_baja: { best: null, why: 'No corras a igualar su descuento. Si tus reseñas son buenas, muchos clientes se quedan contigo.' },
  enferma: { best: (s) => (busy(s) ? 0 : 2), why: 'Depende del día: si viene mucha gente, paga horas extra para no perder huéspedes; si es flojo, trabajar con una persona menos ahorra. Ayudar tú sube el ánimo, pero no reemplaza a una profesional.' },
  lavadora: { best: 0, why: 'Reparar hoy duele más de golpe, pero tres días con menos cuartos limpios cuestan más. Compara siempre: ¿cuánto dejarías de vender?' },
  influencer: { best: (s) => (s.reputation >= 3.8 ? 0 : 1), why: 'Acepta solo si tu hotel está en buena forma (3.8★ o más): una influencer muestra lo bueno… y lo malo.' },
  amenidades: { best: 2, why: 'Negociar casi siempre conviene: el proveedor prefiere un cliente seguro. Lo barato que el huésped nota te baja las reseñas.' },
  uniformes: { best: 0, why: 'Un equipo orgulloso atiende mejor. Y si prometes algo, cúmplelo: prometer y no cumplir es peor que decir que no.' },
  idea_kevin: { best: 0, why: 'Una idea barata de quien atiende a los huéspedes vale la pena probarla: si funciona, ganas; si no, aprendiste barato.' },
  descuento_largo: { best: 1, why: 'Dar algo que te cuesta poco (un desayuno) en lugar de bajar el precio cuida tu ingreso y el huésped queda igual de feliz.' },
  cartera: { best: 0, why: 'Reconocer algo bueno con un detalle concreto hace que todo el equipo quiera repetirlo. Las dos opciones son buenas; el bono deja más huella.' },
  resena_injusta: { best: 0, why: 'Responde siempre con amabilidad: tu respuesta la leen todos los futuros huéspedes, no solo quien se quejó.' },

  // Capítulo 2
  renuncia: { best: null, why: 'Si faltan manos, reemplázala pronto. Pero mira la causa: el cansancio o un sueldo bajo hacen que la gente se vaya, y reemplazar cuesta más que cuidar.' },
  llega_tarde: { best: 0, why: 'Antes de regañar, pregunta. Casi siempre hay una razón, y en privado la gente se abre.' },
  pelea: { best: 0, why: 'Un conflicto que nadie resuelve crece. Una plática hoy cuesta poco tiempo y evita semanas de equipo dividido.' },
  aumento: { best: 0, why: 'Si tu ganancia lo permite, pagar justo reduce renuncias y reemplazos. Un bono alegra hoy pero no cambia el problema.' },
  recomendada: { best: null, why: 'Una recomendación de confianza vale mucho, pero contrata solo si de verdad necesitas a alguien: cada persona cuesta todos los días.' },
  curso: { best: 0, why: 'Capacitar cuesta hoy y paga todos los días después. Y a mitad de precio, mejor.' },

  // Capítulo 3
  ota_destacado: { best: 1, why: 'Prueba poco antes de comprometerte mucho: una semana de prueba te deja medir si la comisión extra vale la pena.' },
  video_viral: { best: (s) => (s.mkt?.social ? 0 : 1), why: 'Si ya tienes redes activas, invertir en el momento viral multiplica el efecto. Si no, el video ayuda solo un poco.' },
  convenio: { best: null, why: 'Un convenio que llena días flojos vale aunque tenga descuento: un cuarto vacío no deja nada. Negociar puede salir bien o mal.' },
  todos_quieren: { best: 1, why: 'Decir que sí a todo vacía la caja. Elige una opción, mide si funciona y luego decide la siguiente.' },
  resenas_falsas: { best: 0, why: 'Las reseñas falsas se descubren y entonces nadie te cree. Tu nombre vale más que unas estrellas.' },
  resenas_descubiertas: { best: 0, why: 'Cuando te equivocas, decir la verdad rápido duele menos que esconderlo.' },

  // Capítulo 4
  exige_suite: { best: 0, why: 'Escucha, ofrece algo justo y sostén tus reglas con amabilidad. Si cedes a gritos, todos aprenden a gritar.' },
  amenaza_resena: { best: 0, why: 'Si el problema es real, compensa lo justo. No pagues de más por una amenaza: enseñas que amenazar funciona.' },
  rompio_tv: { best: 0, why: 'Tener registros (el reporte de entrega) te deja cobrar con respeto y sin discutir.' },
  grita_recamarista: { best: 0, why: 'Tu equipo necesita saber que lo defiendes. Un cliente que grita no tiene la razón por gritar.' },
  cancela_enfermo: { best: 0, why: 'Cumple tu política y busca una salida que ayude: cambiar la fecha cuida tu dinero y al cliente.' },

  // Capítulo 5
  chef_aumento: { best: 0, why: 'Un buen trato hace que a los dos les convenga lo mismo: un bono por resultados alinea a la chef con el restaurante.' },
  proveedor: { best: 0, why: 'No compres de más solo por un descuento: lo que se tira también se paga.' },
  critico: { best: (s) => (s.rest?.menu >= 1 ? 0 : 1), why: 'Si tu comida es buena, atiéndelo como a todos: los críticos valoran lo real. Si tu menú es sencillo, preparar algo especial ayuda.' },
  boda: { best: null, why: 'Una boda paga mucho en un día, pero cansa al equipo y desplaza a huéspedes normales. Conviene si ese sábado no se iba a llenar.' },
  refri: { best: 0, why: 'Esperar para ahorrar en una reparación urgente casi siempre sale más caro.' },

  // Capítulo 6
  falla_aire: { best: (s) => (busy(s) ? 0 : 1), why: 'Si viene mucha gente, repara hoy: cada cuarto cerrado es dinero perdido. En días flojos, la reparación normal está bien. El parche barato suele fallar otra vez.' },
  falla_agua: { best: 0, why: 'Sin agua caliente las reseñas caen rápido. Arreglarlo de fondo evita que vuelva a pasar.' },
  proteccion_civil: { best: 0, why: 'La seguridad no se negocia: corregir todo hoy te cuida a ti, a tus huéspedes y a tu equipo.' },
  mordida: { best: 0, why: 'Un atajo deshonesto parece barato hasta que se descubre. Paga lo oficial y duerme tranquila.' },
  mordida_descubierta: { best: 0, why: 'Cuando te equivocas, acepta y corrige.' },
  faltante: { best: 0, why: 'Sin pruebas no acuses. Pon controles: contar la caja cada día protege al dinero y al equipo honesto.' },
  temporada_baja: { best: 0, why: 'Los meses buenos pagan los malos. Aparta dinero ahora para no sufrir después.' },

  // Capítulo 7
  guerra_global: { best: 0, why: 'Si solo compites con precio, siempre habrá alguien más barato. Defiende lo que te hace distinta.' },
  roban_personal: { best: 0, why: 'A la gente buena le importa crecer, no solo el sueldo. Darle un camino suele retenerla mejor que igualar una oferta.' },
  oferta_compra: { best: 0, why: 'Un hotel con clientes y buena reputación vale más de lo que costó. No vendas barato lo que construiste.' },
  festival_incierto: { best: 0, why: 'Cuando no sabes qué va a pasar, prepárate a medias: si pasa, ganas; si no, no pierdes mucho.' },

  // Capítulo 8
  rodrigo_recorte: { best: 0, why: 'Con números se convence mejor que con un "no". Muestra cuánto cuesta que la gente se vaya.' },
  alma_dividendos: { best: 0, why: 'Cuando el Consejo no está de acuerdo, escucha a todos y decide con números, no con quién habla más fuerte.' },

  // Decisiones diarias
  promo_local: { best: 1, why: 'En un día flojo, regalar algo que te cuesta poco atrae gente sin bajar tu precio. Bajar 20% por un día también sirve.' },
  limpieza_profunda: { best: 0, why: 'Los días flojos son para preparar el hotel: lo que hoy limpias a fondo, mañana se nota en las reseñas.' },
  medio_dia_libre: { best: 0, why: 'Descansar cuando hay poco trabajo recarga al equipo para los días llenos.' },
  llamar_empresas: { best: 0, why: 'Un cuarto vendido con un pequeño descuento vale más que uno vacío. Vender entre semana es buscar clientes, no esperarlos.' },
  fotos_redes: { best: null, why: 'Buenas fotos venden cuartos. Si la caja está sana, la fotógrafa vale la pena; si no, tu celular también ayuda.' },
  dia_curso: { best: 0, why: 'Capacitar un día flojo es ideal: casi no pierdes limpieza y el equipo mejora para siempre.' },
  reparaciones_chicas: { best: 0, why: 'Arregla lo pequeño antes de que se vuelva grande, y mejor cuando el hotel está vacío.' },
  menu_del_dia: { best: 0, why: 'Si el restaurante está tranquilo, atraer gente de fuera aprovecha a la chef que ya estás pagando.' },
  cumple: { best: null, why: 'Las dos primeras son buenas: un detalle barato crea fans y reseñas, y venderlo es venta cruzada. Lo importante es aprovechar el momento.' },
  checkin_temprano: { best: (s) => (busy(s) ? 2 : 1), why: 'Si el día está lleno, no compliques la limpieza: guarda las maletas y ofrece algo mientras esperan. Si hay cuartos listos, cobrar la entrada temprana es ingreso extra.' },
  mascota: { best: 1, why: 'Tus reglas existen por algo. Explicarlas con amabilidad y ayudar con otra opción cuida tu política y al cliente.' },
  grupo_ultimo: { best: (s) => (busy(s) ? 1 : 0), why: 'Si hoy te ibas a llenar de todos modos, no des descuento. Si es un día flojo, 3 cuartos seguros valen el descuento.' },
  objeto_olvidado: { best: 0, why: 'Un gesto pequeño en el momento justo convierte a un cliente en fan.' },
};
