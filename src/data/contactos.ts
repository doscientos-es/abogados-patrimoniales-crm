// Datos ficticios del módulo CONTACTOS. Sustituibles en el futuro sin tocar las pantallas.

/**
 * NATURALEZA: qué es el contacto en sí mismo (dato objetivo e invariable).
 * No se mezcla con la relación con el despacho ni con la profesión.
 */
export type Naturaleza = 'Persona física' | 'Persona jurídica' | 'Órgano judicial' | 'Público'

/** Alias histórico: el campo del contacto sigue llamándose tipoPersona. */
export type TipoPersona = Naturaleza

export const NATURALEZAS: { id: Naturaleza; descripcion: string }[] = [
  { id: 'Persona física', descripcion: 'Individuo identificado por nombre, apellidos y NIF/NIE.' },
  { id: 'Persona jurídica', descripcion: 'Sociedad o entidad con razón social y CIF.' },
  { id: 'Órgano judicial', descripcion: 'Juzgado, tribunal, fiscalía o decanato.' },
  { id: 'Público', descripcion: 'Administración, registro u organismo oficial.' },
]

/**
 * RELACIÓN CON EL DESPACHO: qué es el contacto para nosotros.
 * Única y excluyente. Solo "Cliente" activa las obligaciones documentales y bancarias.
 */
export type RelacionDespacho =
  | 'Lead'
  | 'Cliente'
  | 'Profesional / colaborador'
  | 'Tercero'
  | 'Contraparte'
  | 'Proveedor'

export const RELACIONES: { id: RelacionDespacho; descripcion: string }[] = [
  { id: 'Lead', descripcion: 'Contacto potencial todavía no convertido en cliente.' },
  { id: 'Cliente', descripcion: 'Encargo aceptado. Exige documentación y datos bancarios.' },
  {
    id: 'Profesional / colaborador',
    descripcion: 'Procuradores, peritos, notarías y colaboradores externos.',
  },
  { id: 'Tercero', descripcion: 'Intervinientes ajenos sin relación contractual.' },
  { id: 'Contraparte', descripcion: 'Parte contraria o su representación.' },
  { id: 'Proveedor', descripcion: 'Suministradores de bienes o servicios al despacho.' },
]

export type EstadoContacto = 'Activo' | 'Inactivo' | 'Archivado'
export type Satisfaccion = 'Sin valorar' | 'Muy bajo' | 'Bajo' | 'Medio' | 'Alto' | 'Muy alto'
export type EstadoDoc = 'Completa' | 'Pendiente' | 'Caducada'
export type EstadoRgpd = 'Firmada' | 'Pendiente' | 'Revocada'
export type EstadoPoder = 'Vigentes' | 'Pendientes' | 'Inexistentes'

export const SATISFACCIONES: Satisfaccion[] = [
  'Sin valorar',
  'Muy bajo',
  'Bajo',
  'Medio',
  'Alto',
  'Muy alto',
]

/**
 * OBSOLETO — "Profesión o condición".
 * Suprimido de la interfaz: la función del contacto se registra como
 * "Interviene como" en la pestaña INTERVINIENTES de cada expediente.
 * Se conserva únicamente como dato histórico archivado y para la migración
 * de fichas antiguas. No debe usarse en pantallas nuevas.
 */
type CategoriaId =
  | 'abogado'
  | 'procurador'
  | 'notaria'
  | 'perito'
  | 'fincas'
  | 'gestoria'
  | 'organismo'
  | 'empresa'
  | 'particular'
  | 'colaborador'
  | 'otro'
  // Identificadores heredados: se traducen a relación en la migración.
  | 'cliente'
  | 'potencial'
  | 'contrario'
  | 'proveedor'

/** @deprecated Catálogo histórico archivado. No se muestra en la interfaz. */
const CATEGORIAS: {
  id: CategoriaId
  nombre: string
  color: string
  activa: boolean
}[] = [
  { id: 'abogado', nombre: 'Abogado/a', color: 'oklch(0.55 0.15 25)', activa: true },
  { id: 'procurador', nombre: 'Procurador/a', color: 'oklch(0.55 0.1 300)', activa: true },
  { id: 'notaria', nombre: 'Notaría', color: 'oklch(0.5 0.08 90)', activa: true },
  { id: 'perito', nombre: 'Perito', color: 'oklch(0.52 0.09 190)', activa: true },
  { id: 'fincas', nombre: 'Administrador de fincas', color: 'oklch(0.5 0.07 140)', activa: true },
  { id: 'gestoria', nombre: 'Gestoría o asesoría', color: 'oklch(0.55 0.08 120)', activa: true },
  { id: 'organismo', nombre: 'Organismo o entidad', color: 'oklch(0.45 0.05 265)', activa: true },
  { id: 'empresa', nombre: 'Empresa', color: 'oklch(0.5 0.11 250)', activa: true },
  { id: 'particular', nombre: 'Particular', color: 'oklch(0.62 0.12 210)', activa: true },
  { id: 'colaborador', nombre: 'Colaborador externo', color: 'oklch(0.55 0.11 160)', activa: true },
  { id: 'otro', nombre: 'Otro', color: 'oklch(0.55 0.02 260)', activa: false },
]

export const ORIGENES = [
  'Recomendación de cliente',
  'Recomendación profesional',
  'Página web',
  'Redes sociales',
  'Publicidad',
  'Contacto directo',
  'Cliente anterior',
  'Colaborador',
  'Otro',
]

export const CANALES = ['Teléfono', 'Correo electrónico', 'WhatsApp', 'Videollamada', 'Presencial']

export const TIPOS_RECLAMACION = [
  'Retraso en la tramitación',
  'Falta de información',
  'Honorarios',
  'Trato recibido',
  'Error documental',
  'Otro',
]

export const ESTADOS_DOCUMENTALES = [
  'Vigente',
  'Pendiente',
  'Próximo a caducar',
  'Caducado',
  'Revocado',
  'No aplicable',
]

