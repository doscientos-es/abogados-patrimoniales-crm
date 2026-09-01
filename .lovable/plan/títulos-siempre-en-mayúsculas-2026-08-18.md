# Títulos siempre en MAYÚSCULAS

Regla nueva y permanente de LEX: todos los títulos se muestran en mayúsculas, mediante estilo visual (el texto original se conserva en el código, así que buscadores y datos no cambian).

## Qué se ve afectado

- Título principal de cada pantalla (cabecera de sección).
- Títulos de tarjetas y paneles.
- Títulos de diálogos y fichas laterales.
- Cabeceras de columnas del Kanban y títulos de bloques internos.

Subtítulos, descripciones, textos de tablas y contenido normal se mantienen tal cual.

## Cómo se aplica

- Se añade `uppercase` (con ligero `tracking`) en los componentes base: `SectionHeader`, `CardTitle`, `DialogTitle`, `SheetTitle` y las cabeceras de columna del Kanban.
- Al aplicarlo en los componentes compartidos, cualquier pantalla futura hereda la regla automáticamente.
- Se revisan los títulos ya escritos a mano con clases propias para que no queden fuera de la regla.

## Nota

Se guarda como preferencia permanente del proyecto para que todo lo que se cree a partir de ahora nazca ya con títulos en mayúsculas.
