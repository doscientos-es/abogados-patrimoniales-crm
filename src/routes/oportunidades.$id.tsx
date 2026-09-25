import {
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
} from "@doscientos/ui";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Archive, ArrowLeft, ArrowRight, CalendarPlus, ContactRound, Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PendingPanel } from "@/components/common";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActiveMembership, useAuthSession } from "@/features/auth";
import { useContacto, type ContactoPersistido } from "@/features/contactos";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_TRANSITIONS,
  OpportunityEditForm,
  opportunityTransitionNeedsReason,
  useActualizarOportunidad,
  useArchivarOportunidad,
  useMiembrosDespacho,
  useOportunidad,
  useTransicionarOportunidad,
  type OportunidadPersistida,
} from "@/features/crm";
import { LeadFirstMeetingTab } from "@/features/crm/ui/lead-first-meeting-tab";
import { LeadWorkspace } from "@/features/crm/ui/lead-workspace";
import { useTareasPersistentes, type TareaPersistida } from "@/features/tareas";
import type { OpportunityStage } from "@/shared/infrastructure/supabase";

export type LeadDetailTab =
  | "summary"
  | "contact"
  | "qualification"
  | "firstMeeting"
  | "tasks"
  | "communications"
  | "notes"
  | "quote"
  | "sent"
  | "engagement"
  | "documents"
  | "acceptance"
  | "history";

const LEAD_DETAIL_TABS: ReadonlyArray<{ id: LeadDetailTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "contact", label: "Contacto" },
  { id: "qualification", label: "Cualificación" },
  { id: "firstMeeting", label: "Primera cita" },
  { id: "tasks", label: "Tareas" },
  { id: "communications", label: "Comunicaciones" },
  { id: "notes", label: "Notas internas" },
  { id: "quote", label: "Presupuesto" },
  { id: "sent", label: "Enviado al cliente" },
  { id: "engagement", label: "Contratación" },
  { id: "documents", label: "Documentación" },
  { id: "acceptance", label: "Validación y aceptación" },
  { id: "history", label: "Histórico" },
];

