import { createFileRoute, redirect } from "@tanstack/react-router";

// El workflow comercial de presupuestos se ha integrado en Leads y Onboarding.
// Los presupuestos se conservan como objetos vinculados y son consultables
// desde la pestaña «Ver presupuestos» del módulo Onboarding.
export const Route = createFileRoute("/presupuestos/")({
  beforeLoad: () => {
    throw redirect({ to: "/onboarding" });
  },
});
