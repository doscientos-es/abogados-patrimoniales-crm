// Módulo ACTIVIDADES · ACTUACIONES · HITOS.
// Regla conceptual: toda actuación es una actividad, pero no toda actividad es
// una actuación. Existe una única entidad base (Actuacion = actividad); la
// condición de actuación y la de hito son calificaciones manuales del
// profesional. La Suite registra; el profesional califica. Sin IA, sin cómputo
// de plazos y sin creación automática de tareas.
import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  Eye,
  EyeOff,
  Flag,
  Gavel,
  FileText,
  LayoutList,
  Rows3,
  Scale,
  Star,
  StarOff,
} from "lucide-react";
import { toast } from "sonner";

import { Field, ToneBadge, ViewSwitch } from "@/components/crm/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Vacio } from "@/components/expedientes/ui";
import { cn } from "@/lib/utils";
import { hoyTexto, parseFecha } from "@/data/pipeline";
import {
  CATEGORIAS_HITO,
  CLASES_ACTUACION,
  ESTADOS_REGISTRO,
  TIPOS_ACTUACION,
  type Actuacion,
  type CategoriaHito,
  type ClaseActuacion,
  type EstadoRegistro,
} from "@/data/expedientes-model";
import { ops, useOps } from "@/lib/expedientes-store";

const RESPONSABLES = ["Igor Belmonte", "Ana Torregrosa", "Luis Ferrán", "Marta Solé", "Nuria Casals"];

export const esActividadActuacion = (a: Actuacion) => a.esActuacion !== false;
export const esActividadHito = (a: Actuacion) => Boolean(a.esHito) && esActividadActuacion(a);
const registroDe = (a: Actuacion): EstadoRegistro =>
  a.estadoRegistro ?? (a.estado === "Cancelada" ? "Anulada" : a.estado === "Borrador" ? "Borrador" : "Confirmada");

const clave = (v: string) => v.toLowerCase();

function ordenFecha(a: Actuacion) {
  const d = parseFecha(a.fecha)?.getTime() ?? 0;
  const [h = "0", m = "0"] = (a.hora || "00:00").split(":");
  return d + Number(h) * 60000 * 60 + Number(m) * 60000;
}

/* ------------------------------------------------------------------ */
/* Distintivos                                                         */
/* ------------------------------------------------------------------ */

