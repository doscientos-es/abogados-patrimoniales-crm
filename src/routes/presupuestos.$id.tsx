import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Lock, Send, ShieldCheck } from "lucide-react";

import { PendingBadge } from "@/components/common";
import {
  EntityHeader,
  Field,
  MockDialog,
  QuickTaskDialog,
  RelationList,
  TimelineFeed,
  ToneBadge,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  antiguedadFase,
  etiquetasPresupuesto,
  faseDePresupuesto,
  fasePresupuesto,
  motivoCierrePresupuesto,
  nombreContacto,
  siguienteAccionPresupuesto,
  situacionEconomica,
  situacionPresupuesto,
  oportunidadPorId,
  presupuestoPorId,
  type Presupuesto,
} from "@/data/crm";

export const Route = createFileRoute("/presupuestos/$id")({
  loader: ({ params }) => {
    const presupuesto = presupuestoPorId(params.id);
    if (!presupuesto) throw notFound();
    return { presupuesto };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return { meta: [{ title: "Presupuesto no encontrado — LEX" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.presupuesto.codigo} — ${loaderData.presupuesto.titulo}`;
    return {
      meta: [
        { title: `${t} — LEX` },
        { name: "description", content: `Ficha del presupuesto ${loaderData.presupuesto.codigo}.` },
        { property: "og:title", content: `${t} — LEX` },
        { property: "og:description", content: "Ficha del presupuesto: alcance, honorarios, validación y cobro." },
      ],
    };
  },
  component: PresupuestoPage,
});

function PresupuestoPage() {
  const { presupuesto: p } = Route.useLoaderData() as { presupuesto: Presupuesto };
  const fase = fasePresupuesto(faseDePresupuesto(p));
  const eco = situacionEconomica(p);
  const etiquetas = etiquetasPresupuesto(p);
  const dias = antiguedadFase(p);
  const motivoCierre = motivoCierrePresupuesto(p);
  const oportunidad = p.oportunidadId ? oportunidadPorId(p.oportunidadId) : undefined;

  return (
    <div className="mx-auto max-w-[1400px]">
      <EntityHeader
        backTo="/presupuestos"
        backLabel="Volver a presupuestos"
        eyebrow={`Presupuesto ${p.codigo} · ${p.version}`}
        title={p.titulo}
        meta={[
          { label: "Fase", value: <ToneBadge tono={fase.tono}>{fase.nombre}</ToneBadge> },
          { label: "Situación interna", value: situacionPresupuesto(p) },
          { label: "Antigüedad en la fase", value: dias !== undefined ? `${dias} días` : "—" },
          { label: "Siguiente acción", value: siguienteAccionPresupuesto(p) },
          { label: "Contacto", value: nombreContacto(p.contactoId) },
          { label: "Tipo", value: p.tipo },
          { label: "Responsable de elaboración", value: p.responsable },
          { label: "Validador", value: p.validador },
          {
            label: "Validación",
            value: p.validado ? (
              <ToneBadge tono="exito">Validado por Igor</ToneBadge>
            ) : (
              <ToneBadge tono="aviso">Pendiente de validación</ToneBadge>
            ),
          },
          { label: "Total", value: p.total },
          { label: "Provisión inicial", value: p.provision },
          { label: "Vigencia", value: p.vigencia },
          { label: "Situación económica", value: <ToneBadge tono={eco.tono}>{eco.texto}</ToneBadge> },
          ...(motivoCierre ? [{ label: "Motivo de cierre", value: motivoCierre }] : []),
        ]}
        actions={
          <>
            <MockDialog
              trigger={<Button size="sm" variant="outline">Asignar elaboración</Button>}
              title="Asignar elaboración"
              confirmLabel="Asignar"
            >
              <Field label="Responsable">
                <Input placeholder="Abogado" />
              </Field>
              <Field label="Fecha límite">
                <Input placeholder="dd/mm/aaaa" />
              </Field>
            </MockDialog>
            <MockDialog
              trigger={<Button size="sm" variant="outline">Enviar a validación</Button>}
              title="Enviar a validación de Igor"
              confirmLabel="Enviar a validación"
            >
              <div className="sm:col-span-2">
                <Field label="Comentario para el validador">
                  <Textarea rows={3} />
                </Field>
              </div>
            </MockDialog>
            <MockDialog
              trigger={
                <Button size="sm" variant="outline" className="gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Validar
                </Button>
              }
              title="Validar presupuesto"
              description="Solo el validador puede autorizar el envío al cliente."
              confirmLabel="Validar"
            >
              <div className="sm:col-span-2">
                <Field label="Observaciones de la validación">
                  <Textarea rows={3} />
                </Field>
              </div>
            </MockDialog>
            <MockDialog
              trigger={<Button size="sm" variant="outline">Devolver para rectificación</Button>}
              title="Devolver para rectificación"
              confirmLabel="Devolver"
            >
              <div className="sm:col-span-2">
                <Field label="Motivo de la devolución">
                  <Textarea rows={3} />
                </Field>
              </div>
            </MockDialog>
            <MockDialog
              trigger={<Button size="sm" variant="outline">Crear nueva versión</Button>}
              title="Nueva versión del presupuesto"
              confirmLabel="Crear versión"
            >
              <div className="sm:col-span-2">
                <Field label="Cambios respecto a la versión anterior">
                  <Textarea rows={3} />
                </Field>
              </div>
            </MockDialog>
            {p.validado ? (
              <MockDialog
                trigger={
                  <Button size="sm" className="gap-1.5">
                    <Send className="h-4 w-4" /> Enviar al cliente
                  </Button>
                }
                title="Enviar presupuesto al cliente"
                confirmLabel="Enviar"
              >
                <Field label="Destinatario">
                  <Input placeholder="correo@dominio.es" />
                </Field>
                <Field label="Canal">
                  <Select defaultValue="correo">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="correo">Correo electrónico</SelectItem>
                      <SelectItem value="mano">Entrega en mano</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Mensaje">
                    <Textarea rows={3} />
                  </Field>
                </div>
              </MockDialog>
            ) : (
              <Button size="sm" disabled className="gap-1.5">
                <Lock className="h-4 w-4" /> Enviar al cliente (requiere validación de Igor)
              </Button>
            )}
            <MockDialog
              trigger={<Button size="sm" variant="outline">Registrar respuesta</Button>}
              title="Registrar respuesta del cliente"
              confirmLabel="Registrar"
            >
              <Field label="Respuesta">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aceptado">Aceptado</SelectItem>
                    <SelectItem value="modificacion">Solicita modificación</SelectItem>
                    <SelectItem value="rechazado">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fecha">
                <Input placeholder="dd/mm/aaaa" />
              </Field>
            </MockDialog>
            <MockDialog
              trigger={<Button size="sm" variant="outline">Generar proforma</Button>}
              title="Generar proforma"
              confirmLabel="Generar"
            >
              <Field label="Importe">
                <Input placeholder="0,00 €" />
              </Field>
              <Field label="Vencimiento">
                <Input placeholder="dd/mm/aaaa" />
              </Field>
            </MockDialog>
            <MockDialog
              trigger={<Button size="sm" variant="outline">Registrar pago</Button>}
              title="Registrar pago"
              confirmLabel="Registrar pago"
            >
              <Field label="Importe recibido">
                <Input placeholder="0,00 €" />
              </Field>
              <Field label="Fecha de pago">
                <Input placeholder="dd/mm/aaaa" />
              </Field>
            </MockDialog>
            <QuickTaskDialog trigger={<Button size="sm" variant="outline">Crear tarea</Button>} />
            <MockDialog
              trigger={<Button size="sm" variant="outline">Cerrar sin encargo</Button>}
              title="Cerrar sin encargo"
              description="El motivo de cierre es obligatorio y queda visible en la tarjeta."
              confirmLabel="Cerrar sin encargo"
            >
              <Field label="Motivo de cierre (obligatorio)">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Rechazado por el cliente",
                      "Sin respuesta",
                      "Caducado",
                      "Cancelado por el despacho",
                      "Duplicado",
                      "Sustituido por otro presupuesto",
                      "Otro motivo",
                    ].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fecha">
                <Input placeholder="dd/mm/aaaa" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Observación breve">
                  <Textarea rows={2} />
                </Field>
              </div>
            </MockDialog>
          </>
        }
      />

      {etiquetas.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {etiquetas.map((e) => (
            <ToneBadge key={e.texto} tono={e.tono}>
              {e.texto}
            </ToneBadge>
          ))}
        </div>
      ) : null}

      {p.envio && faseDePresupuesto(p) === "cliente" ? (
        <Card className="mb-4">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Enviado el", p.envio.fecha],
              ["Destinatario", p.envio.destinatario],
              ["Canal", p.envio.canal],
              ["Caduca el", p.envio.caducidad],
              ["Próximo seguimiento", p.envio.seguimiento ?? "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-sm text-foreground">{v}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {p.aceptacion ? (
        <Card className="mb-4">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
            {[
              ["Fecha de aceptación", p.aceptacion.fecha],
              ["Versión aceptada", p.aceptacion.version],
              ["Forma de aceptación", p.aceptacion.forma],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-sm text-foreground">{v}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!p.validado ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <Lock className="h-4 w-4" />
          Ningún presupuesto puede mostrarse como enviado sin la validación previa de Igor Belmonte.
          <PendingBadge label="Control de permisos pendiente de desarrollo" />
        </div>
      ) : null}

      <Tabs defaultValue="condiciones">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
          <TabsTrigger value="economia">Honorarios y pago</TabsTrigger>
          <TabsTrigger value="versiones">Versiones</TabsTrigger>
          <TabsTrigger value="validaciones">Validaciones</TabsTrigger>
          <TabsTrigger value="proforma">Situación económica</TabsTrigger>
          <TabsTrigger value="relaciones">Relaciones</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="condiciones" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Alcance del encargo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {p.alcance.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Exclusiones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {p.exclusiones.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                  {p.exclusiones.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sin exclusiones.</p>
              )}
              <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Observaciones</p>
              <p className="mt-0.5 text-sm text-foreground">{p.observaciones}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="economia" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.honorarios.map((h) => (
                    <TableRow key={h.concepto}>
                      <TableCell>{h.concepto}</TableCell>
                      <TableCell className="text-right">{h.importe}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold">{p.total}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              ["Forma de pago", p.formaPago],
              ["Provisión inicial", p.provision],
              ["Vigencia", p.vigencia],
            ].map(([k, v]) => (
              <Card key={k}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p>
                  <p className="mt-1 text-sm text-foreground">{v}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="versiones" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versión</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>Cambio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.versiones.length ? (
                    p.versiones.map((v) => (
                      <TableRow key={v.version}>
                        <TableCell className="font-medium">{v.version}</TableCell>
                        <TableCell>{v.fecha}</TableCell>
                        <TableCell>{v.autor}</TableCell>
                        <TableCell>{v.cambio}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Todavía no hay versiones elaboradas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validaciones" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Validador</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Observación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.validaciones.length ? (
                    p.validaciones.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell>{v.fecha}</TableCell>
                        <TableCell>{v.validador}</TableCell>
                        <TableCell>
                          <ToneBadge tono={v.resultado === "Validado" ? "exito" : "riesgo"}>
                            {v.resultado}
                          </ToneBadge>
                        </TableCell>
                        <TableCell>{v.observacion}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Sin validaciones registradas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proforma" className="mt-4">
          {p.proforma ? (
            <Card>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Número", p.proforma.numero],
                  ["Fecha", p.proforma.fecha],
                  ["Importe", p.proforma.importe],
                  ["Estado", p.proforma.estado],
                  ["Pagado", p.proforma.pagado],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p>
                    <p className="mt-0.5 text-sm text-foreground">{v}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Sin proforma emitida. Genera la proforma tras la aceptación del cliente.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="relaciones" className="mt-4 grid gap-4 lg:grid-cols-3">
          <RelationList
            title="Contacto"
            items={[
              {
                label: nombreContacto(p.contactoId),
                to: "/contactos/$id",
                params: { id: p.contactoId },
              },
            ]}
          />
          <RelationList
            title="Oportunidad"
            items={
              oportunidad
                ? [
                    {
                      label: `${oportunidad.codigo} · ${oportunidad.titulo}`,
                      to: "/oportunidades",
                      params: { id: oportunidad.id },
                    },
                  ]
                : []
            }
            empty="Sin oportunidad vinculada."
          />
          <RelationList
            title="Expediente"
            items={
              p.expedienteId
                ? [{ label: p.expedienteId, to: "/expedientes/$id", params: { id: p.expedienteId } }]
                : []
            }
            empty="Sin expediente vinculado."
          />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <TimelineFeed items={p.historial} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Los documentos económicos y la pasarela de pago se desarrollarán en fases posteriores.{" "}
        <Link to="/facturacion" className="text-primary hover:underline">
          Ver facturación y cobros
        </Link>
      </p>
    </div>
  );
}
