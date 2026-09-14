# Usuarios demo

Estas cuentas se usan para las demostraciones del CRM. Pertenecen al despacho
**Pruebas** y deben mantenerse separadas de los usuarios y datos reales.

| UID                                    | Nombre            | Correo de acceso                       | Rol                       | Estado |
| -------------------------------------- | ----------------- | -------------------------------------- | ------------------------- | ------ |
| `ff28257b-284f-4e8e-8be8-239ef69b3c3d` | pol@doscientos.es | `pol@doscientos.es`                    | Propietario/a (`owner`)   | Activo |
| `b8da679e-e97c-4f23-b552-35804679d14f` | Pol Admin         | `pol+admin+abogados@doscientos.es`     | Administrador/a (`admin`) | Activo |
| `c57d9de9-3eda-40a7-93fe-6fa1d2c9d503` | Pol . Abogado     | `pol+lawyer+abogados@doscientos.es`    | Abogado/a (`lawyer`)      | Activo |
| `1e526d60-b5fe-405b-a373-c82790057ed4` | Pol . Paralegal   | `pol+paralegal+abogados@doscientos.es` | Paralegal (`paralegal`)   | Activo |

## Acciones rápidas

`↻ Restablecer contraseña` · `⚙ Gestionar en Supabase Auth` · `⛔ No usar datos reales`

Las contraseñas no se almacenan en el repositorio ni en este documento.

## Cobertura de roles

Las cuentas cubren los cuatro roles de la aplicación: `owner`, `admin`,
`lawyer` y `paralegal`.

### Diferencias entre roles

| Rol                         | Alcance general                       | Gestión del equipo                                                                                     | Expedientes                                                      | Configuración y facturación                                                | Permisos especiales                                                                   |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Propietario** (`owner`)   | Control total del despacho            | Puede invitar y gestionar administradores, abogados y paralegales                                      | Puede ver y gestionar todos los expedientes                      | Puede modificar los datos del despacho, ajustes, facturas y procedimientos | Único rol que puede administrar el acceso de otros administradores                    |
| **Administrador** (`admin`) | Administración operativa del despacho | Puede invitar y gestionar abogados y paralegales; no puede gestionar administradores ni al propietario | Puede ver y gestionar todos los expedientes                      | Puede modificar datos del despacho, ajustes, facturas y procedimientos     | Puede editar notas de otros usuarios y administrar catálogos                          |
| **Abogado/a** (`lawyer`)    | Trabajo jurídico y operativo          | No puede invitar ni modificar miembros                                                                 | Solo puede acceder a expedientes asignados o creados por él/ella | Puede consultar, pero no modificar ajustes, facturas ni procedimientos     | Puede validar o rechazar plazos legales y gestionar catálogos, etiquetas y plantillas |
| **Paralegal** (`paralegal`) | Apoyo operativo                       | No puede invitar ni modificar miembros                                                                 | Solo puede acceder a expedientes asignados o creados por él/ella | Puede consultar, pero no modificar ajustes, facturas ni procedimientos     | No puede validar plazos legales ni gestionar catálogos administrativos                |

### Matriz rápida de permisos

| Acción                                             | `owner` | `admin` | `lawyer` | `paralegal` |
| -------------------------------------------------- | :-----: | :-----: | :------: | :---------: |
| Ver contactos, oportunidades y tareas del despacho |   Sí    |   Sí    |    Sí    |     Sí      |
| Crear y editar contactos, oportunidades y tareas   |   Sí    |   Sí    |    Sí    |     Sí      |
| Ver todos los expedientes                          |   Sí    |   Sí    |    No    |     No      |
| Ver expedientes asignados o propios                |   Sí    |   Sí    |    Sí    |     Sí      |
| Gestionar miembros del equipo                      |   Sí    |   Sí    |    No    |     No      |
| Invitar administradores                            |   Sí    |   No    |    No    |     No      |
| Modificar configuración del despacho               |   Sí    |   Sí    |    No    |     No      |
| Crear o modificar facturas                         |   Sí    |   Sí    |    No    |     No      |
| Crear o modificar procedimientos                   |   Sí    |   Sí    |    No    |     No      |
| Gestionar etiquetas, plantillas y áreas jurídicas  |   Sí    |   Sí    |    Sí    |     No      |
| Validar plazos legales                             |   Sí    |   Sí    |    Sí    |     No      |
| Editar notas de otros usuarios                     |   Sí    |   Sí    |    No    |     No      |

Todos los permisos requieren una membresía activa en el despacho. El acceso a
expedientes de abogados y paralegales está limitado a los asuntos asignados o
creados por ellos.

--
DNS records for domain verification of abogadospatrimoniales.es on Resend

Add the following DNS records at your domain provider for abogadospatrimoniales.es:

*DKIM
Type: TXT
Name: resend._domainkey
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvcfzl67Bt8XEMPdCZ79eGaQCpSZuYLJ4ioxbl+I7+S0MovrvSqD9xEn9dCuetAF0pNdJi4YPZjL1g5UKcCOdHozfEORUOgE9LlVtMcIcnXrva3JGRUqnPew8ti6UJkP27vxpSq1b77VTbAZXKb/TxRLgZ6LzDYaC8fZFBfxW2DQIDAQAB
TTL: Auto

SPF
Type: CNAME
Name: rsend
Value: rsend-euw1.forge.rmta.net
TTL: Auto

Type: CNAME
Name: send
Value: send.forge.rmta.net
TTL: Auto

DMARC (recommended)
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none;
TTL: Auto*

After adding these records, return to Resend to verify.
Docs: https://resend.com/docs/dashboard/domains/introduction
