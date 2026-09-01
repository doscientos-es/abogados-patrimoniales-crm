# Nueva oportunidad: pantalla central, contacto principal y «¿Siguiente acción?»

Hoy "Nueva oportunidad" es un formulario en ventana/panel con campos en dos columnas (título, contacto, área, responsable, origen, medio, importe potencial, prioridad, descripción). Se sustituye por una pantalla propia, central y vertical, y se añade la ventana «¿Siguiente acción?» al guardar.

## 1. Pantalla propia y central

Nueva ruta `/oportunidades/nueva` (el botón "Nueva oportunidad" deja de abrir el panel lateral y navega a ella). Contenido centrado, ancho cómodo (máx. ~900 px), bloques verticales apilados, responsive en escritorio, tablet y móvil. Sin navegación lateral ni pasos.

Orden de bloques:

1. Contacto principal
2. Información inicial del asunto
3. Documentos iniciales
4. Origen de la oportunidad
5. Conversación y seguimiento inicial
6. Guardado
7. Ventana «¿Siguiente acción?»

## 2. Contacto principal (bloque destacado)

- Buscador de contactos existentes por nombre y apellidos, denominación social, DNI/NIE/NIF, teléfono y correo.
- Botón "Crear nuevo contacto": abre el alta de Contactos existente, avisa de posibles coincidencias antes de crear, y al volver regresa a Nueva oportunidad **conservando todo lo escrito** (borrador guardado en el navegador).
- Tarjeta del contacto seleccionado: iniciales/avatar, nombre o denominación, naturaleza, relación con el despacho, teléfono, email, avisos o notas internas, y botones "Abrir ficha completa" y "Cambiar contacto". Sin edición de datos estructurales aquí.
- Seleccionar el contacto **no** cambia su relación con el despacho.
- "Rol en la oportunidad": selector buscable con los 15 roles indicados (Interesado principal … Otro rol) más un campo de aclaración breve. El rol pertenece al par contacto–oportunidad.
- "Otros intervinientes" (opcional): buscar y vincular contactos existentes o crear uno nuevo, con rol provisional e identificación básica pendiente.
- Ningún campo obligatorio.

## 3. Información inicial del asunto

Sustituye "Descripción del asunto". Texto auxiliar indicado. Todos los campos son texto libre y opcionales:

- ¿Qué ha ocurrido? (área amplia, admite pegado y saltos de línea; si cambia sustancialmente se conserva histórico de versiones)
- ¿Qué solicita al despacho? (área amplia, visualmente diferenciada)
- Urgencia: exactamente las cuatro opciones indicadas; con "Sí, existe una fecha o plazo concreto" aparece un único campo de texto simple. Con cualquiera de las tres opciones de posible urgencia se muestra solo el aviso `POSIBLE URGENCIA — PENDIENTE DE REVISIÓN`.
- ¿Qué otras personas o entidades están relacionadas con el asunto? (texto libre)
- ¿Existe algún procedimiento, reclamación o actuación ya iniciada? (texto libre)
- ¿Qué documentación manifiesta tener o aporta el contacto? (texto libre)
- Observaciones internas del primer contacto (texto libre)

## 4. Documentos iniciales

Bloque propio con arrastrar y soltar, selección múltiple desde el dispositivo, lista de documentos añadidos con descripción breve opcional, eliminación antes de guardar, y apertura/descarga posterior. Los archivos quedan vinculados a la oportunidad, con nombre, fecha y autor, y se conservan sin duplicarse al convertir en expediente. Sin IA ni lectura automática.

## 5. Origen y eliminación de importe

- Se mantiene "¿Cómo ha llegado este contacto al despacho?" con las opciones configurables indicadas y, cuando proceda, selección del contacto o colaborador recomendante.
- Se elimina "Importe potencial" de esta pantalla, sin sustituto económico. No se tocan datos históricos ni otros módulos.

## 6. Conversación con bocadillos

La conversación y seguimiento inicial pasa a presentación de chat: contacto a la izquierda, despacho a la derecha, notas internas diferenciadas y eventos del sistema centrados y discretos. Cada mensaje muestra autor, fecha y hora, canal (Llamada, Email, WhatsApp, Presencial, Nota), contenido y adjuntos. Solo cambia la presentación; los registros existentes se conservan.

## 7. Guardado sin obligatoriedad

Se puede guardar aunque falte contacto, rol, información, urgencia, documentos u origen. Como máximo un aviso discreto de información pendiente: sin errores ni bloqueos ni puntuaciones.

## 8. Ventana «¿Siguiente acción?»

Tras guardar, diálogo con el texto indicado y las once opciones (Llamar al contacto … Crear otra tarea, Ahora no procede). Sin IA ni deducción.

- Al elegir una plantilla: se abre el formulario ordinario de Nueva tarea, vinculado a la oportunidad, con descripción precumplimentada y editable, responsable, fecha, recordatorio e indicaciones. La tarea resultante es una tarea normal, sin etiqueta ni estado especial.
- "Crear otra tarea": formulario en blanco, solo con la vinculación.
- "Ahora no procede" o cerrar la ventana: no se crea nada y se abre la ficha de la oportunidad.

## 9. Conversión en expediente

Al convertir, el contacto principal se incorpora a Intervinientes con su rol trasladado a "Rol con el expediente", revisable y modificable, sin duplicar el contacto y manteniendo su ficha única. Los documentos iniciales se trasladan sin duplicar.

## Detalle técnico

- Nueva ruta `src/routes/oportunidades.nueva.tsx` con subcomponentes en `src/components/oportunidades/` (buscador y tarjeta de contacto, información inicial, documentos, conversación en bocadillos, diálogo de siguiente acción).
- Ampliación de `OportunidadCRM` en `src/data/pipeline.ts`: `rolContacto` + aclaración, `otrosIntervinientes[]`, `informacionInicial` (con historial de versiones del relato), `urgencia`, `documentosIniciales[]`, `mensajes[]` con canal y dirección; `importeEstimado` se mantiene en el modelo por compatibilidad pero desaparece del alta.
- `src/lib/crm-store.ts`: `crearOportunidad` acepta los nuevos campos y todos opcionales; borrador persistido en `localStorage` para el ida y vuelta al alta de contacto; `convertirEnExpediente` traslada contacto principal, rol y documentos a Intervinientes/Documentos del expediente.
- Archivos gestionados en el navegador (object URLs / base64 ligero), coherente con el resto de la maqueta sin backend.
- Verificación final en la app en funcionamiento, punto por punto, de los criterios de aceptación.