export const IDIOMAS = ['Castellano', 'Catalán', 'Inglés', 'Francés', 'Alemán']
export const PAISES = ['España', 'Francia', 'Portugal', 'Reino Unido', 'Andorra']
export const PROVINCIAS = ['Madrid', 'Barcelona', 'Valencia', 'Alicante', 'Sevilla', 'Vizcaya']

export type Documento = {
  tipo: string
  numero?: string
  expedicion?: string
  caducidad?: string
  firma?: string
  estado: string
  archivo: string
  observaciones?: string
  subidoPor?: string
  version?: number
}

export type Poder = {
  tipo: string
  otorgante: string
  apoderados: string
  organismo: string
  protocolo: string
  otorgamiento: string
  caducidad: string
  ambito: string
  estado: string
  archivo: string
}

export type OtroDocumento = {
  nombre: string
  categoria: string
  fecha: string
  caducidad?: string
  etiquetas: string[]
  archivo: string
}

export type Nota = {
  id: string
  titulo: string
  contenido: string
  autor: string
  fecha: string
  destacada: boolean
  archivada: boolean
}

export type Valoracion = { fecha: string; nivel: Satisfaccion; observacion: string; autor: string }

export type Recomendacion = {
  contactoId?: string
  nombre: string
  fecha: string
  resultado: string
  observaciones: string
}

export type Incidencia = {
  fecha: string
  tipo: string
  descripcion: string
  estado: 'Abierta' | 'En revisión' | 'Resuelta' | 'Cerrada'
  solucion: string
  observaciones: string
}

export type Contacto = {
  id: string
  /** NATURALEZA del contacto (qué es). */
  tipoPersona: Naturaleza
  /** RELACIÓN con el despacho (qué es para nosotros). Única y excluyente. */
  relacion: RelacionDespacho
  nombre: string
  apellidos?: string
  /** Razón social o denominación oficial del órgano/organismo. */
  razonSocial?: string
  /** Código o identificación oficial del órgano judicial u organismo. */
  codigoOrgano?: string
  nif: string
  nacimiento?: string
  /** @deprecated Dato histórico archivado; no se muestra ni se edita. */
  profesion?: string
  /** @deprecated Dato histórico archivado; no se muestra ni se edita. */
  categorias: CategoriaId[]
  estado: EstadoContacto
  telefono: string
  telefono2?: string
  email: string
  email2?: string
  direccion: string
  cp: string
  municipio: string
  provincia: string
  pais: string
  idioma: string
  personaContacto?: string
  cargoContacto?: string
  observaciones?: string
  origen: string
  canal: string
  horario: string
  tratamiento: string
  indicaciones: string
  observacionesTrato: string
  satisfaccion: Satisfaccion
  fechaSatisfaccion: string
  historialSatisfaccion: Valoracion[]
  recomendadoPor?: Recomendacion
  haRecomendado: Recomendacion[]
  incidencias: Incidencia[]
  banco: {
    titular: string
    nif: string
    iban: string
    entidad: string
    bic: string
    sepa: boolean
    fechaSepa?: string
    estadoMandato: string
    observaciones: string
  }
  documentacion: { identificacion: EstadoDoc; rgpd: EstadoRgpd; poderes: EstadoPoder }
  identificacion: Documento[]
  proteccionDatos: Documento[]
  poderes: Poder[]
  otrosDocumentos: OtroDocumento[]
  notas: Nota[]
  creado: string
  creadoPor: string
  modificado: string
  modificadoPor: string
}

/** Ficha tal y como está escrita en los datos ficticios (relación opcional). */
type ContactoRaw = Omit<Contacto, 'relacion'> & { relacion?: RelacionDespacho }

export function nombreCompleto(
  c: Pick<Contacto, 'tipoPersona' | 'nombre' | 'apellidos' | 'razonSocial'>,
) {
  return c.tipoPersona === 'Persona física'
    ? `${c.nombre} ${c.apellidos ?? ''}`.trim()
    : (c.razonSocial ?? c.nombre)
}

/* ------------------- Reglas por relación con el despacho ------------------ */

export const esCliente = (c: Pick<Contacto, 'relacion'>) => c.relacion === 'Cliente'

/** Solo los clientes tienen exigencias documentales y bancarias. */
export const requiereDocumentacion = esCliente
export const requiereDatosBancarios = esCliente

export type EstadoDocumentalContacto = {
  aplica: boolean
  etiqueta: string
  pendientes: string[]
}

/**
 * Estado documental del contacto. Para quien no es cliente no hay obligación
 * alguna: nunca se muestran avisos ni documentación "pendiente".
 */
export function estadoDocumental(c: Contacto): EstadoDocumentalContacto {
  if (!requiereDocumentacion(c)) {
    return { aplica: false, etiqueta: 'No aplicable', pendientes: [] }
  }
  const pendientes: string[] = []
  if (c.documentacion.identificacion !== 'Completa') {
    pendientes.push(`Identificación: ${c.documentacion.identificacion.toLowerCase()}`)
  }
  if (c.documentacion.rgpd !== 'Firmada') {
    pendientes.push(`Protección de datos: ${c.documentacion.rgpd.toLowerCase()}`)
  }
  if (c.documentacion.poderes === 'Pendientes') {
    pendientes.push('Poderes pendientes de aportar')
  }
  return {
    aplica: true,
    etiqueta: pendientes.length === 0 ? 'Completa' : 'Pendiente',
    pendientes,
  }
}

/** Aviso bancario: solo para clientes sin cuenta registrada. */
export function avisoBancario(c: Contacto): string | null {
  if (!requiereDatosBancarios(c)) return null
  if (!c.banco.iban.trim()) return 'Cliente sin cuenta bancaria registrada.'
  if (!c.banco.sepa) return 'Mandato SEPA pendiente de firma.'
  return null
}

/* ---------------------------- Migración de datos -------------------------- */

