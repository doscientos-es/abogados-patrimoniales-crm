# Viabilidad en Nuevo Lead

El alta guarda el Lead, avanza su fase y crea una única actuación con fecha y responsable en una sola transacción. El modal final siempre permite abrir la ficha. Los Leads anteriores al cambio no se reclasifican ni se borran.

- **Apto:** crea un aviso para concertar. En la ficha se registra la comprobación humana de conflicto antes de poder citar. La primera cita toma el relevo del aviso; si se cancela y no queda otra, el aviso vuelve a estar activo.
- **Pendiente:** la revisión tiene fecha y no se puede cerrar o cancelar por separado. Desde la ficha se reclasifica el Lead o se programa otra revisión con fecha.
- **No apto:** se exige un motivo del catálogo (o detalle para «Otro motivo»). Si hay plazo concreto, hace falta confirmar el aviso antes de cerrar; la fecha interna no sustituye el plazo. El despacho abre un borrador editable de correo o WhatsApp y confirma su envío tras hacerlo. LEX no envía automáticamente ni acredita recepción. Quedan registrados fecha, canal y usuario.

El vencimiento es el día elegido a las 17:00 de Madrid, no un plazo legal. Las alertas usan esa fecha, sin fijar un número de días no acordado. La ficha avisa si un APTO no tiene ni cita ni aviso activo.

## Verificación

El script `supabase/tests/lead_viability_workflow_regression.sql` comprueba las transiciones, las restricciones, el reintento, los dos canales y la recuperación del aviso. Usar una base de pruebas aislada; las filas ficticias se revierten. En interfaz, crear un Lead ficticio por rama y comprobar el resumen, las fechas y los cambios al recargar. No enviar las comunicaciones de la prueba.
