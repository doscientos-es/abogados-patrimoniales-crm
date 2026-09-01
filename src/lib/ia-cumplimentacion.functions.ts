// IA CUMPLIMENTACIÓN — lectura real de documentos.
//
// Lee PDF (con texto o escaneado) e imágenes mediante un modelo multimodal y
// devuelve datos ESTRUCTURADOS propuestos. No crea ni modifica nada: es una
// función de sólo lectura. Si no hay clave de IA configurada, se comunica con
// claridad y NO se simula ninguna lectura.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const Entrada = z.object({
  formulario: z.string().min(1),
  contexto: z.string().default(''),
  documento: z.object({
    nombre: z.string().min(1),
    mime: z.string().min(1),
    /** Contenido en base64 sin prefijo data:. */
    datos: z.string().min(1),
  }),
  campos: z.array(z.object({ id: z.string(), label: z.string(), ayuda: z.string().optional() })),
  camposYaCumplimentados: z.array(z.string()).default([]),
})

const SISTEMA = `Eres un extractor documental de un despacho de abogados patrimoniales español.
Tu única función es LEER el documento y EXTRAER datos literales para cumplimentar formularios.

PROHIBIDO: análisis jurídico, recomendaciones, estrategia, cálculo de plazos, conclusiones.

REGLAS:
- Extrae SÓLO lo que aparece literalmente en el documento. Nunca inventes ni deduzcas datos.
- Si un dato no consta o es ilegible, no lo incluyas (o márcalo con claridad "ilegible" si aparece pero no se lee).
- Copia siempre un fragmento literal breve del documento que justifique cada dato, y la página cuando puedas determinarla.
- Fechas en formato dd/mm/aaaa.
- Detecta TODAS las personas y entidades que intervengan (comparecientes, partes, representantes, abogados, procuradores, notarios, peritos, órganos judiciales).
- Para cada persona propone su NATURALEZA ("Persona física", "Persona jurídica", "Órgano judicial", "Público") y su ROL DOCUMENTAL (comprador, vendedor, heredero, apoderado, notario autorizante, demandante, demandado, letrado, procurador…).
- NUNCA propongas la relación con el despacho: eso lo decide el usuario.
- Formula preguntas breves SÓLO sobre datos que falten o resulten ambiguos.

Responde EXCLUSIVAMENTE con un objeto JSON válido, sin markdown, con esta forma:
{
  "tipoDocumental": "string",
  "campos": [{"campoId":"id del campo","valor":"...","pagina":1,"fragmento":"...","claridad":"clara|revisar|ilegible"}],
  "personas": [{"nombre":"...","naturaleza":"...","documento":"...","domicilio":"...","telefono":"...","email":"...","profesion":"...","esProfesional":false,"rolDocumental":"...","fragmento":"...","pagina":1}],
  "preguntas": [{"texto":"...","campoId":"","opciones":[]}]
}
Si el documento no es legible, devuelve listas vacías y un tipoDocumental "No se ha podido leer".`

export const extraerDocumentoIA = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => Entrada.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env['LOVABLE_API_KEY']
    if (!apiKey) {
      throw new Error(
        'Falta la configuración del servicio de lectura documental (clave de IA). La interfaz está lista, pero la extracción real no puede ejecutarse.',
      )
    }

    const listaCampos = data.campos
      .map((c) => `- ${c.id}: ${c.label}${c.ayuda ? ` (${c.ayuda})` : ''}`)
      .join('\n')

    const instruccion = [
      `Formulario destino: ${data.formulario}.`,
      data.contexto ? `Contexto: ${data.contexto}` : '',
      `Campos disponibles en LEX (usa exactamente estos identificadores en "campoId"):\n${listaCampos}`,
      data.camposYaCumplimentados.length
        ? `Campos ya cumplimentados por el usuario (no vuelvas a preguntar por ellos, pero sí puedes proponer el valor leído si difiere): ${data.camposYaCumplimentados.join(', ')}`
        : '',
      `Nombre del archivo: ${data.documento.nombre}`,
      'Lee el documento adjunto y devuelve el JSON solicitado.',
    ]
      .filter(Boolean)
      .join('\n\n')

    const esImagen = data.documento.mime.startsWith('image/')
    const bloqueArchivo = esImagen
      ? {
          type: 'image_url',
          image_url: { url: `data:${data.documento.mime};base64,${data.documento.datos}` },
        }
      : {
          type: 'file',
          file: {
            filename: data.documento.nombre,
            file_data: `data:${data.documento.mime};base64,${data.documento.datos}`,
          },
        }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.6-flash',
        messages: [
          { role: 'system', content: SISTEMA },
          { role: 'user', content: [{ type: 'text', text: instruccion }, bloqueArchivo] },
        ],
      }),
    })

    if (!res.ok) {
      const detalle = await res.text().catch(() => '')
      if (res.status === 429)
        throw new Error('Servicio de lectura saturado. Inténtalo de nuevo en unos minutos.')
      if (res.status === 402)
        throw new Error('Se han agotado los créditos de IA del espacio de trabajo.')
      throw new Error(
        `No ha sido posible leer el documento (${res.status}). ${detalle.slice(0, 300)}`,
      )
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const bruto = json.choices?.[0]?.message?.content ?? ''
    const limpio = bruto
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim()

    const inicio = limpio.indexOf('{')
    const fin = limpio.lastIndexOf('}')
    if (inicio < 0 || fin < 0) {
      throw new Error('El servicio de lectura no ha devuelto un resultado interpretable.')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(limpio.slice(inicio, fin + 1))
    } catch {
      throw new Error('El servicio de lectura no ha devuelto un resultado interpretable.')
    }

    const Salida = z.object({
      tipoDocumental: z.string().default('Documento'),
      campos: z
        .array(
          z.object({
            campoId: z.string(),
            valor: z.string(),
            pagina: z.number().optional(),
            fragmento: z.string().default(''),
            claridad: z.enum(['clara', 'revisar', 'ilegible']).default('revisar'),
          }),
        )
        .default([]),
      personas: z
        .array(
          z.object({
            nombre: z.string(),
            naturaleza: z.string().default('Persona física'),
            documento: z.string().default(''),
            domicilio: z.string().default(''),
            telefono: z.string().default(''),
            email: z.string().default(''),
            profesion: z.string().default(''),
            esProfesional: z.boolean().default(false),
            rolDocumental: z.string().default('Otros'),
            fragmento: z.string().default(''),
            pagina: z.number().optional(),
          }),
        )
        .default([]),
      preguntas: z
        .array(
          z.object({
            texto: z.string(),
            campoId: z.string().default(''),
            opciones: z.array(z.string()).default([]),
          }),
        )
        .default([]),
    })

    return Salida.parse(parsed)
  })