/** Traducción de las antiguas categorías mixtas a la nueva relación. */
const RELACION_POR_CATEGORIA: Partial<Record<CategoriaId, RelacionDespacho>> = {
  cliente: 'Cliente',
  potencial: 'Lead',
  contrario: 'Contraparte',
  proveedor: 'Proveedor',
  procurador: 'Profesional / colaborador',
  notaria: 'Profesional / colaborador',
  perito: 'Profesional / colaborador',
  fincas: 'Profesional / colaborador',
  gestoria: 'Profesional / colaborador',
  colaborador: 'Profesional / colaborador',
  organismo: 'Tercero',
}

/** Antiguas categorías que en realidad describen una profesión o condición. */
const CATEGORIA_HEREDADA: Partial<Record<CategoriaId, CategoriaId>> = {
  contrario: 'abogado',
  cliente: 'particular',
  potencial: 'particular',
  proveedor: 'empresa',
}

const CATEGORIAS_VALIDAS = new Set(CATEGORIAS.map((c) => c.id))

/**
 * Separa relación y profesión en las fichas antiguas. Cuando ninguna categoría
 * permite deducir la relación con seguridad, queda "Sin clasificar" para su
 * revisión manual.
 */
function migrarContacto(c: ContactoRaw): Contacto {
  const relacion =
    c.relacion ?? c.categorias.map((id) => RELACION_POR_CATEGORIA[id]).find(Boolean) ?? 'Tercero'

  const categorias: CategoriaId[] = []
  for (const id of c.categorias) {
    const traducida = CATEGORIAS_VALIDAS.has(id) ? id : CATEGORIA_HEREDADA[id]
    if (traducida && !categorias.includes(traducida)) categorias.push(traducida)
  }
  if (categorias.length === 0)
    categorias.push(c.tipoPersona === 'Persona física' ? 'particular' : 'empresa')

  return { ...c, relacion, categorias }
}

const baseBanco = {
  titular: '',
  nif: '',
  iban: '',
  entidad: '',
  bic: '',
  sepa: false,
  estadoMandato: 'Sin mandato',
  observaciones: '—',
}

