# LEX · Abogados Patrimoniales

Aplicación web operativa para la gestión comercial y operativa de despachos de abogados patrimoniales. El producto evoluciona por fases, pero no es una maqueta ni un prototipo solo navegable.

## Repositorio y aplicaciones

Un único repositorio y lockfile, con dos aplicaciones desplegables por separado:

- `apps/crm`: web React/TanStack; conserva sus features y la vinculación privada con ChatGPT.
- `apps/mcp`: servicio Node independiente, sin React, Vite, Nitro ni imports del CRM.
- `supabase`: migraciones, funciones y pruebas de la base compartida. No se duplican por app.
- `docs` y `CHANGELOG.md`: documentación y novedades compartidas.

Se conserva el nombre local `nuestro`; no se cambia la raíz Git ni se crea otro repositorio.
No hay paquetes compartidos artificiales: se extraerán únicamente cuando exista una necesidad real.

## Alcance actual

- Autenticación, usuarios y pertenencia a despacho mediante Supabase.
- Gestión persistente de contactos, Leads, oportunidades y tareas.
- Pipeline comercial con trazabilidad de creación y cambios de fase.
- Módulos de expedientes, comunicaciones, documentos, calendario, facturación e informes en evolución.

Las migraciones de base de datos residen en `supabase/migrations`. La aplicación cliente utiliza exclusivamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; no incorpores claves de servicio, contraseñas ni datos reales al repositorio o a entornos de prueba.

La fuente de verdad del alcance P0/P1/P2, flujos, permisos, aceptación y Definition of Done es
[`docs/mvp-juridico-aprobado.md`](docs/mvp-juridico-aprobado.md).

Los datos de demostración deben identificarse de forma inequívoca y mantenerse separados de los datos reales del despacho.

## Novedades del producto

`CHANGELOG.md` es la fuente editorial; `apps/crm/src/features/configuracion/changelog.json` es el artefacto que consume la pestaña **Novedades** de Configuración. Se regenera automáticamente al ejecutar `pnpm dev`, `pnpm build` o `pnpm build:dev`; también puedes ejecutar `pnpm run changelog:sync` a mano. Para revisar el siguiente intervalo de commits, ejecutar `pnpm run changelog:plan`; tras redactar y añadir una entrada con `pnpm exec changelog add <sha-destino> <fecha-UTC> <título> <borrador.json>`, verifica el resultado con `pnpm run changelog:check`. Las entradas describen cambios del repositorio y no implican por sí mismas que estén desplegados.

## Modelo funcional

El ciclo de vida de cada asunto se divide en seis fases:

1. LEAD — Captación

Contacto inicial.

Calificación del potencial cliente.

Primera cita.

Presupuesto.

Aceptación y pago inicial.

Conversión en cliente.

2. ONBOARDING — Alta del encargo

Objetivos y alcance.

Acta de encargo.

Firma.

Welcome Pack.

Cronología inicial.

Documentación.

Activación del asunto.

3. CASE WORK — Preparación y estrategia

Designación del responsable y equipo.

Checklist del expediente.

Datos, firmas y poderes.

Cuestiones previas.

Estrategia.

Reparto de tareas.

Reunión de traspaso.

4. DELIVER — Ejecución

Trabajo jurídico.

Demandas, escritos, contratos y escrituras.

Tareas y actuaciones.

Contactos y comunicaciones.

Seguimiento.

Registro de tiempo y coste.

Reportes al cliente.

5. OFFBOARDING — Cierre formal

Revisión final.

Entrega.

Conformidad del cliente.

Rectificaciones.

Adendas o ampliaciones.

Factura y cobro.

Archivo.

Preparación de una posible ejecución posterior.

6. AFTERCARE — Seguimiento posterior

Casos latentes.

Ejecuciones judiciales o materiales.

Recuperación de cantidades.

Información periódica al cliente.

Liquidaciones.

Satisfacción.

Reactivación o cierre definitivo.

## Navegación principal

El menú lateral incluye:

Inicio.

Leads.

Clientes.

Asuntos.

Las seis fases.

Tareas.

Calendario y plazos.

Documentos.

Comunicaciones.

