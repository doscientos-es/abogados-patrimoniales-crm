import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { SectionHeader, StatTile } from '@/components/common'
import { Bloque, DatoLinea, euros, Vacio } from '@/components/expedientes/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ESTADOS_EJECUCION_EXTRA,
  FASES_EJECUCION_JUDICIAL,
  saldoEjecucion,
} from '@/data/expedientes-model'
import { ToneBadge, ViewSwitch } from '@/features/crm'
import { ops, useOps } from '@/lib/expedientes-store'

export const Route = createFileRoute('/ejecuciones')({
  head: () => ({
    meta: [
      { title: 'Ejecuciones — LEX' },
      {
        name: 'description',
        content:
          'Control de ejecuciones judiciales y extrajudiciales: título, obligado, importes reclamados y recuperados, estado y próximo control.',
      },
      { property: 'og:title', content: 'Ejecuciones — LEX' },
      {
        property: 'og:description',
        content: 'Seguimiento del cumplimiento efectivo de acuerdos, contratos y resoluciones.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: EjecucionesPage,
})

function EjecucionesPage() {
  const ejecuciones = useOps((s) => s.ejecuciones)
  const expedientes = useOps((s) => s.expedientes)
  const [vista, setVista] = useState('judicial')

  const codigo = (id: string) => expedientes.find((e) => e.id === id)?.codigo ?? id
  const lista = ejecuciones.filter((e) =>
    vista === 'judicial'
      ? e.modalidad === 'Ejecución judicial'
      : e.modalidad === 'Ejecución extrajudicial',
  )

  const totalReclamado = ejecuciones.reduce((t, e) => t + e.importeReclamado, 0)
  const totalRecuperado = ejecuciones.reduce((t, e) => t + e.importeRecuperado, 0)

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <SectionHeader
        title="Ejecuciones"
        subtitle="La ejecución es una dimensión propia: puede existir en asuntos judiciales y también en asuntos que nunca llegaron a los tribunales."
        actions={
          <ViewSwitch
            value={vista}
            onChange={setVista}
            options={[
              { id: 'judicial', label: 'Judiciales' },
              { id: 'extrajudicial', label: 'Extrajudiciales' },
            ]}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Importe reclamado" value={euros(totalReclamado)} />
        <StatTile label="Importe recuperado" value={euros(totalRecuperado)} tono="exito" />
        <StatTile
          label="Pendiente de recuperar"
          value={euros(totalReclamado - totalRecuperado)}
          tono="aviso"
        />
      </div>

      {lista.length ? (
        <div className="space-y-4">
          {lista.map((e) => (
            <Bloque
              key={e.id}
              titulo={e.titulo}
              acciones={
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/expedientes/$id"
                    params={{ id: e.expedienteId }}
                    className="text-muted-foreground text-xs hover:underline"
                  >
                    {codigo(e.expedienteId)}
                  </Link>
                  <Select
                    value={e.estado}
                    onValueChange={(v) => ops.actualizarEjecucion(e.id, { estado: v })}
                  >
                    <SelectTrigger className="h-8 w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(e.modalidad === 'Ejecución judicial'
                        ? FASES_EJECUCION_JUDICIAL
                        : ESTADOS_EJECUCION_EXTRA
                      ).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {e.modalidad === 'Ejecución extrajudicial' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        ops.derivarAJudicial(e.id)
                        toast.success('Derivada a ejecución judicial')
                      }}
                    >
                      Derivar a judicial
                    </Button>
                  ) : null}
                </div>
              }
            >
              <dl className="grid gap-x-6 md:grid-cols-2">
                <DatoLinea label="Modalidad" value={e.modalidad} />
                <DatoLinea label="Tipo" value={e.tipo} />
                <DatoLinea label="Obligado" value={e.obligado} />
                <DatoLinea label="Beneficiario" value={e.beneficiario} />
                <DatoLinea label="Prestación" value={e.prestacion} />
                <DatoLinea label="Responsable" value={e.responsable} />
                <DatoLinea label="Reclamado" value={euros(e.importeReclamado)} />
                <DatoLinea label="Recuperado" value={euros(e.importeRecuperado)} />
                <DatoLinea label="Saldo" value={euros(saldoEjecucion(e))} />
                <DatoLinea label="Depende de" value={e.dependencia} />
                <DatoLinea label="Dónde estamos" value={e.dondeEstamos} />
                <DatoLinea label="Próxima acción" value={e.proximaAccion} />
                <DatoLinea
                  label="Próximo control"
                  value={
                    e.proximoControl ? (
                      e.proximoControl
                    ) : (
                      <ToneBadge tono="riesgo">Sin control fijado</ToneBadge>
                    )
                  }
                />
                <DatoLinea
                  label="Situación presupuestaria"
                  value={
                    <ToneBadge
                      tono={
                        e.situacionPresupuestaria === 'Incluida'
                          ? 'exito'
                          : e.situacionPresupuestaria === 'Pendiente de comprobar'
                            ? 'aviso'
                            : 'riesgo'
                      }
                    >
                      {e.situacionPresupuestaria}
                    </ToneBadge>
                  }
                />
              </dl>
            </Bloque>
          ))}
        </div>
      ) : (
        <Vacio texto="Sin ejecuciones en esta modalidad." />
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expediente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Próximo control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ejecuciones.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      to="/expedientes/$id"
                      params={{ id: e.expedienteId }}
                      className="hover:underline"
                    >
                      {codigo(e.expedienteId)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">{e.titulo}</TableCell>
                  <TableCell>{e.modalidad}</TableCell>
                  <TableCell>{e.estado}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euros(saldoEjecucion(e))}
                  </TableCell>
                  <TableCell>{e.proximoControl || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
