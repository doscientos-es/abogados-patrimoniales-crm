import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import { PendingPanel, SectionHeader, StatTile, StatusBadge } from '@/components/common'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthSession } from '@/features/auth/application/auth-session'
import { useActiveMembership } from '@/features/auth/application/membership'
import {
  formatCurrency,
  formatDate,
  useFacturas,
} from '@/features/facturacion/infrastructure/supabase-facturas'

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
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const facturasQuery = useFacturas(membership.data?.firmId)
  const facturas = facturasQuery.data ?? []
  const resumen = useMemo(
    () =>
      facturas.reduce(
        (total, factura) => ({
          emitido:
            total.emitido +
            (factura.ejercicio === new Date().getFullYear() &&
            !['draft', 'cancelled'].includes(factura.estadoCodigo)
              ? factura.importeTotal
              : 0),
          cobrado: total.cobrado + factura.importeCobrado,
          pendiente:
            total.pendiente +
            (!['draft', 'cancelled', 'paid'].includes(factura.estadoCodigo)
              ? factura.importePendiente
              : 0),
        }),
        { emitido: 0, cobrado: 0, pendiente: 0 },
      ),
    [facturas],
  )

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando facturación" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !membership.data?.firmId)
    return (
      <PendingPanel
        title="Facturación no disponible"
        description="Necesitas una sesión y una membresía activa."
      />
    )

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader title="Facturación" subtitle="Facturas y cobros por expediente." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Emitido en el año" value={formatCurrency(resumen.emitido, 'EUR')} />
        <StatTile label="Cobrado" value={formatCurrency(resumen.cobrado, 'EUR')} tono="exito" />
        <StatTile
          label="Pendiente de cobro"
          value={formatCurrency(resumen.pendiente, 'EUR')}
          tono={resumen.pendiente ? 'aviso' : 'neutro'}
        />
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
              {facturas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.referencia}</TableCell>
                  <TableCell>
                    <Link
                      to="/contactos/$id"
                      params={{ id: f.contactoId }}
                      className="text-primary hover:underline"
                    >
                      {f.cliente}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/expedientes/$id"
                      params={{ id: f.asuntoId }}
                      className="text-primary hover:underline"
                    >
                      {f.asuntoReferencia}
                    </Link>
                  </TableCell>
                  <TableCell>{f.concepto}</TableCell>
                  <TableCell>{formatCurrency(f.importeTotal, f.moneda)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(f.emision)}</TableCell>
                  <TableCell>
                    <StatusBadge value={f.estado} />
                  </TableCell>
                </TableRow>
              ))}
              {facturasQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    Cargando facturas…
                  </TableCell>
                </TableRow>
              ) : null}
              {facturasQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-destructive py-10 text-center">
                    No se han podido cargar las facturas. Inténtalo de nuevo.
                  </TableCell>
                </TableRow>
              ) : null}
              {!facturasQuery.isLoading && !facturasQuery.isError && !facturas.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    Todavía no hay facturas registradas para este despacho.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
