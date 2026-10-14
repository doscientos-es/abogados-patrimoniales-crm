# Sincronización del fork Lovable con Nuestro

## Objetivo

`sandbox` es la fuente de cambios de UX y flujo que el cliente sigue haciendo en Lovable; `nuestro` es la aplicación operativa. No se mezclan repositorios ni se copian pantallas a ciegas: cada flujo se adapta al modelo de datos, permisos, auditoría y experiencia de `nuestro`.

## Punto de partida

- Fecha de revisión: 2026-10-13.
- Sandbox: `HEAD` local `09c5af049b3f83e40f8feb8ece84a80df54155d9`; ref actualizada `origin/main` `1e243276d2d7037560bbf3de9df445a37d37f196`.
- Delta auditado inicialmente: `09c5af0..1e24327`; 427 commits, 137 archivos, 16.359 inserciones y 1.701 eliminaciones.
- Nuestro: los repositorios no comparten historial. La integración anterior se fusionó en `main` con PR #1 el 14/10/2026 (merge `345652f`).
- Antes de cada tanda, ejecutar `git fetch origin` en Sandbox y fijar el SHA fuente. El fetch actualizó las refs, no los archivos de trabajo.

### Revisión del delta del 14/10/2026

- SHA revisado: `1e243276d2d7037560bbf3de9df445a37d37f196..8ee981d` (13 commits, 12 archivos modificados/añadidos).
- Catálogos: implementados como pestañas de Configuración (`services`, `blocks`, `quoteTemplates`) reutilizando los hooks, RPC y RLS de Nuestro. Las rutas anteriores redirigen a la pestaña correspondiente para conservar enlaces guardados.
- Apertura de expediente: adaptado el diálogo simplificado y enlace de expediente. El botón automático al confirmar pago y la autorización con motivo para iniciar sin provisión permanecen intactos.
- Referencia: se muestra como estimación basada en expedientes cargados y se indica que Supabase asigna la definitiva. La asignación transaccional por despacho sigue en la base de datos.
- Compatibilidad con la BD: no se copió la transición automática `formal_start_scheduled`/`formal_start_completed` de Sandbox; Nuestro ya permite abrir con pago confirmado o excepción autorizada en `20261013154653_open_case_on_payment_or_authorized_exception.sql`.
- Revisión histórica: los cambios funcionales anteriores de la rama `sync/sandbox-1e24327` se fusionaron en `main` mediante PR #1 (`345652f`). El CI del PR detectó fallos de formato y lint en archivos históricos ajenos a la tanda; el typecheck, build y pruebas focalizadas de la tanda pasaron localmente.
- Los datos iniciales de servicios, bloques o plantillas no se importaron; requieren carga deliberada por el despacho.

### Revisión del delta posterior del 14/10/2026

- SHA revisado: `1e243276d2d7037560bbf3de9df445a37d37f196..a0ad560d576da3c9e1e58057b945e42393e73a0e` (28 commits; 15 paths en el delta acumulado).
- Catálogos, navegación y referencia estimada: ya cubiertos por PR #1. Sandbox añadió pantallas `localStorage`; Nuestro conserva el administrador conectado a Supabase, sus controles de despacho/RLS y redirects desde las rutas antiguas.
- Inicio de expediente: añadido selector de abogado al pago confirmado y a la excepción autorizada. La asignación usa `crm_open_onboarding_case`; una migración local nueva valida que el abogado pertenezca al despacho y esté activo.
- Traspaso: añadido corte de responsabilidad, documento RECIBÍ con confirmación explícita del receptor, persistencia de texto y fecha en el historial versionado del Lead, y cambios de titularidad mediante `crm_update_case` (con evento/versionado). Los antecedentes siguen en el expediente y las notas privadas; no se duplican campos locales de Sandbox.
- Compatibilidad: los traspasos históricos sin fecha siguen mostrando la fecha de aceptación como fallback. La migración SQL protege la nueva asignación desde onboarding; queda pendiente probar/aplicar el esquema en el proyecto Supabase correcto. No se modificó ninguna base remota.
- Validación local: typecheck, build y 15 pruebas focalizadas pasan. `pnpm run quality` queda bloqueado por 144 archivos preexistentes con diferencias de formato; la base local no pudo arrancarse porque este equipo no tiene Docker/Podman.
- Sin datos ficticios ni catálogos importados. Sandbox permanece intacto.

