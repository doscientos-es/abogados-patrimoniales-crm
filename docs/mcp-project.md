# LEX MCP: proyecto y operación

Estado: base de solo lectura implementada; **no publicada ni habilitada**. Migración pendiente
de ejecutar y probar en una base local desechable. No se han creado claves reales ni cambiado
datos remotos. Especificación de transporte fijada a MCP 2025-11-25; se negocian también
2025-06-18 y 2025-03-26. No se anuncia compatibilidad universal ni con versiones posteriores.

## 1. Objetivo y decisiones

Consultar LEX desde un asistente sin copiar toda la base ni conceder acceso administrativo.
Primera entrega: buscar y consultar leads, contactos, expedientes y metadatos de documentos.
No hay SQL libre, escrituras de negocio, envío, firma, generación de archivos, lectura del
contenido de documentos, enlaces firmados ni acceso a Drive. Sí se escriben claves, contadores
y auditoría: «solo lectura» se refiere a los datos de negocio.

**Identidad:** cuenta LEX existente + credencial personal específica del MCP. Nunca una clave
compartida por despacho, el correo declarado por el asistente, un `userId` del cliente, una
cookie del navegador o un JWT de Supabase reenviado como credencial MCP. Una clave atribuye
la operación a su titular: no demuestra qué persona física está escribiendo si la comparte.

**Objetivo para usuarios finales: OAuth 2.1 con PKCE S256.** Login y consentimiento, selección
de despacho, scopes mínimos, tokens cortos con audiencia del MCP y renovación rotatoria.
No construir un servidor OAuth casero. Elegir un proveedor compatible y verificar RFC 8707
antes de añadirlo; usar el mismo contrato de autorización y herramientas.

