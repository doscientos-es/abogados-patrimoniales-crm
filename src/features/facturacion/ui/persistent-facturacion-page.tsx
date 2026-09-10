import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import { PendingPanel, SectionHeader, StatTile } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos, type ContactoPersistido } from '@/features/contactos'
import { useExpedientesPersistentes } from '@/features/expedientes'
import {
  ESTADO_FACTURA_LABEL,
  etiquetaEstadoEconomicoProvisional,
  facturasRectificadas,
  formatCurrency,
  formatDate,
  puedeDescartarse,
  puedeEditarse,
  puedeEmitirse,
  puedeRectificarse,
  puedeRegistrarCobro,
  resumenEconomicoProvisional,
  resumenFacturacion,
  TIPO_FACTURA_LABEL,
  useDescartarBorradorFactura,
  useEmitirFactura,
  useFacturas,
  useGuardarBorradorFactura,
  useRectificarFactura,
  useRegistrarCobroFactura,
  type FacturaPersistida,
} from '@/features/facturacion/application'
import {
  BorradorFacturaDialog,
  EmitirFacturaDialog,
  MotivoFacturaDialog,
  RegistrarCobroDialog,
} from '@/features/facturacion/ui/factura-dialogs'
import { useOnboardings } from '@/features/onboarding'

const EMPTY_FACTURAS: FacturaPersistida[] = []

const nombreContacto = (contacto: ContactoPersistido | undefined) =>
  contacto?.razonSocial || `${contacto?.nombre ?? ''} ${contacto?.apellidos ?? ''}`.trim()

const TONO_ESTADO: Record<string, 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  issued: 'secondary',
  partially_paid: 'secondary',
  paid: 'secondary',
  overdue: 'destructive',
  cancelled: 'outline',
  written_off: 'destructive',
}