export const Route = createFileRoute("/oportunidades/$id")({
  head: () => ({
    meta: [
      { title: "Ficha de Lead — LEX" },
      {
        name: "description",
        content:
          "Ficha completa del Lead: situación comercial, contacto, cualificación, tareas, notas internas e historial.",
      },
      { property: "og:title", content: "Ficha de Lead — LEX" },
      {
        property: "og:description",
        content: "Toda la información comercial del Lead en una única pantalla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FichaOportunidadPage,
});

function FichaOportunidadPage() {
  const { id } = Route.useParams();
  const session = useAuthSession();
  const membership = useActiveMembership(
    session.status === "signed-in" ? session.user.id : undefined,
  );
  const firmId = membership.data?.firmId;
  const oportunidad = useOportunidad(firmId, id);
  const contacto = useContacto(firmId, oportunidad.data?.contactoId ?? "");
  const miembros = useMiembrosDespacho(firmId);
  const tareas = useTareasPersistentes(firmId);
  const actualizar = useActualizarOportunidad(firmId);
  const [activeTab, setActiveTab] = useState<LeadDetailTab>("summary");

  if (session.status === "loading") {
    return (
      <PendingPanel title="Cargando oportunidad" description="Consultando el despacho activo…" />
    );
  }
  if (session.status !== "signed-in") {
    return (
      <PendingPanel
        title="Oportunidad no disponible"
        description="Necesitas una sesión y una membresía activa en un despacho."
      />
    );
  }
  if (membership.isPending) {
    return (
      <PendingPanel title="Cargando oportunidad" description="Consultando el despacho activo…" />
    );
  }
  if (!membership.data) {
    return (
      <PendingPanel
        title="Oportunidad no disponible"
        description="Tu usuario no tiene una membresía activa en un despacho."
      />
    );
  }
  if (oportunidad.isPending) {
    return (
      <PendingPanel title="Cargando oportunidad" description="Consultando datos del despacho…" />
    );
  }
  if (oportunidad.isError) {
    return (
      <PendingPanel
        title="No se pudo cargar la oportunidad"
        description={oportunidad.error.message}
      />
    );
  }
  if (!oportunidad.data) {
    return (
      <PendingPanel
        title="Oportunidad no encontrada"
        description="No existe o no pertenece al despacho activo."
      />
    );
  }

  const data = oportunidad.data;
  const relatedTasks = (tareas.data ?? []).filter((task) => task.oportunidadId === data.id);
  const memberName = miembros.data?.find((member) => member.id === data.asignadoId)?.nombre;
  return (
    <main className="mx-auto max-w-[1400px] space-y-6 p-6">
      <Link
        to="/oportunidades"
        search={{ vista: "todas", abrir: "" }}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Leads
      </Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{data.referencia}</Badge>
          <Badge>{OPPORTUNITY_STAGE_LABELS[data.fase]}</Badge>
          <Badge variant="secondary">{data.subestado}</Badge>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-balance">{data.titulo}</h1>
            <p className="text-muted-foreground mt-1">
              {data.descripcion || "Sin descripción registrada."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/contactos/$id"
              params={{ id: data.contactoId }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ContactRound className="h-4 w-4" aria-hidden="true" />
              Ver contacto
            </Link>
            <LeadHeroActions
              stage={data.fase}
              canEdit={!data.archivadoEn}
              onSelectTab={setActiveTab}
            />
          </div>
        </div>
      </header>
      <LeadDetailTabs activeTab={activeTab} onSelectTab={setActiveTab} />
      <section
        id={`lead-detail-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`lead-detail-tab-${activeTab}`}
      >
        {activeTab === "summary" ? (
          <div className="space-y-4">
            <LeadSummary
              opportunity={data}
              memberName={memberName}
              tasks={relatedTasks}
              tasksLoading={tareas.isPending}
              onSelectTab={setActiveTab}
            />
            {data.archivadoEn ? (
              <Card>
                <CardContent className="pt-6 text-sm">
                  Lead archivado: {data.motivoArchivo || "sin motivo visible"}.
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
        {activeTab === "contact" ? (
          <div className="space-y-4">
            <LeadContactOverview
              opportunity={data}
              contact={contacto.data}
              contactLoading={contacto.isPending}
            />
            {!data.archivadoEn ? (
              <OpportunityEditForm
                key={`edit-${data.id}-${data.version}`}
                id="lead-edit-details"
                oportunidad={data}
                miembros={miembros.data ?? []}
                miembrosCargando={miembros.isPending}
                miembrosError={miembros.isError}
                guardando={actualizar.isPending}
                onSave={async (input) => {
                  await actualizar.mutateAsync(input);
                }}
              />
            ) : null}
          </div>
        ) : null}
        {activeTab === "qualification" ? (
          <LeadWorkspace
            opportunity={data}
            firmId={membership.data.firmId}
            section="qualification"
          />
        ) : null}
        {activeTab === "firstMeeting" ? (
          <LeadFirstMeetingTab
            opportunity={data}
            firmId={membership.data.firmId}
            members={miembros.data ?? []}
            contactId={data.contactoId}
            contactName={contacto.data ? contactName(contacto.data) : "Contacto principal"}
            currentUserId={session.user.id}
            memberRole={membership.data.role}
            canEdit={!data.archivadoEn}
          />
        ) : null}
        {activeTab === "tasks" ? (
          <LeadWorkspace opportunity={data} firmId={membership.data.firmId} section="tasks" />
        ) : null}
        {activeTab === "communications" ? (
          <LeadWorkspace
            opportunity={data}
            firmId={membership.data.firmId}
            section="communications"
          />
        ) : null}
        {activeTab === "notes" ? (
          <LeadWorkspace opportunity={data} firmId={membership.data.firmId} section="notes" />
        ) : null}
        {activeTab === "quote" ? (
          <LeadWorkspace
            opportunity={data}
            firmId={membership.data.firmId}
            section="quote"
            canEdit={!data.archivadoEn}
          />
        ) : null}
        {activeTab === "engagement" ? (
          <LeadWorkspace
            opportunity={data}
            firmId={membership.data.firmId}
            section="engagement"
            canEdit={!data.archivadoEn}
          />
        ) : null}
        {activeTab === "sent" ? (
          <LeadWorkspace
            opportunity={data}
            firmId={membership.data.firmId}
            section="sent"
            canEdit={!data.archivadoEn}
          />
        ) : null}
        {activeTab === "documents" ? (
          <LeadWorkspace opportunity={data} firmId={membership.data.firmId} section="documents" />
        ) : null}
        {activeTab === "history" ? (
          <LeadWorkspace opportunity={data} firmId={membership.data.firmId} section="history" />
        ) : null}
        {activeTab === "acceptance" ? (
          <div className="space-y-4">
            <LeadWorkspace
              opportunity={data}
              firmId={membership.data.firmId}
              section="acceptance"
              canEdit={!data.archivadoEn}
            />
            {!data.archivadoEn ? (
              <>
                <OpportunityTransitionCard
                  key={`${data.id}-${data.version}`}
                  opportunityId={data.id}
                  firmId={firmId}
                  stage={data.fase}
                />
                <OpportunityArchiveCard
                  opportunityId={data.id}
                  version={data.version}
                  firmId={firmId}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export function LeadHeroActions({
  stage,
  canEdit = true,
  onSelectTab,
}: {
  stage: OpportunityStage;
  canEdit?: boolean;
  onSelectTab: (tab: LeadDetailTab) => void;
}) {
  const canAdvance = OPPORTUNITY_TRANSITIONS[stage].some((target) => target !== "lost");

  return (
    <div className="flex shrink-0 flex-wrap gap-2" aria-label="Acciones rápidas del Lead">
      {canEdit ? (
        <a
          href="#lead-edit-details"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => onSelectTab("contact")}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" /> Editar Lead
        </a>
      ) : null}
      <a
        href="#lead-new-task"
        className={buttonVariants({ size: "sm" })}
        onClick={() => onSelectTab("tasks")}
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Añadir tarea
      </a>
      {canAdvance ? (
        <a
          href="#lead-stage-transition"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => onSelectTab("acceptance")}
        >
          Avanzar de fase <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

export function LeadSummary({
  opportunity,
  memberName,
  tasks,
  tasksLoading,
  onSelectTab,
}: {
  opportunity: OportunidadPersistida;
  memberName: string | undefined;
  tasks: TareaPersistida[];
  tasksLoading: boolean;
  onSelectTab: (tab: LeadDetailTab) => void;
}) {
  const nextAction = nextLeadAction(tasks);
  const firstMeeting = firstMeetingStatus(tasks);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Situación del Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <LeadSummaryItem label="Fase" value={OPPORTUNITY_STAGE_LABELS[opportunity.fase]} />
            <LeadSummaryItem label="Responsable" value={memberName ?? "Sin asignar"} />
            <LeadSummaryItem label="Origen" value={opportunity.origen || "No indicado"} />
            <LeadSummaryItem label="Tiempo como Lead" value={leadAge(opportunity.creada)} />
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Siguiente acción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasksLoading ? (
            <p className="text-muted-foreground text-sm">Cargando tareas vinculadas…</p>
          ) : nextAction ? (
            <div>
              <p className="text-sm font-medium">{nextAction.titulo}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {nextAction.venceEn ? `Prevista: ${formatDate(nextAction.venceEn)}` : "Sin fecha"}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin siguiente acción</p>
          )}
          <p className="text-sm font-medium">
            ¿Qué hay que hacer ahora para que este asunto avance?
          </p>
          <a
            href="#lead-new-task"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            onClick={() => onSelectTab("tasks")}
          >
            {nextAction ? "Gestionar tareas" : "Definir siguiente acción"}
          </a>
          <p className="text-muted-foreground text-xs">
            La siguiente acción se gestiona como una tarea ordinaria del módulo de Tareas.
          </p>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Hitos del Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-3">
            <LeadSummaryItem label="Primera cita" value={firstMeeting} />
            <LeadSummaryItem label="Presupuesto" value={quoteStatus(opportunity.fase)} />
            <LeadSummaryItem label="Aceptación" value={acceptanceStatus(opportunity.fase)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

export function LeadContactOverview({
  opportunity,
  contact,
  contactLoading,
}: {
  opportunity: OportunidadPersistida;
  contact: ContactoPersistido | null | undefined;
  contactLoading: boolean;
}) {
  const details = asRecord(opportunity.detalles);
  const initial = asRecord(details["informacionInicial"]);
  const role = asRecord(details["rolContacto"]);
  const urgency = asRecord(details["urgencia"]);
  const participants = participantNames(details["otrosIntervinientes"]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacto principal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <LeadSummaryItem
              label="Contacto principal"
              value={contactLoading ? "Cargando contacto…" : contactName(contact)}
            />
            <LeadSummaryItem label="Origen" value={opportunity.origen || "No indicado"} />
            <LeadSummaryItem label="Fecha de entrada" value={formatDate(opportunity.creada)} />
            <LeadSummaryItem label="Tiempo como Lead" value={leadAgeShort(opportunity.creada)} />
            <LeadSummaryItem
              label="Rol en el Lead"
              value={textValue(role["rol"]) || "Sin indicar"}
            />
          </dl>
          <div className="border-border border-t pt-5">
            <h3 className="text-sm font-medium">Otros intervinientes</h3>
            {participants.length ? (
              <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                {participants.map((participant) => (
                  <li key={participant}>{participant}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                No hay otros intervinientes vinculados a este Lead.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información inicial</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
            <LeadSummaryItem
              label="¿Qué ha ocurrido?"
              value={textValue(initial["queHaOcurrido"]) || "—"}
            />
            <LeadSummaryItem
              label="¿Qué solicita?"
              value={textValue(initial["queSolicita"]) || "—"}
            />
            <LeadSummaryItem
              label="¿Existe algún procedimiento ya iniciado?"
              value={textValue(initial["procedimientoIniciado"]) || "—"}
            />
            <LeadSummaryItem
              label="¿Qué documentación manifiesta tener?"
              value={textValue(initial["documentacionManifestada"]) || "—"}
            />
            <LeadSummaryItem
              label="¿Existe alguna urgencia o fecha relevante?"
              value={urgencyValue(urgency)}
            />
          </dl>
        </CardContent>
      </Card>
    </>
  );
}

function LeadSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

export function LeadDetailTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: LeadDetailTab;
  onSelectTab: (tab: LeadDetailTab) => void;
}) {
  return (
    <div
      className="border-border/80 flex max-w-full gap-1 overflow-x-auto border-b px-2"
      role="tablist"
    >
      {LEAD_DETAIL_TABS.map(({ id, label }) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`lead-detail-tab-${id}`}
            aria-controls={`lead-detail-panel-${id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelectTab(id)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${selected ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function OpportunityArchiveCard({
  opportunityId,
  version,
  firmId,
}: {
  opportunityId: string;
  version: number;
  firmId: string | undefined;
}) {
  const navigate = useNavigate();
  const archive = useArchivarOportunidad(firmId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const submit = async () => {
    try {
      await archive.mutateAsync({ id: opportunityId, versionEsperada: version, motivo: reason });
      toast.success("Lead archivado con su historial.");
      await navigate({ to: "/oportunidades", search: { vista: "todas", abrir: "" } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo archivar el Lead.");
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <p className="text-muted-foreground text-sm">
          Archivar conserva la ficha y su auditoría, pero la retira del pipeline activo.
        </p>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          <Archive className="h-4 w-4" /> Archivar Lead
        </Button>
      </CardContent>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              El Lead dejará de aparecer en el pipeline. Indica el motivo para conservar una traza
              profesional de la decisión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="opportunity-archive-reason">Motivo del archivo</Label>
            <Textarea
              id="opportunity-archive-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={4}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archive.isPending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={archive.isPending || !reason.trim()}
              onClick={() => void submit()}
            >
              {archive.isPending ? "Archivando…" : "Confirmar archivo"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function OpportunityTransitionCard({
  opportunityId,
  firmId,
  stage,
}: {
  opportunityId: string;
  firmId: string | undefined;
  stage: OpportunityStage;
}) {
  const destinations = OPPORTUNITY_TRANSITIONS[stage];
  const initialTarget = destinations.find((target) => target !== "lost") ?? destinations[0];

  if (!initialTarget) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          Este Lead está en una fase terminal. Su reapertura requiere un flujo específico con
          justificación.
        </CardContent>
      </Card>
    );
  }

  return (
    <TransitionForm
      opportunityId={opportunityId}
      firmId={firmId}
      stage={stage}
      destinations={destinations}
      initialTarget={initialTarget}
    />
  );
}

function TransitionForm({
  opportunityId,
  firmId,
  stage,
  destinations,
  initialTarget,
}: {
  opportunityId: string;
  firmId: string | undefined;
  stage: OpportunityStage;
  destinations: OpportunityStage[];
  initialTarget: OpportunityStage;
}) {
  const transition = useTransicionarOportunidad(firmId);
  const [target, setTarget] = useState(initialTarget);
  const [substage, setSubstage] = useState("");
  const [reason, setReason] = useState("");
  const needsReason = opportunityTransitionNeedsReason(stage, target);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (needsReason && !reason.trim()) {
      toast.error("Indica el motivo del cierre o retroceso.");
      return;
    }
    try {
      await transition.mutateAsync({
        id: opportunityId,
        fase: target,
        subestado: substage,
        motivo: reason,
      });
      toast.success(`Lead movido a ${OPPORTUNITY_STAGE_LABELS[target]}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar la fase del Lead.");
    }
  };

  return (
    <Card id="lead-stage-transition">
      <CardContent className="pt-6">
        <form className="grid gap-4 md:grid-cols-3" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1 text-sm">
            <Label htmlFor="opportunity-stage">Nueva fase</Label>
            <Select
              aria-label="Nueva fase"
              value={target}
              onChange={(value) => {
                if (typeof value === "string") setTarget(value as OpportunityStage);
              }}
            >
              <SelectTrigger id="opportunity-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  {destinations.map((destination) => (
                    <SelectItem key={destination} id={destination}>
                      {OPPORTUNITY_STAGE_LABELS[destination]}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 text-sm">
            <Label htmlFor="opportunity-substage">Subestado</Label>
            <Input
              id="opportunity-substage"
              value={substage}
              onChange={(event) => setSubstage(event.target.value)}
              placeholder="Sin revisar"
            />
          </div>
          <div className="space-y-1 text-sm">
            <Label htmlFor="opportunity-transition-reason">
              Motivo {needsReason ? "(obligatorio)" : "(opcional)"}
            </Label>
            <Input
              id="opportunity-transition-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-required={needsReason}
            />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={transition.isPending}>
              {transition.isPending ? "Cambiando fase…" : "Cambiar fase"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function nextLeadAction(tasks: TareaPersistida[]) {
  return [...tasks]
    .filter((task) => !["Completada", "Cancelada"].includes(task.estado))
    .sort((first, second) => taskDateValue(first.venceEn) - taskDateValue(second.venceEn))[0];
}

function firstMeetingStatus(tasks: TareaPersistida[]) {
  const meeting = [...tasks]
    .filter(
      (task) =>
        task.tipo === "Evento" &&
        task.estado !== "Cancelada" &&
        asRecord(task.reunion["primeraCita"])["estado"] !== undefined,
    )
    .sort((first, second) => taskDateValue(first.venceEn) - taskDateValue(second.venceEn))[0];
  if (!meeting) return "Sin programar";
  const metadata = asRecord(meeting.reunion["primeraCita"]);
  const status = textValue(metadata["estado"]);
  const date = textValue(meeting.reunion["startsAt"]) || meeting.venceEn;
  if (status === "No comparece" || status === "Reprogramación pendiente") return status;
  if (status === "Celebrada" || meeting.estado === "Completada")
    return `Celebrada${date ? ` · ${formatDate(date)}` : ""}`;
  if (!date) return "Pendiente de programar";
  return `Programada · ${formatDate(date)}`;
}

function quoteStatus(stage: OpportunityStage) {
  if (stage === "quote") return "Solicitado";
  if (stage === "validation") return "Pendiente de validar";
  if (stage === "engagement") return "Enviado al cliente";
  if (stage === "won") return "Aceptado";
  if (stage === "lost") return "Cerrado sin aceptación";
  return "No solicitado";
}

function acceptanceStatus(stage: OpportunityStage) {
  if (stage === "won") return "Aceptado";
  if (stage === "lost") return "No aceptado";
  if (stage === "validation") return "En validación";
  if (stage === "engagement") return "Pendiente de aceptación";
  return "Sin aceptación";
}

function leadAge(createdAt: string, now = new Date()) {
  const relative = leadAgeShort(createdAt, now);
  return relative === "Sin fecha de alta"
    ? relative
    : `${relative} · desde ${formatDate(createdAt)}`;
}

function leadAgeShort(createdAt: string, now = new Date()) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "Sin fecha de alta";
  const dayMs = 86_400_000;
  const createdDay = Date.UTC(
    created.getUTCFullYear(),
    created.getUTCMonth(),
    created.getUTCDate(),
  );
  const currentDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.max(0, Math.floor((currentDay - createdDay) / dayMs));
  return days === 0 ? "Hoy" : days === 1 ? "Ayer" : `Hace ${days} días`;
}

function taskDateValue(value: string | null) {
  const timestamp = value ? Date.parse(value) : Number.POSITIVE_INFINITY;
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function participantNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((participant) => {
      if (typeof participant === "string") return participant.trim();
      const record = asRecord(participant);
      return (
        textValue(record["nombre"]) ||
        textValue(record["nombreCompleto"]) ||
        textValue(record["name"])
      );
    })
    .filter(Boolean);
}

function contactName(contact: ContactoPersistido | null | undefined) {
  if (!contact) return "Contacto no disponible";
  return [contact.nombre, contact.apellidos].filter(Boolean).join(" ");
}

function urgencyValue(urgency: Record<string, unknown>) {
  const option = textValue(urgency["opcion"]);
  const detail = textValue(urgency["detalle"]);
  return [option, detail].filter(Boolean).join(" · ") || "Sin indicar";
}
