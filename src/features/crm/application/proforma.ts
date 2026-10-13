/**
 * Proforma (provisión de fondos) generada desde el presupuesto aceptado.
 * Por defecto el 60 % del total; porcentaje e importe son editables.
 * Se guarda en detalles.proforma del Lead; no es una factura fiscal.
 */
export const PCT_PROFORMA_DEFECTO = 60

export type Proforma = {
  referencia: string
  presupuestoReferencia: string
  version: number | null
  pct: number
  /** Total del presupuesto aceptado, en céntimos. */
  totalPresupuestoCents: number
  baseCents: number
  ivaCents: number
  totalCents: number
  concepto: string
  fecha: string
  estado: 'borrador' | 'enviada'
  fechaEnvio: string | null
  creadaPor: string | null
}

/** Reparte un total en base + IVA con la misma proporción que el presupuesto. */
export function desglosar(totalCents: number, presBase: number, presTotal: number) {
  if (presTotal <= 0) return { baseCents: totalCents, ivaCents: 0, totalCents }
  const baseCents = Math.round((totalCents * presBase) / presTotal)
  return { baseCents, ivaCents: totalCents - baseCents, totalCents }
}

export function importePorPct(totalPresupuestoCents: number, pct: number) {
  return Math.round((totalPresupuestoCents * pct) / 100)
}

export function nuevaProforma(input: {
  presupuestoReferencia: string
  version: number | null
  presBaseCents: number
  presTotalCents: number
  hoy: string
  por: string | null
}): Proforma {
  const total = importePorPct(input.presTotalCents, PCT_PROFORMA_DEFECTO)
  return {
    referencia: `PF-${input.presupuestoReferencia}`,
    presupuestoReferencia: input.presupuestoReferencia,
    version: input.version,
    pct: PCT_PROFORMA_DEFECTO,
    totalPresupuestoCents: input.presTotalCents,
    ...desglosar(total, input.presBaseCents, input.presTotalCents),
    concepto: `Provisión de fondos inicial (${PCT_PROFORMA_DEFECTO} %) según presupuesto ${input.presupuestoReferencia}`,
    fecha: input.hoy,
    estado: 'borrador',
    fechaEnvio: null,
    creadaPor: input.por,
  }
}

export function problemasProforma(proforma: Proforma, fechaEnvioPresupuesto?: string) {
  const problems: string[] = []
  if (!(proforma.totalCents > 0)) problems.push('El importe debe ser mayor que 0.')
  if (proforma.totalPresupuestoCents > 0 && proforma.totalCents > proforma.totalPresupuestoCents) {
    problems.push('El importe no puede superar el total del presupuesto.')
  }
  if (!proforma.concepto.trim()) problems.push('Indica el concepto.')
  if (proforma.estado === 'enviada' && !proforma.fechaEnvio) {
    problems.push('Indica la fecha de envío.')
  }
  if (
    proforma.fechaEnvio &&
    fechaEnvioPresupuesto &&
    proforma.fechaEnvio < fechaEnvioPresupuesto.slice(0, 10)
  ) {
    problems.push('La fecha de envío no puede ser anterior al envío del presupuesto.')
  }
  return problems
}

export function leerProforma(detalles: unknown): Proforma | null {
  const value =
    detalles && typeof detalles === 'object' && !Array.isArray(detalles)
      ? (detalles as Record<string, unknown>)['proforma']
      : null
  if (!value || typeof value !== 'object' || typeof (value as Proforma).totalCents !== 'number') {
    return null
  }
  return value as Proforma
}