export function PersistentFacturacionPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const facturasQuery = useFacturas(firmId)
  const onboardingsQuery = useOnboardings(firmId)
  const contactsQuery = useContactos(firmId)
  const casesQuery = useExpedientesPersistentes(firmId)
  const guardarBorrador = useGuardarBorradorFactura(firmId)
  const emitir = useEmitirFactura(firmId)
  const descartar = useDescartarBorradorFactura(firmId)
  const registrarCobro = useRegistrarCobroFactura(firmId)
  const rectificar = useRectificarFactura(firmId)

  const facturas = facturasQuery.data ?? EMPTY_FACTURAS
  const provisionales = useMemo(
    () => resumenEconomicoProvisional(onboardingsQuery.data ?? []),
    [onboardingsQuery.data],
  )
  const contactosPorId = useMemo(
    () => new Map((contactsQuery.data ?? []).map((contacto) => [contacto.id, contacto])),
    [contactsQuery.data],
  )
  const expedientes = useMemo(
    () => (casesQuery.data ?? []).filter((expediente) => !expediente.fechaCierre),
    [casesQuery.data],
  )
  const resumen = useMemo(() => resumenFacturacion(facturas, new Date().getFullYear()), [facturas])
  const rectificadas = useMemo(() => facturasRectificadas(facturas), [facturas])
  const nombreCliente = (contactoId: string) =>
    nombreContacto(contactosPorId.get(contactoId)) || 'Cliente pendiente'

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando facturación" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Facturación no disponible"
        description="Necesitas una sesión y una membresía activa."
      />
    )

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Facturación"
        subtitle="Borradores, facturas emitidas, cobros y rectificativas por expediente."
        logo
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => exportInvoicesCsv(facturas)}>
              Exportar CSV
            </Button>
            <BorradorFacturaDialog
              trigger={<Button type="button">Nueva factura</Button>}
              expedientes={expedientes}
              nombreCliente={nombreCliente}
              pending={guardarBorrador.isPending}
              onGuardar={(input) => guardarBorrador.mutateAsync(input)}
            />
          </div>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile compact label="Emitido en el año" value={formatCurrency(resumen.emitido, 'EUR')} />
        <StatTile compact label="Cobrado" value={formatCurrency(resumen.cobrado, 'EUR')} tono="exito" />
        <StatTile
          label="Pendiente de cobro"
          value={formatCurrency(resumen.pendiente, 'EUR')}
          tono={resumen.pendiente ? 'aviso' : 'neutro'} compact
        />
        <StatTile
          label="Borradores"
          value={String(resumen.borradores)}
          tono={resumen.borradores ? 'aviso' : 'neutro'} compact
        />
        <StatTile
          label="Proformas pendientes"
          value={String(provisionales.proformasPendientes.length)}
          tono={provisionales.proformasPendientes.length ? 'aviso' : 'neutro'} compact
        />
      </div>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold">
                Seguimiento provisional de presupuestos
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Confirmaciones manuales del onboarding. No son documentos fiscales ni se incluyen en
                los totales anteriores.
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
                  <TableCell>{nombreCliente(item.contactoId)}</TableCell>
                  <TableCell>{item.asunto}</TableCell>
                  <TableCell>
                    {item.importePresupuesto === null
                      ? '—'
                      : formatCurrency(item.importePresupuesto, 'EUR')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.fechaEstado)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.estadoEconomico === 'payment_confirmed' ? 'secondary' : 'outline'
                      }
                    >
                      {etiquetaEstadoEconomicoProvisional(item.estadoEconomico)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!onboardingsQuery.isLoading && !provisionales.items.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    No hay proformas pendientes ni pagos manuales por revisar.
                  </TableCell>
                </TableRow>
              ) : null}
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
                <TableHead className="w-44">Cliente</TableHead>
                <TableHead className="w-24">Asunto</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="w-28">Total</TableHead>
                <TableHead className="w-28">Pendiente</TableHead>
                <TableHead className="w-28">Emisión</TableHead>
                <TableHead className="w-36">Estado</TableHead>
                <TableHead className="w-64">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturas.map((factura) => (
                <TableRow key={factura.id}>
                  <TableCell className="font-medium">
                    {factura.referencia}
                    {factura.tipo === 'credit_note' ? (
                      <span className="text-muted-foreground ml-1 text-xs">
                        {TIPO_FACTURA_LABEL[factura.tipo]}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/contactos/$id"
                      params={{ id: factura.contactoId }}
                      className="text-primary hover:underline"
                    >
                      {factura.cliente}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/expedientes/$id"
                      params={{ id: factura.asuntoId }}
                      className="text-primary hover:underline"
                    >
                      {factura.asuntoReferencia}
                    </Link>
                  </TableCell>
                  <TableCell>{factura.concepto}</TableCell>
                  <TableCell>{formatCurrency(factura.importeTotal, factura.moneda)}</TableCell>
                  <TableCell>{formatCurrency(factura.importePendiente, factura.moneda)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(factura.emision)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TONO_ESTADO[factura.estado] ?? 'outline'}>
                      {ESTADO_FACTURA_LABEL[factura.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {puedeEditarse(factura) ? (
                        <BorradorFacturaDialog
                          trigger={
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs underline-offset-2 hover:underline"
                            >
                              Editar
                            </Button>
                          }
                          factura={factura}
                          expedientes={expedientes}
                          nombreCliente={nombreCliente}
                          pending={guardarBorrador.isPending}
                          onGuardar={(input) => guardarBorrador.mutateAsync(input)}
                        />
                      ) : null}
                      {puedeEmitirse(factura) ? (
                        <EmitirFacturaDialog
                          factura={factura}
                          pending={emitir.isPending}
                          onEmitir={(emision, vencimiento) =>
                            emitir.mutateAsync({
                              facturaId: factura.id,
                              versionEsperada: factura.version,
                              emision,
                              vencimiento,
                            })
                          }
                        />
                      ) : null}
                      {puedeDescartarse(factura) ? (
                        <MotivoFacturaDialog
                          factura={factura}
                          titulo="Descartar borrador"
                          descripcion="El borrador quedará anulado y no podrá emitirse."
                          etiqueta="Descartar"
                          placeholder="Presupuesto no aceptado"
                          exito="Borrador descartado."
                          pending={descartar.isPending}
                          onConfirmar={(motivo) =>
                            descartar.mutateAsync({
                              facturaId: factura.id,
                              versionEsperada: factura.version,
                              motivo,
                            })
                          }
                        />
                      ) : null}
                      {puedeRegistrarCobro(factura) ? (
                        <RegistrarCobroDialog
                          factura={factura}
                          pending={registrarCobro.isPending}
                          onRegistrar={(input) =>
                            registrarCobro.mutateAsync({ facturaId: factura.id, ...input })
                          }
                        />
                      ) : null}
                      {puedeRectificarse(factura, rectificadas) ? (
                        <MotivoFacturaDialog
                          factura={factura}
                          titulo="Rectificar"
                          descripcion="Se creará una factura rectificativa por el importe íntegro."
                          etiqueta="Rectificar"
                          placeholder="Error en el importe facturado"
                          exito="Factura rectificativa creada."
                          pending={rectificar.isPending}
                          onConfirmar={(motivo) =>
                            rectificar.mutateAsync({
                              facturaId: factura.id,
                              versionEsperada: factura.version,
                              motivo,
                            })
                          }
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {facturasQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
                    Cargando facturas…
                  </TableCell>
                </TableRow>
              ) : null}
              {facturasQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-destructive py-10 text-center">
                    No se han podido cargar las facturas. Inténtalo de nuevo.
                  </TableCell>
                </TableRow>
              ) : null}
              {!facturasQuery.isLoading && !facturasQuery.isError && !facturas.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
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

function exportInvoicesCsv(facturas: FacturaPersistida[]) {
  const headers = [
    'Factura',
    'Cliente',
    'Expediente',
    'Concepto',
    'Total',
    'Pendiente',
    'Emisión',
    'Estado',
  ]
  const rows = facturas.map((factura) => [
    factura.referencia,
    factura.cliente,
    factura.asuntoReferencia,
    factura.concepto,
    String(factura.importeTotal),
    String(factura.importePendiente),
    factura.emision ?? '',
    ESTADO_FACTURA_LABEL[factura.estado],
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';'))
    .join('\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `facturas-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
