import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { OportunidadFicha } from "@/components/crm/opportunity-panel";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="mx-auto max-w-[1400px]">
      <Button variant="ghost" size="sm" className="-ml-2 mb-3 gap-1.5" asChild>
        <Link to="/oportunidades" search={{ vista: "todas", abrir: "" }}>
          <ArrowLeft className="h-4 w-4" /> Volver a Leads
        </Link>
      </Button>
      <OportunidadFicha oportunidadId={id} />
    </div>
  );
}
