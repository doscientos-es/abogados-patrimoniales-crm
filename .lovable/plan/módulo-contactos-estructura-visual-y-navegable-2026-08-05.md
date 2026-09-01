# Módulo CONTACTOS — estructura visual y navegable

Primer módulo real del software: pantalla principal de Contactos y Ficha Personal completa,
solo maqueta visual con datos ficticios. Ninguna funcionalidad real, sin base de datos ni APIs.

## Navegación

- Nueva entrada "Contactos" en el menú lateral, en primer lugar del bloque principal.
- Rutas nuevas:
  - `/contactos` — listado general
  - `/contactos/$id` — ficha personal (pestañas por parámetro de búsqueda `?tab=`)
  - `/contactos/nuevo` — formulario de alta (maqueta)
  - `/configuracion` — se amplía con una pestaña "Contactos" para los catálogos editables
- Los módulos ya existentes (Leads, Clientes, Asuntos, etc.) se mantienen tal cual.

## 1. Listado de contactos

Tabla principal con: nombre / razón social, tipo (física o jurídica), categorías con color,
teléfono, correo, origen, satisfacción, estado documental, estado y última modificación.

Barra superior con buscador (nombre, apellidos, razón social, NIF, teléfono, correo),
filtros por categoría, estado, origen y nivel de satisfacción, y selector de orden
(nombre, categoría, fecha de creación, última modificación). Pestañas Activos / Archivados.

Botón "Nuevo contacto" y menú de acciones por fila: consultar, editar, guardar como borrador,
duplicar, archivar y eliminar (con diálogo de confirmación). Las acciones que no sean
navegación se muestran con el distintivo "Pendiente de desarrollo".

## 2. Cabecera de la ficha

Nombre o razón social, tipo de persona, categorías, teléfono y correo principales,
nivel de satisfacción, estado del contacto, indicador documental, avisos de reclamación
abierta o documento caducado, y botones Editar ficha / Archivar / menú de acciones.

## 3. Pestañas de la Ficha Personal

Estructura de pestañas ampliable:

- **Resumen** — tarjetas con datos principales, dirección, origen, canal preferido,
  satisfacción, últimas notas, fechas y autoría. Indicadores documentales (identificación,
  protección de datos, poderes). Espacios reservados vacíos para expedientes, presupuestos,
  facturas, comunicaciones, tareas y próximas actuaciones, marcados como pendientes.
- **Datos generales** — formulario maqueta con todos los campos indicados (persona física/jurídica,
  nombre, apellidos, razón social, NIF, nacimiento, profesión, teléfonos, correos, dirección
  completa, idioma, persona de contacto y cargo, observaciones), en modo lectura con opción
  visual de edición.
- **Datos bancarios** — bloque diferenciado visualmente por contener datos sensibles: titular,
  NIF, IBAN enmascarado con botón mostrar/ocultar, entidad, BIC, mandato SEPA y fecha, estado
  y observaciones. Aviso de acceso restringido por perfil y registro de cambios (maqueta).
- **Perfil** — subsecciones: origen del contacto, trato preferente, nivel de satisfacción con
  indicador e historial, recomendaciones (quién recomendó y a quién, con enlaces a otras fichas)
  y reclamaciones o incidencias con su estado.
- **Archivos personales** — tres categorías fijas (NIF e identificación, protección de datos,
  poderes y autorizaciones) más "Otros documentos", cada una como tabla con los campos y estados
  descritos, avisos de documento faltante o próximo a caducar, buscador y filtros, y zona de
  subida marcada como pendiente de desarrollo.
- **Notas internas** — listado cronológico de notas con título, contenido, autor, fecha,
  marca de destacada, filtros por autor y fecha, y acciones (crear, editar, archivar) en maqueta.

## 4. Configuración

Nueva pestaña "Contactos" dentro de Configuración con la estructura visual para administrar:
categorías (nombre, color, orden, activar/desactivar, archivar/eliminar), orígenes del contacto,
niveles de satisfacción, tipos de reclamación, tipos de documento, estados documentales,
países/provincias/idiomas y campos adicionales.

## 5. Datos de demostración

Se amplía el módulo de datos ficticios con unos 12 contactos variados (personas físicas y
jurídicas: clientes, notarías, procuradores, peritos, abogado contrario, proveedor, organismo),
con categorías múltiples, documentos en distintos estados, notas, recomendaciones y una
incidencia abierta.

## Notas técnicas

- Rutas TanStack en `src/routes/contactos.index.tsx`, `contactos.$id.tsx`, `contactos.nuevo.tsx`,
  cada una con su `head()` propio.
- Datos ficticios en `src/data/contactos.ts`; tipos exportados para reutilizar.
- Componentes reutilizables nuevos en `src/components/contactos/` (tabla, filtros, cabecera de
  ficha, campos de solo lectura, indicadores de estado, tabla de documentos).
- Se reutilizan los tokens de color y los componentes shadcn ya existentes; nuevos tokens de
  color solo si hacen falta para las categorías, definidos en `src/styles.css`.
- Todo elemento que requiera lógica real se marca con el componente `PendingBadge`/`PendingPanel`
  ya existentes. Diseño de escritorio y tableta.
