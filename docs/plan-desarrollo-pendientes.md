# Plan de desarrollo — trabajo pendiente

**Actualizado:** 2026-09-03 · **Esfuerzo pendiente:** 420 h · **Objetivo:** piloto jurídico seguro y reproducible.

## Principios de ejecución

- No activar envíos, facturación real ni importaciones hasta completar pruebas E2E y aprobaciones.
- Toda funcionalidad respeta RLS por despacho, rol, concurrencia optimista y auditoría.
- Un plazo no se activa sin fuente, responsable y validación de `owner`, `admin` o `lawyer`.
- Cada bloque termina con migraciones, pruebas reproducibles, formato, lint, tipos y build en verde.

## Fase 0 — Documentos privados y versionados (en curso, 32 h)

**Entregables:** subida a Storage privado, metadata, SHA-256, versiones, URL firmada y limpieza de huérfanos.

**Pendiente concreto:** repositorio tipado, nueva versión desde UI, archivo, prueba RLS/Storage y regresión automatizada.

**Salida:** ningún archivo es público; cada descarga respeta permisos del expediente.

## Fase 1 — Identidad y frontera de seguridad (52 h)

| Orden | Tarea                                  | Est. | Entregables                                                                                  |
| ----: | -------------------------------------- | ---: | -------------------------------------------------------------------------------------------- |
|     1 | Altas, invitaciones y miembros         | 24 h | invitación administrada, suspensión/baja, permisos por acción y MFA sensible                 |
|     2 | Auditoría y pruebas RLS multi-despacho | 28 h | matriz de dos despachos × cuatro roles, vínculos cruzados, Storage y escalada de privilegios |

**Salida:** ningún usuario autenticado crea un despacho, se autoasigna privilegios o accede a datos/objetos de otro despacho.

## Fase 2 — Calidad y entornos (48 h)

| Orden | Tarea                           | Est. | Entregables                                                                                   |
| ----: | ------------------------------- | ---: | --------------------------------------------------------------------------------------------- |
|     3 | CI y puertas de entrega         | 20 h | instalación reproducible, formato, lint, tipos, build, tests, auditoría de dependencias y SQL |
|     4 | Staging y despliegue Cloudflare | 28 h | entornos separados, variables, Supabase staging, HTTPS/WAF y rollback probado                 |

**Salida:** una release candidata llega a staging sin datos reales y no puede saltarse controles de calidad.

## Fase 3 — Flujos jurídicos y comerciales P0 (112 h)

| Orden | Tarea                        | Est. | Dependencias                                            |
| ----: | ---------------------------- | ---: | ------------------------------------------------------- |
|     5 | Onboarding jurídico trazable | 32 h | contactos, oportunidades, documentos e identidad        |
|     6 | Comunicaciones persistentes  | 40 h | documentos, roles, proveedor transaccional y reintentos |
|     7 | Facturación, pagos y emisión | 40 h | onboarding, expedientes, permisos y reglas fiscales     |

### Hitos

1. **Onboarding:** checklist, evidencias, conflicto/KYC, responsables y bloqueo de activación.
2. **Comunicaciones:** hilos, idempotencia, adjuntos, triaje y estados; envío real bloqueado hasta E2E.
3. **Facturación:** borrador → revisión → emisión inmutable → pago parcial/cobro → rectificativa.

## Fase 4 — Pruebas de producto y piloto (88 h)

| Orden | Tarea                                | Est. | Entregables                                                                    |
| ----: | ------------------------------------ | ---: | ------------------------------------------------------------------------------ |
|     8 | Unitarias, integración y E2E         | 48 h | dominio, auth, RLS, migraciones, expedientes, documentos, plazos y facturación |
|     9 | Importación, UAT, formación y piloto | 40 h | importación idempotente, conciliación, guías, formación y go/no-go             |

**Salida:** UAT nominal firmado, conciliación aprobada, rollback conocido y piloto con un despacho.

## Fase 5 — P1 de operación segura (88 h)

| Orden | Tarea                                          | Est. | Entregables                                                |
| ----: | ---------------------------------------------- | ---: | ---------------------------------------------------------- |
|    10 | Privacidad, conservación y secreto profesional | 24 h | inventario, DPA, retención, derechos e incidentes          |
|    11 | Observabilidad y alertas seguras               | 24 h | errores/rendimiento, logs sin PII, alertas y runbooks      |
|    12 | Backups, restauración y runbooks               | 16 h | RPO/RTO, retención y restauración ensayada                 |
|    13 | Informes con datos reales                      | 24 h | métricas reconciliadas, paginadas y filtradas por despacho |

## Ruta crítica

1. Documentos → identidad/invitaciones → RLS automatizada.
2. CI y staging avanzan en paralelo una vez fijados identidad y entornos.
3. Onboarding depende de identidad/documentos; comunicaciones de documentos; facturación de onboarding.
4. Las pruebas se añaden por fase y se consolidan antes de UAT.
5. UAT/piloto empieza tras Fases 1–4; P1 no bloquea salvo riesgo crítico de privacidad, backup u observabilidad.

## Cadencia y control

- Inicio: contrato, migración reversible, amenazas/RLS y casos de prueba.
- Cada PR: permisos, ausencia de PII/secrets, documentación y checks CI.
- Semanal: demo con despacho, bloqueos, riesgos, coste y decisiones registradas.
- Go/no-go: despacho, responsable técnico y protección de datos confirman evidencia antes de producción.
