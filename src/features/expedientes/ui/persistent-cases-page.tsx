import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ContactoPersistido } from '@/features/contactos'
import type { ExpedientePersistido } from '@/features/expedientes/application/case-types'

export function PersistentCasesPage({
  expedientes,
  contactos,
}: {
  expedientes: ExpedientePersistido[]
  contactos: ContactoPersistido[]
}) {
  const [query, setQuery] = useState('')
  const [nature, setNature] = useState<'all' | 'Judicial' | 'Extrajudicial'>('all')
  const contactNames = new Map(contactos.map((contact) => [contact.id, contact.nombre]))

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = expedientes.filter((item) => {
    const text =
      `${item.referencia} ${item.titulo} ${item.area} ${contactNames.get(item.contactoPrincipalId) ?? ''}`.toLowerCase()
    return (
      (!normalizedQuery || text.includes(normalizedQuery)) &&
      (nature === 'all' || item.naturaleza === nature)
    )
  })

  return (
    <main className="mx-auto max-w-[1400px] p-6">
      <SectionHeader
        title="Control de expedientes"
        subtitle="Expedientes persistentes y compartidos por el despacho."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar expediente…"
          className="max-w-md"
        />
        {(['all', 'Extrajudicial', 'Judicial'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={nature === value ? 'default' : 'outline'}
            onClick={() => setNature(value)}
          >
            {value === 'all' ? 'Todos' : value}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <Link key={item.id} to="/expedientes/$id" params={{ id: item.id }}>
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground text-xs">{item.referencia}</span>
                  <Badge variant="outline">{item.prioridad}</Badge>
                </div>
                <h2 className="font-medium">{item.titulo}</h2>
                <p className="text-muted-foreground text-sm">
                  {contactNames.get(item.contactoPrincipalId) ?? 'Contacto no disponible'}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge>{item.naturaleza}</Badge>
                  <Badge variant="secondary">{item.fase}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {item.proximaAccion || 'Sin próxima acción definida'}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {!filtered.length ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No hay expedientes persistentes con estos criterios.
        </p>
      ) : null}
    </main>
  )
}
