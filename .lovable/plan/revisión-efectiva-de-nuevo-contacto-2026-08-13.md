# Revisión efectiva de “Nuevo contacto”

## Objetivo

Corregir y comprobar de extremo a extremo la pantalla `/contactos/nuevo`, asegurando que los cambios sean visibles en la ruta real y que el acceso **Dar de alta con IA** no se pierda.

## Estado comprobado

- La vista previa que está abierta actualmente se encuentra en `/` (Panel de inicio), no en `/contactos/nuevo`.
- La ruta servida `/contactos/nuevo` contiene actualmente el botón **Dar de alta con IA**.
- El código actual de esa ruta contiene selectores inicialmente vacíos, las cuatro naturalezas solicitadas y las seis relaciones solicitadas.

## Cambios y comprobaciones

1. Revisar la entrada de navegación hacia **Contactos → Nuevo contacto** para garantizar que conduce a `/contactos/nuevo` y no a otra vista o versión duplicada.
2. Mantener **Dar de alta con IA** como acción principal visible en la cabecera, con apertura del flujo documental de IA y aplicación de los datos validados al formulario.
3. Revisar literalmente toda la clasificación:
   - Naturaleza: Persona física, Persona jurídica, Órgano judicial y Público.
   - Relación: Lead, Cliente, Profesional / colaborador, Tercero, Contraparte y Proveedor.
   - Sin valores predeterminados y sin “Sin clasificar”.
4. Verificar los campos condicionales de cada naturaleza, especialmente **Número** y **Partido judicial** para Órgano judicial.
5. Comprobar que no aparecen Profesión, categorías, tipo específico ni rol de expediente en el alta general.
6. Probar en navegador la navegación completa desde Contactos, la apertura del panel de IA, la aplicación de datos y los ocho escenarios de validación solicitados.
7. Revisar por separado el botón **Crear contacto**: no se considerará terminado mientras no persista realmente el contacto; se informará con exactitud de su estado funcional.

## Criterio de aceptación

Desde la navegación normal de LEX se llega a `/contactos/nuevo`, se ve **Dar de alta con IA**, el panel abre y aplica propuestas validadas, y el formulario muestra exactamente la clasificación y campos acordados sin categorías añadidas.
