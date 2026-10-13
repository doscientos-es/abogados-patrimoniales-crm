import { toast } from 'sonner'

import {
  euros,
  totales,
  totalesLinea,
  type CopiaVersion,
} from '@/features/crm/application/quote-editor'

export type Cliente = { nombre: string; email: string; nif?: string }

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function documentoHtml(
  version: CopiaVersion,
  cliente: Cliente,
  despacho: string,
  standalone: boolean,
) {
  const total = totales(version.lineas)
  const rows = version.lineas
    .map((line) => {
      const lineTotal = totalesLinea(line)
      return `<tr><td><strong>${esc(line.nombre)}</strong>${line.descripcion ? `<div class="muted">${esc(line.descripcion)}</div>` : ''}</td><td class="number">${line.cantidad}</td><td class="number">${euros(line.precioCents)}</td><td class="number">${line.ivaPct ?? '—'} %</td><td class="number">${euros(lineTotal.total)}</td></tr>`
    })
    .join('')
  const blocks = version.bloques
    .filter((block) => block.incluido)
    .map((block) => `<h3>${esc(block.titulo)}</h3><p class="preserve">${esc(block.texto)}</p>`)
    .join('')
  const css =
    '.document{font:12px/1.5 Georgia,serif;color:#111}.document h1{font-size:20px}.document h2{font-size:15px;margin-top:20px}.document table{width:100%;border-collapse:collapse;margin-top:10px}.document th,.document td{border-bottom:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}.document .number{text-align:right;white-space:nowrap}.document .muted{color:#555;font-size:11px}.document .preserve{white-space:pre-wrap}.document .totals{width:270px;margin-left:auto}.document .totals td{border:0}.document header{border-bottom:2px solid #111;margin-bottom:16px;padding-bottom:10px}.document footer{border-top:1px solid #ccc;margin-top:24px;padding-top:8px;text-align:right;color:#555}'
  const body = `<article class="document"><header><h1>Presupuesto / nota de encargo</h1><div>${esc(despacho)}</div><p>Referencia ${esc(version.referencia)} · ${esc(version.fecha)} · versión ${version.version}</p></header><p><strong>Cliente:</strong> ${esc(cliente.nombre)}${cliente.nif ? ` · <strong>NIF:</strong> ${esc(cliente.nif)}` : ''}<br><strong>Asunto:</strong> ${esc(version.asunto)}</p><h2>Servicios</h2><table><thead><tr><th>Servicio</th><th class="number">Cant.</th><th class="number">Precio</th><th class="number">IVA</th><th class="number">Total</th></tr></thead><tbody>${rows}</tbody></table><table class="totals"><tr><td>Base imponible</td><td class="number">${euros(total.base)}</td></tr><tr><td>IVA</td><td class="number">${euros(total.iva)}</td></tr><tr><td><strong>Total</strong></td><td class="number"><strong>${euros(total.total)}</strong></td></tr></table>${blocks}${version.condiciones.trim() ? `<h2>Condiciones</h2><p class="preserve">${esc(version.condiciones)}</p>` : ''}<footer>${esc(despacho)}</footer></article>`
  return standalone
    ? `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(version.referencia)}</title><style>@page{size:A4;margin:18mm}body{margin:0}${css}</style></head><body>${body}</body></html>`
    : `<style>${css}</style>${body}`
}

export function imprimir(version: CopiaVersion, cliente: Cliente, despacho: string) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    toast.error(
      'El navegador ha bloqueado la ventana. Permite ventanas emergentes para descargar el PDF.',
    )
    return
  }
  printWindow.document.write(documentoHtml(version, cliente, despacho, true))
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 150)
}
