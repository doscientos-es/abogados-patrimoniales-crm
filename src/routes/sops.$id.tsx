import { createFileRoute, Link } from "@tanstack/react-router";

import { PendingPanel, SectionHeader } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sopById } from "@/data/mock";

export const Route = createFileRoute("/sops/$id")({
  head: () => ({
    meta: [
      { title: "Procedimiento — LEX" },
      {
        name: "description",
        content: "Ficha de procedimiento normalizado del despacho, pendiente de desarrollo.",
      },
      { property: "og:title", content: "Procedimiento — LEX" },
      {
        property: "og:description",
        content: "Estructura prevista: objetivo, responsables, pasos, plantillas y controles.",
      },
    ],
  }),
  component: SopDetail,
});

const secciones = [
  "Objetivo del procedimiento",
  "Responsables e intervinientes",
  "Pasos del procedimiento",
  "Plantillas y documentos asociados",
  "Controles de calidad",
  "Indicadores y registro",
];

function SopDetail() {
  const { id } = Route.useParams();
  const sop = sopById(id);

  if (!sop) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionHeader title="Procedimiento no encontrado" subtitle={id} />
        <Link to="/sops" className="text-sm text-primary hover:underline">
          Volver a la biblioteca
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <SectionHeader title={sop.nombre} subtitle={`Fase ${sop.fase} · ${sop.descripcion}`} />
      <div className="space-y-3">
        {secciones.map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{s}</CardTitle>
            </CardHeader>
            <CardContent>
              <PendingPanel title="Contenido pendiente de redacción" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <Link to="/sops" className="text-sm text-primary hover:underline">
          Volver a la biblioteca de SOPs
        </Link>
      </div>
    </div>
  );
}