function Distintivo({
  children,
  icon,
  tono = "neutro",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tono?: "neutro" | "actuacion" | "judicial" | "hito" | "aviso" | "riesgo";
}) {
  const clases: Record<string, string> = {
    neutro: "border-border text-muted-foreground",
    actuacion: "border-primary/40 bg-primary/10 text-primary",
    judicial: "border-foreground/30 bg-foreground/5 text-foreground",
    hito: "border-warning/50 bg-warning/10 text-warning-foreground",
    aviso: "border-success/40 bg-success/10 text-success",
    riesgo: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        clases[tono],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function DistintivosActividad({ a }: { a: Actuacion }) {
  const actuacion = esActividadActuacion(a);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {actuacion ? (
        <Distintivo tono="actuacion" icon={<Star className="h-3 w-3" />}>
          Actuación{a.tipoActuacion ? ` · ${a.tipoActuacion}` : ""}
        </Distintivo>
      ) : (
        <Distintivo>Actividad</Distintivo>
      )}
      {esActividadHito(a) ? (
        <Distintivo tono="hito" icon={<Flag className="h-3 w-3" />}>
          Hito
        </Distintivo>
      ) : null}
      {a.esJudicial ? (
        <Distintivo tono="judicial" icon={<Gavel className="h-3 w-3" />}>
          Judicial
        </Distintivo>
      ) : null}
      {a.contieneDocumentoJudicial ? (
        <Distintivo tono="judicial" icon={<Scale className="h-3 w-3" />}>
          Documento judicial
        </Distintivo>
      ) : null}
      {a.visibleCliente ? (
        <Distintivo tono="aviso" icon={<Eye className="h-3 w-3" />}>
          Reportable
        </Distintivo>
      ) : null}
      {a.confidencial ? (
        <Distintivo tono="riesgo" icon={<EyeOff className="h-3 w-3" />}>
          Confidencial
        </Distintivo>
      ) : null}
      {a.requiereProximaAccion ? <Distintivo tono="neutro">Próxima acción</Distintivo> : null}
      {(a.distintivos ?? []).map((d) => (
        <Distintivo key={d}>{d}</Distintivo>
      ))}
      {registroDe(a) !== "Confirmada" ? <Distintivo tono="riesgo">{registroDe(a)}</Distintivo> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulario de actividad                                             */
/* ------------------------------------------------------------------ */

type FormState = {
  expedienteId: string;
  fecha: string;
  hora: string;
  tipo: string;
  tipoOtro: string;
  titulo: string;
  descripcion: string;
  observaciones: string;
  responsable: string;
  lineaId: string;
  lineasRelacionadas: string[];
  participantes: string;
  documentos: string[];
  comunicacionId: string;
  origenTexto: string;
  esActuacion: boolean;
  tipoActuacion: ClaseActuacion;
  resultado: string;
  esJudicial: boolean;
  contieneDocumentoJudicial: boolean;
  visibleCliente: boolean;
  confidencial: boolean;
  requiereProximaAccion: boolean;
  proximaAccion: string;
  esHito: boolean;
  tituloHito: string;
  categoriaHito: CategoriaHito;
  tiempo: string;
  facturable: boolean;
};

function estadoInicial(expedienteId: string, comoActuacion: boolean, base?: Actuacion): FormState {
  return {
    expedienteId: base?.expedienteId ?? expedienteId,
    fecha: base?.fecha ?? hoyTexto(),
    hora: base?.hora ?? "10:00",
    tipo: base?.tipo ?? TIPOS_ACTUACION[0],
    tipoOtro: base?.tipoOtro ?? "",
    titulo: base?.titulo ?? "",
    descripcion: base?.descripcion ?? "",
    observaciones: base?.observaciones ?? "",
    responsable: base?.responsable ?? RESPONSABLES[3]!,
    lineaId: base?.lineaId ?? "sin",
    lineasRelacionadas: base?.lineasRelacionadas ?? [],
    participantes: (base?.participantes ?? []).join(", "),
    documentos: base?.documentos ?? [],
    comunicacionId: base?.comunicacionId ?? "sin",
    origenTexto: base?.origenRef?.label ?? "",
    esActuacion: base ? esActividadActuacion(base) : comoActuacion,
    tipoActuacion: base?.tipoActuacion ?? "Extrajudicial",
    resultado: base?.resultado ?? "",
    esJudicial: Boolean(base?.esJudicial),
    contieneDocumentoJudicial: Boolean(base?.contieneDocumentoJudicial),
    visibleCliente: Boolean(base?.visibleCliente),
    confidencial: Boolean(base?.confidencial),
    requiereProximaAccion: Boolean(base?.requiereProximaAccion),
    proximaAccion: base?.proximaAccion ?? "",
    esHito: Boolean(base?.esHito),
    tituloHito: base?.tituloHito ?? "",
    categoriaHito: base?.categoriaHito ?? "Actuación procesal",
    tiempo: String(base?.tiempo ?? 0).replace(".", ","),
    facturable: Boolean(base?.facturable),
  };
}

function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border/70 p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      {ayuda ? <p className="mt-1 text-xs text-muted-foreground">{ayuda}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Interruptor({
  id,
  label,
  ayuda,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  ayuda?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="sm:col-span-2 flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/40 p-2.5">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {ayuda ? <p className="mt-0.5 text-xs text-muted-foreground">{ayuda}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ActuacionFormDialog({
  trigger,
  expedienteId,
  comoActuacion = false,
  base,
  abierto,
  onOpenChange,
}: {
  trigger?: ReactNode;
  expedienteId?: string;
  comoActuacion?: boolean;
  base?: Actuacion;
  abierto?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const expedientes = useOps((s) => s.expedientes);
  const lineas = useOps((s) => s.lineas);
  const documentos = useOps((s) => s.documentos);
  const comunicaciones = useOps((s) => s.comunicaciones);
  const usuario = useOps((s) => s.usuario);
  const [interno, setInterno] = useState(false);
  const open = abierto ?? interno;
  const setOpen = onOpenChange ?? setInterno;
  const [f, setF] = useState<FormState>(() =>
    estadoInicial(expedienteId ?? expedientes[0]?.id ?? "", comoActuacion, base),
  );
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const lineasExp = lineas.filter((l) => l.expedienteId === f.expedienteId);
  const docsExp = documentos.filter((d) => d.expedienteId === f.expedienteId);
  const comsExp = comunicaciones.filter((c) => c.expedienteId === f.expedienteId);
  const valido = Boolean(f.expedienteId && f.fecha.trim() && f.tipo && f.titulo.trim() && f.responsable);

  function construir(): Partial<Actuacion> {
    const participantes = f.participantes
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      expedienteId: f.expedienteId,
      ...(f.lineaId !== "sin" ? { lineaId: f.lineaId } : {}),
      ...(f.lineasRelacionadas.length ? { lineasRelacionadas: f.lineasRelacionadas } : {}),
      tipo: f.tipo,
      ...(f.tipo === "Otra" && f.tipoOtro ? { tipoOtro: f.tipoOtro } : {}),
      titulo: f.titulo.trim(),
      descripcion: f.descripcion,
      observaciones: f.observaciones,
      fecha: f.fecha,
      hora: f.hora,
      responsable: f.responsable,
      participantes,
      documentos: f.documentos,
      ...(f.comunicacionId !== "sin" ? { comunicacionId: f.comunicacionId } : {}),
      ...(f.origenTexto
        ? { origenRef: { tipo: "Tarea" as const, id: "", label: f.origenTexto } }
        : {}),
      esActuacion: f.esActuacion,
      ...(f.esActuacion ? { tipoActuacion: f.tipoActuacion } : {}),
      resultado: f.esActuacion ? f.resultado : "",
      esJudicial: f.esActuacion && f.esJudicial,
      contieneDocumentoJudicial: f.esActuacion && f.contieneDocumentoJudicial,
      visibleCliente: f.esActuacion && f.visibleCliente,
      confidencial: f.confidencial,
      requiereProximaAccion: f.esActuacion && f.requiereProximaAccion,
      proximaAccion: f.esActuacion && f.requiereProximaAccion ? f.proximaAccion : "",
      esHito: f.esActuacion && f.esHito,
      ...(f.esActuacion && f.esHito
        ? { tituloHito: f.tituloHito || f.titulo, categoriaHito: f.categoriaHito }
        : {}),
      tiempo: Number(f.tiempo.replace(",", ".")) || 0,
      facturable: f.facturable,
    };
  }

  function guardar(estadoRegistro: EstadoRegistro) {
    if (!valido) {
      toast.error("Completa expediente, fecha, tipo, título y responsable.");
      return;
    }
    const datos = construir();
    if (base) {
      ops.actualizarActuacion(base.id, {
        ...datos,
        estadoRegistro,
        modificadoPor: usuario,
        fechaModificacion: `${hoyTexto()} ${new Date().toTimeString().slice(0, 5)}`,
      });
      toast.success("Actividad actualizada");
    } else {
      ops.crearActuacion({
        ...(datos as Omit<Actuacion, "id">),
        autor: usuario,
        creadoPor: usuario,
        clienteInformado: false,
        estado: estadoRegistro === "Borrador" ? "Borrador" : "Completada",
        estadoRegistro,
        fechaRegistro: `${hoyTexto()} ${new Date().toTimeString().slice(0, 5)}`,
      });
      toast.success(
        estadoRegistro === "Borrador" ? "Actividad guardada como borrador" : "Actividad registrada",
      );
      setF(estadoInicial(expedienteId ?? f.expedienteId, comoActuacion));
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{base ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
          <DialogDescription>
            Todo se registra como actividad. Si tiene relevancia, se marca además como actuación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Bloque titulo="1 · Datos principales">
            <Field label="Expediente *">
              <Select value={f.expedienteId} onValueChange={(v) => set("expedienteId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona expediente" />
                </SelectTrigger>
                <SelectContent>
                  {expedientes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.codigo} · {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsable *">
              <Select value={f.responsable} onValueChange={(v) => set("responsable", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSABLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha efectiva * (día en que ocurrió)">
              <Input value={f.fecha} onChange={(e) => set("fecha", e.target.value)} placeholder="dd/mm/aaaa" />
            </Field>
            <Field label="Hora (opcional)">
              <Input value={f.hora} onChange={(e) => set("hora", e.target.value)} />
            </Field>
            <Field label="Tipo de actividad *">
              <Select value={f.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ACTUACION.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {f.tipo === "Otra" ? (
              <Field label="Denominación específica">
                <Input value={f.tipoOtro} onChange={(e) => set("tipoOtro", e.target.value)} />
              </Field>
            ) : (
              <Field label="Tiempo dedicado (horas)">
                <Input value={f.tiempo} onChange={(e) => set("tiempo", e.target.value)} />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Título *">
                <Input
                  value={f.titulo}
                  onChange={(e) => set("titulo", e.target.value)}
                  placeholder="Descripción breve de lo realizado o sucedido"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descripción">
                <Textarea rows={3} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Observaciones internas">
                <Textarea rows={2} value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
              </Field>
            </div>
          </Bloque>

          <Bloque titulo="2 · Relaciones" ayuda="Una actividad puede ser transversal y no pertenecer a ninguna línea.">
            <Field label="Línea de trabajo principal">
              <Select value={f.lineaId} onValueChange={(v) => set("lineaId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin">Sin línea (transversal)</SelectItem>
                  {lineasExp.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Comunicación relacionada">
              <Select value={f.comunicacionId} onValueChange={(v) => set("comunicacionId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin">Ninguna</SelectItem>
                  {comsExp.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.asunto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Otras líneas relacionadas">
                <div className="flex flex-wrap gap-1.5">
                  {lineasExp.filter((l) => l.id !== f.lineaId).length ? (
                    lineasExp
                      .filter((l) => l.id !== f.lineaId)
                      .map((l) => {
                        const on = f.lineasRelacionadas.includes(l.id);
                        return (
                          <Button
                            key={l.id}
                            type="button"
                            size="sm"
                            variant={on ? "secondary" : "outline"}
                            className="h-7 text-xs"
                            onClick={() =>
                              set(
                                "lineasRelacionadas",
                                on
                                  ? f.lineasRelacionadas.filter((x) => x !== l.id)
                                  : [...f.lineasRelacionadas, l.id],
                              )
                            }
                          >
                            {l.nombre}
                          </Button>
                        );
                      })
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin otras líneas disponibles.</span>
                  )}
                </div>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Intervinientes (separados por comas)">
                <Input value={f.participantes} onChange={(e) => set("participantes", e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Documentos vinculados">
                <div className="flex flex-wrap gap-1.5">
                  {docsExp.length ? (
                    docsExp.slice(0, 12).map((d) => {
                      const on = f.documentos.includes(d.id);
                      return (
                        <Button
                          key={d.id}
                          type="button"
                          size="sm"
                          variant={on ? "secondary" : "outline"}
                          className="h-7 max-w-[220px] truncate text-xs"
                          onClick={() =>
                            set("documentos", on ? f.documentos.filter((x) => x !== d.id) : [...f.documentos, d.id])
                          }
                        >
                          {d.nombre}
                        </Button>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin documentos en el expediente.</span>
                  )}
                </div>
              </Field>
            </div>
            <Field label="Referencia de origen (opcional)">
              <Input
                value={f.origenTexto}
                onChange={(e) => set("origenTexto", e.target.value)}
                placeholder="Actividad o tarea de la que procede"
              />
            </Field>
            <Field label="Facturable">
              <div className="flex h-9 items-center">
                <Switch checked={f.facturable} onCheckedChange={(v) => set("facturable", v)} />
              </div>
            </Field>
          </Bloque>

          <Bloque titulo="3 · Relevancia">
            <Interruptor
              id="act-relevante"
              label="Marcar como actuación relevante"
              ayuda="Una actuación es una actividad relevante para comprender, dirigir, justificar o reportar el expediente."
              checked={f.esActuacion}
              onChange={(v) => setF((p) => ({ ...p, esActuacion: v, esHito: v ? p.esHito : false }))}
            />
            {f.esActuacion ? (
              <>
                <Field label="Tipo de actuación">
                  <Select value={f.tipoActuacion} onValueChange={(v) => set("tipoActuacion", v as ClaseActuacion)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASES_ACTUACION.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Resultado">
                  <Input value={f.resultado} onChange={(e) => set("resultado", e.target.value)} />
                </Field>
                <Interruptor
                  id="act-judicial"
                  label="Judicial"
                  checked={f.esJudicial}
                  onChange={(v) => set("esJudicial", v)}
                />
                <Interruptor
                  id="act-docjud"
                  label="Contiene documento judicial"
                  checked={f.contieneDocumentoJudicial}
                  onChange={(v) => set("contieneDocumentoJudicial", v)}
                />
                <Interruptor
                  id="act-report"
                  label="Reportable al cliente"
                  checked={f.visibleCliente}
                  onChange={(v) => set("visibleCliente", v)}
                />
                <Interruptor
                  id="act-conf"
                  label="Confidencial interno"
                  checked={f.confidencial}
                  onChange={(v) => set("confidencial", v)}
                />
                <Interruptor
                  id="act-prox"
                  label="Requiere próxima acción"
                  ayuda="Descripción informativa. No crea tareas, plazos ni recordatorios."
                  checked={f.requiereProximaAccion}
                  onChange={(v) => set("requiereProximaAccion", v)}
                />
                {f.requiereProximaAccion ? (
                  <div className="sm:col-span-2">
                    <Field label="Descripción de la próxima acción">
                      <Input value={f.proximaAccion} onChange={(e) => set("proximaAccion", e.target.value)} />
                    </Field>
                  </div>
                ) : null}
              </>
            ) : null}
          </Bloque>

          {f.esActuacion ? (
            <Bloque titulo="4 · Hito histórico">
              <Interruptor
                id="act-hito"
                label="Mostrar como hito histórico"
                ayuda="Los hitos recogen los acontecimientos esenciales ya ocurridos y alimentarán la futura cronología del expediente."
                checked={f.esHito}
                onChange={(v) => set("esHito", v)}
              />
              {f.esHito ? (
                <>
                  <div className="sm:col-span-2">
                    <Field label="Título breve del hito">
                      <Input
                        value={f.tituloHito}
                        onChange={(e) => set("tituloHito", e.target.value)}
                        placeholder={f.titulo || "Demanda presentada"}
                      />
                    </Field>
                  </div>
                  <Field label="Categoría del hito">
                    <Select value={f.categoriaHito} onValueChange={(v) => set("categoriaHito", v as CategoriaHito)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS_HITO.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Confirmación de la fecha efectiva">
                    <Input value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
                  </Field>
                </>
              ) : null}
            </Bloque>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => guardar("Borrador")}>
            Guardar como borrador
          </Button>
          <Button disabled={!valido} onClick={() => guardar(base ? "Rectificada" : "Confirmada")}>
            {base ? "Guardar cambios" : "Guardar y confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Acciones sobre un registro                                          */
/* ------------------------------------------------------------------ */

function AccionesActividad({ a }: { a: Actuacion }) {
  const [editar, setEditar] = useState(false);
  const [confirmar, setConfirmar] = useState<null | "desmarcar" | "anular">(null);
  const [hito, setHito] = useState(false);
  const [tituloHito, setTituloHito] = useState(a.tituloHito || a.titulo);
  const [categoria, setCategoria] = useState<CategoriaHito>(a.categoriaHito ?? "Actuación procesal");
  const [motivo, setMotivo] = useState("");
  const actuacion = esActividadActuacion(a);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
            Acciones <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs">Calificación manual</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setEditar(true)}>Ver detalle y editar</DropdownMenuItem>
          <DropdownMenuSeparator />
          {actuacion ? (
            <DropdownMenuItem onSelect={() => setConfirmar("desmarcar")}>
              <StarOff className="mr-2 h-3.5 w-3.5" /> Dejar de destacar como actuación
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => {
                ops.marcarComoActuacion(a.id);
                toast.success("Actividad marcada como actuación");
              }}
            >
              <Star className="mr-2 h-3.5 w-3.5" /> Marcar como actuación
            </DropdownMenuItem>
          )}
          {esActividadHito(a) ? (
            <DropdownMenuItem
              onSelect={() => {
                ops.desmarcarHito(a.id);
                toast.success("Retirada de los hitos");
              }}
            >
              <Flag className="mr-2 h-3.5 w-3.5" /> Retirar de los hitos
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setHito(true)}>
              <Flag className="mr-2 h-3.5 w-3.5" /> Marcar como hito histórico
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {registroDe(a) === "Borrador" ? (
            <DropdownMenuItem
              onSelect={() => {
                ops.confirmarActuacion(a.id);
                toast.success("Actividad confirmada");
              }}
            >
              Confirmar registro
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setEditar(true)}>Rectificar</DropdownMenuItem>
          {registroDe(a) !== "Anulada" ? (
            <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmar("anular")}>
              Anular
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {editar ? (
        <ActuacionFormDialog base={a} abierto={editar} onOpenChange={setEditar} expedienteId={a.expedienteId} />
      ) : null}

      <Dialog open={hito} onOpenChange={setHito}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Marcar como hito histórico</DialogTitle>
            <DialogDescription>
              {actuacion
                ? "Los hitos recogen los acontecimientos esenciales ya ocurridos."
                : "Solo una actuación puede ser hito: al confirmar, esta actividad se marcará también como actuación."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Título breve del hito">
              <Input value={tituloHito} onChange={(e) => setTituloHito(e.target.value)} />
            </Field>
            <Field label="Categoría">
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaHito)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_HITO.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">Fecha efectiva del hecho: {a.fecha}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHito(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!actuacion) ops.marcarComoActuacion(a.id);
                const r = ops.marcarHito(a.id, { tituloHito, categoriaHito: categoria });
                if (r?.ok === false) toast.error(r.motivo);
                else toast.success("Hito histórico registrado");
                setHito(false);
              }}
            >
              Confirmar hito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmar !== null} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar === "anular" ? "Anular la actividad" : "Dejar de destacar como actuación"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === "anular"
                ? "La actividad permanecerá visible en el histórico con su condición de anulada. Indica el motivo."
                : "Este registro dejará de mostrarse como actuación y como hito, pero continuará conservado como actividad."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmar === "anular" ? (
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la anulación" />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmar === "anular") {
                  ops.anularActuacion(a.id, motivo || "Sin motivo indicado");
                  toast.success("Actividad anulada y conservada en el histórico");
                } else {
                  ops.desmarcarActuacion(a.id);
                  toast.success("El registro se conserva como actividad");
                }
                setConfirmar(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta                                                             */
/* ------------------------------------------------------------------ */

function TarjetaActividad({
  a,
  codigo,
  linea,
}: {
  a: Actuacion;
  codigo: string;
  linea?: string;
}) {
  const actuacion = esActividadActuacion(a);
  const hito = esActividadHito(a);
  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        actuacion ? "border-l-4 border-l-primary border-border" : "border-border/70 bg-muted/30",
        hito && "border-l-warning shadow-sm ring-1 ring-warning/30",
        registroDe(a) === "Anulada" && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {a.fecha}
            {a.hora ? ` · ${a.hora}` : ""} · {codigo} · {a.tipo}
          </p>
          <h3
            className={cn(
              "mt-1 text-foreground",
              hito ? "text-base font-bold" : actuacion ? "text-sm font-semibold" : "text-sm font-medium",
            )}
          >
            {hito ? a.tituloHito || a.titulo : a.titulo}
          </h3>
          {hito && a.tituloHito && a.tituloHito !== a.titulo ? (
            <p className="text-xs text-muted-foreground">Actividad: {a.titulo}</p>
          ) : null}
        </div>
        <AccionesActividad a={a} />
      </div>

      <div className="mt-2">
        <DistintivosActividad a={a} />
      </div>

      {a.descripcion ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.descripcion}</p> : null}
      {actuacion && a.resultado ? (
        <p className="mt-1.5 text-xs text-foreground">
          <span className="font-medium">Resultado:</span> {a.resultado}
        </p>
      ) : null}
      {a.requiereProximaAccion && a.proximaAccion ? (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Próxima acción:</span> {a.proximaAccion}
        </p>
      ) : null}
      {a.documentos?.length ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" /> {a.documentos.length} documento(s) vinculado(s)
        </p>
      ) : null}

      <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <span>
          {a.responsable}
          {linea ? ` · ${linea}` : " · Sin línea"}
        </span>
        <span>Registrada: {a.fechaRegistro ?? `${a.fecha} ${a.hora}`}</span>
      </footer>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

const VISTAS = [
  { id: "actuaciones", label: "Actuaciones" },
  { id: "todas", label: "Toda la actividad" },
  { id: "hitos", label: "Hitos" },
];

export function ActuacionesPanel({ expedienteId }: { expedienteId?: string }) {
  const actividades = useOps((s) => s.actuaciones);
  const expedientes = useOps((s) => s.expedientes);
  const lineas = useOps((s) => s.lineas);

  const [vista, setVista] = useState("actuaciones");
  const [formato, setFormato] = useState<"tarjetas" | "tabla">("tarjetas");
  const [q, setQ] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState<"desc" | "asc">("desc");
  const [agrupacion, setAgrupacion] = useState<"ninguna" | "fecha" | "expediente" | "linea">("ninguna");

  const vacio = {
    expediente: expedienteId ?? "todos",
    linea: "todas",
    tipo: "todos",
    tipoActuacion: "todos",
    responsable: "todos",
    interviniente: "",
    desde: "",
    hasta: "",
    judicial: "todos",
    docJudicial: "todos",
    hito: "todos",
    reportable: "todos",
    confidencial: "todos",
    proxima: "todos",
    registro: "todos",
    conDocumentos: "todos",
    sinLinea: "todos",
  };
  const [fl, setFl] = useState(vacio);
  const setF = (k: keyof typeof vacio, v: string) => setFl((p) => ({ ...p, [k]: v }));

  const expDe = (id: string) => expedientes.find((e) => e.id === id);
  const codigoDe = (id: string) => expDe(id)?.codigo ?? id;
  const nombreLinea = (id?: string) => (id ? lineas.find((l) => l.id === id)?.nombre : undefined);

  const bool = (filtro: string, valor: boolean) =>
    filtro === "todos" || (filtro === "si") === Boolean(valor);

  const filtradas = useMemo(() => {
    const lista = actividades.filter((a) => {
      if (expedienteId && a.expedienteId !== expedienteId) return false;
      if (vista === "actuaciones" && !esActividadActuacion(a)) return false;
      if (vista === "hitos" && !esActividadHito(a)) return false;
      if (fl.expediente !== "todos" && a.expedienteId !== fl.expediente) return false;
      if (fl.linea !== "todas" && a.lineaId !== fl.linea && !(a.lineasRelacionadas ?? []).includes(fl.linea))
        return false;
      if (fl.tipo !== "todos" && a.tipo !== fl.tipo) return false;
      if (fl.tipoActuacion !== "todos" && a.tipoActuacion !== fl.tipoActuacion) return false;
      if (fl.responsable !== "todos" && a.responsable !== fl.responsable) return false;
      if (fl.interviniente && !a.participantes.some((p) => clave(p).includes(clave(fl.interviniente))))
        return false;
      const d = parseFecha(a.fecha);
      const desde = parseFecha(fl.desde);
      const hasta = parseFecha(fl.hasta);
      if (desde && d && d < desde) return false;
      if (hasta && d && d > hasta) return false;
      if (!bool(fl.judicial, Boolean(a.esJudicial))) return false;
      if (!bool(fl.docJudicial, Boolean(a.contieneDocumentoJudicial))) return false;
      if (!bool(fl.hito, esActividadHito(a))) return false;
      if (!bool(fl.reportable, Boolean(a.visibleCliente))) return false;
      if (!bool(fl.confidencial, Boolean(a.confidencial))) return false;
      if (!bool(fl.proxima, Boolean(a.requiereProximaAccion))) return false;
      if (fl.registro !== "todos" && registroDe(a) !== fl.registro) return false;
      if (!bool(fl.conDocumentos, Boolean(a.documentos?.length))) return false;
      if (!bool(fl.sinLinea, !a.lineaId)) return false;
      if (q) {
        const cliente = expDe(a.expedienteId)?.nombre ?? "";
        const texto = `${a.titulo} ${a.tituloHito ?? ""} ${a.descripcion} ${a.resultado} ${codigoDe(a.expedienteId)} ${cliente} ${a.responsable}`;
        if (!clave(texto).includes(clave(q))) return false;
      }
      return true;
    });
    return lista.sort((x, y) => (orden === "desc" ? ordenFecha(y) - ordenFecha(x) : ordenFecha(x) - ordenFecha(y)));
  }, [actividades, expedienteId, vista, fl, q, orden, expedientes]);

  const grupos = useMemo(() => {
    if (agrupacion === "ninguna") return [{ clave: "", items: filtradas }];
    const mapa = new Map<string, Actuacion[]>();
    for (const a of filtradas) {
      const k =
        agrupacion === "fecha"
          ? a.fecha
          : agrupacion === "expediente"
            ? `${codigoDe(a.expedienteId)} · ${expDe(a.expedienteId)?.nombre ?? ""}`
            : (nombreLinea(a.lineaId) ?? "Sin línea de trabajo");
      mapa.set(k, [...(mapa.get(k) ?? []), a]);
    }
    return [...mapa.entries()].map(([k, items]) => ({ clave: k, items }));
  }, [filtradas, agrupacion, expedientes, lineas]);

  const lineasFiltro = expedienteId ? lineas.filter((l) => l.expedienteId === expedienteId) : lineas;
  const responsables = Array.from(new Set(actividades.map((a) => a.responsable)));

  const Tri = ({ k, label }: { k: keyof typeof vacio; label: string }) => (
    <Field label={label}>
      <Select value={fl[k]} onValueChange={(v) => setF(k, v)}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Indiferente</SelectItem>
          <SelectItem value="si">Sí</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitch value={vista} onChange={setVista} options={VISTAS} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, expediente, cliente o responsable…"
            className="h-9 w-full sm:max-w-sm"
          />
          <Button size="sm" variant="outline" className="h-9" onClick={() => setFiltrosAbiertos((v) => !v)}>
            Filtros
          </Button>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={formato === "tarjetas" ? "secondary" : "ghost"}
              className="h-9 px-2"
              onClick={() => setFormato("tarjetas")}
              aria-label="Vista de tarjetas"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={formato === "tabla" ? "secondary" : "ghost"}
              className="h-9 px-2"
              onClick={() => setFormato("tabla")}
              aria-label="Vista de tabla"
            >
              <Rows3 className="h-4 w-4" />
            </Button>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-xs"
                onClick={() => setOrden((o) => (o === "desc" ? "asc" : "desc"))}
              >
                {orden === "desc" ? "Más recientes primero" : "Más antiguas primero"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Orden por fecha efectiva (día en que ocurrió el hecho)</TooltipContent>
          </Tooltip>
          {vista === "todas" ? (
            <Select value={agrupacion} onValueChange={(v) => setAgrupacion(v as typeof agrupacion)}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Secuencia única</SelectItem>
                <SelectItem value="fecha">Agrupar por fecha</SelectItem>
                <SelectItem value="expediente">Agrupar por expediente</SelectItem>
                <SelectItem value="linea">Agrupar por línea de trabajo</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">{filtradas.length} registros</span>
        </div>

        {filtrosAbiertos ? (
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {expedienteId ? null : (
                <Field label="Expediente">
                  <Select value={fl.expediente} onValueChange={(v) => setF("expediente", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {expedientes.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.codigo} · {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Línea de trabajo">
                <Select value={fl.linea} onValueChange={(v) => setF("linea", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {lineasFiltro.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de actividad">
                <Select value={fl.tipo} onValueChange={(v) => setF("tipo", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {Array.from(new Set([...TIPOS_ACTUACION, ...actividades.map((a) => a.tipo)])).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de actuación">
                <Select value={fl.tipoActuacion} onValueChange={(v) => setF("tipoActuacion", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {CLASES_ACTUACION.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Responsable">
                <Select value={fl.responsable} onValueChange={(v) => setF("responsable", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {responsables.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Interviniente">
                <Input
                  className="h-9"
                  value={fl.interviniente}
                  onChange={(e) => setF("interviniente", e.target.value)}
                  placeholder="Nombre"
                />
              </Field>
              <Field label="Fecha efectiva desde">
                <Input className="h-9" value={fl.desde} onChange={(e) => setF("desde", e.target.value)} placeholder="dd/mm/aaaa" />
              </Field>
              <Field label="Fecha efectiva hasta">
                <Input className="h-9" value={fl.hasta} onChange={(e) => setF("hasta", e.target.value)} placeholder="dd/mm/aaaa" />
              </Field>
              <Tri k="judicial" label="Judicial" />
              <Tri k="docJudicial" label="Documento judicial" />
              <Tri k="hito" label="Hito" />
              <Tri k="reportable" label="Reportable al cliente" />
              <Tri k="confidencial" label="Confidencial" />
              <Tri k="proxima" label="Requiere próxima acción" />
              <Tri k="conDocumentos" label="Con documentos vinculados" />
              <Tri k="sinLinea" label="Sin línea de trabajo" />
              <Field label="Estado del registro">
                <Select value={fl.registro} onValueChange={(v) => setF("registro", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {ESTADOS_REGISTRO.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                <Button size="sm" onClick={() => setFiltrosAbiertos(false)}>
                  Aplicar filtros
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFl(vacio)}>
                  Limpiar filtros
                </Button>
                <span className="text-xs text-muted-foreground">{filtradas.length} resultados</span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!filtradas.length ? (
          <Vacio
            texto={
              vista === "hitos"
                ? "Todavía no hay hitos históricos. Marca una actuación esencial como hito."
                : vista === "actuaciones"
                  ? "No hay actuaciones. Registra una actividad y márcala como actuación si es relevante."
                  : "No hay actividad registrada con estos filtros."
            }
          />
        ) : formato === "tabla" ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha efectiva</TableHead>
                    <TableHead>Expediente</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Calificación</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((a) => (
                    <TableRow key={a.id} className={registroDe(a) === "Anulada" ? "opacity-60" : ""}>
                      <TableCell className="whitespace-nowrap text-sm">{a.fecha}</TableCell>
                      <TableCell className="text-sm">{codigoDe(a.expedienteId)}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">
                        {esActividadHito(a) ? a.tituloHito || a.titulo : a.titulo}
                      </TableCell>
                      <TableCell className="text-sm">{a.tipo}</TableCell>
                      <TableCell>
                        <DistintivosActividad a={a} />
                      </TableCell>
                      <TableCell className="text-sm">{a.responsable}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {a.fechaRegistro ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AccionesActividad a={a} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {grupos.map((g) => (
              <div key={g.clave || "todo"} className="space-y-2">
                {g.clave ? (
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.clave}</h3>
                    <ToneBadge tono="neutro">{g.items.length}</ToneBadge>
                  </div>
                ) : null}
                {g.items.map((a) => {
                  const linea = nombreLinea(a.lineaId);
                  return (
                    <TarjetaActividad
                      key={a.id}
                      a={a}
                      codigo={codigoDe(a.expedienteId)}
                      {...(linea ? { linea } : {})}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
