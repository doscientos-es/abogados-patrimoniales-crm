# LEX MCP: validación y publicación del piloto

## Estado y orden de trabajo

El código no basta para habilitarlo: migración local pendiente de ejecutar, sin UI de claves
ni OAuth todavía. No usar datos ni credenciales de producción para las pruebas. La primera
publicación es un piloto controlado para clientes con cabecera Bearer personalizada.

1. Crear una base Supabase local desechable con las migraciones del proyecto. No ejecutar
   `supabase db reset` contra un proyecto remoto ni reutilizar un entorno compartido.
2. Revisar y aplicar allí `20261109100000_mcp_readonly.sql`. `pgcrypto` debe estar en
   `extensions`, como en el proyecto comprobado. No añadir `lex_mcp` a los esquemas expuestos.
3. Ejecutar `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/mcp-readonly.sql` con conexión local
   en configuración protegida/PGPASSFILE, nunca contraseña ni URI secreta en argumentos.
   El test inserta fixtures y hace rollback; exige una base **desechable** y rol postgres.
4. Tests HTTP y adaptador Node, sin SSR: `pnpm test:mcp`. Después
   `pnpm --filter @lex/mcp typecheck`, `pnpm --filter @lex/mcp lint` y `pnpm build:mcp`.
   Para validar también la web tras cambios compartidos: `pnpm test`, `pnpm build`,
   `pnpm typecheck`, `pnpm structure:check` y lint/formato desde la raíz.
5. Probar permisos de ejecución reales `anon`/`authenticated`, no solo llamadas como postgres;
   concurrencia de contadores/revocación, borrado/bloqueo de usuario y latencia con volumen.
6. Obtener aprobación explícita para migración y despliegue del entorno elegido. Verificar de
   nuevo proyecto y estado remoto antes de aplicar. No ejecutar todos los SQL ciegamente.

## Configuración del servidor

| Variable                   | Uso                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `LEX_MCP_ENABLED`          | Solo el valor exacto `true` habilita `/mcp`; por defecto 404. Nunca variable `VITE_`.                |
| `LEX_MCP_PUBLIC_URL`       | URL HTTPS canónica terminada exactamente en `/mcp`, sin query/fragmento.                             |
| `SUPABASE_URL`             | URL del entorno elegido. Configuración propia del MCP, sin fallback a Vite.                          |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable del entorno. No service role, ni credencial personal de un usuario.                 |
| `HOST` / `PORT`            | Dirección de escucha; por defecto `127.0.0.1:3001`. Docker usa `0.0.0.0:3001` dentro del contenedor. |

El servicio Node carga `apps/mcp/.env.local` en desarrollo/inicio local; Docker recibe variables
en runtime. No lee `.env.local` del CRM ni usa Vite/Nitro/Cloudflare para ejecutarse.
El proxy termina TLS y debe conservar el `Host` público canónico, `Authorization`, `Accept`,
`Content-Type` y `MCP-Protocol-Version`. El adaptador construye el origen desde la configuración
y valida `Host`; ignora `Forwarded`/`X-Forwarded-*` del cliente. Rechaza queries y orígenes ajenos.
No habilitar CORS para sitios de terceros ni registrar cabeceras o cuerpos en el proxy.

### Docker y servidor independiente

1. Crear `apps/mcp/.env.local` desde `apps/mcp/.env.example` con valores del entorno aprobado.
   Configurar la URL pública HTTPS exacta; no introducir PAT ni claves de servicio en este archivo.
   Mantener `LEX_MCP_ENABLED=false` hasta validar migración, permisos y protección del proxy.
2. Desde la raíz: `docker compose -f compose.mcp.yaml build`. El contexto es la raíz del workspace;
   `.dockerignore` excluye entornos, CRM, historia Git y artefactos locales. La imagen final
   contiene únicamente la app MCP y sus dependencias de producción; corre como usuario no root.
3. Tras aprobar el despliegue: `docker compose -f compose.mcp.yaml up -d`. Solo publica
   `127.0.0.1:3001`: poner delante el proxy HTTPS con dominio propio y límites de petición.
   Si el proxy está en otro contenedor, usar una red privada compartida en vez de abrir el puerto
   a internet. No incorporar la web al contenedor MCP.
4. Comprobar `/health`: solo indica que el proceso responde, **no** que la base o los permisos
   estén listos. Probar `/mcp` y revocación con un usuario de prueba por el canal seguro del cliente.
