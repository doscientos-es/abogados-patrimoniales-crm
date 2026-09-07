# Auditoría para paso a producción

**Fecha:** 2026-09-07 · **Objetivo:** convertir LEX en un producto jurídico multiusuario seguro.

## Estado verificado

- Build, TypeScript y 13 pruebas unitarias pasan; no hay pruebas E2E.
- La puerta de lint estaba rota con 31 errores y no existía CI.
- Supabase productivo está activo y tiene aplicadas las 34 migraciones versionadas del repositorio.
- Hay autenticación, membresía por despacho, MFA, RLS y Storage privado, pero faltan cierres de revisión.
- El código todavía mezcla repositorios Supabase con semillas y stores operativos en `localStorage`.

## Backlog cruzado con Backoffice

| Orden | Trabajo pendiente | Estado MCP | Evidencia / cierre requerido |
| ---: | --- | --- | --- |
| 1 | CI y puertas de entrega | todo | Checkout limpio, calidad, estructura, tests, build y auditoría en verde |
| 2 | Documentos privados versionados | in_review | Cerrar revisión RLS/Storage, huérfanos, archivo y regresión |
| 3 | Invitaciones y miembros | in_review | Probar altas, suspensión, roles, MFA y CORS restringido |
| 4 | RLS multi-despacho | in_review | Resolver advisors y ejecutar matriz 2 despachos × 4 roles |
| 5 | Onboarding y SOPs trazables | todo | Sustituir `onboarding-store`, checklist, evidencias y conversión transaccional |
| 6 | Comunicaciones persistentes | todo | Sustituir `expedientes-store`, hilos, adjuntos, idempotencia y reintentos |
| 7 | Facturación, pagos y emisión | todo | CRUD, impuestos, serie, emisión inmutable, cobros y rectificativas |
| 8 | Pruebas unitarias/integración/E2E | todo | Auth, RLS, documentos, plazos, expediente, concurrencia y facturación |
| 9 | Staging y Cloudflare | todo | Entornos separados, variables, WAF, despliegue y rollback probado |
| 10 | Importación, UAT y piloto | todo | Importador idempotente, conciliación, formación y go/no-go firmado |
| 11 | Observabilidad segura | todo | Errores/rendimiento sin PII, alertas y runbooks accionables |
| 12 | Backups y restauración | todo | RPO/RTO, retención y restauración ensayada |
| 13 | Informes con datos reales | todo | Dashboard paginado, autorizado y reconciliado |

## Hallazgos adicionales no reflejados como tarea independiente

### P0 — bloquean piloto

- El inicio usa exclusivamente `src/data/crm.ts`; muestra métricas y fechas ficticias.
- Onboarding, comunicaciones y parte de notas/expedientes aún dependen de stores locales y semillas.
- Presupuestos son mayoritariamente documentales/demo y no tienen repositorio productivo completo.
- Facturación solo lee facturas y pagos; no crea, revisa, emite, rectifica ni registra cobros desde UI.
- No hay estrategia de paginación para listados; varias consultas descargan todas las filas.
- La Edge Function de invitaciones permite CORS `*`; debe limitarse a orígenes autorizados.
- La protección de contraseñas filtradas de Supabase Auth está desactivada.
- Los advisors señalan funciones `SECURITY DEFINER` expuestas; hay que separar RPC públicas
  intencionales de helpers internos y revocar las demás.
- Falta verificar la exposición Data API de tablas antes del cambio obligatorio de Supabase.

### P1 — operación profesional

- Hay decenas de claves foráneas sin índice y una política RLS que reevalúa `auth.uid()` por fila.
- No existe cobertura, umbral mínimo ni informe de tests; solo 13 casos en cuatro ficheros.
- No hay gestión de consentimientos/KYC/conflicto completamente persistente ni firma electrónica.
- No hay antivirus real ni cuarentena de documentos, solo validación de metadatos/contenido.
- Falta correo transaccional real, webhooks de entrega, WhatsApp y bandeja de fallidos.
- IA requiere política de retención, proveedor aprobado, trazabilidad y revisión humana persistente.
- Faltan accesibilidad automatizada, pruebas de teclado/móvil y presupuestos de rendimiento.

## Criterio de ejecución

Cada tarea se cierra solo con migración o código versionado, prueba reproducible, RLS/roles verificados,
errores y estados vacíos tratados, documentación actualizada y `pnpm check` en verde. No se activarán
envíos, emisión fiscal ni importaciones reales antes de staging, E2E y UAT.