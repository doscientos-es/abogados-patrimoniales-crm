import QRCode from 'qrcode'
import { toast } from 'sonner'

import { auFichaUrl } from '../physical-originals'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** Small optional label: only the firm name, the reference and a QR to the protected record. */
export async function printAuLabel(reference: string) {
  const qr = await QRCode.toDataURL(auFichaUrl(window.location.origin, reference), {
    margin: 0,
    width: 240,
  })
  const printWindow = window.open('', '_blank', 'width=420,height=320')
  if (!printWindow) {
    toast.error('El navegador bloqueó la ventana de impresión.')
    return
  }
  printWindow.document
    .write(`<!doctype html><html><head><title>${escapeHtml(reference)}</title><style>
    @page{size:60mm 30mm;margin:2mm}body{margin:0;font-family:Arial,sans-serif}
    .l{display:flex;gap:3mm;align-items:center;width:56mm;height:26mm}
    img{width:24mm;height:24mm}.t{font-size:6pt;line-height:1.3}.r{font-size:12pt;font-weight:700;margin-top:1mm}
  </style></head><body><div class="l"><img src="${qr}" alt=""><div class="t">ABOGADOS PATRIMONIALES<br>ARCHIVO ÚNICO<div class="r">${escapeHtml(reference)}</div></div></div>
  <script>window.onload=()=>{window.print()}</script></body></html>`)
  printWindow.document.close()
}
