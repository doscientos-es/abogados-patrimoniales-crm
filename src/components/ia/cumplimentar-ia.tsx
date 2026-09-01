// IA CUMPLIMENTACIÓN — panel transversal de asistencia al alta.
//
// Mismo comportamiento en todos los formularios de LEX: subir documentos,
// revisar los datos propuestos uno a uno, decidir sobre las personas
// detectadas, responder preguntas y aplicar al formulario. Nada se guarda sin
// validación humana explícita.
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Paperclip,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ESQUEMAS,
  RELACIONES_IA,
  ROLES_DOCUMENTALES,
  ROLES_EXPEDIENTE,
  TEXTO_ESTADO,
  type DatoExtraido,
  type EstadoDato,
  type FormularioIA,
  type PersonaDetectada,
  type SesionIA,
} from "@/data/ia-cumplimentacion";
import { extraerDocumentoIA } from "@/lib/ia-cumplimentacion.functions";
import {
  actualizarDato,
  datoManual,
  integrarLectura,
  nuevaSesion,
  nuevoDocumento,
  registrarSesionAplicada,
  traza,
  valoresAplicables,
} from "@/lib/ia-cumplimentacion-store";
import { ops } from "@/lib/expedientes-store";

const PASOS = ["Documentos", "Datos", "Personas", "Preguntas", "Resumen"] as const;
type Paso = (typeof PASOS)[number];

const COLOR_ESTADO: Record<EstadoDato, string> = {
  confirmado: "border-success/50 bg-success/10 text-success-foreground",
  pendiente: "border-warning/50 bg-warning/10 text-warning-foreground",
  dudoso: "border-destructive/50 bg-destructive/10 text-destructive",
  manual: "border-border bg-muted text-muted-foreground",
  descartado: "border-border bg-muted/60 text-muted-foreground line-through",
};

function leerArchivo(f: File) {
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("No se ha podido leer el archivo."));
    fr.onload = () => {
      const r = String(fr.result ?? "");
      resolve(r.slice(r.indexOf(",") + 1));
    };
    fr.readAsDataURL(f);
  });
}

