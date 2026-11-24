# Google Calendar · Citas del despacho

El CRM crea un evento privado al confirmar la fecha y hora de una cita. El evento incluye el título de la cita, los nombres del responsable y del equipo, y enlaces a la cita y a sus fichas de lead o expediente. El título puede contener datos introducidos por el equipo; no se envían notas ni el contenido del expediente. Google invita a los asistentes del despacho con una cuenta activa y un correo corporativo verificado en el CRM. Preparar una cita no envía invitaciones; reprogramarla o cancelarla desde el CRM actualiza o retira el evento. Los cambios que se hagan en Google no se importan al CRM.

## 1. Google: crear un calendario y autorizar el acceso

1. Con la cuenta de integración del despacho, abrir Google Calendar → **Configuración → Añadir calendario → Crear un calendario**. Crear `LEX · Citas`, zona horaria `Europe/Madrid`. Mantenerlo privado y no compartir permisos de edición. Copiar el **ID del calendario** desde **Integrar el calendario**; debe acabar en `@group.calendar.google.com`.
2. En el proyecto [Google Cloud](https://console.cloud.google.com/) del cliente, habilitar **Google Calendar API**. Se pueden reutilizar el proyecto y el cliente OAuth web de Drive, pero el token de Drive no autoriza Calendar.
3. En **Google Auth Platform**, usar audiencia **Interna** si el despacho usa Workspace y registrar el permiso `https://www.googleapis.com/auth/calendar.events.owned`. Si la aplicación es externa, completar la publicación y cualquier verificación requerida por Google; el modo Testing no es adecuado para producción porque el token puede caducar a los siete días.
4. Añadir `https://developers.google.com/oauthplayground` a las URI de redirección del cliente OAuth. Abrir [OAuth Playground](https://developers.google.com/oauthplayground/), activar **Use your own OAuth credentials** e introducir las credenciales del cliente. Pedir acceso **Offline**, autorizar el permiso anterior con la cuenta propietaria del calendario e intercambiar el código por un **Refresh token** específico para Calendar. No reemplazar el token de Drive.

No copiar secretos a Git, tickets, chat ni comandos. Introducirlos directamente en los formularios de OAuth y Supabase.

## 2. Supabase: configurar y activar

Verificar el proyecto Supabase enlazado para **Nuestro** antes de hacer cambios. En **Edge Functions → Secrets**, crear:

| Nombre                              | Valor                                                           |
| ----------------------------------- | --------------------------------------------------------------- |
| `GOOGLE_CALENDAR_REFRESH_TOKEN`     | Token offline autorizado por la cuenta propietaria              |
| `GOOGLE_CALENDAR_ID`                | ID de `LEX · Citas`                                             |
| `GOOGLE_CALENDAR_FIRM_ID`           | UUID exacto del despacho (`crm_firms.id`)                       |
| `GOOGLE_CALENDAR_STAFF_DOMAIN`      | Dominio corporativo exacto, sin `@`; no usar un dominio público |
| `CRM_GOOGLE_CALENDAR_WORKER_SECRET` | Secreto aleatorio y exclusivo, de 32 a 256 caracteres ASCII     |

Si Calendar usa el mismo cliente OAuth de Drive, la función reutiliza `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Para usar un cliente OAuth distinto, configurar juntos `GOOGLE_CALENDAR_CLIENT_ID` y `GOOGLE_CALENDAR_CLIENT_SECRET`; ambos tienen prioridad sobre los de Drive.

Los enlaces apuntan por defecto a `https://www.lex.eus`. Para otra instalación se puede configurar `CRM_PUBLIC_URL` con el origen HTTPS público del CRM.

Antes de aplicar migraciones, comparar el historial remoto con el repositorio: este proyecto tiene versiones históricas que no coinciden y no debe ejecutarse `supabase db push` a ciegas. Desplegar las funciones `google-calendar-sync` y `google-calendar-connection`. La primera valida una credencial de un solo uso; la segunda exige una sesión y un administrador activo del despacho.

En producción (`abogados-patrimoniales-crm`), las migraciones locales `20261124150000`, `20261124151000`, `20261124160000` y `20261124170000` se aplicaron con las versiones remotas `20261124164621`, `20261124164638`, `20261124164730` y `20261124173703`, respectivamente. No volver a aplicarlas al reconciliar el historial.

El secreto permanente permanece en Vault y nunca se coloca en la cola HTTP de `pg_net`. Cada llamada usa una credencial aleatoria que caduca a los dos minutos y se consume una sola vez. Un usuario con acceso directo a la cola podría anticipar esa llamada mientras siga vigente; limitar las conexiones directas a roles de confianza y mantener `net` fuera de los esquemas expuestos por la API, como recomienda [Supabase](https://supabase.com/kb/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).

Abrir **CRM → Configuración → Conexiones → Google Calendar** como administrador y pulsar **Probar conexión**. La prueba comprueba la autorización y acceso al calendario sin crear eventos. Una vez verificada, pulsar **Activar sincronización**: el servidor configura Vault con la URL y el secreto sin mostrarlos en el CRM. Al activarla se pueden enviar invitaciones de citas futuras ya confirmadas.

Como alternativa administrativa, las entradas de Vault son `crm_google_calendar_worker_url` y `crm_google_calendar_worker_secret`. La primera es la URL HTTPS de `google-calendar-sync`; la segunda es un secreto aleatorio independiente que solo utiliza la base de datos para emitir y verificar credenciales de un solo uso. Al activar desde el CRM se establece a partir de `CRM_GOOGLE_CALENDAR_WORKER_SECRET`; también puede generarse directamente en la base de datos sin mostrarlo. No copiarlas a tickets ni chat. El trabajo de Cron también debe activarse explícitamente.

Al confirmar, modificar o cancelar una cita, la base de datos solicita la sincronización después de guardar los cambios. Cron revisa la cola cada minuto como respaldo para reintentar errores. La migración encola también las citas futuras ya confirmadas, así que al activar la sincronización se pueden enviar invitaciones de citas existentes. Para pausar los nuevos envíos inmediatos y los reintentos, desactivar **`crm-google-calendar-sync`** en Supabase Cron; los cambios del CRM seguirán quedando en cola. Una llamada que ya esté en curso podría terminar después de la pausa. Evitar cambiar el ID del calendario después de empezar a sincronizar: cambiarlo no retira los eventos del calendario anterior.

## 3. Prueba de puesta en marcha

1. Confirmar una cita de prueba con uno o dos asistentes cuyo correo verificado del CRM coincida con su cuenta corporativa de Google. Comprobar el evento en `LEX · Citas` y la invitación en el correo de cada asistente.
2. **Comprueba la agenda personal:** Google decide si muestra la cita automáticamente según **Añadir invitaciones a mi calendario**. Si no se muestra, aceptar la invitación o añadir la cuenta de integración como remitente conocido. No hace falta conectar cada cuenta al CRM.
3. Reprogramar, reconfirmar y luego cancelar desde el CRM. Comprobar que no quedan duplicados y que Google notifica los cambios. Para evitar duplicados, no guardar también la misma cita con el botón manual de Google Calendar del CRM.
4. Si no se crea el evento, revisar el historial de Cron y `crm_google_calendar_jobs`: `last_error = 'google_auth'` indica que hay que revisar el OAuth; `calendar_request` apunta al calendario, sus permisos o una petición rechazada; `staff_email` indica que falta un correo verificado en el dominio configurado. Si el evento existe pero alguien no recibe invitación, revisar primero su cuenta activa, su correo verificado, el dominio y la configuración de invitaciones de Google.
