import QRCode from 'qrcode'
import { toast } from 'sonner'

import {
  euros,
  totales,
  totalesLinea,
  type CopiaVersion,
} from '@/features/crm/application/quote-editor'

export type Cliente = { nombre: string; email: string; nif?: string }

const WEB = 'abogadospatrimoniales.es'

/** QR of the firm website as an inline SVG data URI: synchronous, so previews render it at once. */
let qrCache: string | null = null
function qrDataUri() {
  if (qrCache) return qrCache
  const { modules } = QRCode.create(`https://${WEB}`, { errorCorrectionLevel: 'M' })
  const size = modules.size
  const cells: string[] = []
  for (let row = 0; row < size; row += 1)
    for (let col = 0; col < size; col += 1)
      if (modules.data[row * size + col]) cells.push(`M${col} ${row}h1v1h-1z`)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${size + 4} ${size + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${size + 4}" height="${size + 4}" fill="#fff"/><path d="${cells.join('')}" fill="#000"/></svg>`
  qrCache = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return qrCache
}
/** Absolute URL: the print window has no origin of its own. */
const logoUrl = () =>
  typeof window !== 'undefined' ? `${window.location.origin}/logo-lex.svg` : '/logo-lex.svg'

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
    '.document{font:12px/1.5 Georgia,serif;color:#111}.document h1{font-size:18px;margin:6px 0 0}.document h2{font-size:15px;margin-top:20px}.document h3{font-size:12px;margin:12px 0 2px}.document table{width:100%;border-collapse:collapse;margin-top:10px}.document th,.document td{border-bottom:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}.document .number{text-align:right;white-space:nowrap}.document .muted{color:#555;font-size:11px}.document .preserve{white-space:pre-wrap;margin:0}.document .totals{width:270px;margin-left:auto}.document .totals td{border:0}.document header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid #111;margin-bottom:16px;padding-bottom:10px}.document .logo{height:48px;width:auto;display:block}.document .meta{text-align:right;font-size:11px}.document .qr{width:64px;height:64px}.document footer{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #ccc;margin-top:24px;padding-top:8px;font-size:10px;color:#555}'
  const body = `<article class="document"><header><div><img class="logo" src="${logoUrl()}" alt="${esc(despacho)}"><h1>Presupuesto / nota de encargo</h1></div><div class="meta">Ref. ${esc(version.referencia)}<br>Fecha ${esc(version.fecha)}<br>Versión ${version.version}</div></header><p><strong>Cliente:</strong> ${esc(cliente.nombre)}${cliente.nif ? ` · <strong>NIF:</strong> ${esc(cliente.nif)}` : ''}<br><strong>Asunto:</strong> ${esc(version.asunto)}</p><h2>Servicios</h2><table><thead><tr><th>Servicio</th><th class="number">Cant.</th><th class="number">Precio</th><th class="number">IVA</th><th class="number">Total</th></tr></thead><tbody>${rows}</tbody></table><table class="totals"><tr><td>Base imponible</td><td class="number">${euros(total.base)}</td></tr><tr><td>IVA</td><td class="number">${euros(total.iva)}</td></tr><tr><td><strong>Total</strong></td><td class="number"><strong>${euros(total.total)}</strong></td></tr></table>${blocks}${version.condiciones.trim() ? `<h2>Condiciones</h2><p class="preserve">${esc(version.condiciones)}</p>` : ''}<footer><span>${esc(despacho)} · ${WEB}</span><img class="qr" src="${qrDataUri()}" alt="Código QR de ${WEB}"></footer></article>`
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
  // Wait for the logo to load before printing.
  void Promise.all(
    Array.from(printWindow.document.images).map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.onload = image.onerror = () => resolve()
          }),
    ),
  ).then(() => setTimeout(() => printWindow.print(), 150))
}
