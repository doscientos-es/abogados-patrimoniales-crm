# LEX CRM · Abogados Patrimoniales

Aplicación web operativa para la gestión comercial y operativa de despachos de abogados patrimoniales. El producto evoluciona por fases, pero no es una maqueta ni un prototipo solo navegable.

## Alcance actual

- Autenticación, usuarios y pertenencia a despacho mediante Supabase.
- Gestión persistente de contactos, Leads, oportunidades y tareas.
- Pipeline comercial con trazabilidad de creación y cambios de fase.
- Módulos de expedientes, comunicaciones, documentos, calendario, facturación e informes en evolución.

Las migraciones de base de datos residen en `supabase/migrations`. La aplicación cliente utiliza exclusivamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; no incorpores claves de servicio, contraseñas ni datos reales al repositorio o a entornos de prueba.

La fuente de verdad del alcance P0/P1/P2, flujos, permisos, aceptación y Definition of Done es
[`docs/mvp-juridico-aprobado.md`](docs/mvp-juridico-aprobado.md).

Los datos de demostración deben identificarse de forma inequívoca y mantenerse separados de los datos reales del despacho.

## Modelo funcional

El ciclo de vida de cada asunto se divide en seis fases:

1. LEAD — Captación

Contacto inicial.

Calificación del potencial cliente.

Primera cita.

Presupuesto.

Aceptación y pago inicial.

Conversión en cliente.

2. ONBOARDING — Alta del encargo

Objetivos y alcance.

Acta de encargo.

Firma.

Welcome Pack.

Cronología inicial.

Documentación.

Activación del asunto.

3. CASE WORK — Preparación y estrategia

Designación del responsable y equipo.

Checklist del expediente.

Datos, firmas y poderes.

Cuestiones previas.

Estrategia.

Reparto de tareas.

Reunión de traspaso.

4. DELIVER — Ejecución

Trabajo jurídico.

Demandas, escritos, contratos y escrituras.

Tareas y actuaciones.

Contactos y comunicaciones.

Seguimiento.

Registro de tiempo y coste.

Reportes al cliente.

5. OFFBOARDING — Cierre formal

Revisión final.

Entrega.

Conformidad del cliente.

Rectificaciones.

Adendas o ampliaciones.

Factura y cobro.

Archivo.

Preparación de una posible ejecución posterior.

6. AFTERCARE — Seguimiento posterior

Casos latentes.

Ejecuciones judiciales o materiales.

Recuperación de cantidades.

Información periódica al cliente.

Liquidaciones.

Satisfacción.

Reactivación o cierre definitivo.

## Navegación principal

El menú lateral incluye:

Inicio.

Leads.

Clientes.

Asuntos.

Las seis fases.

Tareas.

Calendario y plazos.

Documentos.

Comunicaciones.

Facturación.

Informes.

Configuración.

Dashboard

Incluye tarjetas visuales para:

Nuevos leads.

Presupuestos pendientes.

Asuntos activos.

Tareas pendientes.

Plazos urgentes.

Asuntos bloqueados.

Asuntos en cierre.

Casos latentes y ejecuciones.

Facturación pendiente.

Últimas actuaciones.

## Ficha del asunto

La ficha común reúne:

Cliente y asunto.

Materia.

Responsable.

Fase y estado.

Prioridad.

Próximo hito.

Cronología.

Tareas.

Documentos.

Comunicaciones.

Plazos.

Equipo.

Tiempo y coste.

Presupuesto y facturación.

Incluye un indicador visual del recorrido por las seis fases.

Diseño

La interfaz debe ser:

Profesional, sobria y moderna.

Clara y fácil de ampliar.

Orientada principalmente a ordenador.

Basada en azul oscuro, gris grafito, blanco y tonos neutros.

Con tarjetas, tablas, pestañas, checklists y cronologías.

Sin imágenes decorativas innecesarias.

## Dirección de producto

La plataforma debe conservar una interfaz profesional, sobria y ampliable, con especial atención a la privacidad, la trazabilidad y el control de acceso por despacho. Cada ampliación debe integrarse con el modelo de datos y las reglas de seguridad existentes.

## Development

Para trabajar en local necesitas Node.js y pnpm.

```sh
pnpm install
pnpm dev
```
