import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PendingPanel } from "@/components/common";
import { useActiveMembership, useAuthSession } from "@/features/auth";
import { useContactos } from "@/features/contactos";
import { useMiembrosDespacho } from "@/features/crm";
import { useFacturas } from "@/features/facturacion";
import {
  CaseEditForm,
  CaseRelatedForms,
  CaseDetail,
  useComunicacionesExpediente,
  useActualizarVisibilidadActuacion,
  useRegistrarReporteCliente,
  useActuacionesPersistentes,
  useActualizarExpediente,
  useCrearActuacion,
  useCrearComunicacionExpediente,
  useCrearLinea,
  useCrearParticipante,
  useDocumentosExpediente,
  useEventosExpediente,
  useExpedientePersistente,
  useLineasPersistentes,
  useParticipantesPersistentes,
} from "@/features/expedientes";
import { useNotasRemotas } from "@/features/notas";
import { useCrearTarea, useMarcarSiguienteAccion, useTareasPersistentes } from "@/features/tareas";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase";

export const Route = createFileRoute("/expedientes/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Expediente ${params.id} — LEX` },
      { name: "description", content: "Ficha persistente y trazabilidad del expediente." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: CaseRoute,
});

function CaseRoute() {
  const { id } = Route.useParams();
  const session = useAuthSession();
  const membership = useActiveMembership(session.user?.id);
  const firmId = membership.data?.firmId;
  const caseQuery = useExpedientePersistente(firmId, id);
  const workstreams = useLineasPersistentes(firmId, id);
  const activities = useActuacionesPersistentes(firmId, id);
  const participants = useParticipantesPersistentes(firmId, id);
  const events = useEventosExpediente(firmId, id);
  const communications = useComunicacionesExpediente(firmId, id);
  const documents = useDocumentosExpediente(firmId, id);
  const invoices = useFacturas(firmId);
  const tasks = useTareasPersistentes(firmId);
  const notes = useNotasRemotas(firmId);
  const contacts = useContactos(firmId);
  const members = useMiembrosDespacho(firmId);
  const titleTemplates = useQuery({
    queryKey: ["task-title-templates", firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !firmId) return [];
      const { data, error } = await supabase
        .from("crm_task_title_templates")
        .select("title")
        .eq("firm_id", firmId)
        .eq("archived", false)
        .order("sort_order")
        .order("title");
      if (error) throw error;
      return data.map((row) => row.title);
    },
  });
  const updateCase = useActualizarExpediente(firmId);
  const createParticipant = useCrearParticipante(firmId);
  const createWorkstream = useCrearLinea(firmId);
  const createActivity = useCrearActuacion(firmId);
  const createCommunication = useCrearComunicacionExpediente(firmId, id);
  const updateActivityVisibility = useActualizarVisibilidadActuacion(firmId, id);
  const registerReport = useRegistrarReporteCliente(firmId, id);
  const createTask = useCrearTarea(firmId);
  const setNextAction = useMarcarSiguienteAccion(firmId);
  const queries = [
    caseQuery,
    workstreams,
    activities,
    participants,
    events,
    communications,
    documents,
    invoices,
    tasks,
    contacts,
    members,
  ];

  if (session.status === "loading" || membership.isPending)
    return <PendingPanel title="Cargando expediente" description="Consultando tu despacho…" />;
  if (session.status !== "signed-in" || !firmId)
    return (
      <PendingPanel
        title="Expediente no disponible"
        description="Necesitas una sesión y una membresía activa."
      />
    );
  if (queries.some((query) => query.isPending))
    return <PendingPanel title="Cargando expediente" description="Consultando datos operativos…" />;
  if (queries.some((query) => query.isError))
    return (
      <PendingPanel
        title="No se pudo cargar el expediente"
        description="Reintenta en unos instantes."
      />
    );
  if (!caseQuery.data)
    return (
      <PendingPanel
        title="Expediente no encontrado"
        description="No existe o no pertenece a tu despacho."
      />
    );
  const expediente = caseQuery.data;

  return (
    <CaseDetail
      expediente={expediente}
      lineas={workstreams.data ?? []}
      actuaciones={activities.data ?? []}
      participantes={participants.data ?? []}
      eventos={events.data ?? []}
      comunicaciones={communications.data ?? []}
      documentos={documents.data ?? []}
      facturas={(invoices.data ?? []).filter((invoice) => invoice.asuntoId === id)}
      tareas={tasks.data ?? []}
      notas={notes.data ?? []}
      taskTitleTemplates={titleTemplates.data ?? []}
      miembros={members.data ?? []}
      clienteNombre={
        contacts.data?.find((contact) => contact.id === expediente.contactoPrincipalId)?.nombre ??
        "Contacto principal"
      }
      taskPending={createTask.isPending}
      onCreateTask={(input) => createTask.mutateAsync(input)}
      onSetNextAction={(task, enabled) => setNextAction.mutateAsync({ task, enabled })}
      canManageNextAction={(task) => Boolean(
        task.creadaPorId === session.user?.id ||
        ["owner", "admin", "lawyer"].includes(membership.data?.role ?? ""),
      )}
      nextActionPending={setNextAction.isPending}
      communicationPending={createCommunication.isPending}
      onCreateCommunication={(input) => createCommunication.mutateAsync(input)}
      activityVisibilityPending={updateActivityVisibility.isPending}
      onUpdateActivityVisibility={(input) => updateActivityVisibility.mutateAsync(input)}
      reportPending={registerReport.isPending}
      onRegisterClientReport={(input) => registerReport.mutateAsync(input)}
      editor={
        <CaseEditForm
          expediente={expediente}
          miembros={members.data ?? []}
          pending={updateCase.isPending}
          onSave={async (input) => {
            await updateCase.mutateAsync(input);
          }}
        />
      }
      relatedForms={{
        participant: (
          <CaseRelatedForms
            expedienteId={expediente.id}
            contactos={contacts.data ?? []}
            miembros={members.data ?? []}
            lineas={workstreams.data ?? []}
            pending={createParticipant.isPending}
            section="participant"
            onParticipant={(input) => createParticipant.mutateAsync(input)}
            onWorkstream={(input) => createWorkstream.mutateAsync(input)}
            onActivity={(input) => createActivity.mutateAsync(input)}
          />
        ),
        workstream: (
          <CaseRelatedForms
            expedienteId={expediente.id}
            contactos={contacts.data ?? []}
            miembros={members.data ?? []}
            lineas={workstreams.data ?? []}
            pending={createWorkstream.isPending}
            section="workstream"
            onParticipant={(input) => createParticipant.mutateAsync(input)}
            onWorkstream={(input) => createWorkstream.mutateAsync(input)}
            onActivity={(input) => createActivity.mutateAsync(input)}
          />
        ),
        activity: (
          <CaseRelatedForms
            expedienteId={expediente.id}
            contactos={contacts.data ?? []}
            miembros={members.data ?? []}
            lineas={workstreams.data ?? []}
            pending={createActivity.isPending}
            section="activity"
            onParticipant={(input) => createParticipant.mutateAsync(input)}
            onWorkstream={(input) => createWorkstream.mutateAsync(input)}
            onActivity={(input) => createActivity.mutateAsync(input)}
          />
        ),
      }}
    />
  );
}