### Intervinientes de expedientes (14/10/2026)

- SHA revisado: `a0ad560d576da3c9e1e58057b945e42393e73a0e..af1bb94f4da1c79092711e2013ee27fe4141d89b` (12 paths en el delta acumulado).
- Adaptación: panel agrupado en Resumen, clasificación de roles antiguos, contactos subordinados, alta/edición, reordenación, retirada lógica con conservación del contacto e identificación de posibles duplicados.
- Persistencia: `crm_case_participants.details` (JSONB) guarda tipo, referencia, descripción, orden, titular/profesional y retirada; se mantiene el `role` existente para compatibilidad. No se requieren columnas ni migraciones nuevas.
- Entorno real contrastado en `abogados-patrimoniales-crm`: RLS habilitada, política `crm_can_access_case(case_id)` para participantes y trigger `crm_case_participants_event` para dejar eventos. La UI usa el cliente Supabase autenticado y las operaciones existentes quedan acotadas a despacho y expediente.
- Compatibilidad: `?tab=participants` lleva a Resumen y desplaza al panel; expedientes existentes conservan la clasificación y siguen mostrando contactos ya registrados.
- Sin escrituras de prueba en producción ni cambios en Sandbox.

## Rutina para cada tanda

1. Acordar el commit de Sandbox que se quiere incorporar y registrar el último SHA ya revisado/incorporado.
2. Revisar el delta entre ambos SHAs; agrupar archivos en flujos y asignar a cada uno una decisión: **implementar**, **ya cubierto**, **adaptar/parcial**, **no aplica** o **requiere decisión**.
3. Crear una rama de integración en Nuestro (`sync/sandbox-<sha-corto>`); mantener los cambios de cada flujo en commits pequeños y revisables.
4. Para cada flujo, comparar comportamiento y criterios de aceptación, no solo nombres de archivos. Traducir operaciones de prototipo a Supabase/RPC/RLS, membresías, control de versión y auditoría de Nuestro.
5. Revisar migraciones por separado: contrastar esquema, permisos, datos existentes y orden; probarlas en un entorno de desarrollo. No aplicar migraciones al proyecto remoto como parte automática de la sincronización.
   Si existe autorización expresa para aplicar una migración remota, conservar el SQL en `supabase/migrations` y ajustar su prefijo al `version` que devuelva Supabase. Así el historial local no intenta volver a aplicar una migración registrada con una marca de tiempo distinta.
6. Ejecutar pruebas del flujo, controles de calidad y un recorrido manual por rol. Registrar resultado y actualizar este documento antes de avanzar al siguiente lote.
7. Marcar la tanda completa solo cuando cada cambio del delta tenga decisión y evidencia; entonces actualizar el SHA de último origen revisado.

## Resultado por flujo

| Flujo                           | Decisión y destino en Nuestro                                                                                                                                   | Evidencia principal                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Contactos y documentos          | Adaptado a almacenamiento privado, NIF opcional por despacho y controles RLS existentes.                                                                        | Migración `20261013130822`; contrato `contact_tax_id_contract.sql`; pruebas focalizadas de documentos. |
| Tareas y avisos                 | Incorporado: asignación, espera, avisos y refresco en tiempo real usando los RPC y tablas del CRM.                                                              | Migraciones `20261013143515`, `20261013143539`; contratos y tests de tareas.                           |
| Presupuesto y aceptación        | Editor versionado en la ficha del Lead; revisión, envío externo registrado y aceptación online limitada por token.                                              | `quote-editor.tsx`, `quote-acceptance-panel.tsx`, contrato `quote_acceptance_contract.sql`.            |
| Proforma y notas privadas       | Proforma ligada al Lead y al onboarding; notas privadas reutilizan notas persistentes y su RLS, marcadas como presupuesto.                                      | `proforma-card.tsx`, `quote-internal-notes.tsx`, contrato `onboarding_proforma_contract.sql`.          |
| Primera cita y cualificación    | Adaptado en pestaña del Lead, con programación, estados, asistentes, cierre, notas y transcripción persistente; se conservan las decisiones de negocio.         | `lead-first-meeting-tab.tsx`, `first-meeting-assistant.tsx`, `first-meeting-workspace.tsx`.            |
| Onboarding, pago y expediente   | Adaptado a hitos derivados, evidencia privada y apertura/traspaso con permisos y motivo auditado.                                                               | Migración `20261013154653`; `onboarding-workflow.ts`; tests de onboarding y traspaso.                  |
| Servicios, bloques y plantillas | Sustituido `localStorage` por catálogos Supabase por despacho, RLS, roles de gestión e importadores validados; editor de presupuesto consume servicios/bloques. | Migraciones `20261013164719`, `20261013165152`; `quote_catalogs_contract.sql`; tests de catálogo.      |

