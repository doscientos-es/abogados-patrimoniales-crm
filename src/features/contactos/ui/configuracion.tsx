import { GripVertical, Plus } from 'lucide-react'

import { PendingBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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

function ListaEditable({
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
        <Button variant="outline" size="sm" disabled>
          <Plus className="h-4 w-4" />
          Añadir
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="border-border flex items-center gap-3 rounded-md border px-3 py-2"
          >
            <GripVertical className="text-muted-foreground h-4 w-4 shrink-0" />
            <Input defaultValue={item} className="h-8 max-w-sm" aria-label={item} disabled />
            <div className="ml-auto flex items-center gap-3">
              <span className="text-muted-foreground text-xs">Activo</span>
              <Switch defaultChecked disabled />
              <Button variant="ghost" size="sm" disabled>
                Archivar
              </Button>
              <Button variant="ghost" size="sm" disabled className="text-destructive">
                Eliminar
              </Button>
            </div>
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

      <ListaEditable
        titulo="Roles en el expediente («Interviene como»)"
        descripcion="Catálogo utilizado al añadir intervinientes dentro de un expediente. No forma parte de la ficha general del contacto."
        items={[...ROLES_INTERVINIENTE]}
      />

      <ListaEditable
        titulo="Orígenes del contacto"
        descripcion="Listado editable de procedencias registradas en el perfil."
        items={ORIGENES}
      />
      <ListaEditable
        titulo="Niveles de satisfacción"
        descripcion="Escala utilizada en las valoraciones de la ficha."
        items={SATISFACCIONES}
      />
      <ListaEditable
        titulo="Tipos de reclamaciones e incidencias"
        descripcion="Clasificación de las incidencias registradas en el perfil."
        items={TIPOS_RECLAMACION}
      />
      <ListaEditable
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
      <ListaEditable
        titulo="Estados documentales"
        descripcion="Estados aplicables a los archivos personales."
        items={ESTADOS_DOCUMENTALES}
      />
      <ListaEditable
        titulo="Países"
        descripcion="Listado utilizado en la dirección de la ficha."
        items={PAISES}
      />
      <ListaEditable
        titulo="Provincias"
        descripcion="Listado utilizado en la dirección de la ficha."
        items={PROVINCIAS}
      />
      <ListaEditable
        titulo="Idiomas"
        descripcion="Idiomas disponibles como preferencia de comunicación."
        items={IDIOMAS}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-base">Campos adicionales de la ficha</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Espacio para definir campos personalizados en futuras fases.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            <Plus className="h-4 w-4" />
            Nuevo campo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border-border bg-muted/40 rounded-lg border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Sin campos adicionales definidos en esta fase.
            </p>
            <div className="mt-3 flex justify-center">
              <PendingBadge />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