const CONTACTOS_BASE: ContactoRaw[] = [
  {
    id: 'CT-0001',

    tipoPersona: 'Persona física',
    nombre: 'Elena',
    apellidos: 'Vargas Miralles',
    nif: '51234567H',
    nacimiento: '12/03/1961',
    profesion: 'Empresaria',
    categorias: ['cliente'],
    estado: 'Activo',
    telefono: '610 224 118',
    telefono2: '915 220 118',
    email: 'elena.vargas@correo.es',
    email2: 'evargas@grupomiralles.es',
    direccion: 'Calle Serrano 118, 4.º B',
    cp: '28006',
    municipio: 'Madrid',
    provincia: 'Madrid',
    pais: 'España',
    idioma: 'Castellano',
    observaciones: 'Cabeza de la rama familiar Miralles. Sucesión en curso.',
    origen: 'Recomendación profesional',
    canal: 'Teléfono',
    horario: 'Mañanas de 9:00 a 13:00',
    tratamiento: 'Sra. Vargas',
    indicaciones: 'No contactar por WhatsApp. Copiar siempre a su hijo en los correos.',
    observacionesTrato: 'Prefiere reuniones presenciales para asuntos sucesorios.',
    satisfaccion: 'Muy alto',
    fechaSatisfaccion: '04/06/2026',
    historialSatisfaccion: [
      {
        fecha: '04/06/2026',
        nivel: 'Muy alto',
        observacion: 'Cierre del protocolo familiar.',
        autor: 'A. Torregrosa',
      },
      {
        fecha: '18/01/2026',
        nivel: 'Alto',
        observacion: 'Buena valoración tras onboarding.',
        autor: 'M. Sanchís',
      },
    ],
    recomendadoPor: {
      contactoId: 'CT-0006',
      nombre: 'Notaría Ruiz de Alda',
      fecha: '09/11/2025',
      resultado: 'Convertido en cliente',
      observaciones: 'Derivada para planificación sucesoria.',
    },
    haRecomendado: [
      {
        contactoId: 'CT-0002',
        nombre: 'Inversiones Torrelodones, S.L.',
        fecha: '20/02/2026',
        resultado: 'Convertido en cliente',
        observaciones: 'Sociedad patrimonial de la familia.',
      },
    ],
    incidencias: [],
    banco: {
      titular: 'Elena Vargas Miralles',
      nif: '51234567H',
      iban: 'ES91 2100 0418 4502 0005 1332',
      entidad: 'CaixaBank',
      bic: 'CAIXESBBXXX',
      sepa: true,
      fechaSepa: '15/11/2025',
      estadoMandato: 'Vigente',
      observaciones: 'Domiciliación de provisiones de fondos.',
    },
    documentacion: { identificacion: 'Completa', rgpd: 'Firmada', poderes: 'Vigentes' },
    identificacion: [
      {
        tipo: 'DNI',
        numero: '51234567H',
        expedicion: '02/02/2022',
        caducidad: '02/02/2032',
        estado: 'Vigente',
        archivo: 'DNI_EVargas.pdf',
        subidoPor: 'M. Sanchís',
        version: 2,
      },
    ],
    proteccionDatos: [
      {
        tipo: 'Cláusula informativa',
        firma: '14/11/2025',
        estado: 'Firmado',
        archivo: 'RGPD_clausula_EVargas.pdf',
        subidoPor: 'M. Sanchís',
      },
      {
        tipo: 'Autorización para comunicaciones',
        firma: '14/11/2025',
        estado: 'Firmado',
        archivo: 'RGPD_comunicaciones_EVargas.pdf',
        subidoPor: 'M. Sanchís',
      },
    ],
    poderes: [
      {
        tipo: 'Poder general',
        otorgante: 'Elena Vargas Miralles',
        apoderados: 'A. Torregrosa, M. Sanchís',
        organismo: 'Notaría Ruiz de Alda',
        protocolo: '2.418/2025',
        otorgamiento: '20/11/2025',
        caducidad: '—',
        ambito: 'Actos de administración y disposición ordinaria',
        estado: 'Vigente',
        archivo: 'Poder_general_EVargas.pdf',
      },
    ],
    otrosDocumentos: [
      {
        nombre: 'Protocolo familiar (borrador)',
        categoria: 'Documentación patrimonial',
        fecha: '12/05/2026',
        etiquetas: ['sucesiones', 'familia'],
        archivo: 'Protocolo_familiar_v3.docx',
      },
    ],
    notas: [
      {
        id: 'N-1',
        titulo: 'Reparto de la vivienda de Cercedilla',
        contenido:
          'La clienta quiere reservar la vivienda para su hija menor. Revisar impacto en legítimas antes de la próxima reunión.',
        autor: 'A. Torregrosa',
        fecha: '02/07/2026 10:12',
        destacada: true,
        archivada: false,
      },
      {
        id: 'N-2',
        titulo: 'Llamada de seguimiento',
        contenido: 'Confirmada la cita del 14/07. Solicita que asista también el asesor fiscal.',
        autor: 'M. Sanchís',
        fecha: '24/06/2026 17:40',
        destacada: false,
        archivada: false,
      },
    ],
    creado: '09/11/2025',
    creadoPor: 'M. Sanchís',
    modificado: '02/07/2026',
    modificadoPor: 'A. Torregrosa',
  },
  {
    id: 'CT-0002',
    tipoPersona: 'Persona jurídica',
    nombre: 'Inversiones Torrelodones',
    razonSocial: 'Inversiones Torrelodones, S.L.',
    nif: 'B87451220',
    categorias: ['cliente'],
    estado: 'Activo',
    telefono: '918 550 220',
    email: 'administracion@invtorrelodones.es',
    direccion: 'Avenida de la Constitución 24',
    cp: '28250',
    municipio: 'Torrelodones',
    provincia: 'Madrid',
    pais: 'España',
    idioma: 'Castellano',
    personaContacto: 'Javier Miralles Vargas',
    cargoContacto: 'Administrador único',
    observaciones: 'Sociedad patrimonial familiar con cinco inmuebles en arrendamiento.',
    origen: 'Recomendación de cliente',
    canal: 'Correo electrónico',
    horario: 'Tardes',
    tratamiento: 'Sr. Miralles',
    indicaciones: 'Enviar documentación siempre en PDF firmado.',
    observacionesTrato: '—',
    satisfaccion: 'Alto',
    fechaSatisfaccion: '10/05/2026',
    historialSatisfaccion: [
      {
        fecha: '10/05/2026',
        nivel: 'Alto',
        observacion: 'Reestructuración societaria satisfactoria.',
        autor: 'A. Torregrosa',
      },
    ],
    recomendadoPor: {
      contactoId: 'CT-0001',
      nombre: 'Elena Vargas Miralles',
      fecha: '20/02/2026',
      resultado: 'Convertido en cliente',
      observaciones: '—',
    },
    haRecomendado: [],
    incidencias: [],
    banco: {
      titular: 'Inversiones Torrelodones, S.L.',
      nif: 'B87451220',
      iban: 'ES68 0049 1500 0512 3456 7892',
      entidad: 'Banco Santander',
      bic: 'BSCHESMMXXX',
      sepa: true,
      fechaSepa: '01/03/2026',
      estadoMandato: 'Vigente',
      observaciones: '—',
    },
    documentacion: { identificacion: 'Completa', rgpd: 'Firmada', poderes: 'Vigentes' },
    identificacion: [
      {
        tipo: 'Escritura de constitución',
        numero: '1.204/2011',
        expedicion: '14/06/2011',
        estado: 'Vigente',
        archivo: 'Escritura_constitucion.pdf',
        subidoPor: 'L. Ferrer',
      },
      {
        tipo: 'Tarjeta CIF',
        numero: 'B87451220',
        expedicion: '20/06/2011',
        estado: 'Vigente',
        archivo: 'CIF_Torrelodones.pdf',
        subidoPor: 'L. Ferrer',
      },
    ],
    proteccionDatos: [
      {
        tipo: 'Consentimiento firmado',
        firma: '01/03/2026',
        estado: 'Firmado',
        archivo: 'RGPD_Torrelodones.pdf',
        subidoPor: 'L. Ferrer',
      },
    ],
    poderes: [
      {
        tipo: 'Representación de persona jurídica',
        otorgante: 'Inversiones Torrelodones, S.L.',
        apoderados: 'Javier Miralles Vargas',
        organismo: 'Notaría Ruiz de Alda',
        protocolo: '890/2024',
        otorgamiento: '03/04/2024',
        caducidad: '—',
        ambito: 'Representación societaria plena',
        estado: 'Vigente',
        archivo: 'Poder_representacion.pdf',
      },
    ],
    otrosDocumentos: [],
    notas: [
      {
        id: 'N-1',
        titulo: 'Cuentas anuales 2025',
        contenido:
          'Pendiente de recibir las cuentas del ejercicio para revisar el reparto de dividendos.',
        autor: 'L. Ferrer',
        fecha: '30/06/2026 09:05',
        destacada: false,
        archivada: false,
      },
    ],
    creado: '20/02/2026',
    creadoPor: 'L. Ferrer',
    modificado: '28/06/2026',
    modificadoPor: 'L. Ferrer',
  },
  {
    id: 'CT-0003',
    tipoPersona: 'Persona física',
    nombre: 'Ramón',
    apellidos: 'Iglesias Peña',
    nif: '44120933K',
    nacimiento: '05/09/1974',
    profesion: 'Arquitecto',
    categorias: ['potencial'],
    estado: 'Activo',
    telefono: '655 981 402',
    email: 'r.iglesias@estudioip.com',
    direccion: 'Carrer de Balmes 45, 2.º',
    cp: '08007',
    municipio: 'Barcelona',
    provincia: 'Barcelona',
    pais: 'España',
    idioma: 'Catalán',
    observaciones: 'Interesado en la reorganización de un patrimonio inmobiliario heredado.',
    origen: 'Página web',
    canal: 'WhatsApp',
    horario: 'Indiferente',
    tratamiento: 'Ramón',
    indicaciones: 'Responde mejor por mensajería.',
    observacionesTrato: '—',
    satisfaccion: 'Sin valorar',
    fechaSatisfaccion: '—',
    historialSatisfaccion: [],
    haRecomendado: [],
    incidencias: [],
    banco: { ...baseBanco },
    documentacion: { identificacion: 'Pendiente', rgpd: 'Pendiente', poderes: 'Inexistentes' },
    identificacion: [],
    proteccionDatos: [
      {
        tipo: 'Cláusula informativa',
        firma: '—',
        estado: 'Pendiente',
        archivo: '—',
      },
    ],
    poderes: [],
    otrosDocumentos: [],
    notas: [
      {
        id: 'N-1',
        titulo: 'Primer contacto web',
        contenido:
          'Solicita presupuesto para la disolución de un proindiviso entre cuatro hermanos.',
        autor: 'M. Sanchís',
        fecha: '15/06/2026 12:20',
        destacada: false,
        archivada: false,
      },
    ],
    creado: '15/06/2026',
    creadoPor: 'M. Sanchís',
    modificado: '18/06/2026',
    modificadoPor: 'M. Sanchís',
  },
  {
    id: 'CT-0004',
    tipoPersona: 'Persona física',
    nombre: 'Beatriz',
    apellidos: 'Cañete Ordóñez',
    nif: '29887410T',
    profesion: 'Abogada',
    categorias: ['contrario'],
    estado: 'Activo',
    telefono: '954 210 776',
    email: 'bcanete@canetelegal.es',
    direccion: 'Plaza Nueva 7',
    cp: '41001',
    municipio: 'Sevilla',
    provincia: 'Sevilla',
    pais: 'España',
    idioma: 'Castellano',
    observaciones: 'Letrada de la parte contraria en dos procedimientos de división de herencia.',
    origen: 'Contacto directo',
    canal: 'Correo electrónico',
    horario: 'Horario de oficina',
    tratamiento: 'Letrada Cañete',
    indicaciones: 'Toda comunicación por escrito y con acuse.',
    observacionesTrato: '—',
    satisfaccion: 'Sin valorar',
    fechaSatisfaccion: '—',
    historialSatisfaccion: [],
    haRecomendado: [],
    incidencias: [],
    banco: { ...baseBanco },
    documentacion: { identificacion: 'Pendiente', rgpd: 'Pendiente', poderes: 'Inexistentes' },
    identificacion: [],
    proteccionDatos: [],
    poderes: [],
    otrosDocumentos: [],
    notas: [],
    creado: '03/03/2026',
    creadoPor: 'A. Torregrosa',
    modificado: '12/05/2026',
    modificadoPor: 'A. Torregrosa',
  },
  {
    id: 'CT-0005',
    tipoPersona: 'Persona física',
    nombre: 'Alfonso',
    apellidos: 'Rueda Barcina',
    nif: '07234881M',
    profesion: 'Procurador de los Tribunales',
    categorias: ['procurador', 'colaborador'],
    estado: 'Activo',
    telefono: '913 774 900',
    email: 'arueda@procuradoresmadrid.es',
    direccion: 'Calle Bailén 12',
    cp: '28013',
    municipio: 'Madrid',
    provincia: 'Madrid',
    pais: 'España',
    idioma: 'Castellano',
    observaciones: 'Procurador habitual en los juzgados de Madrid capital.',
    origen: 'Colaborador',
    canal: 'Teléfono',
    horario: 'Mañanas',
    tratamiento: 'Alfonso',
    indicaciones: 'Avisar con 48 h de antelación para apud acta.',
    observacionesTrato: 'Muy ágil con las notificaciones de LexNET.',
    satisfaccion: 'Alto',
    fechaSatisfaccion: '20/03/2026',
    historialSatisfaccion: [
      {
        fecha: '20/03/2026',
        nivel: 'Alto',
        observacion: 'Colaboración fluida.',
        autor: 'A. Torregrosa',
      },
    ],
    haRecomendado: [
      {
        contactoId: 'CT-0008',
        nombre: 'Peritaciones Delta, S.L.',
        fecha: '11/04/2026',
        resultado: 'Colaboración iniciada',
        observaciones: 'Perito tasador de inmuebles.',
      },
    ],
    incidencias: [],
    banco: {
      titular: 'Alfonso Rueda Barcina',
      nif: '07234881M',
      iban: 'ES44 0182 2370 4402 0155 1122',
      entidad: 'BBVA',
      bic: 'BBVAESMMXXX',
      sepa: false,
      estadoMandato: 'No aplicable',
      observaciones: 'Provisiones por transferencia.',
    },
    documentacion: { identificacion: 'Completa', rgpd: 'Firmada', poderes: 'Vigentes' },
    identificacion: [
      {
        tipo: 'DNI',
        numero: '07234881M',
        expedicion: '10/10/2019',
        caducidad: '10/10/2029',
        estado: 'Vigente',
        archivo: 'DNI_ARueda.pdf',
      },
    ],
    proteccionDatos: [
      {
        tipo: 'Consentimiento firmado',
        firma: '08/01/2024',
        estado: 'Firmado',
        archivo: 'RGPD_ARueda.pdf',
      },
    ],
    poderes: [
      {
        tipo: 'Apud acta',
        otorgante: 'Elena Vargas Miralles',
        apoderados: 'Alfonso Rueda Barcina',
        organismo: 'Juzgado de Primera Instancia n.º 12 de Madrid',
        protocolo: 'AA-441/2026',
        otorgamiento: '18/02/2026',
        caducidad: '18/02/2027',
        ambito: 'Representación procesal',
        estado: 'Vigente',
        archivo: 'Apud_acta_441.pdf',
      },
    ],
    otrosDocumentos: [],
    notas: [],
    creado: '08/01/2024',
    creadoPor: 'A. Torregrosa',
    modificado: '18/02/2026',
    modificadoPor: 'M. Sanchís',
  },
  {
    id: 'CT-0006',
    tipoPersona: 'Persona jurídica',
    nombre: 'Notaría Ruiz de Alda',
    razonSocial: 'Notaría Ruiz de Alda e Hijos',
    nif: 'B28994120',
    categorias: ['notaria', 'colaborador'],
    estado: 'Activo',
    telefono: '915 310 042',
    email: 'despacho@notariaruizdealda.es',
    direccion: 'Calle Velázquez 90',
    cp: '28006',
    municipio: 'Madrid',
    provincia: 'Madrid',
    pais: 'España',
    idioma: 'Castellano',
    personaContacto: 'Carmen Ruiz de Alda',
    cargoContacto: 'Notaria titular',
    observaciones: 'Notaría de referencia para escrituras de herencia y poderes.',
    origen: 'Recomendación profesional',
    canal: 'Correo electrónico',
    horario: '9:00 a 14:00',
    tratamiento: 'Sra. Notaria',
    indicaciones: 'Enviar minutas con 5 días de antelación.',
    observacionesTrato: '—',
    satisfaccion: 'Muy alto',
    fechaSatisfaccion: '12/02/2026',
    historialSatisfaccion: [
      {
        fecha: '12/02/2026',
        nivel: 'Muy alto',
        observacion: 'Gran disponibilidad de agenda.',
        autor: 'A. Torregrosa',
      },
    ],
    haRecomendado: [
      {
        contactoId: 'CT-0001',
        nombre: 'Elena Vargas Miralles',
        fecha: '09/11/2025',
        resultado: 'Convertido en cliente',
        observaciones: '—',
      },
    ],
    incidencias: [],
    banco: { ...baseBanco },
    documentacion: { identificacion: 'Completa', rgpd: 'Firmada', poderes: 'Inexistentes' },
    identificacion: [
      {
        tipo: 'Tarjeta CIF',
        numero: 'B28994120',
        expedicion: '03/03/2015',
        estado: 'Vigente',
        archivo: 'CIF_Notaria.pdf',
      },
    ],
    proteccionDatos: [
      {
        tipo: 'Cláusula informativa',
        firma: '03/03/2023',
        estado: 'Firmado',
        archivo: 'RGPD_Notaria.pdf',
      },
    ],
    poderes: [],
    otrosDocumentos: [
      {
        nombre: 'Tarifas notariales 2026',
        categoria: 'Colaboración',
        fecha: '10/01/2026',
        etiquetas: ['tarifas'],
        archivo: 'Tarifas_2026.pdf',
      },
    ],
    notas: [],
    creado: '03/03/2023',
    creadoPor: 'A. Torregrosa',
    modificado: '10/01/2026',
    modificadoPor: 'L. Ferrer',
  },
  {
    id: 'CT-0007',
    tipoPersona: 'Persona jurídica',
    nombre: 'Gestión Fincas Levante',
    razonSocial: 'Gestión de Fincas Levante, S.L.U.',
    nif: 'B96110455',
    categorias: ['fincas', 'proveedor'],
    estado: 'Activo',
    telefono: '963 880 415',
    email: 'info@fincaslevante.es',
    direccion: 'Gran Vía Marqués del Turia 30',
    cp: '46005',
    municipio: 'Valencia',
    provincia: 'Valencia',
    pais: 'España',
    idioma: 'Castellano',
    personaContacto: 'Silvia Ballester',
    cargoContacto: 'Administradora de fincas',
    observaciones: 'Administra tres comunidades donde el despacho tiene asuntos abiertos.',
    origen: 'Colaborador',
    canal: 'Correo electrónico',
    horario: 'Mañanas',
    tratamiento: 'Silvia',
    indicaciones: '—',
    observacionesTrato: '—',
    satisfaccion: 'Medio',
    fechaSatisfaccion: '05/04/2026',
    historialSatisfaccion: [
      {
        fecha: '05/04/2026',
        nivel: 'Medio',
        observacion: 'Retrasos puntuales en la remisión de actas.',
        autor: 'L. Ferrer',
      },
    ],
    haRecomendado: [],
    incidencias: [
      {
        fecha: '22/06/2026',
        tipo: 'Retraso en la tramitación',
        descripcion: 'No se remitieron las actas de la junta en el plazo acordado.',
        estado: 'Abierta',
        solucion: '—',
        observaciones: 'Reclamado por correo el 25/06.',
      },
    ],
    banco: {
      titular: 'Gestión de Fincas Levante, S.L.U.',
      nif: 'B96110455',
      iban: 'ES12 3058 0011 2027 2000 1414',
      entidad: 'Cajamar',
      bic: 'CCRIES2AXXX',
      sepa: true,
      fechaSepa: '18/09/2024',
      estadoMandato: 'Vigente',
      observaciones: '—',
    },
    documentacion: { identificacion: 'Completa', rgpd: 'Pendiente', poderes: 'Inexistentes' },
    identificacion: [
      {
        tipo: 'Escritura de constitución',
        numero: '3.011/2014',
        expedicion: '27/10/2014',
        estado: 'Vigente',
        archivo: 'Escritura_Levante.pdf',
      },
    ],
    proteccionDatos: [
      { tipo: 'Consentimiento firmado', firma: '—', estado: 'Pendiente', archivo: '—' },
    ],
    poderes: [],
    otrosDocumentos: [],
    notas: [
      {
        id: 'N-1',
        titulo: 'Incidencia con actas',
        contenido: 'Se les ha requerido formalmente la remisión de las actas pendientes.',
        autor: 'L. Ferrer',
        fecha: '25/06/2026 08:55',
        destacada: true,
        archivada: false,
      },
    ],
    creado: '18/09/2024',
    creadoPor: 'L. Ferrer',
    modificado: '25/06/2026',
    modificadoPor: 'L. Ferrer',
  },
  {
    id: 'CT-0008',
    tipoPersona: 'Persona jurídica',
    nombre: 'Peritaciones Delta',
    razonSocial: 'Peritaciones Delta, S.L.',
    nif: 'B85002377',
    categorias: ['perito', 'proveedor'],
    estado: 'Activo',
    telefono: '911 020 337',
    email: 'peritos@delta-tasaciones.es',
    direccion: 'Calle Orense 34',
    cp: '28020',
    municipio: 'Madrid',
    provincia: 'Madrid',
    pais: 'España',
    idioma: 'Castellano',
    personaContacto: 'Íñigo Salas',
    cargoContacto: 'Perito tasador',
    observaciones: 'Tasaciones inmobiliarias y periciales judiciales.',
    origen: 'Recomendación profesional',
    canal: 'Teléfono',
    horario: 'Tardes',
    tratamiento: 'Íñigo',
    indicaciones: '—',
    observacionesTrato: '—',
    satisfaccion: 'Alto',
    fechaSatisfaccion: '28/05/2026',
    historialSatisfaccion: [
      {
        fecha: '28/05/2026',
        nivel: 'Alto',
        observacion: 'Informe entregado en plazo.',
        autor: 'M. Sanchís',
      },
    ],
    recomendadoPor: {
      contactoId: 'CT-0005',
      nombre: 'Alfonso Rueda Barcina',
      fecha: '11/04/2026',
      resultado: 'Colaboración iniciada',
      observaciones: '—',
    },
    haRecomendado: [],
    incidencias: [],
    banco: {
      ...baseBanco,
      titular: 'Peritaciones Delta, S.L.',
      nif: 'B85002377',
      iban: 'ES75 2085 8888 7703 3012 9911',
      entidad: 'Ibercaja',
      bic: 'CAZRES2ZXXX',
      estadoMandato: 'Sin mandato',
    },
    documentacion: { identificacion: 'Completa', rgpd: 'Firmada', poderes: 'Inexistentes' },
    identificacion: [
      {
        tipo: 'Tarjeta CIF',
        numero: 'B85002377',
        expedicion: '12/05/2018',
        estado: 'Vigente',
        archivo: 'CIF_Delta.pdf',
      },
    ],
    proteccionDatos: [
      {
        tipo: 'Consentimiento firmado',
        firma: '11/04/2026',
        estado: 'Firmado',
        archivo: 'RGPD_Delta.pdf',
      },
    ],
    poderes: [],
    otrosDocumentos: [],
    notas: [],
    creado: '11/04/2026',
    creadoPor: 'M. Sanchís',
    modificado: '28/05/2026',
    modificadoPor: 'M. Sanchís',
  },
  {
    id: 'CT-0009',
    tipoPersona: 'Persona jurídica',
    nombre: 'Dirección General de Tributos',
    razonSocial: 'Dirección General de Tributos — Comunidad de Madrid',
    nif: 'S2811001C',
    categorias: ['organismo'],
    estado: 'Activo',
    telefono: '915 809 000',
    email: 'registro@tributos.madrid.org',
    direccion: 'Paseo del General Martínez Campos 30',
    cp: '28010',
    municipio: 'Madrid',
    provincia: 'Madrid',
    pais: 'España',
    idioma: 'Castellano',
    personaContacto: 'Registro general',
    cargoContacto: '—',
    observaciones: 'Presentación de autoliquidaciones de ISD e ITP.',
    origen: 'Otro',
    canal: 'Presencial',
    horario: '9:00 a 14:00',
    tratamiento: '—',
    indicaciones: 'Presentación telemática preferente.',
    observacionesTrato: '—',
    satisfaccion: 'Sin valorar',
    fechaSatisfaccion: '—',
    historialSatisfaccion: [],
    haRecomendado: [],
    incidencias: [],
    banco: { ...baseBanco },
    documentacion: { identificacion: 'Pendiente', rgpd: 'Pendiente', poderes: 'Inexistentes' },
    identificacion: [],
    proteccionDatos: [],
    poderes: [],
    otrosDocumentos: [],
    notas: [],
    creado: '14/01/2025',
    creadoPor: 'L. Ferrer',
    modificado: '14/01/2025',
    modificadoPor: 'L. Ferrer',
  },
  {
    id: 'CT-0010',
    tipoPersona: 'Persona física',
    nombre: 'Marta',
    apellidos: 'Solé Ribas',
    nif: '38774120P',
    nacimiento: '23/07/1988',
    profesion: 'Asesora fiscal',
    categorias: ['colaborador'],
    estado: 'Activo',
    telefono: '677 340 210',
    email: 'msole@fiscalsole.cat',
    direccion: 'Rambla Catalunya 60, 3.º 1.ª',
    cp: '08007',
    municipio: 'Barcelona',
    provincia: 'Barcelona',
    pais: 'España',
    idioma: 'Catalán',
    observaciones: 'Colaboradora externa para fiscalidad patrimonial.',
    origen: 'Recomendación profesional',
    canal: 'Videollamada',
    horario: 'Tardes',
    tratamiento: 'Marta',
    indicaciones: '—',
    observacionesTrato: '—',
    satisfaccion: 'Muy alto',
    fechaSatisfaccion: '02/06/2026',
    historialSatisfaccion: [
      {
        fecha: '02/06/2026',
        nivel: 'Muy alto',
        observacion: 'Excelente informe de plusvalías.',
        autor: 'A. Torregrosa',
      },
    ],
    haRecomendado: [],
    incidencias: [],
    banco: {
      ...baseBanco,
      titular: 'Marta Solé Ribas',
      nif: '38774120P',
      iban: 'ES40 0081 0301 2200 0111 8877',
      entidad: 'Banc Sabadell',
      bic: 'BSABESBBXXX',
      estadoMandato: 'Sin mandato',
    },
    documentacion: { identificacion: 'Completa', rgpd: 'Firmada', poderes: 'Inexistentes' },
    identificacion: [
      {
        tipo: 'DNI',
        numero: '38774120P',
        expedicion: '14/08/2016',
        caducidad: '14/08/2026',
        estado: 'Próximo a caducar',
        archivo: 'DNI_MSole.pdf',
      },
    ],
    proteccionDatos: [
      {
        tipo: 'Consentimiento firmado',
        firma: '20/05/2023',
        estado: 'Firmado',
        archivo: 'RGPD_MSole.pdf',
      },
    ],
    poderes: [],
    otrosDocumentos: [],
    notas: [],
    creado: '20/05/2023',
    creadoPor: 'A. Torregrosa',
    modificado: '02/06/2026',
    modificadoPor: 'A. Torregrosa',
  },
  {
    id: 'CT-0011',
    tipoPersona: 'Persona física',
    nombre: 'Jorge',
    apellidos: 'Landa Etxeberria',
    nif: '16220487D',
    nacimiento: '30/01/1957',
    profesion: 'Jubilado',
    categorias: ['cliente'],
    estado: 'Inactivo',
    telefono: '944 220 118',
    email: 'jlanda@correo.eus',
    direccion: 'Calle Ercilla 15',
    cp: '48009',
    municipio: 'Bilbao',
    provincia: 'Vizcaya',
    pais: 'España',
    idioma: 'Castellano',
    observaciones: 'Asunto de herencia finalizado en 2025. Sin actuaciones en curso.',
    origen: 'Cliente anterior',
    canal: 'Teléfono',
    horario: 'Mañanas',
    tratamiento: 'Sr. Landa',
    indicaciones: '—',
    observacionesTrato: '—',
    satisfaccion: 'Bajo',
    fechaSatisfaccion: '15/12/2025',
    historialSatisfaccion: [
      {
        fecha: '15/12/2025',
        nivel: 'Bajo',
        observacion: 'Disconforme con la duración del procedimiento.',
        autor: 'A. Torregrosa',
      },
      { fecha: '10/06/2025', nivel: 'Medio', observacion: '—', autor: 'M. Sanchís' },
    ],
    haRecomendado: [],
    incidencias: [
      {
        fecha: '10/12/2025',
        tipo: 'Honorarios',
        descripcion: 'Discrepancia sobre la última minuta emitida.',
        estado: 'Resuelta',
        solucion: 'Se aplicó un ajuste del 10 % sobre la minuta final.',
        observaciones: 'Cerrada de común acuerdo.',
      },
    ],
    banco: {
      ...baseBanco,
      titular: 'Jorge Landa Etxeberria',
      nif: '16220487D',
      iban: 'ES29 2095 0100 8091 2233 4455',
      entidad: 'Kutxabank',
      bic: 'BASKES2BXXX',
      estadoMandato: 'Cancelado',
    },
    documentacion: { identificacion: 'Caducada', rgpd: 'Revocada', poderes: 'Inexistentes' },
    identificacion: [
      {
        tipo: 'DNI',
        numero: '16220487D',
        expedicion: '02/02/2015',
        caducidad: '02/02/2025',
        estado: 'Caducado',
        archivo: 'DNI_JLanda.pdf',
      },
    ],
    proteccionDatos: [
      {
        tipo: 'Revocación del consentimiento',
        firma: '20/12/2025',
        estado: 'Revocado',
        archivo: 'RGPD_revocacion.pdf',
      },
    ],
    poderes: [],
    otrosDocumentos: [],
    notas: [],
    creado: '04/02/2023',
    creadoPor: 'M. Sanchís',
    modificado: '20/12/2025',
    modificadoPor: 'A. Torregrosa',
  },
  {
    id: 'CT-0012',
    tipoPersona: 'Persona jurídica',
    nombre: 'Suministros Jurídicos Cebra',
    razonSocial: 'Suministros Jurídicos Cebra, S.L.',
    nif: 'B84003991',
    categorias: ['proveedor'],
    estado: 'Archivado',
    telefono: '910 445 220',
    email: 'pedidos@cebrasum.es',
    direccion: 'Polígono Las Mercedes, nave 8',
    cp: '28022',
    municipio: 'Madrid',
    provincia: 'Madrid',
    pais: 'España',
    idioma: 'Castellano',
    personaContacto: 'Dpto. comercial',
    cargoContacto: '—',
    observaciones: 'Proveedor de material de oficina. Relación finalizada en 2025.',
    origen: 'Publicidad',
    canal: 'Correo electrónico',
    horario: '—',
    tratamiento: '—',
    indicaciones: '—',
    observacionesTrato: '—',
    satisfaccion: 'Muy bajo',
    fechaSatisfaccion: '30/09/2025',
    historialSatisfaccion: [
      {
        fecha: '30/09/2025',
        nivel: 'Muy bajo',
        observacion: 'Incumplimiento reiterado de plazos.',
        autor: 'L. Ferrer',
      },
    ],
    haRecomendado: [],
    incidencias: [
      {
        fecha: '12/09/2025',
        tipo: 'Otro',
        descripcion: 'Entregas incompletas durante tres meses.',
        estado: 'Cerrada',
        solucion: 'Rescisión del acuerdo de suministro.',
        observaciones: '—',
      },
    ],
    banco: { ...baseBanco },
    documentacion: { identificacion: 'Pendiente', rgpd: 'Pendiente', poderes: 'Inexistentes' },
    identificacion: [],
    proteccionDatos: [],
    poderes: [],
    otrosDocumentos: [],
    notas: [],
    creado: '11/01/2022',
    creadoPor: 'L. Ferrer',
    modificado: '30/09/2025',
    modificadoPor: 'L. Ferrer',
  },
]

export const CONTACTOS: Contacto[] = CONTACTOS_BASE.map(migrarContacto)

export function contactoPorId(id: string) {
  return CONTACTOS.find((c) => c.id === id)
}
