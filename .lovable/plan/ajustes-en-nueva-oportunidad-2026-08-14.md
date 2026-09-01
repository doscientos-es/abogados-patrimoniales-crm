# Ajustes en «Nueva oportunidad»

## 1. Eliminar «Aclaración del rol (opcional)»

- Desaparece el campo de texto libre junto al «Rol en la oportunidad» en el bloque Contacto principal.
- También se retira el mismo campo en la ficha de la oportunidad (panel lateral, pestaña de contacto), para que no quede un campo huérfano.
- Los intervinientes adicionales dejan de mostrar aclaración de rol.

## 2. Bloque 4 «Origen de la oportunidad»: solo el origen

Se queda únicamente:
- **Origen** (selector con las opciones actuales) y, cuando el origen lo requiera, el campo «¿Quién ha recomendado?».

Se eliminan de esta pantalla: Medio de contacto, Título provisional del asunto, Área jurídica preliminar, Responsable y Prioridad. Al guardar, la oportunidad toma valores por defecto internos (título derivado del contacto, sin responsable asignado, prioridad media), sin pedirlos aquí.

## 3. Bloque 5: pasa a ser TAREAS

Se elimina el bloque de Conversación y en su lugar aparece el bloque **Tareas**, usando el módulo de tareas ya existente:
- Botón «Nueva tarea» que abre el formulario ordinario de tarea del módulo de Tareas, vinculada a esta oportunidad.
- Lista de las tareas añadidas (asignada a, fecha, estado) con opción de quitarlas antes de guardar.
- Las tareas se crean realmente en el módulo de Tareas al guardar la oportunidad, sin etiqueta ni estado especial.
- Se mantiene intacta la ventana «¿Siguiente acción?» tras guardar.

## 4. Bloque 6: NOTAS INTERNAS

Nuevo bloque final con el módulo transversal de Notas internas, en ámbito Oportunidad:
- Botón «Nueva nota» con el formulario de nota existente y muro de notas ya añadidas.
- Las notas quedan vinculadas a la oportunidad al guardar y son visibles después desde la ficha de la oportunidad y desde el módulo de Notas.

La conversación con bocadillos ya existente en la ficha de la oportunidad no se toca; solo desaparece del alta.

## Detalle técnico

- `src/routes/oportunidades.nueva.tsx`: quitar estado `aclaracionRol`, `medioContacto`, `titulo`, `area`, `responsable`, `prioridad` de la pantalla (con valores por defecto al crear); sustituir `<Conversacion>` por un bloque que use `NuevaTareaDialog` (`src/components/crm/task-dialog.tsx`) y añadir un bloque 6 con `NuevaNotaBoton`/`NotaMuro` (`src/components/notas/`).
- Tareas y notas se acumulan en estado local y se persisten mediante los stores existentes (`expedientes-store` para tareas, `notas-store` para notas) en el momento de guardar, con el id de la oportunidad recién creada.
- `src/components/crm/opportunity-panel.tsx`: eliminar el `Field` «Aclaración del rol».
- `src/data/pipeline.ts` y `src/lib/crm-store.ts`: se conserva `aclaracion` en el modelo por compatibilidad, sin interfaz que lo edite.
