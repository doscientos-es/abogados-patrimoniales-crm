// PLANTILLAS DE COMUNICACIÓN — pieza nuclear de COMUNICACIONES.
//
// LEX no envía: PREPARA. Toda comunicación saliente parte de una plantilla,
// incluso el «mensaje libre», que usa una plantilla base mínima.
//
// Clasificación principal: las 6 fases de LEX. Los ejemplos de abajo son
// DATOS DE PRUEBA (3-4 por fase), pensados para editarse o eliminarse: no
// constituyen el catálogo definitivo del despacho.
import type { CanalComunicacion } from '@/data/comunicaciones'

/* ------------------------------- Fases ------------------------------ */

export const FASES_LEX = [
  'Lead',
  'Onboarding',
  'Casework',
  'Delivery',
  'Offboarding',
  'Aftercare',
] as const
export type FaseLex = (typeof FASES_LEX)[number]

/** Fase probable a partir del contexto vinculado de una comunicación. */
export function faseDeContexto(ctx: {
  leadId?: string | undefined
  onboardingId?: string | undefined
  expedienteId?: string | undefined
}): FaseLex {
  if (ctx.leadId) return 'Lead'
  if (ctx.onboardingId) return 'Onboarding'
  if (ctx.expedienteId) return 'Casework'
  return 'Lead'
}

/* ----------------------------- Plantillas --------------------------- */

export type FormatoPlantilla = 'Texto' | 'Audio' | 'Texto + audio'

export type PlantillaLex = {
  id: string
  /** Nombre interno con el que la localiza el despacho. */
  nombre: string
  fase: FaseLex
  canal: CanalComunicacion
  formato: FormatoPlantilla
  /** Para qué sirve: ayuda a elegir sin abrirla. */
  finalidad: string
  /** Sólo email. */
  asunto?: string
  /** Cuerpo de texto. En plantillas de sólo audio puede ir vacío. */
  cuerpo: string
  /**
   * Audio prehecho reutilizable (WhatsApp Business). En esta fase se guarda
   * la referencia interna: la reproducción real depende de la integración.
   */
  audio?: { nombre: string; duracion?: string; referencia?: string }
  favorita?: boolean
  /** Marca de dato de prueba: puede borrarse sin consecuencias. */
  demo?: boolean
}

/** Plantilla base mínima: nunca se parte de un lienzo en blanco. */
export const PLANTILLA_BASE_EMAIL: PlantillaLex = {
  id: 'PLX-BASE-EMAIL',
  nombre: 'Mensaje libre (base)',
  fase: 'Casework',
  canal: 'Email',
  formato: 'Texto',
  finalidad: 'Estructura mínima para un correo sin plantilla específica.',
  asunto: '',
  cuerpo: 'Buenos días, {CONTACTO}:\n\n[contenido]\n\nUn saludo,\n{REMITENTE}\n{DESPACHO}',
  favorita: true,
}

export const PLANTILLA_BASE_WHATSAPP: PlantillaLex = {
  id: 'PLX-BASE-WA',
  nombre: 'Mensaje libre (base)',
  fase: 'Casework',
  canal: 'WhatsApp',
  formato: 'Texto',
  finalidad: 'Estructura mínima para un WhatsApp sin plantilla específica.',
  cuerpo: 'Buenos días, {CONTACTO}:\n\n[contenido]\n\nUn saludo,\n{DESPACHO}',
  favorita: true,
}