export function CumplimentarIA({
  formulario,
  contexto,
  valoresActuales = {},
  onAplicar,
  etiqueta = "Cumplimentar con IA",
  destacado = false,
}: {
  formulario: FormularioIA;
  contexto?: string;
  valoresActuales?: Record<string, string>;
  onAplicar: (valores: Record<string, string>, personas: PersonaDetectada[]) => void;
  etiqueta?: string;
  destacado?: boolean;
}) {
  const esquema = ESQUEMAS[formulario];
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>("Documentos");
  const [sesion, setSesion] = useState<SesionIA>(() =>
    nuevaSesion(formulario, ops.usuarioActual(), contexto),
  );
  const [procesando, setProcesando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pendientes = sesion.datos.filter((d) => d.estado === "pendiente" || d.estado === "dudoso");
  const listos = sesion.datos.filter((d) => d.estado === "confirmado" || d.estado === "manual");
  const preguntasPendientes = sesion.preguntas.filter((p) => p.estado === "pendiente");

  const camposCumplimentados = useMemo(
    () => Object.entries(valoresActuales).filter(([, v]) => v?.trim()).map(([k]) => k),
    [valoresActuales],
  );

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setProcesando(true);
    let actual = sesion;
    for (const file of Array.from(files)) {
      const doc = nuevoDocumento(file.name, file.type || "application/pdf", file.size, "");
      try {
        const datos = await leerArchivo(file);
        doc.datos = datos;
        doc.estado = "leyendo";
        actual = { ...actual, documentos: [...actual.documentos, doc] };
        setSesion(actual);

        const lectura = await extraerDocumentoIA({
          data: {
            formulario: esquema.titulo,
            contexto: contexto ?? "",
            documento: { nombre: file.name, mime: doc.mime, datos },
            campos: esquema.campos,
            camposYaCumplimentados: camposCumplimentados,
          },
        });
        actual = integrarLectura(actual, doc.id, lectura);
        setSesion(actual);
        toast.success(`${file.name}: lectura completada.`);
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : "No se ha podido leer el documento.";
        actual = {
          ...actual,
          documentos: actual.documentos.map((d) =>
            d.id === doc.id ? { ...d, estado: "error", error: mensaje } : d,
          ),
        };
        actual = traza(actual, "Error de lectura", `${file.name}: ${mensaje}`);
        setSesion(actual);
        toast.error(mensaje);
      }
    }
    setProcesando(false);
    if (inputRef.current) inputRef.current.value = "";
    if (actual.datos.length || actual.personas.length) setPaso("Datos");
  };

  const aplicar = () => {
    const valores = valoresAplicables(sesion);
    const personas = sesion.personas.filter(
      (p) => p.decision === "crear" || p.decision === "vincular",
    );
    if (!Object.keys(valores).length && !personas.length) {
      toast.error("No hay ningún dato validado para trasladar al formulario.");
      return;
    }
    const final = traza(
      sesion,
      "Datos aplicados al formulario",
      `${Object.keys(valores).length} campo(s) y ${personas.length} persona(s).`,
    );
    registrarSesionAplicada(final);
    onAplicar(valores, personas);
    toast.success(
      `${Object.keys(valores).length} campo(s) trasladados. Revisa el formulario antes de guardar.`,
    );
    setAbierto(false);
  };

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant={destacado ? "default" : "outline"} type="button" className="gap-2">
          <Sparkles className="h-4 w-4" />
          {etiqueta}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            IA Cumplimentación · {esquema.titulo}
          </SheetTitle>
          <SheetDescription className="text-xs">
            La IA sólo lee, ordena y propone. No decide, no clasifica y no guarda nada: toda
            información pasa por tu validación.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-1 border-b px-5 py-2 text-xs">
          {PASOS.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setPaso(p)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                paso === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {i + 1}. {p}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-5">
            {paso === "Documentos" ? (
              <PasoDocumentos
                sesion={sesion}
                procesando={procesando}
                inputRef={inputRef}
                onSubir={subir}
                onQuitar={(id) =>
                  setSesion((s) => ({
                    ...s,
                    documentos: s.documentos.filter((d) => d.id !== id),
                  }))
                }
              />
            ) : null}

            {paso === "Datos" ? (
              <PasoDatos
                sesion={sesion}
                onCambio={setSesion}
                pendientes={pendientes}
                listos={listos}
              />
            ) : null}

            {paso === "Personas" ? <PasoPersonas sesion={sesion} onCambio={setSesion} /> : null}

            {paso === "Preguntas" ? <PasoPreguntas sesion={sesion} onCambio={setSesion} /> : null}

            {paso === "Resumen" ? <PasoResumen sesion={sesion} /> : null}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {listos.length} validado(s) · {pendientes.length} por revisar ·{" "}
            {preguntasPendientes.length} pregunta(s)
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" type="button" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={aplicar} disabled={!listos.length && !sesion.personas.length}>
              Aplicar al formulario
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ----------------------------- Paso 1 ------------------------------ */

function PasoDocumentos({
  sesion,
  procesando,
  inputRef,
  onSubir,
  onQuitar,
}: {
  sesion: SesionIA;
  procesando: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubir: (f: FileList | null) => void;
  onQuitar: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Documentos de partida</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF (con texto o escaneado) e imágenes. Se conservan como origen de los datos para
            poder consultarlos en cualquier momento.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => onSubir(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={procesando}
            onClick={() => inputRef.current?.click()}
          >
            {procesando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            {procesando ? "Leyendo documentos…" : "Añadir documentos"}
          </Button>

          {sesion.documentos.length ? (
            <ul className="space-y-2">
              {sesion.documentos.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.estado === "error"
                        ? d.error
                        : d.estado === "leido"
                          ? `${d.tipoDocumental ?? "Documento"} · leído ${d.subidoEn}`
                          : "Pendiente de lectura"}
                    </p>
                  </div>
                  <button type="button" onClick={() => onQuitar(d.id)} aria-label="Quitar">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Todavía no has añadido documentos. También puedes cumplimentar el formulario a mano y
              usar la IA sólo para completar lo que falte.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------- Paso 2 ------------------------------ */

function PasoDatos({
  sesion,
  onCambio,
  pendientes,
  listos,
}: {
  sesion: SesionIA;
  onCambio: (s: SesionIA) => void;
  pendientes: DatoExtraido[];
  listos: DatoExtraido[];
}) {
  const [campoNuevo, setCampoNuevo] = useState("");
  const [valorNuevo, setValorNuevo] = useState("");
  const esquema = ESQUEMAS[sesion.formulario];
  const docNombre = (id?: string) =>
    sesion.documentos.find((d) => d.id === id)?.nombre ?? "Sin documento";

  if (!sesion.datos.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay datos propuestos. Añade documentos en el paso anterior o introduce los datos que
        falten manualmente desde aquí una vez existan lecturas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Revisa dato por dato. Nada se traslada al formulario hasta que lo confirmes. Puedes corregir
        cualquier valor: la corrección queda registrada.
      </p>

      {[...pendientes, ...listos].map((d) => (
        <div key={d.id} className={cn("rounded-md border p-3", COLOR_ESTADO[d.estado])}>
          <div className="flex items-start justify-between gap-2">
            <Label className="text-xs uppercase tracking-wide">{d.etiqueta}</Label>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {TEXTO_ESTADO[d.estado]}
            </Badge>
          </div>
          <Input
            value={d.valor}
            className="mt-2 bg-background"
            onChange={(e) =>
              onCambio(
                actualizarDato(sesion, d.id, {
                  valor: e.target.value,
                  estado: "manual",
                  corregido: true,
                }),
              )
            }
          />
          <p className="mt-1.5 text-xs opacity-80">
            Origen: {docNombre(d.documentoId)}
            {d.pagina ? ` · pág. ${d.pagina}` : ""}
            {d.fragmento ? ` · «${d.fragmento}»` : ""}
          </p>

          {d.versiones.length ? (
            <div className="mt-2 rounded-md border border-destructive/40 bg-background/70 p-2 text-xs">
              <p className="flex items-center gap-1 font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Dato contradictorio entre documentos
              </p>
              {d.versiones.map((v, i) => (
                <div key={i} className="mt-1 flex items-center justify-between gap-2">
                  <span>
                    {v.valor} · {docNombre(v.documentoId)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() =>
                      onCambio(
                        actualizarDato(sesion, d.id, {
                          valor: v.valor,
                          documentoId: v.documentoId,
                          estado: "confirmado",
                          versiones: [],
                        }),
                      )
                    }
                  >
                    Usar este
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              type="button"
              className="gap-1"
              onClick={() => onCambio(actualizarDato(sesion, d.id, { estado: "confirmado" }))}
            >
              <Check className="h-3.5 w-3.5" />
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="gap-1"
              onClick={() => onCambio(actualizarDato(sesion, d.id, { estado: "descartado" }))}
            >
              <X className="h-3.5 w-3.5" />
              Descartar
            </Button>
          </div>
        </div>
      ))}

      <Separator />
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Añadir un dato manualmente
        </Label>
        <div className="flex flex-wrap gap-2">
          <Select value={campoNuevo} onValueChange={setCampoNuevo}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Campo" />
            </SelectTrigger>
            <SelectContent>
              {esquema.campos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-48"
            placeholder="Valor"
            value={valorNuevo}
            onChange={(e) => setValorNuevo(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const campo = esquema.campos.find((c) => c.id === campoNuevo);
              if (!campo || !valorNuevo.trim()) return;
              onCambio(datoManual(sesion, campo.id, campo.label, valorNuevo.trim()));
              setValorNuevo("");
            }}
          >
            Añadir
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Paso 3 ------------------------------ */

function PasoPersonas({
  sesion,
  onCambio,
}: {
  sesion: SesionIA;
  onCambio: (s: SesionIA) => void;
}) {
  if (!sesion.personas.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No se ha detectado ninguna persona o entidad en los documentos aportados.
      </p>
    );
  }

  const set = (id: string, cambios: Partial<PersonaDetectada>) =>
    onCambio({
      ...sesion,
      personas: sesion.personas.map((p) => (p.id === id ? { ...p, ...cambios } : p)),
    });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Cada persona detectada requiere una decisión. La relación con el despacho nunca la propone
        la IA: la eliges tú. Ninguna ficha se fusiona automáticamente.
      </p>

      {sesion.personas.map((p) => (
        <Card key={p.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{p.nombre}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {p.naturaleza}
              {p.documento ? ` · ${p.documento}` : ""}
              {p.domicilio ? ` · ${p.domicilio}` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.coincidencias.length ? (
              <div className="rounded-md border border-warning/50 bg-warning/10 p-2 text-xs text-warning-foreground">
                <p className="font-medium">Posible duplicado</p>
                {p.coincidencias.map((c) => (
                  <div key={c.contactoId} className="mt-1 flex items-center justify-between gap-2">
                    <span>
                      {c.nombre} — {c.motivo}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() =>
                        set(p.id, { decision: "vincular", contactoVinculado: c.contactoId })
                      }
                    >
                      Vincular
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rol documental</Label>
                <Select
                  value={p.rolDocumental}
                  onValueChange={(v) => set(p.id, { rolDocumental: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_DOCUMENTALES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sesion.formulario !== "contacto" ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Interviene como</Label>
                  <Select
                    value={p.rolExpediente}
                    onValueChange={(v) =>
                      set(p.id, { rolExpediente: v as PersonaDetectada["rolExpediente"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES_EXPEDIENTE.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Relación con el despacho</Label>
                <Select
                  value={p.relacion ?? ""}
                  onValueChange={(v) =>
                    set(p.id, { relacion: v as NonNullable<PersonaDetectada["relacion"]> })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="La decides tú" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELACIONES_IA.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Decisión</Label>
                <Select
                  value={p.decision}
                  onValueChange={(v) =>
                    set(p.id, { decision: v as PersonaDetectada["decision"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente de decidir</SelectItem>
                    <SelectItem value="crear">Crear contacto nuevo</SelectItem>
                    <SelectItem value="vincular">Vincular a contacto existente</SelectItem>
                    <SelectItem value="solo-documento">Dejar sólo en el documento</SelectItem>
                    <SelectItem value="excluir">Excluir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {p.fragmento ? (
              <p className="text-xs text-muted-foreground">Origen: «{p.fragmento}»</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------- Paso 4 ------------------------------ */

function PasoPreguntas({
  sesion,
  onCambio,
}: {
  sesion: SesionIA;
  onCambio: (s: SesionIA) => void;
}) {
  const pendientes = sesion.preguntas.filter((p) => p.estado === "pendiente");
  if (!pendientes.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No quedan preguntas pendientes. La IA sólo pregunta por lo que falta o resulta ambiguo.
      </p>
    );
  }

  const responder = (id: string, respuesta: string) => {
    const pregunta = sesion.preguntas.find((q) => q.id === id);
    let s: SesionIA = {
      ...sesion,
      preguntas: sesion.preguntas.map((q) =>
        q.id === id ? { ...q, respuesta, estado: "respondida" } : q,
      ),
    };
    if (pregunta?.personaId) {
      s = {
        ...s,
        personas: s.personas.map((p) =>
          p.id === pregunta.personaId
            ? { ...p, relacion: respuesta as NonNullable<PersonaDetectada["relacion"]> }
            : p,
        ),
      };
    } else if (pregunta?.campoId) {
      const campo = ESQUEMAS[sesion.formulario].campos.find((c) => c.id === pregunta.campoId);
      if (campo) s = datoManual(s, campo.id, campo.label, respuesta);
    }
    onCambio(traza(s, "Pregunta respondida", `${pregunta?.texto ?? ""} → ${respuesta}`));
  };

  return (
    <div className="space-y-3">
      {pendientes.map((q) => (
        <PreguntaItem key={q.id} pregunta={q} onResponder={responder} onOmitir={(id) =>
          onCambio({
            ...sesion,
            preguntas: sesion.preguntas.map((x) =>
              x.id === id ? { ...x, estado: "omitida" } : x,
            ),
          })
        } />
      ))}
    </div>
  );
}

function PreguntaItem({
  pregunta,
  onResponder,
  onOmitir,
}: {
  pregunta: { id: string; texto: string; opciones: string[] };
  onResponder: (id: string, respuesta: string) => void;
  onOmitir: (id: string) => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <p className="text-sm">{pregunta.texto}</p>
        {pregunta.opciones.length ? (
          <div className="flex flex-wrap gap-2">
            {pregunta.opciones.map((o) => (
              <Button
                key={o}
                size="sm"
                variant="outline"
                type="button"
                onClick={() => onResponder(pregunta.id, o)}
              >
                {o}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={texto}
              placeholder="Respuesta"
              onChange={(e) => setTexto(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => texto.trim() && onResponder(pregunta.id, texto.trim())}
            >
              Responder
            </Button>
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          type="button"
          className="text-xs"
          onClick={() => onOmitir(pregunta.id)}
        >
          No consta / omitir
        </Button>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Paso 5 ------------------------------ */

function PasoResumen({ sesion }: { sesion: SesionIA }) {
  const valores = valoresAplicables(sesion);
  const personas = sesion.personas.filter(
    (p) => p.decision === "crear" || p.decision === "vincular",
  );
  const sinDecidir = sesion.personas.filter((p) => p.decision === "pendiente");
  const sinValidar = sesion.datos.filter((d) => d.estado === "pendiente" || d.estado === "dudoso");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Se trasladará al formulario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {Object.keys(valores).length ? (
            Object.entries(valores).map(([k, v]) => {
              const dato = sesion.datos.find((d) => d.campoId === k);
              return (
                <p key={k}>
                  <span className="text-muted-foreground">{dato?.etiqueta ?? k}:</span> {v}
                </p>
              );
            })
          ) : (
            <p className="text-muted-foreground">Ningún dato validado todavía.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Personas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {personas.length ? (
            personas.map((p) => (
              <p key={p.id}>
                {p.nombre} — {p.decision === "crear" ? "alta nueva" : "vinculación"}
                {sesion.formulario !== "contacto" ? ` · ${p.rolExpediente}` : ""} ·{" "}
                {p.relacion ?? "relación sin decidir"}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">Sin altas ni vinculaciones propuestas.</p>
          )}
          {sinDecidir.length ? (
            <p className="text-xs text-warning-foreground">
              {sinDecidir.length} persona(s) sin decisión: no se harán cambios sobre ellas.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {sinValidar.length ? (
        <div className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          Quedan {sinValidar.length} dato(s) sin validar. No se trasladarán al formulario.
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trazabilidad de la sesión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          {sesion.trazabilidad.map((e) => (
            <p key={e.id}>
              {e.fecha} · {e.usuario} · {e.accion} — {e.detalle}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