**Bloqueo de Supabase Auth como servidor OAuth del MCP:** sus tokens OAuth tienen por defecto
la audiencia `authenticated` y acceso a la API de la base con los permisos del usuario; sus
scopes estándar no limitan las operaciones de negocio. Además, el soporte de indicadores de
recurso RFC 8707 sigue pendiente según [supabase/auth#2610](https://github.com/supabase/auth/issues/2610).
No basta con habilitar su OAuth ni con aceptar esos JWT en el MCP: se perdería el aislamiento
de las credenciales de solo lectura. Mantener deshabilitada la conexión OAuth hasta elegir y
probar un proveedor con audiencia específica del MCP, identidad vinculada de forma segura a LEX,
permisos y revocación por usuario. Comprobar también la compatibilidad real con ChatGPT.

**Piloto inicial: PAT (clave personal)** de 256 bits, hash SHA-256 en esquema privado,
caducidad obligatoria de hasta 90 días, máximo 10 claves vigentes por usuario y despacho.
Es útil para clientes que permiten cabecera Bearer. No es OAuth ni permite prometer conexión
«solo pegar URL» en ChatGPT/Claude: depende de su soporte de autenticación personalizada.
No se han añadido dependencias nuevas; el transporte inicial es deliberadamente pequeño.

## 2. Arquitectura y límites de confianza

- `apps/mcp/src/domain`: contratos de identidad, scopes y puerto de lectura.
- `apps/mcp/src/application/tools.ts`: catálogo único para descubrimiento, validación y scopes.
- `apps/mcp/src/infrastructure/server/http-handler.ts`: Streamable HTTP sin estado, respuestas JSON.
- `apps/mcp/src/infrastructure/server/supabase-gateway.ts`: RPC con clave **publicable**, no service role.
- `apps/mcp/src/infrastructure/server/node-server.ts`: adaptador HTTP Node, límite de cuerpo y host.
- `apps/mcp/src/main.ts`: proceso independiente y cierre ordenado. `/health` es solo liveness.
- `apps/crm/src/server.ts`: únicamente web/SSR; no importa ni atiende el MCP.
- `20261109100000_mcp_readonly.sql`: emisión/listado/revocación y RPC de lectura acotada.
- `lex_mcp`: tablas privadas sin acceso directo para `anon` ni `authenticated` y con RLS.

Cada petición autentica la clave contra la pertenencia activa al despacho y una cuenta no
borrada/bloqueada. Cada herramienta de datos vuelve a comprobarlo, incluidos scopes y acceso
actual al registro. No se cachean permisos ni se confía en una sesión MCP compartida.
La RPC es `SECURITY DEFINER`: **no se afirma que las consultas ejecuten RLS automáticamente**.
Aplica filtros de despacho explícitos y reutiliza `crm_can_access_case` y
`crm_can_read_case_document` con identidad local derivada de la clave, restaurada al terminar.
La única RPC pública anónima valida esa clave; no permite elegir identidad ni ejecutar SQL.

Permisos actuales comprobados en el esquema remoto el 09/11/2026, sin leer datos de clientes:

| Recurso         | Autorización aplicada                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Leads/contactos | Scope correspondiente y pertenencia activa; lectura por despacho, como LEX actual. Archivados excluidos.                          |
| Expedientes     | Scope y helper vigente: owner/admin o creador/asignado.                                                                           |
| Documentos      | `documents:read` + `cases:read`, acceso al expediente **y** confidencialidad; solo versiones actuales, validadas y no archivadas. |

El MCP es más restrictivo que la política SELECT actual de metadatos documentales, que solo
comprueba acceso al expediente. No cambia esa política de la aplicación. Si se endurecen los
permisos de contactos/leads, actualizar también esta RPC y sus regresiones; es una frontera
explícita que requiere revisión, no una autorización genérica extensible sin control.

## 3. Acciones disponibles y valor

| Herramienta                               | Pregunta o uso                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `lex_whoami`                              | «¿Con qué cuenta, despacho y permisos estoy conectado?»                                           |
| `lex_search_leads` / `lex_get_lead`       | Localizar un lead y consultar estado, responsable y descripción para resumirlo.                   |
| `lex_search_contacts` / `lex_get_contact` | Identificar un contacto; correo/teléfono solo en detalle. Sin NIF, IBAN ni campos JSON completos. |
| `lex_search_cases` / `lex_get_case`       | Conocer fase, estado, situación y próxima acción de expedientes autorizados.                      |
| `lex_list_case_documents`                 | Comprobar los documentos disponibles de un expediente, sin descargar ni interpretar su contenido. |

Listados: `query` literal de hasta 120 caracteres, `limit` 1–50, `offset` 0–10000. Orden
`updated_at DESC, id`; devolver `nextOffset`, no inventar totales a partir de una página.
La paginación no es una instantánea: cambios concurrentes pueden mover registros. Detalle por
UUID; inexistente/no autorizado produce el mismo `record: null`. Campos narrativos acotados.
Las respuestas conservan identificadores y fechas para citar las fuentes; no son asesoramiento
jurídico verificado. Los datos recuperados nunca se deben obedecer como instrucciones.

## 4. Hoja de ruta y criterios de aceptación

### Fase A — Base técnica (esta entrega)

Catálogo y validación, endpoint HTTPS desactivado por defecto, PAT individuales, SQL fijo,
auditoría y límites persistentes. Tests unitarios HTTP y suite SQL transaccional preparada.
Pendiente para cerrar la fase: **ejecutar migración y suite SQL en entorno aislado**, incluyendo
pruebas de roles reales, concurrencia, caducidad, revocación y cambios de permisos.

### Fase B — Piloto operable y publicación

1. Pantalla «Conexiones de IA» en Configuración: crear clave propia con nombre del cliente,
   despacho, scopes y fecha; mostrarla una sola vez y nunca guardarla en localStorage/analytics.
   Listar metadatos/último uso y revocar; owner/admin puede revocar conexiones de su despacho.
2. Consumir desde sesión LEX las RPC `crm_mcp_create_key`, `crm_mcp_list_keys`,
   `crm_mcp_revoke_key`. No forman parte de las herramientas MCP. La UI aún no está implementada.
3. Configurar entorno y gateway de internet; validar con MCP Inspector y dos usuarios/dos
   despachos de prueba. Probar también llamadas directas a RPC y ausencia de secretos en logs.
4. Aceptación: ningún acceso cruzado; clave revocada/usuario deshabilitado deja de funcionar
   en la siguiente petición; el usuario conecta un cliente compatible y obtiene una respuesta
   con referencia a LEX sin configurar una service key ni herramientas en su ordenador.

### Fase C — OAuth y conexión sin claves manuales

Proveedor aprobado, login LEX, consentimiento por cliente y despacho, PKCE, `state`, redirects
exactos, resource/audience del MCP, revocación y refresh rotatorio. Publicar metadata RFC 9728,
discovery del autorizador, desafíos `WWW-Authenticate` y scopes incrementales. No confundir
PAT actual con compatibilidad OAuth. Ningún token del asistente se reenvía como JWT de la BBDD.
Aceptar solo después de una prueba real con los clientes elegidos y una revisión de seguridad.

### Fase D — Consultas de mayor valor, todavía read-only

Resumen de lead con contacto y tareas permitidas; preparación de reunión; tareas vencidas y
plazos urgentes con zona horaria explícita; cronología y documentación pendiente; métricas de
pipeline mediante agregaciones autorizadas, no exportaciones masivas ni recuentos inventados.
Añadir cada herramienta con su caso de uso, scope, proyección mínima, límites y tests de acceso.
Para contenido documental: extracción aislada, clasificación/confidencialidad, presupuesto de
tamaño, referencias de página y revisión de prompt injection antes de habilitarlo.

### Fase E — Borradores y, por separado, escrituras

Primero contexto y plantillas aprobadas para minuta de reunión, solicitud de documentación,
resumen del lead y borrador de hoja de encargo. Señalar datos ausentes y citas; nunca inventar
hechos, fechas, importes, poderes ni fundamentos jurídicos. Revisión del abogado obligatoria.
Después, scopes nuevos para guardar **borradores**, idempotencia y control de versión; mostrar
vista previa y confirmación explícita. Envío/firma/presentación judicial fuera del alcance
inicial y con autorización adicional. Ninguna clave de lectura gana escrituras automáticamente.

## 5. Operación, publicación y conexión

Seguir [mcp-runbook.md](mcp-runbook.md). Un mismo repositorio contiene `apps/crm` y `apps/mcp`,
con dependencias, entornos y despliegues independientes. Comparten la misma base e identidad,
no un proceso de servidor. Docker es opcional y puede ejecutarse en el mismo servidor que
la web o en otro. El dominio real se decide al publicar: los dominios de ejemplo son ficticios.
No hay despliegue automático ni cambios en la configuración Supabase remota en esta entrega.

Decisiones del cliente antes de abrir el piloto: asistentes permitidos y sus contratos de
tratamiento de datos; contactos/leads visibles por despacho o por asignación; si todos los
miembros pueden emitir claves propias; retención de auditoría; MFA/step-up para emitir claves;
conjuntos de datos documentales permitidos y quién aprueba los futuros borradores.

Referencias: [transporte MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports.md),
[autorización MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization.md).
