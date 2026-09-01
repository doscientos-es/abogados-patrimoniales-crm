import { createFileRoute } from "@tanstack/react-router";

import { PendingPanel, SectionHeader } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfiguracionContactos } from "@/components/contactos/configuracion";
import { GestionEtiquetas } from "@/components/tareas/etiquetas";
import { GestionTitulosTarea } from "@/components/tareas/titulos";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — LEX" },
      {
        name: "description",
        content: "Ajustes del despacho: equipo, materias, plantillas, tarifas y numeración.",
      },
      { property: "og:title", content: "Configuración — LEX" },
      {
        property: "og:description",
        content: "Parámetros generales previstos para el software del despacho.",
      },
    ],
  }),
  component: ConfiguracionPage,
});

const bloques: Record<string, [string, string][]> = {
  despacho: [
    ["Datos del despacho", "Denominación, NIF, domicilio y colegiación."],
    ["Series de numeración", "Referencias de leads, asuntos, documentos y facturas."],
  ],
  equipo: [
    ["Profesionales y roles", "Socios, asociados, paralegales y administración."],
    ["Permisos por módulo", "Acceso a asuntos, documentos y facturación."],
  ],
  catalogos: [
    ["Materias y submaterias", "Sucesiones, patrimonio societario, inmobiliario, ejecuciones."],
    ["Estados y prioridades", "Catálogo de estados por fase."],
    ["Tarifas y honorarios", "Tarifas horarias, precios cerrados y provisiones."],
  ],
  plantillas: [
    ["Plantillas documentales", "Acta de encargo, welcome pack, acta de cierre y adendas."],
    ["Checklists por fase", "Pasos obligatorios en cada una de las seis fases."],
  ],
};

function ConfiguracionPage() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <SectionHeader
        title="Configuración"
        subtitle="Parámetros del despacho. Estructura visual sin edición real."
      />
      <Tabs defaultValue="despacho">
        <TabsList>
          <TabsTrigger value="despacho">Despacho</TabsTrigger>
          <TabsTrigger value="contactos">Contactos</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
        </TabsList>
        <TabsContent value="contactos">
          <ConfiguracionContactos />
        </TabsContent>
        {Object.entries(bloques).map(([key, items]) => (
          <TabsContent key={key} value={key} className="space-y-3">
            {key === "catalogos" ? <GestionEtiquetas /> : null}
            {key === "catalogos" ? <GestionTitulosTarea /> : null}
            {items.map(([titulo, desc]) => (
              <Card key={titulo}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{titulo}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">{desc}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="h-9 rounded-md border border-dashed border-border bg-muted/40" />
                    <div className="h-9 rounded-md border border-dashed border-border bg-muted/40" />
                  </div>
                </CardContent>
              </Card>
            ))}
            <PendingPanel title="Edición y guardado de la configuración" />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
