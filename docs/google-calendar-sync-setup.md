# Google Calendar · Citas del despacho

El CRM crea una **Cita del despacho** en un calendario privado al confirmar la fecha y hora en el CRM. Google invita a los asistentes del despacho con una cuenta activa y un correo corporativo verificado en el CRM. No se envían nombres de clientes, notas, expedientes ni enlaces. Preparar una cita no envía invitaciones; reprogramarla o cancelarla desde el CRM actualiza o retira el evento. Los cambios que se hagan en Google no se importan al CRM.

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

Con el proyecto ya enlazado, revisar las migraciones con `supabase db push --dry-run` y aplicar las aprobadas con `supabase db push`. Desplegar con `supabase functions deploy google-calendar-sync`. Esta función valida el secreto propio de Cron en lugar de un JWT; no comparte el secreto con el CRM ni con Google.

En **Vault** de ese mismo proyecto, crear estas dos entradas al final, cuando ya se quieran enviar invitaciones:

| Nombre                              | Valor                                                             |
| ----------------------------------- | ----------------------------------------------------------------- |
| `crm_google_calendar_worker_url`    | URL HTTPS de la función `google-calendar-sync` del mismo proyecto |
| `crm_google_calendar_worker_secret` | El mismo valor que `CRM_GOOGLE_CALENDAR_WORKER_SECRET`            |

Cron procesa la cola cada minuto. La migración encola también las citas futuras ya confirmadas, así que al activar Vault se pueden enviar invitaciones de citas existentes. Para pausar nuevos envíos, desactivar **`crm-google-calendar-sync`** en Supabase Cron; los cambios del CRM seguirán quedando en cola. Evitar cambiar el ID del calendario después de empezar a sincronizar: cambiarlo no retira los eventos del calendario anterior.

## 3. Prueba de puesta en marcha

1. Confirmar una cita de prueba con uno o dos asistentes cuyo correo verificado del CRM coincida con su cuenta corporativa de Google. Comprobar el evento en `LEX · Citas` y la invitación en el correo de cada asistente.
2. **Comprueba la agenda personal:** Google decide si muestra la cita automáticamente según **Añadir invitaciones a mi calendario**. Si no se muestra, aceptar la invitación o añadir la cuenta de integración como remitente conocido. No hace falta conectar cada cuenta al CRM.
3. Reprogramar, reconfirmar y luego cancelar desde el CRM. Comprobar que no quedan duplicados y que Google notifica los cambios. Para evitar duplicados, no guardar también la misma cita con el botón manual de Google Calendar del CRM.
4. Si no se crea el evento, revisar el historial de Cron y `crm_google_calendar_jobs`: `last_error = 'google_auth'` indica que hay que revisar el OAuth; `calendar_request` apunta al calendario, sus permisos o una petición rechazada. Si el evento existe pero alguien no recibe invitación, revisar primero su cuenta activa, su correo verificado, el dominio y la configuración de invitaciones de Google.