export const PLANTILLAS_LEX: PlantillaLex[] = [
  PLANTILLA_BASE_EMAIL,
  PLANTILLA_BASE_WHATSAPP,

  /* ------------------------------ Lead ------------------------------ */
  {
    id: 'PLX-L1',
    nombre: 'Acuse de primera consulta',
    fase: 'Lead',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Confirmar que hemos recibido la consulta inicial.',
    asunto: 'Hemos recibido su consulta · {DESPACHO}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nHemos recibido su consulta y la estamos revisando. Nos pondremos en contacto con usted para concretar una primera cita.\n\nUn saludo,\n{REMITENTE}',
    favorita: true,
    demo: true,
  },
  {
    id: 'PLX-L2',
    nombre: 'Propuesta de primera cita',
    fase: 'Lead',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Proponer día y hora para la primera reunión.',
    asunto: 'Propuesta de cita · {DESPACHO}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe proponemos celebrar la primera cita el [indicar fecha] a las [indicar hora].\n\nConfírmenos si le resulta posible.\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-L3',
    nombre: 'Recordatorio breve de cita',
    fase: 'Lead',
    canal: 'WhatsApp',
    formato: 'Texto',
    finalidad: 'Recordar la cita por WhatsApp el día anterior.',
    cuerpo:
      'Buenos días, {CONTACTO}: le recordamos su cita en {DESPACHO} el [indicar fecha] a las [indicar hora]. Un saludo.',
    favorita: true,
    demo: true,
  },
  {
    id: 'PLX-L4',
    nombre: 'Audio · bienvenida al despacho',
    fase: 'Lead',
    canal: 'WhatsApp',
    formato: 'Texto + audio',
    finalidad: 'Audio prehecho de presentación del despacho para nuevos contactos.',
    cuerpo: 'Le adjuntamos una breve presentación en audio. Quedamos a su disposición.',
    audio: { nombre: 'Bienvenida despacho', duracion: '0:38' },
    demo: true,
  },

  /* ---------------------------- Onboarding --------------------------- */
  {
    id: 'PLX-O1',
    nombre: 'Envío de proforma',
    fase: 'Onboarding',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Remitir la proforma y las instrucciones de pago.',
    asunto: 'Proforma de honorarios · {DESPACHO}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe remitimos la proforma correspondiente al encargo. Una vez confirmado el pago, iniciaremos formalmente la tramitación.\n\nUn saludo,\n{REMITENTE}',
    favorita: true,
    demo: true,
  },
  {
    id: 'PLX-O2',
    nombre: 'Solicitud de documentación inicial',
    fase: 'Onboarding',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Pedir la documentación necesaria para abrir el expediente.',
    asunto: 'Documentación necesaria · {NUM_EXPEDIENTE}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nPara continuar necesitamos la siguiente documentación:\n\n- [indicar documento]\n\nMuchas gracias.\n\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-O3',
    nombre: 'Recordatorio de documentación',
    fase: 'Onboarding',
    canal: 'WhatsApp',
    formato: 'Texto',
    finalidad: 'Recordar de forma breve la documentación pendiente.',
    cuerpo:
      'Buenos días, {CONTACTO}: le recordamos que queda pendiente de enviarnos [indicar documento]. Gracias.',
    demo: true,
  },
  {
    id: 'PLX-O4',
    nombre: 'Audio · explicación del inicio formal',
    fase: 'Onboarding',
    canal: 'WhatsApp',
    formato: 'Audio',
    finalidad: 'Audio prehecho explicando cómo arranca el asunto tras el pago.',
    cuerpo: '',
    audio: { nombre: 'Inicio formal del encargo', duracion: '1:05' },
    demo: true,
  },

  /* ----------------------------- Casework ---------------------------- */
  {
    id: 'PLX-C1',
    nombre: 'Últimas actuaciones',
    fase: 'Casework',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Informar periódicamente de las actuaciones practicadas.',
    asunto: 'ÚLTIMAS ACTUACIONES · {NUM_EXPEDIENTE} · {TITULO_EXPEDIENTE}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe informamos de las últimas actuaciones practicadas en el expediente {NUM_EXPEDIENTE}:\n\n- [indicar actuación]\n\nQuedamos a su disposición.\n\nAtentamente,\n{REMITENTE}',
    favorita: true,
    demo: true,
  },
  {
    id: 'PLX-C2',
    nombre: 'Traslado de resolución',
    fase: 'Casework',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Remitir una resolución recibida y anunciar el análisis.',
    asunto: 'Resolución recibida · {NUM_EXPEDIENTE}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe trasladamos la resolución recibida en el expediente {NUM_EXPEDIENTE}. La estamos analizando y le indicaremos la siguiente actuación a seguir.\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-C3',
    nombre: 'Aviso de señalamiento',
    fase: 'Casework',
    canal: 'WhatsApp',
    formato: 'Texto',
    finalidad: 'Avisar de una fecha judicial señalada.',
    cuerpo:
      'Buenos días, {CONTACTO}: le informamos de que se ha señalado [indicar acto] para el [indicar fecha]. Le llamamos para explicárselo.',
    demo: true,
  },

  /* ----------------------------- Delivery ---------------------------- */
  {
    id: 'PLX-D1',
    nombre: 'Entrega de resultado',
    fase: 'Delivery',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Entregar el resultado del encargo al cliente.',
    asunto: 'Entrega de resultado · {NUM_EXPEDIENTE}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe hacemos entrega del resultado del encargo {NUM_EXPEDIENTE}. Adjuntamos la documentación correspondiente.\n\nUn saludo,\n{REMITENTE}',
    favorita: true,
    demo: true,
  },
  {
    id: 'PLX-D2',
    nombre: 'Liquidación económica',
    fase: 'Delivery',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Comunicar la liquidación económica final.',
    asunto: 'Liquidación económica · {NUM_EXPEDIENTE}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe remitimos la liquidación económica del expediente {NUM_EXPEDIENTE}, con el detalle de cantidades.\n\nAtentamente,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-D3',
    nombre: 'Aviso de entrega disponible',
    fase: 'Delivery',
    canal: 'WhatsApp',
    formato: 'Texto',
    finalidad: 'Avisar de que la documentación final está lista.',
    cuerpo:
      'Buenos días, {CONTACTO}: la documentación final de su asunto ya está disponible. Le hemos escrito por correo con el detalle.',
    demo: true,
  },

  /* ---------------------------- Offboarding -------------------------- */
  {
    id: 'PLX-F1',
    nombre: 'Cierre del expediente',
    fase: 'Offboarding',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Comunicar formalmente el cierre del asunto.',
    asunto: 'Cierre del expediente · {NUM_EXPEDIENTE}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nDamos por concluido el expediente {NUM_EXPEDIENTE}. Conservamos la documentación a su disposición.\n\nUn saludo,\n{REMITENTE}',
    favorita: true,
    demo: true,
  },
  {
    id: 'PLX-F2',
    nombre: 'Devolución de documentación original',
    fase: 'Offboarding',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Coordinar la devolución de originales.',
    asunto: 'Devolución de documentación · {NUM_EXPEDIENTE}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nTenemos preparada la documentación original para su devolución. Indíquenos cuándo le viene bien recogerla.\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-F3',
    nombre: 'Audio · agradecimiento de cierre',
    fase: 'Offboarding',
    canal: 'WhatsApp',
    formato: 'Texto + audio',
    finalidad: 'Audio breve de agradecimiento al terminar el asunto.',
    cuerpo: 'Muchas gracias por su confianza. Le dejamos un breve mensaje de despedida.',
    audio: { nombre: 'Agradecimiento de cierre', duracion: '0:26' },
    demo: true,
  },

  /* ----------------------------- Aftercare --------------------------- */
  {
    id: 'PLX-A1',
    nombre: 'Seguimiento posterior',
    fase: 'Aftercare',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Interesarse por la situación tras el cierre.',
    asunto: 'Seguimiento · {DESPACHO}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nHa pasado un tiempo desde el cierre de su asunto y queremos interesarnos por su situación. Si necesita cualquier cosa, quedamos a su disposición.\n\nUn saludo,\n{REMITENTE}',
    favorita: true,
    demo: true,
  },
  {
    id: 'PLX-A2',
    nombre: 'Aviso de vencimiento o revisión',
    fase: 'Aftercare',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Recordar una revisión periódica o un vencimiento futuro.',
    asunto: 'Revisión pendiente · {DESPACHO}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe recordamos que conviene revisar [indicar asunto] antes de [indicar fecha].\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-A3',
    nombre: 'Audio · recordatorio anual',
    fase: 'Aftercare',
    canal: 'WhatsApp',
    formato: 'Audio',
    finalidad: 'Audio prehecho de recordatorio anual de revisión patrimonial.',
    cuerpo: '',
    audio: { nombre: 'Recordatorio revisión anual', duracion: '0:44' },
    demo: true,
  },

  /* ------- Contexto REUNIÓN · PREPARACIÓN (tarea especial Reunión) ------- */
  {
    id: 'PLX-R1',
    nombre: 'Reunión · solicitar disponibilidad',
    fase: 'Casework',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Pedir franjas disponibles antes de proponer fecha.',
    asunto: 'Disponibilidad para una reunión · {DESPACHO}',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nNecesitamos mantener una reunión sobre [objeto]. ¿Podría indicarnos su disponibilidad durante los próximos días?\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-R2',
    nombre: 'Reunión · proponer fecha',
    fase: 'Casework',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Proponer un día y hora concretos.',
    asunto: 'Propuesta de reunión · [fecha]',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe proponemos reunirnos el [fecha] a las [hora] en [lugar / videollamada]. Quedamos a la espera de su confirmación.\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-R3',
    nombre: 'Reunión · proponer varias alternativas',
    fase: 'Casework',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Ofrecer dos o tres franjas alternativas.',
    asunto: 'Alternativas para nuestra reunión',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nLe ofrecemos estas alternativas:\n· [fecha 1] a las [hora]\n· [fecha 2] a las [hora]\n· [fecha 3] a las [hora]\n\nIndíquenos cuál le encaja mejor.\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-R4',
    nombre: 'Reunión · confirmar',
    fase: 'Casework',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Confirmar día, hora, lugar y asistentes.',
    asunto: 'Reunión confirmada · [fecha]',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nConfirmamos la reunión del [fecha] a las [hora] en [lugar / enlace]. Asistirán [asistentes].\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-R5',
    nombre: 'Reunión · cambio de fecha',
    fase: 'Casework',
    canal: 'Email',
    formato: 'Texto',
    finalidad: 'Comunicar una reprogramación.',
    asunto: 'Cambio de fecha de nuestra reunión',
    cuerpo:
      'Buenos días, {CONTACTO}:\n\nPor [motivo] necesitamos trasladar la reunión prevista al [nueva fecha] a las [hora]. Disculpe la molestia.\n\nUn saludo,\n{REMITENTE}',
    demo: true,
  },
  {
    id: 'PLX-R6',
    nombre: 'Reunión · recordatorio',
    fase: 'Casework',
    canal: 'WhatsApp',
    formato: 'Texto',
    finalidad: 'Recordar la reunión el día antes.',
    cuerpo:
      'Buenos días, {CONTACTO}. Le recordamos nuestra reunión de mañana [fecha] a las [hora] en [lugar]. Un saludo, {REMITENTE}',
    demo: true,
  },
]

/** Últimas plantillas usadas (memoria de sesión, no persistida todavía). */
const recientes: string[] = []

export const registrarUsoPlantilla = (id: string) => {
  const i = recientes.indexOf(id)
  if (i >= 0) recientes.splice(i, 1)
  recientes.unshift(id)
  if (recientes.length > 8) recientes.pop()
}

export const plantillasRecientes = (canal: CanalComunicacion) =>
  recientes
    .map((id) => PLANTILLAS_LEX.find((p) => p.id === id))
    .filter((p): p is PlantillaLex => !!p && p.canal === canal)

export const plantillasDe = (canal: CanalComunicacion) =>
  PLANTILLAS_LEX.filter((p) => p.canal === canal)
