import { createFileRoute, Link } from '@tanstack/react-router'

import { PendingPanel, SectionHeader, StatusBadge } from '@/components/common'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FACTURAS } from '@/data/mock'

export const Route = createFileRoute('/facturacion')({
  head: () => ({
    meta: [
      { title: 'Facturación — LEX' },
      {
        name: 'description',
        content: 'Provisiones, facturas emitidas y cobros pendientes del despacho.',
      },
      { property: 'og:title', content: 'Facturación — LEX' },
      {
        property: 'og:description',
        content: 'Estado económico de los encargos: emitido, cobrado y pendiente.',
      },
    ],
  }),
  component: FacturacionPage,
})

function FacturacionPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Facturación"
        subtitle="Facturas y cobros por asunto. Datos ficticios."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Emitido en el año', '312.400 €'],
          ['Cobrado', '268.900 €'],
          ['Pendiente de cobro', '14.000 €'],
        ].map(([l, v]) => (
          <div key={l} className="border-border bg-card rounded-lg border p-4">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">{l}</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Factura</TableHead>
                <TableHead className="w-48">Cliente</TableHead>
                <TableHead className="w-24">Asunto</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="w-28">Importe</TableHead>
                <TableHead className="w-28">Emisión</TableHead>
                <TableHead className="w-44">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FACTURAS.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.id}</TableCell>
                  <TableCell className="text-muted-foreground">{f.cliente}</TableCell>
                  <TableCell>
                    <Link
                      to="/expedientes/$id"
                      params={{ id: f.asunto }}
                      className="text-primary hover:underline"
                    >
                      {f.asunto}
                    </Link>
                  </TableCell>
                  <TableCell>{f.concepto}</TableCell>
                  <TableCell>{f.importe}</TableCell>
                  <TableCell className="text-muted-foreground">{f.emision}</TableCell>
                  <TableCell>
                    <StatusBadge value={f.estado} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="mt-4">
        <PendingPanel
          title="Emisión, cobro y contabilidad"
          description="Series de facturación, impuestos, remesas y conciliación bancaria."
        />
      </div>
    </div>
  )
}
