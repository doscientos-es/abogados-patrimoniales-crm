# Matriz de persistencia para producción

## Regla de decisión

- Los datos jurídicos, comerciales, financieros o de auditoría viven en Supabase y se aíslan por `firm_id` mediante RLS.
- `localStorage` se limita a preferencias visuales no sensibles. Un borrador temporal puede usar `sessionStorage` si se elimina al guardar o abandonar.
- Las semillas de `src/data` solo están disponibles en desarrollo y nunca actúan como fallback cuando Supabase falla.

## Inventario y destino

| Dominio                 | Origen actual                                   | Destino productivo                                                    | Trabajo pendiente                                                                                                                                    |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contactos               | `LocalStorageContactosRepository` y `CONTACTOS` | `crm_contacts`                                                        | Listado, alta, ficha, edición general y archivado ya son remotos. Falta retirar el repositorio local y migrar secciones bancarias, archivos y notas. |
| Oportunidades           | `crm-store`, pipeline demo y lectura Supabase   | `crm_opportunities`, `crm_opportunity_events`                         | Completar mutaciones, transición RPC, concurrencia y eliminar fallback demo.                                                                         |
| Expedientes             | `expedientes-store` y semillas cruzadas         | `crm_cases`, `crm_case_participants`, `crm_case_workstreams`          | Crear repositorio, CRUD, asignación, versión y migración de relaciones.                                                                              |
| Actuaciones             | `expedientes-store`                             | `crm_case_activities`                                                 | Persistir alta, resultado, evidencias y próxima acción atómicamente.                                                                                 |
| Tareas                  | `crm-store` y `expedientes-store`               | `crm_case_tasks`                                                      | Unificar modelo, responsables, bloqueos, subtareas y estados.                                                                                        |
| Plazos y alertas        | `expedientes-store`                             | `crm_case_deadlines`, `crm_case_reminders`                            | Persistir validación profesional, recordatorios y auditoría.                                                                                         |
| Documentos              | metadatos en `expedientes-store`                | `crm_case_documents` + bucket `case-documents`                        | Subida privada, versión, URL firmada, permisos y limpieza de huérfanos.                                                                              |
| Comunicaciones          | `expedientes-store`                             | `crm_case_communications`                                             | Persistir hilos, destinatarios, adjuntos, estados e idempotencia de envío.                                                                           |
| Notas                   | `notas-store`; lectura remota parcial           | `crm_notes` y tablas de contactos, permisos, confirmaciones y eventos | Implementar mutaciones remotas y retirar semilla/localStorage.                                                                                       |
| Onboarding              | `onboarding-store`                              | `crm_onboardings`, pasos y evidencias                                 | Persistir máquina de estados y conversión transaccional a expediente.                                                                                |
| Facturación             | consultas Supabase parciales                    | `crm_invoices`, `crm_invoice_payments`                                | Completar borrador, emisión, rectificación, cobro e inmutabilidad.                                                                                   |
| Procedimientos          | datos remotos parciales                         | `crm_procedures`                                                      | Completar edición, relación con expediente y permisos.                                                                                               |
| Cumplimentación IA      | `ia-cumplimentacion-store`                      | sesiones y documentos IA por despacho                                 | Persistir solo metadatos necesarios, retención y revisión humana.                                                                                    |
| Borrador de oportunidad | `sessionStorage`                                | sesión del navegador                                                  | Se mantiene temporal; excluir adjuntos y limpiar tras guardar/cancelar.                                                                              |
| Vista de líneas         | `localStorage`                                  | preferencia local                                                     | Se mantiene: solo guarda `mapa` o `tarjetas`, sin datos personales.                                                                                  |

## Orden de migración

1. Desactivar semillas como fallback en builds productivos y añadir una bandera explícita de datos demo para desarrollo.
2. Completar contactos y oportunidades, ya que son dependencias de onboarding y expedientes.
3. Migrar expedientes, participantes, líneas, actuaciones, tareas y plazos en una única frontera de repositorios.
4. Migrar documentos y comunicaciones con operaciones idempotentes y compensación ante fallos parciales.
5. Migrar notas, onboarding, facturación, procedimientos e IA.
6. Eliminar stores locales operativos cuando cada ruta tenga lectura, escritura, RLS y pruebas E2E remotas.

## Importación idempotente

- Exportar cada store local a JSON versionado sin secretos de sesión.
- Validar el fichero con Zod y resolver referencias por claves externas estables, no por IDs generados en navegador.
- Importar por despacho en una transacción o lote reanudable con `source_id` único.
- Registrar creados, actualizados, omitidos y errores; una segunda ejecución no debe duplicar filas ni ficheros.
- Conciliar recuentos, importes, relaciones y hashes de documentos en staging antes de producción.
- Conservar una copia cifrada de la exportación hasta la aceptación y eliminarla según la política de retención.

## Criterios de cierre por dominio

- Dos usuarios del mismo despacho observan el mismo cambio desde navegadores distintos.
- Otro despacho no puede leer, modificar ni enlazar el registro, incluido Storage.
- Recargar o limpiar el almacenamiento del navegador no elimina datos operativos.
- Los fallos remotos se muestran al usuario y no activan una semilla demo silenciosa.
- Cada mutación crítica tiene prueba de integración, auditoría y control de concurrencia.
