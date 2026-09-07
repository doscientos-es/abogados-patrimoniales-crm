import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import { PendingPanel, SectionHeader, StatTile, StatusBadge } from '@/components/common'
import { Badge } from '@/components/ui/badge'
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
import { useContactos } from '@/features/contactos'
import {
  formatCurrency,
  formatDate,
  type FacturaResumen,
  useFacturas,
} from '@/features/facturacion/infrastructure/supabase-facturas'
import {
  etiquetaEstadoEconomicoProvisional,
  resumenEconomicoProvisional,
} from '@/features/facturacion'
import { useOnboardings } from '@/features/onboarding'

const EMPTY_FACTURAS: FacturaResumen[] = []

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
  const firmId = membership.data?.firmId
  const facturasQuery = useFacturas(firmId)
  const onboardingsQuery = useOnboardings(firmId)
  const contactsQuery = useContactos(firmId)
  const facturas = facturasQuery.data ?? EMPTY_FACTURAS
  const provisionales = useMemo(
    () => resumenEconomicoProvisional(onboardingsQuery.data ?? []),
    [onboardingsQuery.data],
  )
  const contactNames = useMemo(
    () => new Map((contactsQuery.data ?? []).map((contact) => [contact.id, contact.nombre])),
    [contactsQuery.data],
  )
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
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Emitido en el año" value={formatCurrency(resumen.emitido, 'EUR')} />
        <StatTile label="Cobrado" value={formatCurrency(resumen.cobrado, 'EUR')} tono="exito" />
        <StatTile
          label="Pendiente de cobro"
          value={formatCurrency(resumen.pendiente, 'EUR')}
          tono={resumen.pendiente ? 'aviso' : 'neutro'}
        />
        <StatTile
          label="Proformas pendientes"
          value={String(provisionales.proformasPendientes.length)}
          tono={provisionales.proformasPendientes.length ? 'aviso' : 'neutro'}
        />
        <StatTile
          label="Pagos manuales confirmados"
          value={String(provisionales.pagosConfirmados.length)}
          tono={provisionales.pagosConfirmados.length ? 'exito' : 'neutro'}
        />
      </div>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold">Seguimiento provisional de presupuestos</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Confirmaciones manuales del onboarding. No son documentos fiscales ni se incluyen en los totales anteriores.
              </p>
            </div>
            <Link to="/onboarding" className="text-primary text-sm font-medium hover:underline">
              Abrir Onboarding
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Onboarding</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado provisional</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {provisionales.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.referencia}</TableCell>
                  <TableCell>{contactNames.get(item.contactoId) ?? 'Contacto no disponible'}</TableCell>
                  <TableCell>{item.asunto}</TableCell>
                  <TableCell>{item.importePresupuesto === null ? '—' : formatCurrency(item.importePresupuesto, 'EUR')}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(item.fechaEstado)}</TableCell>
                  <TableCell><Badge variant={item.estadoEconomico === 'payment_confirmed' ? 'secondary' : 'outline'}>{etiquetaEstadoEconomicoProvisional(item.estadoEconomico)}</Badge></TableCell>
                </TableRow>
              ))}
              {onboardingsQuery.isLoading ? <TableRow><TableCell colSpan={6} className="text-muted-foreground py-8 text-center">Cargando confirmaciones provisionales…</TableCell></TableRow> : null}
              {onboardingsQuery.isError ? <TableRow><TableCell colSpan={6} className="text-destructive py-8 text-center">No se pudieron cargar las confirmaciones provisionales.</TableCell></TableRow> : null}
              {!onboardingsQuery.isLoading && !onboardingsQuery.isError && !provisionales.items.length ? <TableRow><TableCell colSpan={6} className="text-muted-foreground py-8 text-center">No hay proformas pendientes ni pagos manuales por revisar.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
