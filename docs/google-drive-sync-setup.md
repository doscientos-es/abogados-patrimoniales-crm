# Chuleta de llamada · Google Drive Sync

Objetivo: configurar la copia **CRM → Drive**. Los cambios hechos directamente
en Drive no vuelven al CRM.

> Usar **Google Cloud Console**, no Google Search Console. Nunca anotar secretos
> reales en este archivo, Git, chat o correo: van directamente a Supabase.

## Antes de empezar

- Cuenta que conectará Drive: `integraciones@despacho.com` (recomendada).
- Carpeta dedicada: `LEX · Expedientes`; no usar toda `Mi unidad`.
- ID de carpeta: en su URL, copiar solo el texto posterior a `/folders/`.
- El cliente ya creó el proyecto Google Cloud y te invitó por IAM.

## 1. Cliente: crear el proyecto y conceder acceso

1. En [Google Cloud Console](https://console.cloud.google.com/), crear un
   proyecto: `CRM LEX — Integración Drive`.
2. Abrir **IAM y administración → IAM → Conceder acceso**.
3. Invitar la cuenta Google de quien hará la configuración técnica.
4. Para la puesta en marcha, asignar temporalmente el rol **Editor**.
5. Confirmar que la cuenta de integración tiene permiso de editor en la carpeta
   raíz de Drive. Si la cuenta de integración es la propietaria, no es necesario
   compartirla adicionalmente.

URL directa: <https://console.cloud.google.com/iam-admin/iam>

## 2. Técnico: activar la API de Drive

1. Entrar con la cuenta invitada y seleccionar el proyecto del cliente arriba.
2. Abrir **APIs y servicios → Biblioteca**.
3. Buscar **Google Drive API**.
4. Abrirla y pulsar **Habilitar**.

URL directa: <https://console.cloud.google.com/apis/library>

**No crear una API key.** La integración usa OAuth 2.0.

## 3. Técnico: configurar consentimiento OAuth

Abrir **Google Auth Platform** (antes: **APIs y servicios → Pantalla de
consentimiento OAuth**). URL: <https://console.cloud.google.com/auth/overview>

Completar los datos siguientes:

| Campo                                 | Valor recomendado                                       |
| ------------------------------------- | ------------------------------------------------------- |
| Nombre de la aplicación               | `LEX CRM`                                               |
| Correo de asistencia                  | Correo corporativo del despacho                         |
| Correos de contacto del desarrollador | Correo técnico del despacho y/o del responsable técnico |
| Audiencia con Workspace               | **Interna**                                             |
| Audiencia sin Workspace               | **Externa**                                             |
| Scope de Drive                        | `https://www.googleapis.com/auth/drive`                 |

No añadir otros scopes.

### Si la audiencia es externa

- Mientras la aplicación esté en **Testing**, añadir la cuenta
  `integraciones@despacho.com` como usuario de prueba.
- No usar Testing como solución definitiva: las autorizaciones/tokens de prueba
  pueden expirar. Antes de producción, publicar la aplicación y completar la
  verificación que Google solicite para ese permiso de Drive.
- Con Google Workspace y audiencia **Interna**, solo las cuentas de esa
  organización podrán autorizarla y normalmente se evita una publicación
  pública.

## 4. Técnico: crear el cliente OAuth

URL: <https://console.cloud.google.com/apis/credentials>

1. Abrir **Google Auth Platform → Clients**. Alternativa: **APIs y servicios →
   Credenciales**.
2. Elegir **Crear cliente** y el tipo **Aplicación web**.
3. Usar como nombre `LEX CRM - Producción`.
4. Para la autorización inicial mediante OAuth Playground, añadir exactamente
   esta URI de redirección autorizada:

   `https://developers.google.com/oauthplayground`

5. Crear el cliente.
6. Abrir ese cliente y obtener los únicos dos datos iniciales necesarios:
   **Client ID** y **Client secret**.

El `Client secret` solo se utiliza como secreto de servidor. No descargar ni
subir el JSON de credenciales al repositorio.

> Cuando exista un flujo OAuth propio en el CRM, se sustituirá la URI de OAuth
> Playground por la URL de callback del CRM. No inventar ni registrar una URL de
> redirección distinta.

## 5. Cliente: aceptar la autorización una vez

Este paso debe hacerlo el cliente con la cuenta `integraciones@despacho.com`.
El técnico guía el proceso sin conocer su contraseña.

1. Abrir [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. En el icono de configuración, activar **Use your own OAuth credentials**.
3. Introducir el **Client ID** y el **Client secret** del cliente OAuth recién
   creado.
4. En Step 1, introducir el scope:
   `https://www.googleapis.com/auth/drive`
5. Pulsar **Authorize APIs**.
6. El cliente inicia sesión con la cuenta de integración y pulsa **Permitir**.
7. En Step 2, pulsar **Exchange authorization code for tokens**.
8. Guardar de forma segura el **Refresh token** que devuelve Google. No hace
   falta conservar el access token, pues es temporal.

La autorización se realiza una vez. El refresh token permite al CRM operar en
segundo plano mientras no se revoque el acceso, se elimine el cliente OAuth o
Google invalide el token.

## 6. Técnico: guardar en Supabase y conectar el CRM

**Ruta:** Supabase Dashboard → proyecto → **Edge Functions → Secrets**.

Crear estos secretos y pegar cada valor directamente:

| Nombre del secret      | Origen                        |
| ---------------------- | ----------------------------- |
| `GOOGLE_CLIENT_ID`     | Cliente OAuth de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Cliente OAuth de Google Cloud |
| `GOOGLE_REFRESH_TOKEN` | Paso de autorización OAuth    |

Después, desde la terminal del repositorio con el proyecto Supabase enlazado:

```powershell
supabase db push
supabase functions deploy sync-drive-document
supabase functions deploy configure-drive-connection
```

Abrir **CRM → Configuración → Google Drive**. Solo un propietario o administrador
puede hacer esta configuración.

1. Pegar el ID o URL de `LEX · Expedientes` en **Carpeta raíz de Drive**.
2. Pulsar **Verificar y conectar**.
3. La aplicación valida con Google que la cuenta conectada puede abrir esa
   carpeta y guarda la conexión para el despacho.

## 7. Validación de puesta en marcha

1. Crear o elegir un expediente de prueba en el CRM.
2. Subir un PDF pequeño desde el módulo Documentos.
3. Comprobar que Drive crea la carpeta del expediente bajo la carpeta raíz y
   que el archivo aparece allí.
4. Mover el documento a una subcarpeta desde el CRM y confirmar el movimiento
   en Drive.
5. Archivar el documento desde el CRM y comprobar que pasa a la papelera de
   Drive.
6. Revisar el estado de sincronización y los errores en el CRM/base de datos si
   alguna operación no termina correctamente.

## Hoja de control de llamada

Rellenar solo referencias no secretas y borrar los valores reales al terminar.

| Dato                                    | Valor     |
| --------------------------------------- | --------- |
| Proyecto Google Cloud (nombre / ID)     |           |
| Cuenta Drive conectada                  |           |
| URL de carpeta raíz                     |           |
| ID de carpeta raíz                      |           |
| Proyecto Supabase / ref                 |           |
| `firm_id`                               |           |
| Perfil CRM (`connected_by`)             |           |
| Prueba: subida / movimiento / archivado | ☐ / ☐ / ☐ |

## Si deja de funcionar

- El cliente puede revocar el acceso desde la seguridad de su cuenta Google o
  eliminando el cliente OAuth; esto detendrá la sincronización.
- Si el refresh token deja de ser válido, repetir solo los pasos 5 y 6.
- Mantener la carpeta raíz y la cuenta de integración activas. Si se cambia la
  carpeta, actualizar el `root_folder_id` del despacho antes de sincronizar.
