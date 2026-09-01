import { createFileRoute, Link } from "@tanstack/react-router";

import { PendingBadge, SectionHeader } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SOPS } from "@/data/mock";

export const Route = createFileRoute("/sops/")({
  head: () => ({
    meta: [
      { title: "Biblioteca de SOPs — LEX" },
      {
        name: "description",
        content: "Procedimientos normalizados del despacho para cada fase del ciclo del asunto.",
      },
      { property: "og:title", content: "Biblioteca de SOPs — LEX" },
      {
        property: "og:description",
        content: "Primera cita, acta de encargo, traspaso, cierre, adendas y archivo.",
      },
    ],
  }),
  component: SopsPage,
});

function SopsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Biblioteca de SOPs"
        subtitle="Procedimientos normalizados del despacho."
        actions={<PendingBadge label="Contenido de los procedimientos pendiente" />}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SOPS.map((s) => (
          <Link key={s.id} to="/sops/$id" params={{ id: s.id }} className="block">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent">
              <CardHeader className="pb-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.fase}
                </span>
                <CardTitle className="text-base">{s.nombre}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.descripcion}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
