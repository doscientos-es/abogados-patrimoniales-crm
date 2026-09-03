# MVP jurídico: alcance, flujos y permisos

**Estado:** aprobado para ejecución · **Fecha:** 2026-09-02 · **Propietario:** despacho / responsable del proyecto

## 1. Objetivo y principios

Primera salida operativa para gestionar captación, alta, expediente, trabajo jurídico, documentación,
plazos, comunicaciones, facturación y cierre con una única fuente de verdad multiusuario.

Principios no negociables: aislamiento por despacho, mínimo privilegio, trazabilidad inmutable,
documentos privados, validación humana de plazos y decisiones jurídicas, concurrencia optimista,
archivo en lugar de borrado destructivo y ausencia de datos demo en flujos productivos.

## 2. Alcance aprobado

### P0 — necesario para piloto

- Identidad, invitaciones administradas, altas/bajas, MFA sensible y roles por acción.
- Contactos y oportunidades: CRUD, búsqueda, asignación, pipeline, archivo y auditoría.
- Onboarding: encargos, consentimientos, KYC/conflictos, hitos y evidencias.
- Expedientes: CRUD, participantes, líneas, actuaciones, asignación, archivo y trazabilidad.
- Tareas, plazos y alertas persistentes; cálculo/IA nunca activa un plazo sin validación humana.
- Documentos privados versionados, metadatos, confidencialidad, antivirus/validación y URLs firmadas.
- Comunicaciones vinculadas a contacto/expediente, plantillas, estado de entrega y auditoría.
- Facturación: borrador, emisión irreversible, cobros, vencimientos y exportación.
- RLS automatizada con dos despachos y todos los roles; CI, staging, UAT, importación y formación.

### P1 — inmediatamente después del piloto

- Informes reales de carga, pipeline, rentabilidad, plazos y facturación.
- Observabilidad y alertas sin PII; backups, restauración y runbooks probados.
- Portal cliente limitado, firma electrónica y automatizaciones revisables.
- Política formal de conservación, supresión, exportación y respuesta a incidentes.

### P2 — fuera del MVP inicial

- IA jurídica generativa autónoma, presentación telemática y cálculo automático no validado.
- Contabilidad completa, nóminas, CRM de marketing avanzado y marketplace de integraciones.
- Aplicaciones móviles nativas, multidioma completo y personalización visual por cliente.
- BI predictivo, scoring automático y migraciones masivas distintas del piloto acordado.

## 3. Flujos operativos

| #   | Flujo                    | Responsable         | Entrada               | Validaciones obligatorias                                                  | Evidencia / salida                                |
| --- | ------------------------ | ------------------- | --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Lead → oportunidad       | Abogado/Admin       | Contacto e interés    | duplicados, despacho, responsable, motivo de pérdida/retroceso             | historial de fases y oportunidad archivada/ganada |
| 2   | Oportunidad → onboarding | Abogado             | aceptación comercial  | identidad, conflicto, KYC, alcance, honorarios, consentimientos            | expediente habilitable y checklist firmado        |
| 3   | Apertura → estrategia    | Abogado responsable | onboarding conforme   | contacto principal, naturaleza, participantes, responsable, próxima acción | expediente, líneas y posición actual              |
| 4   | Trabajo → plazo          | Abogado/Paralegal   | actuación o documento | fuente, zona horaria, fecha propuesta, validación profesional              | actuación, tarea/plazo validado y auditoría       |
| 5   | Documento/comunicación   | Abogado/Paralegal   | fichero o mensaje     | tipo, expediente, confidencialidad, destinatario y aprobación si aplica    | versión privada, entrega y acuse/estado           |
| 6   | Honorarios → cobro       | Admin/Abogado       | encargo e hitos       | concepto, impuestos, serie, importes y aprobación de emisión               | factura inmutable, vencimiento y cobros           |
| 7   | Cierre → archivo         | Abogado/Admin       | trabajo finalizado    | tareas/plazos, saldo, devolución/conservación documental y motivo          | cierre trazable, archivo y acceso restringido     |

## 4. Matriz de roles objetivo

