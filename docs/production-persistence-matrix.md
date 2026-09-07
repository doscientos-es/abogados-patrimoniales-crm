# Matriz de persistencia para producción

## Regla de decisión

- Los datos jurídicos, comerciales, financieros o de auditoría viven en Supabase y se aíslan por `firm_id` mediante RLS.
- No hay stores operativos en `localStorage`/`sessionStorage` ni semillas de desarrollo en el código de producción.
- Un error remoto produce un estado de error explícito; nunca activa datos simulados como fallback.

## Inventario y destino

| Dominio             | Persistencia productiva                                    | Estado de interfaz                                    |
| ------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| Despacho y miembros | `crm_firms`, perfiles y membresías                         | Configuración, roles, invitaciones y MFA remotos      |
| Contactos           | `crm_contacts`                                             | Listado, alta, ficha, edición y archivo remotos       |
| Leads               | `crm_opportunities`, eventos y RPC de transición           | Alta, edición, fases y archivo remotos                |
| Expedientes         | `crm_cases`, participantes, líneas, actividades y eventos  | Alta, edición y relaciones remotas                    |
| Tareas y plazos     | `crm_case_tasks`, validaciones y eventos                   | Alta, cierre y validación remotos                     |
| Documentos          | `crm_case_documents` y bucket privado `case-documents`     | Subida, descarga firmada, versión y archivo remotos   |
| Notas               | `crm_notes`, contactos, permisos, confirmaciones y eventos | Consulta remota; no existe fallback local             |
| Facturación         | `crm_invoices`, líneas y pagos                             | Consulta y resumen remotos                            |
| Módulos no migrados | Sin persistencia activa                                    | Deshabilitados explícitamente; no muestran datos demo |

## Criterios de cierre por dominio

- Dos usuarios del mismo despacho observan el mismo cambio desde navegadores distintos.
- Otro despacho no puede leer, modificar ni enlazar el registro, incluido Storage.
- Recargar o limpiar el almacenamiento del navegador no elimina datos operativos.
- Los fallos remotos se muestran al usuario y no activan una semilla demo silenciosa.
- Cada mutación crítica tiene prueba de integración, auditoría y control de concurrencia.