### Inventario de paths sin correspondencia directa (33/137)

La ausencia de un path idéntico no significa que falte el flujo: se registra aquí su decisión, destino y evidencia. Los datos iniciales de catálogo no se han sembrado en producción; cargar precios de Holded o cláusulas legales queda pendiente de autorización explícita.

| Path del delta Sandbox                                                                     | Decisión / destino en Nuestro                                                                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.lovable/plan/avisos-al-asignar-responsabilidad-mediante-tareas-revisión-y-2026-10-06.md` | Nota de planificación Lovable; comportamiento adaptado en tareas, avisos y contratos SQL, no se copia como especificación ejecutable. |
| `.lovable/plan/diagnóstico-notas-del-abogado-en-preparar-presupuesto-sin-ca-2026-10-07.md` | Nota de diagnóstico; resuelto con `QuoteInternalNotes`, persistencia de notas y `quote-internal-notes.test.tsx`.                      |
| `.lovable/plan/diagnóstico-plantillas-en-enviar-al-cliente-sin-cambios-2026-10-06.md`      | Nota de diagnóstico; textos de plantilla se gestionan en el catálogo persistente de Nuestro.                                          |
| `bun.lock`                                                                                 | No aplica: Nuestro fija pnpm y conserva `pnpm-lock.yaml`; no se mezclan gestores de paquetes.                                         |
| `roadmap.md`                                                                               | Roadmap del fork no se copia como plan operativo; la rutina de integración vive en este documento.                                    |
| `src/assets/logo-abogados-patrimoniales.jpg.asset.json`                                    | Adaptación visual: proforma de Nuestro usa el recurso de marca existente `public/logo-lex.svg`.                                       |
| `src/assets/qr-abogadospatrimoniales.png.asset.json`                                       | Recurso específico de Sandbox no importado; no afecta a persistencia, cálculo ni descarga de proforma.                                |
| `src/features/bloques/bloques-encargo.json`                                                | Importable en `/bloques-encargo` a la tabla `crm_engagement_blocks`; no sembrado automáticamente.                                     |
| `src/features/bloques/bloques-store.ts`                                                    | Sustituido por `supabase-quote-catalogs.ts` y RLS, sin almacenamiento local.                                                          |
| `src/features/bloques/bloques-store.test.ts`                                               | Contrato adaptado por `quote-catalogs.test.ts` y `quote-catalog-admin.test.tsx`.                                                      |
| `src/features/crm/application/quote-review-notice.test.ts`                                 | Cobertura integrada en `quote-editor.test.ts` y las pruebas de la revisión ligada a tareas.                                           |
| `src/features/crm/application/quote-send-date.test.ts`                                     | Cobertura integrada en `quote-send-task.test.ts` y el flujo de envío del editor.                                                      |
| `src/features/crm/ui/first-meeting-closing.test.tsx`                                       | Cobertura del cierre integrado en `lead-first-meeting-tab.test.tsx`.                                                                  |
| `src/features/crm/ui/first-meeting-data.tsx`                                               | Su resumen/edición se integra en el formulario completo de `lead-first-meeting-tab.tsx`.                                              |
| `src/features/crm/ui/first-meeting-workspace.test.tsx`                                     | Workspace adaptado y conectado a tarea persistente; cobertura desde tests de Primera cita y del workspace.                            |
| `src/features/crm/ui/force-onboarding-button.tsx`                                          | No se porta: Sandbox lo marca como atajo temporal solo de preview; Nuestro conserva los gates reales de aceptación/onboarding.        |
| `src/features/crm/ui/lead-created-dialog.tsx`                                              | Sustituido por `LeadNextActionDialog`, que crea tarea y marca siguiente acción con reintento sin duplicar.                            |
| `src/features/crm/ui/no-next-action-warning.tsx`                                           | Aviso adaptado en ficha/dashboard CRM, con acción para definir una tarea real.                                                        |
| `src/features/crm/ui/quote-acceptance-dialog.test.tsx`                                     | Aceptación adaptada a panel interno y página pública tokenizada; cubierto por el contrato SQL de acceptance links.                    |
| `src/features/crm/ui/quote-editor-autocreate.test.tsx`                                     | Editor integrado en ficha operativa; cobertura en `quote-editor.test.ts` y `quote-editor.tsx`.                                        |
| `src/features/onboarding/application/onboarding-columns.test.ts`                           | Columnas derivadas cubiertas en `onboarding-workflow.test.ts` y `onboarding-milestones.test.ts`.                                      |
| `src/features/onboarding/application/onboarding-milestones.ts`                             | Lógica equivalente consolidada en `onboarding-workflow.ts`, sin duplicar estados.                                                     |
| `src/features/plantillas/plantillas-presupuesto.ts`                                        | Sustituido por `crm_quote_email_templates`, RLS, RPC para plantilla predeterminada e importador persistente.                          |
| `src/features/plantillas/plantillas-presupuesto.test.ts`                                   | Contrato adaptado por `quote-catalogs.test.ts` y pruebas del catálogo administrativo.                                                 |
| `src/features/servicios/servicios-catalogo.json`                                           | Importable como export de Holded desde `/servicios`; no sembrado automáticamente.                                                     |
| `src/features/servicios/servicios-store.ts`                                                | Sustituido por `crm_quote_services`, RLS por despacho y consumo desde el editor versionado.                                           |
| `supabase/pending/20261006214500_notify_task_assignment.sql`                               | Promovida/consolidada en `20261013143515_task_assignment_notifications_and_waiting_history.sql`; aplicada en remoto.                  |
| `supabase/pending/20261008100000_waiting_history_payload.sql`                              | Promovida/consolidada en `20261013143515_task_assignment_notifications_and_waiting_history.sql`; aplicada en remoto.                  |
| `supabase/pending/20261008120000_quote_acceptance_links.sql`                               | Migración gestionada `20261013143623_quote_acceptance_links.sql`; aplicada en remoto.                                                 |
| `supabase/pending/20261008150000_casework_on_payment_and_handoffs.sql`                     | Adaptada en `20261013154653_open_case_on_payment_or_authorized_exception.sql`; aplicada en remoto.                                    |
| `supabase/pending/20261008210000_realtime_boards.sql`                                      | Migración gestionada `20261013143539_realtime_boards.sql`; aplicada en remoto.                                                        |
| `supabase/pending/20261009090000_onboarding_start_without_provision.sql`                   | Consolidada con apertura autorizada de expediente en `20261013154653`; aplicada en remoto.                                            |
| `supabase/pending/20261009100000_contacts_tax_id_optional_unique.sql`                      | Adaptada a NIF opcional normalizado en `20261013130822_allow_multiple_contacts_without_tax_id.sql`; aplicada en remoto.               |

Las otras 104 rutas del delta se revisaron dentro de los siete lotes funcionales; no se copiaron en bloque cuando Nuestro ya tenía una implementación mejor alineada con su modelo. El inventario queda ligado al SHA de Sandbox de este documento; al avanzar el fork, repetir la comparación desde ese SHA.

### Migración adicional de proforma

Por autorización expresa, se aplicó al proyecto Supabase `abogados-patrimoniales-crm` la función versionada de registro del envío de proforma. Supabase asignó la versión `20261013185413`, ya alineada con `supabase/migrations/20261013185413_register_onboarding_proforma_sent.sql`. El contrato de seguridad se ejecutó después de aplicar la función y pasó; no se cargaron filas de catálogo.

## Puertas de calidad

- Nada que parezca guardado puede depender solo de `localStorage` o datos mock.
- Toda lectura/escritura respeta el despacho activo y RLS; las operaciones sensibles usan RPC con autorización, control de versión y eventos/auditoría cuando corresponda.
- Cada migración tiene prueba de contrato y se valida sobre una base de desarrollo antes de considerarla lista.
- Correr las pruebas focalizadas y `pnpm run check` desde `nuestro`; hacer recorrido manual con los roles afectados.
- Distinguir explícitamente **migración creada**, **probada en desarrollo** y **aplicada/verificada en remoto**. No declarar la última sin comprobarla en el proyecto correcto.
