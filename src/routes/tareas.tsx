import { createFileRoute } from "@tanstack/react-router";

import { SectionHeader } from "@/components/common";
import { TareasWorkspace } from "@/components/tareas/workspace";

export const Route = createFileRoute("/tareas")({
  head: () => ({
    meta: [
      { title: "Tareas — LEX" },
      {
        name: "description",
        content:
          "Tablero único de tareas del despacho: pendientes, en curso, en espera, completadas y canceladas, con responsable, vencimiento y trazabilidad.",
      },
      { property: "og:title", content: "Tareas — LEX" },
      {
        property: "og:description",
        content: "Trabajo real del equipo: quién, qué, cuándo y con qué evidencia de cierre.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TareasPage,
});

function TareasPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Tareas"
        subtitle="Todo el trabajo del despacho en un único tablero. Cada tarea tiene responsable, fecha y trazabilidad completa: apertura, reclamaciones, evidencias y cierre."
      />
      <TareasWorkspace />
    </div>
  );
}
