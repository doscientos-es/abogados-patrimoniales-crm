# Etiquetas en Tareas: por qué no se ven y cómo arreglarlo

## Qué he comprobado

- El catálogo de etiquetas sí está creado y guardado: 10 etiquetas (Administración, Bancos, Cliente, Compras, Fiscal, Informática, Juzgado, Nóminas, Notaría, Personal), cada una con su color.
- Las 5 tareas de ejemplo existentes (TR-0001 a TR-0005) **no tienen ninguna etiqueta asignada**.

Por eso la pantalla parece "sin etiquetas": los chips solo aparecen cuando una tarea tiene al menos una, y no hay ninguna asignada todavía.

## Qué haré

1. **Etiquetas de ejemplo en las tareas**: asignar etiquetas coherentes a las tareas de muestra (por ejemplo Juzgado + Cliente en la de plazo de recurso, Cliente en el informe de resultado, Juzgado en la reclamación al juzgado, Bancos/Administración en las restantes), mediante una migración idempotente del almacén para que se apliquen también en sesiones ya existentes sin borrar datos.
2. **Visibilidad del acceso**: en la tarjeta y en la ficha de tarea, mostrar siempre el control "Añadir etiqueta" (ahora solo se percibe cuando ya hay chips), para que se pueda etiquetar desde el primer momento.
3. **Filtro y estado vacío**: dejar visible el filtro de etiquetas en la barra del tablero y añadir un texto guía cuando una tarea no tiene ninguna ("Sin etiquetas").

## Detalles técnicos

- `src/lib/expedientes-store.ts`: nueva migración con incremento de `version` que rellena `tareas[].etiquetas` con IDs del catálogo cuando el campo está vacío; sin tocar el resto del estado persistido.
- `src/components/tareas/etiquetas.tsx` y `src/components/tareas/ui.tsx`: mostrar siempre el disparador del selector y el placeholder "Sin etiquetas".
- Sin cambios de modelo ni de permisos; el resto del módulo de tareas queda intacto.