Leyenda: **T** total, **O** operativo, **L** lectura, **—** sin acceso. La pertenencia al despacho y
las restricciones por expediente se aplican además del rol.

| Acción                          | owner | admin |      lawyer      |    paralegal    |
| ------------------------------- | :---: | :---: | :--------------: | :-------------: |
| Configuración, miembros y roles |   T   |   O   |        —         |        —        |
| Contactos y oportunidades       |   T   |   T   |        O         |        O        |
| Archivar oportunidad/contacto   |   T   |   T   |        O         |        —        |
| Abrir/editar/asignar expediente |   T   |   T   |        T         |        O        |
| Participantes y líneas          |   T   |   T   |        T         |        O        |
| Actuaciones                     |   T   |   T   |        T         |        O        |
| Proponer tarea/plazo            |   T   |   T   |        T         |        O        |
| Validar plazo jurídico          |   T   |   T   |        T         |        —        |
| Documentos normales             |   T   |   T   |        T         |        O        |
| Documentos confidenciales       |   T   |   T   |        T         | L si autorizado |
| Comunicaciones externas         |   T   |   T   |        T         |    borrador     |
| Emitir/anular factura           |   T   |   T   | O si autorizado  |        —        |
| Informes económicos             |   T   |   T   |     L propia     |        —        |
| Exportar/suprimir datos         |   T   |   O   |        —         |        —        |
| Auditoría                       |   T   |   L   | L del expediente |        —        |

**Separación sensible:** solo `owner` transfiere propiedad; `admin` no puede autoelevarse; bajas,
exportaciones, emisiones y cambios de rol exigen reautenticación/MFA y evento de auditoría.

## 5. Criterios de aceptación del MVP

1. Dos usuarios del mismo despacho comparten cambios; otro despacho no puede leer, escribir ni vincularlos.
2. Toda entidad P0 persiste en Supabase y sobrevive recarga/sesión; no existe fallback demo operativo.
3. Ediciones críticas usan versión esperada y muestran conflicto, sin sobrescritura silenciosa.
4. Todo cambio sensible registra actor, instante, entidad, acción y campos afectados.
5. Ningún documento es público; descargas usan autorización y URL firmada corta.
6. Ningún plazo propuesto por cálculo o IA se activa sin responsable, fuente y validación humana.
7. Facturas emitidas no se editan: se rectifican/anulan con trazabilidad.
8. Estados vacíos, errores, carga, móvil y teclado están cubiertos en los flujos principales.
9. CI, staging, pruebas RLS/E2E, UAT, restauración e importación piloto pasan antes de producción.

## 6. Definition of Done

- Requisitos y permisos implementados en frontend, backend y RLS; migraciones versionadas y aplicadas.
- Validación de entrada también en servidor; secretos fuera del cliente; logs sin contenido sensible.
- Pruebas unitarias, integración, RLS multirol y E2E del camino feliz/error/concurrencia en verde.
- Formato, tipos, lint, build, accesibilidad crítica y revisión de seguridad en verde.
- Auditoría, métricas operativas, rollback/runbook y documentación actualizados.
- Aprobación UAT nominal del despacho y responsable técnico registrada en Backoffice.

## 7. Dependencias y orden de entrega

1. Alcance y permisos (este documento) → identidad/invitaciones → RLS automatizada.
2. Contactos/oportunidades → onboarding → expedientes → tareas/plazos/documentos/comunicaciones.
3. Encargos y actuaciones → facturación → informes.
4. CI + observabilidad + backups → staging/importación → UAT/formación → piloto.

Bloqueos: documentos dependen de Storage privado; comunicaciones de proveedor transaccional; facturación
de series/impuestos; producción de dominio, variables, backups y responsables de soporte confirmados.

## 8. Decisión y control de cambios

Este alcance queda aprobado operativamente por instrucción expresa del responsable del proyecto para
continuar y completar la siguiente tarea. Cualquier ampliación P1/P2 requiere una tarea separada y no
puede retrasar los criterios P0. La aprobación nominal del representante del despacho se registra durante
UAT; si contradice este documento, se abre control de cambio con impacto, riesgo, coste y decisión.
