# LEX MCP en Supabase: preparación

Estado: adaptador Edge preparado, **deshabilitado y no desplegado**. Incluye escritura limitada
de borradores internos de texto con claves personales; **no es compatible con OAuth de ChatGPT**.
No usarlo con datos reales hasta probar la autorización, las migraciones y el flujo en un entorno aislado.

## Adaptador

- `supabase/functions/lex-mcp` reutiliza el mismo manejador y gateway que `apps/mcp`.
- La ruta HTTPS admitida es `/functions/v1/lex-mcp`, con origen canónico configurado.
- `LEX_MCP_ENABLED` debe permanecer desactivado. `LEX_MCP_PUBLIC_URL` debe contener la URL
  HTTPS exacta del entorno. La función usa `SUPABASE_URL` y `SUPABASE_ANON_KEY` de Supabase;
  no utiliza la clave de servicio. No registrar cabeceras ni cuerpos de peticiones.
- `verify_jwt = false` afecta solo a esta función: permite recibir la clave MCP, pero no
  autoriza peticiones. El manejador y la RPC deben validar la credencial en cada llamada.
- El empaquetado de imports desde `apps/mcp`, el origen de `Request.url`, las cabeceras y
  la ruta deben probarse con Supabase CLI y en un entorno aislado antes del despliegue real.

## Borradores internos

- `lex_save_internal_draft` guarda texto UTF-8 (hasta 65536 bytes) en un lead o expediente,
  visible en la sección Documentos de su ficha. Es un borrador pendiente de revisión, no un
  archivo PDF/Word ni un documento validado; no permite envío, firma ni publicación al cliente.
- Requiere una nueva clave con `drafts:write` y `leads:read` o `cases:read`, según el destino.
  Las claves antiguas no reciben escritura. La RPC vuelve a comprobar clave, membresía,
  alcance, despacho y acceso al expediente. Auditoría sin contenido y reintentos con UUID
  idempotente; reutilizarlo con otros datos se rechaza.
- La migración `20261113100000_mcp_internal_drafts.sql` deja el interruptor de escritura en
  base de datos apagado, también para llamadas directas a la RPC. Solo un operador autorizado
  puede habilitarlo tras los controles de despliegue, cambiando `enabled` a `true` en la única
  fila de `lex_mcp.draft_settings`; para detener escrituras, volverlo a `false`. El endpoint sigue
  deshabilitado por defecto.
- Aún no vincula el borrador directamente a un contrato o ejecución de procedimiento, no
  ofrece edición/validación desde la ficha ni exporta archivos. Las pruebas SQL preparadas en
  `supabase/tests/mcp-internal-drafts.sql` deben ejecutarse en base desechable antes del piloto.

## Bloqueos para ChatGPT y publicación

1. Elegir y verificar la integración OAuth 2.1 con ChatGPT. Supabase Auth ofrece OAuth para
   MCP y permite usar las cuentas existentes, pero documenta tokens con audiencia
   `authenticated`, sin scopes personalizados y con acceso completo de usuario. Hay que
   comprobar la compatibilidad con el requisito de audiencia del MCP y restringir el acceso
   directo a Supabase antes de usarlo. La clave personal actual no sustituye OAuth.
   Referencias: [Supabase Auth para MCP](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication),
   [flujos y scopes](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows) y
   [autenticación de OpenAI](https://developers.openai.com/plugins/build/auth).
2. Crear permisos independientes para contactos, documentos y compartición;
   no dar escrituras a credenciales existentes. El acceso directo a RPC también debe respetar
   esos permisos y la política de emergencia.
3. Definir la relación del documento con la ejecución del procedimiento o contrato del lead.
   Los documentos de expediente y contacto tienen flujos distintos; no asumir que uno de ellos
   cubre automáticamente ese caso. La entrega al cliente requiere canal y destinatario definidos.
4. Completar el flujo de revisión humana, edición/versionado y, para archivos, la limpieza de
   subidas incompletas. Una bandera enviada por el modelo no demuestra por sí sola la
   confirmación del usuario.
5. Ejecutar la migración y las pruebas SQL en una base desechable, y pruebas de aislamiento,
   autorización, revocación, concurrencia y protocolo con un cliente real antes de publicar.

No se ha ejecutado ninguna migración, ni creado claves, ni modificado el proyecto remoto.
