import { Plus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactoPersistido } from "@/features/contactos";
import type { MiembroDespacho } from "@/features/crm";
import type {
  CrearActuacionInput,
  CrearLineaInput,
  CrearParticipanteInput,
  LineaPersistida,
} from "@/features/expedientes/application/case-types";

export type RelatedFormSection = "participant" | "workstream" | "activity";

export function CaseRelatedForms({
  expedienteId,
  contactos,
  miembros,
  lineas,
  pending,
  section,
  onParticipant,
  onWorkstream,
  onActivity,
}: {
  expedienteId: string;
  contactos: ContactoPersistido[];
  miembros: MiembroDespacho[];
  lineas: LineaPersistida[];
  pending: boolean;
  section: RelatedFormSection;
  onParticipant: (input: CrearParticipanteInput) => Promise<void>;
  onWorkstream: (input: CrearLineaInput) => Promise<void>;
  onActivity: (input: CrearActuacionInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const execute = async (
    event: FormEvent<HTMLFormElement>,
    action: (data: FormData) => Promise<void>,
    success: string,
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await action(new FormData(form));
      toast.success(success);
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  };
  const assignees = (
    <>
      <option value="">Sin asignar</option>
      {miembros.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre}
        </option>
      ))}
    </>
  );
  const content =
    section === "participant" ? (
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) =>
          void execute(
            event,
            async (data) =>
              onParticipant({
                expedienteId,
                contactoId: formText(data, "contacto") || null,
                nombre: formText(data, "nombre"),
                rol: formText(data, "rol"),
                confidencialidad: formText(
                  data,
                  "confidencialidad",
                ) as CrearParticipanteInput["confidencialidad"],
              }),
            "Participante añadido.",
          )
        }
      >
        <Field name="nombre" label="Nombre" required />
        <Field name="rol" label="Rol" required />
        <NativeSelect name="contacto" label="Contacto vinculado">
          <option value="">Sin vincular</option>
          {contactos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="confidencialidad" label="Confidencialidad">
          <option>Normal</option>
          <option>Restringida</option>
          <option>Confidencial</option>
        </NativeSelect>
        <Button type="submit" className="sm:col-span-2" disabled={pending}>
          Añadir interviniente
        </Button>
      </form>
    ) : section === "workstream" ? (
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) =>
          void execute(
            event,
            async (data) =>
              onWorkstream({
                expedienteId,
                titulo: formText(data, "titulo"),
                tipo: formText(data, "tipo"),
                descripcion: formText(data, "descripcion"),
                prioridad: formText(data, "prioridad") as CrearLineaInput["prioridad"],
                asignadoId: formText(data, "asignado") || null,
                fechaObjetivo: formText(data, "objetivo") || null,
              }),
            "Línea creada.",
          )
        }
      >
        <div className="sm:col-span-2">
          <Field name="titulo" label="Título" required />
        </div>
        <Field name="tipo" label="Tipo" />
        <NativeSelect name="prioridad" label="Prioridad">
          <option>Media</option>
          <option>Alta</option>
          <option>Baja</option>
        </NativeSelect>
        <div className="sm:col-span-2">
          <Field name="descripcion" label="Descripción" />
        </div>
        <NativeSelect name="asignado" label="Responsable">
          {assignees}
        </NativeSelect>
        <Field name="objetivo" label="Fecha objetivo" type="date" />
        <Button type="submit" className="sm:col-span-2" disabled={pending}>
          Crear línea
        </Button>
      </form>
    ) : (
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) =>
          void execute(
            event,
            async (data) =>
              onActivity({
                expedienteId,
                lineaId: formText(data, "linea") || null,
                tipo: formText(data, "tipo"),
                titulo: formText(data, "titulo"),
                descripcion: formText(data, "descripcion"),
                asignadoId: formText(data, "asignado") || null,
                resultado: formText(data, "resultado"),
                proximaAccion: formText(data, "proxima"),
                horas: Number(data.get("horas") || 0),
                facturable: data.get("facturable") === "on",
                visibleCliente: data.get("visibleCliente") === "on",
              }),
            "Actuación registrada.",
          )
        }
      >
        <Field name="titulo" label="Título" required />
        <Field name="tipo" label="Tipo" required />
        <div className="sm:col-span-2">
          <Field name="descripcion" label="Descripción" />
        </div>
        <NativeSelect name="linea" label="Línea">
          <option value="">General</option>
          {lineas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.titulo}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="asignado" label="Responsable">
          {assignees}
        </NativeSelect>
        <Field name="resultado" label="Resultado" />
        <Field name="proxima" label="Próxima acción" />
        <Field name="horas" label="Horas" type="number" min="0" step="0.25" />
        <label className="flex items-center gap-2 self-end text-sm">
          <input name="facturable" type="checkbox" /> Facturable
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="visibleCliente" type="checkbox" /> Incluir en próximos reportes al cliente
        </label>
        <Button type="submit" className="sm:col-span-2" disabled={pending}>
          Registrar actuación
        </Button>
      </form>
    );
  const config = {
    participant: {
      title: "Añadir interviniente",
      description: "Relaciona una persona o entidad con este expediente.",
      trigger: "Añadir interviniente",
    },
    workstream: {
      title: "Nueva línea de trabajo",
      description: "Define un frente autónomo con objetivo, responsable y seguimiento.",
      trigger: "Nueva línea",
    },
    activity: {
      title: "Registrar actuación",
      description: "Deja trazabilidad del trabajo realizado en este expediente.",
      trigger: "Registrar actuación",
    },
  }[section];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {config.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-2xl overflow-y-auto p-0 sm:max-h-[calc(100svh-4rem)]">
        <DialogHeader>
          <div className="bg-muted/45 border-b px-6 py-5">
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription className="mt-1.5">{config.description}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="px-6 py-6">{content}</div>
      </DialogContent>
    </Dialog>
  );
}

function formText(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

function Field({
  name,
  label,
  ...inputProps
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`related-${name}`}>{label}</Label>
      <Input id={`related-${name}`} name={name} {...inputProps} />
    </div>
  );
}
function NativeSelect({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`related-${name}`}>{label}</Label>
      <select
        id={`related-${name}`}
        name={name}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      >
        {children}
      </select>
    </div>
  );
}
