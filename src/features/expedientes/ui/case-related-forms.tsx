import { Plus } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { ContactoPersistido } from "@/features/contactos";
import type { MiembroDespacho } from "@/features/crm";
import type {
  CrearLineaInput,
  CrearParticipanteInput,
} from "@/features/expedientes/application/case-types";

export type RelatedFormSection = "participant" | "workstream";

export function CaseRelatedForms({
  expedienteId,
  contactos,
  miembros,
  pending,
  section,
  onParticipant,
  onWorkstream,
}: {
  expedienteId: string;
  contactos: ContactoPersistido[];
  miembros: MiembroDespacho[];
  pending: boolean;
  section: RelatedFormSection;
  onParticipant: (input: CrearParticipanteInput) => Promise<unknown>;
  onWorkstream: (input: CrearLineaInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const addAnother = useRef(false);
  const execute = async (
    event: FormEvent<HTMLFormElement>,
    action: (data: FormData) => Promise<unknown>,
    success: string,
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    const keepOpen = addAnother.current;
    addAnother.current = false;
    try {
      await action(new FormData(form));
      toast.success(success);
      form.reset();
      if (keepOpen) form.querySelector<HTMLInputElement>("input[name=titulo]")?.focus();
      else setOpen(false);
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
    ) : (
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
                objetivos: formText(data, "objetivos"),
                estado: formText(data, "estado") || "pending",
                asignadoId: formText(data, "asignado") || null,
                fechaObjetivo: formText(data, "objetivo") || null,
              }),
            "Línea creada.",
          )
        }
      >
        <div className="sm:col-span-2">
          <Field
            name="titulo"
            label="Título de la línea *"
            placeholder="Ej. Revisión de cargas registrales"
            required
          />
        </div>
        <Field name="tipo" label="Tipo (opcional)" placeholder="Ej. Análisis jurídico" />
        <NativeSelect name="estado" label="Estado">
          <option value="pending">Pendiente</option>
          <option value="in_analysis">En análisis</option>
          <option value="in_progress">En curso</option>
          <option value="on_hold">En espera</option>
        </NativeSelect>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="related-objetivos">Objetivos (opcional)</Label>
          <Textarea
            id="related-objetivos"
            name="objetivos"
            rows={3}
            placeholder="Qué se pretende conseguir y qué resultado se espera."
          />
        </div>
        <NativeSelect name="asignado" label="Responsable (opcional)">
          {assignees}
        </NativeSelect>
        <Field name="objetivo" label="Fecha objetivo (opcional)" type="date" />
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              addAnother.current = true;
            }}
          >
            Crear y añadir otra
          </Button>
          <div className="flex gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Crear línea
            </Button>
          </div>
        </div>
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
      description:
        "El título es obligatorio. Añade objetivos, responsable y fecha objetivo si ya los tienes; podrás completarlos después.",
      trigger: "Nueva línea",
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
  placeholder?: string;
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