Facturación.

Informes.

Configuración.

Dashboard

Incluye tarjetas visuales para:

Nuevos leads.

Presupuestos pendientes.

Asuntos activos.

Tareas pendientes.

Plazos urgentes.

Asuntos bloqueados.

Asuntos en cierre.

Casos latentes y ejecuciones.

Facturación pendiente.

Últimas actuaciones.

## Ficha del asunto

La ficha común reúne:

Cliente y asunto.

Materia.

Responsable.

Fase y estado.

Prioridad.

Próximo hito.

Cronología.

Tareas.

Documentos.

Comunicaciones.

Plazos.

Equipo.

Tiempo y coste.

Presupuesto y facturación.

Incluye un indicador visual del recorrido por las seis fases.

Diseño

La interfaz debe ser:

Profesional, sobria y moderna.

Clara y fácil de ampliar.

Orientada principalmente a ordenador.

Basada en azul oscuro, gris grafito, blanco y tonos neutros.

Con tarjetas, tablas, pestañas, checklists y cronologías.

Sin imágenes decorativas innecesarias.

## Dirección de producto

La plataforma debe conservar una interfaz profesional, sobria y ampliable, con especial atención a la privacidad, la trazabilidad y el control de acceso por despacho. Cada ampliación debe integrarse con el modelo de datos y las reglas de seguridad existentes.

## Development

### MCP de solo lectura

Base remota desactivada por defecto, con claves personales y permisos por despacho/registro.
Arquitectura y fases en [docs/mcp-project.md](docs/mcp-project.md); validación, publicación y
conexión en [docs/mcp-runbook.md](docs/mcp-runbook.md). La migración y la suite SQL requieren
validación aislada antes de habilitarlo; no incluye todavía UI de claves ni OAuth.

### Desarrollo local

Node.js >=22.18 y pnpm 11.25.0. Ejecutar todos los comandos desde la raíz del repositorio.
Instalar dependencias con `pnpm install --frozen-lockfile`.

| Comando                             | Acción                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                          | CRM (8080) y MCP (3001), con salida identificada por aplicación. |
| `pnpm dev:crm` / `pnpm dev:mcp`     | Solo una aplicación.                                             |
| `pnpm test`                         | Pruebas de ambas aplicaciones.                                   |
| `pnpm test:crm` / `pnpm test:mcp`   | Pruebas de una aplicación.                                       |
| `pnpm build`                        | Builds independientes de ambas aplicaciones.                     |
| `pnpm build:crm` / `pnpm build:mcp` | Build de una aplicación.                                         |
| `pnpm typecheck` / `pnpm lint`      | Comprobaciones de ambas aplicaciones.                            |

Cada aplicación carga únicamente su `apps/<app>/.env.local`. Los archivos de entorno existentes
del CRM se trasladan con la aplicación; no se copian al MCP. Su `/health` funciona sin claves,
pero `/mcp` permanece desactivado por defecto. Para habilitar el piloto, seguir el runbook.

### Despliegues separados

- CRM: conservar su plataforma actual. Usar el workspace raíz para instalar y ejecutar
  `pnpm build:crm`; el resultado está en `apps/crm/.output` (antes `.output`). Si la plataforma
  usa raíz de proyecto, apuntarla a `apps/crm` y permitir acceso a la raíz del workspace.
  El nombre del Worker de Cloudflare se conserva explícitamente en `apps/crm/vite.config.ts`.
  Revisar las rutas y variables del proyecto de hosting **antes de publicar** este cambio.
- MCP: Docker opcional, preparado en `apps/mcp/Dockerfile` y `compose.mcp.yaml`. También puede
  ejecutarse con Node mediante `pnpm build:mcp` y `pnpm --filter @lex/mcp start`.
  No necesita otro servidor físico: puede convivir con la web detrás de un proxy HTTPS.
- La autenticación PAT actual no garantiza compatibilidad con ChatGPT; OAuth sigue pendiente.

Preparación del contenedor, proxy, límites y conexión en [docs/mcp-runbook.md](docs/mcp-runbook.md).
La separación del código no aplica migraciones ni publica servicios automáticamente.