5. Para iniciar sin Docker: `pnpm build:mcp` y `pnpm --filter @lex/mcp start`.

No es necesario otro servidor físico. Sí se necesita un endpoint HTTPS accesible por el cliente
remoto; un túnel sirve para desarrollo, no sustituye las medidas de producción. Este cambio
no despliega nada ni habilita OAuth; revisar la compatibilidad real del cliente antes del piloto.

## Protección de internet: requisitos previos

- HTTPS con HSTS, ningún proxy/CDN cacheando `/mcp`; respuestas llevan `no-store`.
- Gateway/WAF con límites por IP **antes** de autenticación, tamaño de cuerpo y timeout de
  lectura para evitar conexiones lentas. Limitar también el acceso público directo a la RPC
  Supabase si el proveedor lo permite; el límite por IP de `/mcp` no protege esa otra URL.
- El límite SQL es por clave y persistente: 120 invocaciones RPC/minuto. Una llamada normal de
  datos hace dos (autenticación + lectura); handshake, ping y lista hacen una. Máximo 50 filas.
- Rotar/revocar claves con regularidad y en cada incidente o baja; la pertenencia activa se
  consulta en cada operación. No compartir cuentas. Un PAT filtrado equivale a su titular.
- Desactivar captura de cabeceras, cuerpos y respuestas sensibles en proxy/APM/error capture,
  y en llamadas RPC de claves/lectura. `p_token` también es un secreto aunque viaje en JSON.
  No introducir claves en prompts, URLs, comandos, capturas, tickets, Git ni ejemplos reales.
- La auditoría privada registra titular, despacho, key id, operación, resultado y fecha, no
  contenido ni preguntas. Registra operaciones RPC válidamente autenticadas; rechazos HTTP
  previos no contienen una identidad comprobada. Métricas edge solo códigos/contadores.
- Definir retención y mantenimiento de auditoría/claves caducadas mediante un trabajo separado
  y aprobado. No existe purga automática en esta base; no activar una retención indefinida
  inadvertidamente. Revisar permisos de operación de esas tablas privadas.
- Aprobar proveedor/modelo y condiciones de confidencialidad/RGPD antes de exponer datos
  jurídicos a una IA. Filtrar campos no impide que descripciones contengan datos personales.

## Crear, conectar y revocar una clave (cuando se haya validado la migración)

La futura pantalla de Configuración usará una sesión LEX autenticada. Mientras no exista,
la emisión del piloto requiere un flujo interno controlado que consuma las mismas RPC:

- `crm_mcp_create_key(p_firm_id, p_label, p_scopes, p_expires_at)`: propietario siempre el
  usuario de la sesión, nombre de cliente, scopes mínimos y caducidad; devuelve secreto una vez.
- `crm_mcp_list_keys(p_firm_id)`: metadatos propios; owner/admin ve los del despacho, sin hashes.
- `crm_mcp_revoke_key(p_key_id)`: titular u owner/admin del despacho. Revocar no borra auditoría.

En el cliente compatible: transporte **Streamable HTTP**, URL pública `/mcp` y cabecera
`Authorization: Bearer <clave-personal>`, guardada en su almacén seguro, no en el prompt.
El cliente envía `Accept: application/json, text/event-stream`. No usar SSE antiguo ni stdio.
Primera prueba: `lex_whoami`, después búsqueda con límite pequeño. El usuario no puede escoger
otro despacho en los argumentos: necesita otra conexión personal emitida para ese despacho.

Si un cliente exige OAuth y no admite claves personalizadas, **no es compatible con este
piloto**: completar la fase OAuth del plan, no pegar una clave Supabase como solución alternativa.

## Errores y retirada

- 404: MCP desactivado. 401: clave inválida/caducada/revocada o cuenta sin acceso.
- 403: scope u origen insuficiente. 400/413/415/406: petición/protocolo/cuerpo no válido.
- 405: GET/SSE, DELETE u otro método no ofrecido; este servidor es sin estado.
- 429: esperar `Retry-After`. 503: configuración o servicio no disponible; sin detalles internos.
- JSON-RPC: `-32600` petición inválida, `-32601` método desconocido, `-32602` parámetros inválidos.

Ante incidente: desactivar `LEX_MCP_ENABLED`, revocar claves afectadas y revisar auditoría
privada sin exportar información jurídica. No borrar tablas ni deshacer migraciones con datos
como primera respuesta. Rehabilitar solo tras validar la causa y rotar los secretos afectados.
