# Verificación de aceptación por correo

El código se envía únicamente al destinatario del envío registrado para esa versión, que se fija al generar el enlace. No se usa una dirección introducida por quien abre el enlace. Los enlaces anteriores a la migración no tienen destinatario fijado y deben regenerarse. Las aceptaciones anteriores no se modifican.

El código caduca a los 10 minutos, admite cinco intentos y se limita a cinco solicitudes por hora y enlace, separadas al menos un minuto. Se guarda solo un hash del código ligado al token, no el código en claro. Tras aceptar se registra un evento con enlace, destinatario y fecha de verificación. Se conserva el nombre declarado y el user-agent; el acceso al correo no demuestra identidad legal ni constituye una firma cualificada. La IP y el hash del PDF siguen pendientes.

## Antes de activar

1. Revisar y ejecutar las pruebas SQL de contratos y regresión en una base local desechable, con autorización; no se han ejecutado. Comprobar el flujo completo y el control de abuso del endpoint público, incluidos límites adicionales por IP en el perímetro.
2. Confirmar en Resend el dominio y remitente autorizado. Configurar en los secretos de la función `RESEND_API_KEY` y `RESEND_FROM_EMAIL`, sin colocarlos en el código ni en el navegador. Supabase proporciona sus credenciales de servidor a la función.
3. Coordinar el despliegue: aplicar primero la migración `20261127074654_quote_acceptance_email_verification.sql`, desplegar `send-quote-verification-code` con `verify_jwt = false` y finalmente publicar el CRM. La migración revoca el acceso público al procedimiento antiguo: la aceptación online quedará temporalmente indisponible hasta publicar la nueva versión. No publicar primero el CRM como si protegiera el procedimiento antiguo.
4. Probar con un presupuesto y buzón de prueba autorizados: solicitud, reenvío, código erróneo, caducidad, aceptación y constancia. No enviar códigos de prueba a clientes reales.

Si el proveedor no está configurado o falla, la función no confirma el envío ni permite aceptar sin código. Una respuesta satisfactoria del proveedor no garantiza la entrega al buzón.
