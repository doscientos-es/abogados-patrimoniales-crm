# Sincronización del fork Lovable con Nuestro

## Objetivo

`sandbox` es la fuente de cambios de UX y flujo que el cliente sigue haciendo en Lovable; `nuestro` es la aplicación operativa. No se mezclan repositorios ni se copian pantallas a ciegas: cada flujo se adapta al modelo de datos, permisos, auditoría y experiencia de `nuestro`.

## Punto de partida

- Fecha de revisión: 2026-10-13.
- Sandbox: `HEAD` local `09c5af049b3f83e40f8feb8ece84a80df54155d9`; ref actualizada `origin/main` `1e243276d2d7037560bbf3de9df445a37d37f196`.
- Delta auditado inicialmente: `09c5af0..1e24327`; 427 commits, 137 archivos, 16.359 inserciones y 1.701 eliminaciones.
- Nuestro: `7d8f6352122700eec924dd5f0df49e0250374718`, limpio en su propio `origin/main`. Los dos repositorios no comparten historial.
- Antes de cada tanda, ejecutar `git fetch origin` en Sandbox y fijar el SHA fuente. El fetch actualizó las refs, no los archivos de trabajo.

## Rutina para cada tanda

1. Acordar el commit de Sandbox que se quiere incorporar y registrar el último SHA ya revisado/incorporado.
2. Revisar el delta entre ambos SHAs; agrupar archivos en flujos y asignar a cada uno una decisión: **implementar**, **ya cubierto**, **adaptar/parcial**, **no aplica** o **requiere decisión**.
3. Crear una rama de integración en Nuestro (`sync/sandbox-<sha-corto>`); mantener los cambios de cada flujo en commits pequeños y revisables.
4. Para cada flujo, comparar comportamiento y criterios de aceptación, no solo nombres de archivos. Traducir operaciones de prototipo a Supabase/RPC/RLS, membresías, control de versión y auditoría de Nuestro.
5. Revisar migraciones por separado: contrastar esquema, permisos, datos existentes y orden; probarlas en un entorno de desarrollo. No aplicar migraciones al proyecto remoto como parte automática de la sincronización.
6. Ejecutar pruebas del flujo, controles de calidad y un recorrido manual por rol. Registrar resultado y actualizar este documento antes de avanzar al siguiente lote.
7. Marcar la tanda completa solo cuando cada cambio del delta tenga decisión y evidencia; entonces actualizar el SHA de último origen revisado.

## Alcance inicial a revisar

| Flujo                              | Lectura inicial en Nuestro                                                                                     | Trabajo de comparación                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Primera cita y cualificación       | Hay ficha de primera cita y cualificación persistida.                                                          | Comparar asistente, participantes, decisiones y transiciones nuevas del fork.                  |
| Presupuesto, proforma y aceptación | Seguimiento en la ficha del Lead; el análisis de Nuestro identifica que no hay editor completo de presupuesto. | Prioridad alta: versiones, revisión, envío, aceptación y creación transaccional de onboarding. |
| Onboarding y pago                  | Hay etapas persistidas y transiciones RPC.                                                                     | Comparar justificante/evidencias y apertura a partir de la aceptación.                         |
| Tareas y avisos                    | Hay espera, revisión, inbox y notificaciones en la app.                                                        | Comparar alcance, historial, asignaciones y migraciones nuevas; evitar duplicar lo existente.  |
| Atención y traspaso a expediente   | Hay dashboard y controles/alertas de expediente.                                                               | Verificar detecciones, bandeja de traspasos, permisos y transacción de conversión.             |
| Contactos y documentos             | Hay almacenamiento privado y flujos de documentos.                                                             | Revisar carga nueva, datos fiscales y compatibilidad con almacenamiento y RLS actuales.        |
| Catálogos, bloques y plantillas    | No se ha confirmado equivalencia funcional.                                                                    | Decidir qué administración necesita persistencia compartida y qué es solo contenido inicial.   |

Esta tabla es una clasificación inicial, no una afirmación de paridad completa. La revisión detallada del delta debe añadir el destino, decisión y pruebas por flujo.

## Puertas de calidad

- Nada que parezca guardado puede depender solo de `localStorage` o datos mock.
- Toda lectura/escritura respeta el despacho activo y RLS; las operaciones sensibles usan RPC con autorización, control de versión y eventos/auditoría cuando corresponda.
- Cada migración tiene prueba de contrato y se valida sobre una base de desarrollo antes de considerarla lista.
- Correr las pruebas focalizadas y `pnpm run check` desde `nuestro`; hacer recorrido manual con los roles afectados.
- Distinguir explícitamente **migración creada**, **probada en desarrollo** y **aplicada/verificada en remoto**. No declarar la última sin comprobarla en el proyecto correcto.
