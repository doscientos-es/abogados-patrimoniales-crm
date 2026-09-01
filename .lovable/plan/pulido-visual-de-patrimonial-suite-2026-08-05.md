# Pulido visual de PATRIMONIAL SUITE

Objetivo: homogeneizar el acabado de todas las pantallas ya creadas sin tocar la lógica de negocio, los datos ni la navegación. Solo capa de presentación.

## 1. Cabeceras y estructura de página

- Unificar todas las pantallas con el mismo contenedor y ritmo vertical: ancho máximo, separación entre bloques y padding idénticos en Inicio, CRM, Contactos, Oportunidades, Presupuestos, Expedientes, Actuaciones, Ejecuciones, Documentos, Alertas, Tareas, Actividades, Calendario, Facturación, Informes, SOPs y Configuración.
- `SectionHeader` pasa a ser responsive real: título truncable, acciones que no se salen en pantallas estrechas (rejilla en móvil, fila en escritorio).
- Añadir un contador o dato de contexto discreto junto al título donde ya existe (por ejemplo "X actuaciones"), con el mismo estilo en todas las pantallas.

## 2. Tarjetas de métrica

- Sustituir los bloques sueltos de `Card` con cifra (Alertas, Ejecuciones, CRM, Inicio) por un único componente de indicador con etiqueta en versalitas, cifra en tipografía serif y pie opcional.
- Colores por tono semántico (neutro, aviso, riesgo, éxito) usando los tokens existentes; nunca colores literales.

## 3. Kanban y tarjetas

- Igualar el aspecto de los tres kanbans (Oportunidades, Expedientes, Actuaciones, Documentos): mismo ancho de columna, cabecera de columna con nombre y recuento, fondo de columna diferenciado del lienzo, scroll horizontal con bordes suaves.
- Tarjetas con jerarquía constante: código del expediente arriba en tamaño menor, título en dos líneas máximo, metadatos en una línea, badges al pie.
- Estados de arrastre visibles: columna destino resaltada y tarjeta con elevación mientras se arrastra.

## 4. Tablas

- Cabeceras en versalitas, filas con separación cómoda, hover sutil, columnas numéricas alineadas a la derecha (importes, horas).
- Celdas de texto largo truncadas con ancho máximo coherente en todas las tablas.
- Estado vacío unificado con el componente `Vacio` en todas las tablas y listas.

## 5. Badges y semántica de color

- Un único criterio de tono para toda la app: éxito (verde), aviso (ámbar), riesgo (rojo), informativo (azul), neutro (gris). Revisar `ToneBadge`, `PriorityBadge`, `StatusBadge` y `PendingBadge` para que compartan tamaño, radio y peso tipográfico.
- "Pendiente de desarrollo" siempre con el mismo distintivo discontinuo.

## 6. Barra lateral y cabecera global

- Agrupar el menú por bloques con etiqueta: Visión general, Comercial, Operativa, Gestión, Sistema.
- Marcar correctamente la ruta activa en todas las secciones, incluidas rutas de detalle (una ficha de expediente deja Expedientes activo).
- Cabecera global con buscador y acciones alineados y sin desbordes en pantallas estrechas.

## 7. Responsive

- Aplicar el patrón rejilla + `min-w-0` + `shrink-0` a todas las cabeceras de ficha y filas mixtas de texto e iconos.
- Filtros: en móvil se apilan a ancho completo; en escritorio en fila.
- Pestañas de fichas con scroll horizontal en lugar de romper la maqueta.

## 8. Detalles finos

- Radios, sombras y bordes coherentes: tarjeta plana con borde, elevación solo en flotantes y arrastre.
- Transiciones cortas y sobrias en hover y foco; anillo de foco visible en enlaces y botones.
- Formato consistente de fechas e importes en toda la app mediante utilidades ya existentes.

## Notas técnicas

- Todo el trabajo en `src/styles.css`, `src/components/common.tsx`, `src/components/crm/ui.tsx`, `src/components/expedientes/ui.tsx`, `src/components/app-sidebar.tsx` y ajustes de clases en las rutas.
- Se mantiene la paleta actual (azul oscuro, grafito, blanco) y las fuentes IBM Plex; solo se afinan tokens de tono y espaciado si hace falta.
- No se modifican los stores, el modelo de datos ni los diálogos en su lógica; únicamente su presentación.
