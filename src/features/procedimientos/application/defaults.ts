import type { EditableProcedure, ProcedureSection } from './types'

type ProcedureTemplate = Pick<EditableProcedure, 'slug' | 'title' | 'phase' | 'description'> & {
  sections: ProcedureSection[]
}

function sections(
  objective: string,
  roles: string,
  steps: Array<[string, string]>,
  templates: string,
  quality: string,
  metrics: string,
): ProcedureSection[] {
  return [
    { type: 'objective', title: 'Objetivo del procedimiento', content: objective },
    { type: 'responsibilities', title: 'Responsables e intervinientes', content: roles },
    ...steps.map(([title, description], index) => ({
      type: 'step' as const,
      id: `paso-${index + 1}`,
      title,
      description,
      required: true,
    })),
    { type: 'templates', title: 'Plantillas y documentos asociados', content: templates },
    { type: 'quality', title: 'Controles de calidad', content: quality },
    { type: 'metrics', title: 'Indicadores y registro', content: metrics },
  ]
}

export const DEFAULT_PROCEDURES: ProcedureTemplate[] = [
  {
    slug: 'primera-cita',
    title: 'Primera cita',
    phase: 'Lead',
    description: 'Guion, checklist y registro de la primera reunión con el potencial cliente.',
    sections: sections(
      'Preparar y registrar la primera conversación con el potencial cliente.',
      'Responsable del Lead y asistentes a la reunión.',
      [
        ['Preparar la reunión', 'Revisar origen, necesidad indicada e información disponible.'],
        ['Celebrar y registrar la reunión', 'Anotar asistentes, necesidades, alcance y acuerdos.'],
        ['Asignar siguiente acción', 'Definir responsable, fecha y acción de seguimiento.'],
      ],
      'Añade la ficha o guion aprobado por el despacho.',
      'Confirmar que acuerdos y responsables quedan registrados.',
      'Fecha, participantes y siguiente acción.',
    ),
  },
  {
    slug: 'acta-de-encargo',
    title: 'Acta de encargo',
    phase: 'Onboarding',
    description: 'Elaboración, revisión y firma del acta de encargo profesional.',
    sections: sections(
      'Preparar y formalizar el encargo profesional aceptado.',
      'Responsable del asunto y personas autorizadas para revisar el encargo.',
      [
        [
          'Confirmar alcance y honorarios',
          'Contrastar alcance y honorarios con la aceptación registrada.',
        ],
        ['Preparar el acta', 'Completar datos del cliente, asunto y alcance acordado.'],
        ['Obtener y archivar la firma', 'Guardar la versión firmada y vincularla al expediente.'],
      ],
      'Añade la plantilla vigente del acta aprobada por el despacho.',
      'Verificar versión, partes y correspondencia con la aceptación.',
      'Fecha de preparación, envío y firma.',
    ),
  },
  {
    slug: 'designacion-del-trabajo',
    title: 'Designación del trabajo',
    phase: 'Case Work',
    description: 'Asignación de responsable, equipo y reparto de tareas del expediente.',
    sections: sections(
      'Dejar claro el equipo responsable y el reparto inicial del trabajo.',
      'Responsable principal y profesionales colaboradores en el asunto.',
      [
        ['Designar responsable principal', 'Confirmar quién coordina el expediente.'],
        ['Asignar equipo y tareas', 'Registrar participantes y distribuir acciones iniciales.'],
        ['Comunicar la designación', 'Alinear al equipo sobre estado y próximos hitos.'],
      ],
      'Añade criterios y plantillas internas del despacho.',
      'Comprobar responsables y fechas en las tareas que lo requieran.',
      'Responsable, equipo y fecha de designación.',
    ),
  },
  {
    slug: 'reunion-de-traspaso',
    title: 'Reunión de traspaso',
    phase: 'Case Work',
    description: 'Traspaso del asunto del captador al equipo ejecutor.',
    sections: sections(
      'Transferir el contexto del asunto sin perder acuerdos ni compromisos.',
      'Persona que entrega el asunto, responsable del expediente y equipo entrante.',
      [
        [
          'Preparar información del asunto',
          'Revisar encargo, documentos, comunicaciones y fechas conocidas.',
        ],
        ['Celebrar la reunión', 'Confirmar estrategia, riesgos, pendientes y próximos hitos.'],
        [
          'Registrar acuerdos y tareas',
          'Asignar responsables y fechas para las siguientes acciones.',
        ],
      ],
      'Añade la agenda o acta aprobada por el despacho.',
      'Verificar recepción del contexto y tareas asignadas.',
      'Participantes, fecha y acciones resultantes.',
    ),
  },
  {
    slug: 'acta-de-cierre',
    title: 'Acta de cierre',
    phase: 'Offboarding',
    description: 'Documento de entrega, conformidad y cierre formal del encargo.',
    sections: sections(
      'Cerrar ordenadamente la prestación y registrar la entrega final.',
      'Responsable del asunto y persona cliente o autorizada.',
      [
        [
          'Revisar pendientes y estado',
          'Identificar actuaciones pendientes, plazos y entregables finales.',
        ],
        ['Entregar documentación final', 'Registrar documentación entregada y canal acordado.'],
        ['Registrar el cierre', 'Documentar la fecha y confirmación de la entrega.'],
      ],
      'Añade el acta aprobada por el despacho.',
      'Confirmar la entrega y documentar elementos pendientes.',
      'Fecha, entregables y confirmación.',
    ),
  },
  {
    slug: 'adenda-del-encargo',
    title: 'Adenda del encargo',
    phase: 'Offboarding',
    description: 'Ampliaciones de alcance y honorarios sobre el encargo original.',
    sections: sections(
      'Documentar las modificaciones del encargo acordadas por las partes.',
      'Responsable del asunto y personas que revisan o firman la adenda.',
      [
        [
          'Describir el cambio acordado',
          'Registrar motivo, alcance y efecto sobre honorarios o calendario.',
        ],
        [
          'Preparar y revisar la adenda',
          'Preparar el documento para revisión según el proceso interno.',
        ],
        ['Formalizar y archivar', 'Registrar aceptación y guardar la versión en el expediente.'],
      ],
      'Añade la plantilla aprobada por el despacho.',
      'Comprobar la relación con el encargo vigente.',
      'Fecha, versión y alcance modificado.',
    ),
  },
  {
    slug: 'archivo',
    title: 'Archivo',
    phase: 'Offboarding',
    description: 'Criterios de archivo, conservación y custodia del expediente.',
    sections: sections(
      'Preparar el cierre operativo y documentar la custodia del expediente.',
      'Responsable del expediente y persona autorizada para validar el archivo.',
      [
        [
          'Verificar el cierre operativo',
          'Comprobar que actuaciones y tareas están cerradas o documentadas.',
        ],
        [
          'Ordenar documentos y comunicaciones',
          'Confirmar que los documentos finales están vinculados.',
        ],
        ['Registrar archivo y custodia', 'Anotar fecha y ubicación lógica de custodia.'],
      ],
      'Añade la lista de control vigente del despacho.',
      'Comprobar integridad y permisos conforme a la política interna.',
      'Fecha y responsable del archivo.',
    ),
  },
  {
    slug: 'informacion-periodica-ejecuciones',
    title: 'Información periódica en ejecuciones',
    phase: 'Aftercare',
    description: 'Cadencia y contenido de los informes al cliente durante la ejecución.',
    sections: sections(
      'Mantener un registro claro de actualizaciones sobre la ejecución.',
      'Profesional responsable de la ejecución y destinatarios acordados.',
      [
        ['Revisar movimientos', 'Revisar hitos y comunicaciones desde la última actualización.'],
        ['Preparar actualización', 'Resumir estado, cambios y siguientes pasos previstos.'],
        ['Registrar envío', 'Anotar destinatario, fecha y canal utilizado.'],
      ],
      'Añade el modelo de actualización aprobado por el despacho.',
      'Verificar que el contenido corresponde al expediente vigente.',
      'Cadencia, fecha de actualización y canal.',
    ),
  },
]
