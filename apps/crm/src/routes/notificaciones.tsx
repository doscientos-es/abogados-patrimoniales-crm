import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage } from "@/features/tareas/ui/notifications-page";

export const Route = createFileRoute("/notificaciones")({
  head: () => ({ meta: [{ title: "Notificaciones — LEX" }] }),
  component: NotificationsPage,
});
