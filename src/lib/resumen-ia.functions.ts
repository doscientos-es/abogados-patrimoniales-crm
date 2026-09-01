// Resumen IA del expediente.
//
// Funcionalidad limitada y sólo de lectura: sintetiza el contenido que el
// cliente le envía del expediente indicado. No modifica ningún dato, no crea
// actuaciones, tareas ni plazos y no consulta información externa.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Entrada = z.object({
  codigo: z.string().min(1),
  contexto: z.string().min(1),
  etiquetasFuente: z.array(z.string()).default([]),
});

const SISTEMA = `Eres un asistente documental de un despacho de abogados patrimoniales.
Redactas en español, en tono profesional, sobrio y operativo.

REGLAS ESTRICTAS:
- Utiliza EXCLUSIVAMENTE la información del expediente que se te entrega. No uses conocimiento externo ni supongas hechos.
- No inventes fechas, importes, documentos, personas, resoluciones ni actuaciones.
- Cuando falte información, escribe literalmente "No consta en el expediente".
- Distingue hechos de inferencias: usa "Según consta en…", "Parece desprenderse…" o "Debe verificarse…" cuando no sea un dato cierto.
- No des conclusiones jurídicas definitivas como si fueran hechos.
- No atribuyas a un documento contenidos que no se te hayan facilitado: de los documentos sólo conoces sus metadatos.
- Señala contradicciones o lagunas si las detectas.

TRAZABILIDAD: tras cada afirmación relevante añade una referencia entre corchetes copiada literalmente de las etiquetas de fuente disponibles, por ejemplo [Actuación · 03/08/2026 · Título] o [Documento · Sentencia.pdf]. No inventes referencias.

FORMATO DE SALIDA (texto plano, sin markdown, con estas seis cabeceras exactas y en este orden):
OBJETO:
SITUACIÓN ACTUAL:
ACTUACIONES RELEVANTES:
PENDIENTE:
PLAZOS E HITOS:
ADVERTENCIAS:

En las cuatro últimas secciones usa viñetas que empiecen por "- ". Sé breve: máximo unas 220 palabras en total.
Si la información recibida es insuficiente para un resumen fiable, responde únicamente con: SIN_INFORMACION_SUFICIENTE`;

export const generarResumenIA = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Entrada.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("No hay clave de IA configurada en el entorno.");

    const prompt = [
      `Expediente ${data.codigo}. Genera el resumen conforme a las reglas.`,
      data.etiquetasFuente.length
        ? `Etiquetas de fuente disponibles para citar:\n${data.etiquetasFuente.map((f) => `[${f}]`).join("\n")}`
        : "No hay etiquetas de fuente disponibles: no cites referencias.",
      "CONTENIDO DEL EXPEDIENTE:",
      data.contexto,
    ].join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        instructions: SISTEMA,
        input: prompt,
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });

    if (!res.ok || !res.body) {
      const detalle = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Servicio de IA saturado. Inténtalo de nuevo en unos minutos.");
      if (res.status === 402) throw new Error("Se han agotado los créditos de IA del espacio de trabajo.");
      throw new Error(`No ha sido posible generar el resumen (${res.status}). ${detalle.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let texto = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lineas = buffer.split("\n");
      buffer = lineas.pop() ?? "";
      for (const linea of lineas) {
        if (!linea.startsWith("data:")) continue;
        const payload = linea.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evento = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (evento.type === "response.output_text.delta" && typeof evento.delta === "string") {
            texto += evento.delta;
          } else if (evento.type === "response.completed" && !texto && evento.response?.output_text) {
            texto = evento.response.output_text;
          }
        } catch {
          /* fragmento no JSON */
        }
      }
    }

    const limpio = texto.trim();
    if (!limpio) throw new Error("El servicio de IA no ha devuelto contenido.");
    if (limpio.includes("SIN_INFORMACION_SUFICIENTE")) {
      return { estado: "insuficiente" as const, texto: "" };
    }
    return { estado: "ok" as const, texto: limpio };
  });
