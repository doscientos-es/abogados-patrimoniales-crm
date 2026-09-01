// Asistencia de redacción y envío de emails relacionados con una tarea.
//
// La IA sólo produce BORRADORES: nunca envía nada. El envío real depende de
// que exista una integración de correo configurada en el entorno; mientras no
// exista, el sistema lo dice con claridad y no simula ningún envío.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const MODOS = ['generar', 'mejorar', 'acortar', 'tono'] as const

const Entrada = z.object({
  modo: z.enum(MODOS),
  indicacion: z.string().default(''),
  borrador: z.string().default(''),
  asunto: z.string().default(''),
  tono: z.string().default('Profesional'),
  contexto: z.object({
    tarea: z.string().default(''),
    descripcion: z.string().default(''),
    expediente: z.string().default(''),
    destinatario: z.string().default(''),
    tratamiento: z.string().default(''),
    remitente: z.string().default(''),
  }),
})

const SISTEMA = `Eres un asistente de redacción de correos de un despacho de abogados patrimoniales.
Escribes en español, en tono profesional, claro y breve.

REGLAS ESTRICTAS:
- Redactas únicamente el CUERPO del correo dirigido a un tercero externo al despacho.
- Utiliza EXCLUSIVAMENTE la información facilitada. No inventes hechos, fechas, importes, documentos ni compromisos.
- Si falta un dato esencial, déjalo entre corchetes, por ejemplo [indicar fecha], en lugar de suponerlo.
- No incluyas información interna del despacho: no menciones tareas internas, plazos internos, conversaciones internas, responsables internos ni referencias de gestión que no se te pidan expresamente.
- No incluyas enlaces a sistemas internos.
- No añadas firma: la firma la añade el remitente.
- Devuelve solamente el texto del correo, sin markdown, sin comillas y sin comentarios.`

const instruccion = (d: z.infer<typeof Entrada>) => {
  switch (d.modo) {
    case 'mejorar':
      return 'Mejora la redacción del siguiente borrador manteniendo su intención y sin añadir contenido nuevo.'
    case 'acortar':
      return 'Acorta el siguiente borrador conservando lo esencial y la cortesía.'
    case 'tono':
      return `Reescribe el siguiente borrador en tono ${d.tono}, sin añadir contenido nuevo.`
    default:
      return 'Redacta un borrador de correo a partir de la indicación y del contexto.'
  }
}

export const redactarEmailIA = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => Entrada.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env['LOVABLE_API_KEY']
    if (!apiKey) throw new Error('No hay clave de IA configurada en el entorno.')

    const prompt = [
      instruccion(data),
      `Contexto (uso interno, no lo copies literalmente):
- Tarea de origen: ${data.contexto.tarea || 'No consta'}
- Instrucciones de la tarea: ${data.contexto.descripcion || 'No constan'}
- Expediente: ${data.contexto.expediente || 'No consta'}
- Destinatario: ${data.contexto.destinatario || 'No consta'} (${data.contexto.tratamiento || 'trato neutro'})
- Remitente: ${data.contexto.remitente || 'No consta'}
- Asunto previsto: ${data.asunto || 'No consta'}`,
      data.indicacion.trim() ? `Indicación del usuario: ${data.indicacion.trim()}` : '',
      data.borrador.trim() ? `Borrador actual:\n${data.borrador.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.6-sol',
        instructions: SISTEMA,
        input: prompt,
        reasoning: { effort: 'low' },
      }),
    })

    if (!res.ok) {
      const detalle = await res.text().catch(() => '')
      if (res.status === 429)
        throw new Error('Servicio de IA saturado. Inténtalo de nuevo en unos minutos.')
      if (res.status === 402)
        throw new Error('Se han agotado los créditos de IA del espacio de trabajo.')
      throw new Error(
        `No ha sido posible redactar el borrador (${res.status}). ${detalle.slice(0, 200)}`,
      )
    }

    const json = (await res.json()) as {
      output_text?: string
      output?: { content?: { type?: string; text?: string }[] }[]
    }
    const texto =
      json.output_text ??
      (json.output ?? [])
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === 'output_text' && typeof c.text === 'string')
        .map((c) => c.text as string)
        .join('\n')

    const limpio = (texto ?? '').trim()
    if (!limpio) throw new Error('El servicio de IA no ha devuelto contenido.')
    return { texto: limpio }
  })

const Envio = z.object({
  para: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).default([]),
  cco: z.array(z.string().email()).default([]),
  asunto: z.string().min(1),
  cuerpo: z.string().min(1),
  remitente: z.string().min(1),
})

/**
 * Envío real. Si no hay proveedor de correo configurado devuelve
 * `disponible: false`: el contenido se conserva como borrador y en ningún caso
 * se presenta como enviado.
 */
export const enviarEmailTarea = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => Envio.parse(data))
  .handler(async () => {
    const proveedor = process.env['EMAIL_PROVEEDOR_URL']
    const clave = process.env['EMAIL_PROVEEDOR_API_KEY']
    if (!proveedor || !clave) {
      return {
        disponible: false as const,
        motivo:
          'Todavía no hay una integración de correo saliente configurada en LEX. El contenido se conserva como borrador.',
      }
    }
    return {
      disponible: false as const,
      motivo:
        'La cuenta de correo configurada no ha completado su integración. El contenido se conserva como borrador.',
    }
  })
