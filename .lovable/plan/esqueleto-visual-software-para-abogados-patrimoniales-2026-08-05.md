# Esqueleto visual — Software para Abogados Patrimoniales

Prototipo navegable, sin lógica real, sin base de datos y con datos ficticios. Todo lo que requiera programación se marca con una etiqueta "Pendiente de desarrollo".

## Diseño

- Paleta sobria: azul oscuro (marca), gris grafito, blanco y neutros; tipografía sans moderna.
- Orientado a escritorio: barra lateral fija + cabecera con buscador ficticio y usuario.
- Componentes: tarjetas, tablas, pestañas, checklists, cronologías, badges de estado y prioridad.
- Sin imágenes decorativas.

## Navegación (menú lateral)

Inicio · Leads · Clientes · Asuntos · Fases (Lead, Onboarding, Case Work, Deliver, Offboarding, Aftercare) · Tareas · Calendario y plazos · Documentos · Comunicaciones · Facturación · Informes · SOPs · Configuración.

## Pantallas

1. **Inicio (Dashboard)**: tarjetas de nuevos leads, presupuestos pendientes, asuntos activos, tareas pendientes, plazos urgentes, asuntos bloqueados, asuntos en cierre, casos latentes y ejecuciones, facturación pendiente, y tabla de últimas actuaciones. Cada tarjeta enlaza a su módulo.
2. **Leads / Clientes / Asuntos**: tablas ficticias con filtros maquetados; las filas abren la ficha correspondiente.
3. **Las seis fases**: una pantalla por fase con la lista de pasos indicada en el encargo, mostrados como checklist/tarjetas de etapa, más una tabla de asuntos ficticios situados en esa fase.
4. **Ficha de asunto** (plantilla común): cabecera con cliente, asunto, materia, responsable, fase, estado, prioridad y próximo hito; indicador visual del recorrido por las seis fases; pestañas de Cronología, Tareas, Documentos, Comunicaciones, Plazos, Equipo, Tiempo y coste, Presupuesto y facturación.
5. **Ficha de cliente y ficha de lead**: datos ficticios y listado de asuntos asociados.
6. **Módulos transversales** (Tareas, Calendario y plazos, Documentos, Comunicaciones, Facturación, Informes, Configuración): cada uno con su tabla o rejilla maquetada y avisos de pendiente de desarrollo donde aplique.
7. **Biblioteca de SOPs**: rejilla con los ocho procedimientos indicados; al abrir uno, ficha vacía con "Pendiente de desarrollo".

## Detalles técnicos

- Rutas TanStack en `src/routes/`: `index`, `leads`, `leads.$id`, `clientes`, `clientes.$id`, `asuntos`, `asuntos.$id`, `fases.$fase`, `tareas`, `calendario`, `documentos`, `comunicaciones`, `facturacion`, `informes`, `sops`, `sops.$id`, `configuracion`. Cada una con su `head()` propio.
- Layout compartido en `__root.tsx`: sidebar shadcn + cabecera, con `<Outlet />`.
- Tokens de color en `src/styles.css` (oklch); nada de colores fijos en componentes.
- Datos ficticios en un único módulo `src/data/mock.ts` para poder sustituirlos después sin tocar las pantallas.
- Componentes reutilizables: `PhaseProgress`, `StatCard`, `PendingBadge`, `DataTable` simple, `Timeline`, `SectionHeader`.
- Sin Cloud, sin auth, sin llamadas externas.
