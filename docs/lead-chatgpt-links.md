# ChatGPT por usuario y Lead

El header de la ficha permite abrir ChatGPT y guardar un marcador privado de una conversación.
No crea conversaciones mediante una API, no transfiere datos del cliente y no conecta todavía el MCP.
La web no puede leer la URL de otra pestaña de ChatGPT por las restricciones entre dominios.

## Uso

1. Pulsa **Abrir con ChatGPT**, revisa el aviso y elige **Continuar a ChatGPT**.
2. Inicia la conversación en tu cuenta de ChatGPT y copia su URL privada de la barra de direcciones.
3. Vuelve a LEX, pega el enlace y pulsa **Guardar enlace**.
4. Las siguientes aperturas usarán ese enlace para tu usuario y ese Lead, también en otros dispositivos.

**Vincular chat** permite guardar una conversación existente sin abrir una nueva.
**Editar enlace de ChatGPT** permite sustituirla o desvincularla. Desvincular no borra el chat en OpenAI.
No se deben generar enlaces públicos con «Compartir» para datos confidenciales.
El enlace requiere acceso a la cuenta o workspace de ChatGPT que contiene esa conversación.
Lo que el usuario escriba o adjunte allí se trata en su cuenta de ChatGPT, bajo las condiciones
de esa cuenta. El despacho debe comprobar las autorizaciones, el contrato y las garantías aplicables.

## Lectura de documentos con LEXIA

Es un flujo distinto: al solicitar la lectura de un documento para un contacto, la aplicación envía
el archivo a la función `extract-contact-document` de Supabase, que lo remite a la API de OpenAI y
devuelve los campos propuestos. La petición a OpenAI incluye `store: false`; esto no permite afirmar
por sí solo que no haya retención ni que el procesamiento sea en el EEE. Deben verificarse el contrato,
la configuración de la cuenta, la residencia y las garantías de transferencia con los proveedores.
El proyecto de Supabase de producción figura en Londres (`eu-west-2`), fuera del EEE; esto no
determina por sí solo dónde procesa o conserva información cada proveedor externo.

Se aceptan URLs HTTPS privadas de `chatgpt.com` y `chat.openai.com`, también conversaciones de GPTs,
y deep links `chatgpt://c/<id>` o `chatgpt://conversation/<id>` copiados de la aplicación.
No se convierten URLs web en deep links: su soporte depende de la aplicación y el sistema operativo.
Los enlaces públicos, otros protocolos y las URLs con credenciales o parámetros se rechazan.

## Persistencia y puesta en marcha

- Aplicar `supabase/migrations/20261109120000_private_lead_chatgpt_links.sql` antes de usar el botón.
- La clave primaria es `(opportunity_id, user_id)`. La caché incluye despacho, Lead y usuario.
- La seguridad por fila exige ser el propietario del marcador y tener acceso al Lead según su RLS.
  Ni los administradores del despacho pueden leer los enlaces de otros usuarios a través de la aplicación.
- La tabla no se añade a feeds, eventos compartidos ni al MCP. No almacena credenciales de ChatGPT.
- Ejecutar `supabase/tests/lead_chatgpt_links_rls.sql` con una conexión administradora para probar
  aislamiento entre usuarios y despachos, upsert, desvinculación, miembros desactivados y acceso anónimo.
  Los fixtures se revierten mediante rollback.
- Los tests de interfaz usan los hooks reales y un cliente Supabase simulado; no sustituyen la prueba SQL.
