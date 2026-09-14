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