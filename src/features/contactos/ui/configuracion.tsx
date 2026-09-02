import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ESTADOS_DOCUMENTALES,
  IDIOMAS,
  NATURALEZAS,
  ORIGENES,
  PAISES,
  PROVINCIAS,
  RELACIONES,
  SATISFACCIONES,
  TIPOS_RECLAMACION,
} from '@/data/contactos'
import { ROLES_INTERVINIENTE } from '@/data/expedientes-model'

function ListaCatalogo({
  titulo,
  descripcion,
  items,
}: {
  titulo: string
  descripcion: string
  items: string[]
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-base">{titulo}</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">{descripcion}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="border-border flex items-center rounded-md border px-3 py-2 text-sm"
          >
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ConfiguracionContactos() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Naturaleza y relación (catálogos fijos)</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            No son editables: la naturaleza describe qué es el contacto y la relación qué es para el
            despacho. Solo la relación «Cliente» activa obligaciones documentales y bancarias.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Naturaleza
            </p>
            <ul className="mt-2 space-y-1.5">
              {NATURALEZAS.map((n) => (
                <li key={n.id} className="border-border rounded-md border px-3 py-2 text-sm">
                  <span className="text-foreground font-medium">{n.id}</span>
                  <span className="text-muted-foreground block text-xs">{n.descripcion}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Relación con el despacho
            </p>
            <ul className="mt-2 space-y-1.5">
              {RELACIONES.map((r) => (
                <li key={r.id} className="border-border rounded-md border px-3 py-2 text-sm">
                  <span className="text-foreground font-medium">{r.id}</span>
                  <span className="text-muted-foreground block text-xs">{r.descripcion}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <ListaCatalogo
        titulo="Roles en el expediente («Interviene como»)"
        descripcion="Catálogo del sistema utilizado al añadir intervinientes dentro de un expediente."
        items={[...ROLES_INTERVINIENTE]}
      />

      <ListaCatalogo
        titulo="Orígenes del contacto"
        descripcion="Procedencias disponibles al registrar un contacto."
        items={ORIGENES}
      />
      <ListaCatalogo
        titulo="Niveles de satisfacción"
        descripcion="Escala utilizada en las valoraciones de la ficha."
        items={SATISFACCIONES}
      />
      <ListaCatalogo
        titulo="Tipos de reclamaciones e incidencias"
        descripcion="Clasificación de las incidencias registradas en el perfil."
        items={TIPOS_RECLAMACION}
      />
      <ListaCatalogo
        titulo="Tipos de documentos"
        descripcion="Documentos disponibles en identificación, protección de datos y poderes."
        items={[
          'DNI',
          'Escritura de constitución',
          'Tarjeta CIF',
          'Cláusula informativa',
          'Consentimiento firmado',
          'Revocación del consentimiento',
          'Poder general',
          'Poder especial',
          'Poder para pleitos',
          'Apud acta',
        ]}
      />
      <ListaCatalogo
        titulo="Estados documentales"
        descripcion="Estados aplicables a los archivos personales."
        items={ESTADOS_DOCUMENTALES}
      />
      <ListaCatalogo
        titulo="Países"
        descripcion="Listado utilizado en la dirección de la ficha."
        items={PAISES}
      />
      <ListaCatalogo
        titulo="Provincias"
        descripcion="Listado utilizado en la dirección de la ficha."
        items={PROVINCIAS}
      />
      <ListaCatalogo
        titulo="Idiomas"
        descripcion="Idiomas disponibles como preferencia de comunicación."
        items={IDIOMAS}
      />
    </div>
  )
}
