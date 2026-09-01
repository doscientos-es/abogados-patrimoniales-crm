# POWER — Arquitectura visual del CRM (primera entrega)

Prototipo navegable con datos ficticios. Esta entrega cubre **solo el bloque CRM**: captación, oportunidades, primera cita, presupuestos y su conversión. Expedientes queda como destino visual mínimo; el resto de módulos, como "Próximamente".

## Reorganización de lo existente

- Leads y Clientes desaparecen como secciones y se absorben en **Contactos** (el módulo de contactos y su ficha personal ya construidos se conservan tal cual y se amplían con las relaciones nuevas).
- Asuntos y Fases se sustituyen por **Expedientes** (en esta entrega: listado ficticio por fases + ficha básica, como punto de llegada de la conversión).
- **SOPs** se conserva como sección independiente.

## Menú lateral

Inicio · CRM · Contactos · Oportunidades · Presupuestos · Expedientes · Tareas · Actividades · Calendario · Documentos · Comunicaciones · Facturación y cobros · Informes · Configuración.

Los cuatro últimos bloques no CRM (Documentos, Comunicaciones, Facturación, Informes) muestran pantalla de "Próximamente" con su estructura anunciada. Botón global permanente **+ Crear tarea** en la cabecera, con modal maquetado.

## Pantallas de esta entrega

1. **Inicio**: tarjetas pulsables (tareas pendientes y vencidas, actividades de hoy, próximas citas, fechas críticas, oportunidades nuevas y sin seguimiento, presupuestos por elaborar / por validar / enviados, proformas pendientes de pago, expedientes activos y con actuaciones vencidas) más línea de actividad reciente. Cada tarjeta enlaza al listado filtrado.
2. **CRM**: panel comercial con embudo de conversión, indicadores (conversión, origen de contactos, motivos de pérdida), seguimientos pendientes y próximas primeras citas. Conmutador de vistas Kanban / Embudo / Tabla / Calendario.
3. **Oportunidades**: Kanban con las 16 columnas indicadas, vista tabla y vista embudo. Tarjeta con código, contacto, título, área, responsable, estado, prioridad, próxima actuación, fecha de seguimiento, última actividad, días en fase y alertas.
4. **Ficha de oportunidad**: cabecera con estado, responsable, próxima actuación, fecha, prioridad, alertas, conflicto de intereses, situación documental y de presupuesto. Pestañas: Resumen, Datos del asunto, Intervinientes, Análisis preliminar, Primera cita, Presupuesto relacionado, Tareas, Actividades, Documentos, Comunicaciones e historial, Notas internas. Acciones en modales maquetados: programar primera cita, registrar resultado, solicitar información, solicitar presupuesto, crear tarea, crear actividad, cerrar, convertir en expediente.
5. **Primera cita**: modal de programación (fecha, hora, duración, modalidad, lugar/enlace, responsable, asistentes, recordatorio, notas) con aviso visual de futura sincronización con Google Calendar; y modal de registro de resultado con resumen, interés, documentación revisada y pendiente, urgencias, valoración y próxima actuación.
6. **Presupuestos**: módulo propio con Kanban de los 18 estados y vista tabla; tipos (inicial, ampliación, adenda, recurso, ejecución, nueva fase, otro).
7. **Ficha de presupuesto**: código y versión, contacto, oportunidad/expediente, tipo, responsable, validador, estado, alcance, exclusiones, honorarios, forma de pago, provisión, vigencia, observaciones, historial de versiones y de validaciones, proforma y situación de pago. Acciones maquetadas incluidas las de validación. El estado "Enviado al cliente" solo se ofrece cuando la ficha muestra validación previa de Igor; en caso contrario aparece bloqueado con su explicación.
8. **Conversión en expediente**: pantalla/modal con la lista de comprobación (aceptación interna, sin conflicto, presupuesto validado, aceptación del cliente, proforma emitida, pago recibido o excepción autorizada), selector de excepción autorizada y botón "Abrir expediente / Iniciar onboarding" que lleva al expediente ya creado en los datos de demostración.
9. **Actividades**: listado y línea temporal con los tipos indicados, estado programada/realizada, responsable, elementos vinculados, resultado y próxima actuación.
10. **Tareas**: vistas Mis tareas, Equipo, Hoy, Próximas, Vencidas, Sin fecha, en Kanban, tabla y calendario.
11. **Calendario**: vistas día, semana, mes y agenda con citas, actividades, tareas con fecha, fechas críticas y vencimientos, con leyenda de colores y aviso de futura sincronización.
12. **Expedientes** (mínimo en esta entrega): listado por fases (Onboarding, Preparación, Case Work, Offboarding, Ejecución, Aftercare) y ficha con cabecera, recorrido de fases y pestañas anunciadas; contenido detallado marcado como próxima entrega.
13. **Configuración**: se añade la vista de perfiles de usuario (Administrador, Abogado responsable, Abogado colaborador, Administrativo, Consulta) con matriz de permisos solo visual.

## Datos de demostración

Un juego coherente que permita recorrer el flujo completo: contacto sin oportunidad, oportunidad nueva, con primera cita programada, con presupuesto solicitado; presupuestos pendiente de validación, devuelto para rectificación y enviado; proforma pendiente de pago; oportunidad lista para convertir; expedientes en onboarding, activo, en cierre y en aftercare; tareas vencidas y próximas; actividades realizadas y programadas.

## Diseño

Azul petróleo para navegación y acciones, fondos blanco y gris claro, verde apagado para completado, ámbar para pendiente, rojo discreto para vencido o bloqueo, azul claro para información. Sin sombras marcadas ni estética comercial. Tipografía actual del proyecto.

## Detalles técnicos

- Rutas TanStack nuevas: `crm`, `oportunidades` (index + `$id`), `presupuestos` (index + `$id`), `expedientes` (index + `$id`), `actividades`, y sustitución de `tareas`, `calendario`, `index`. Se eliminan `leads.*`, `clientes.*`, `asuntos.*`, `fases.$fase`.
- Datos ficticios en `src/data/crm.ts` (oportunidades, presupuestos, actividades, tareas, expedientes, usuarios), reutilizando los contactos de `src/data/contactos.ts`; `src/data/mock.ts` se recorta a lo que siga en uso.
- Componentes reutilizables nuevos en `src/components/crm/`: `KanbanBoard`, `FunnelChart`, `StageBadge`, `AlertPills`, `TimelineFeed`, `RelationList`, `EntityHeader`, `QuickTaskDialog`, `CalendarGrid`.
- Todo estático: sin backend, sin llamadas externas, botones de acción con modales o marcas de "Pendiente de desarrollo".
- Tokens de color en `src/styles.css`; cada ruta con su propio `head()`.
