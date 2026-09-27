import { CalendarDays } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

import changelog from '../changelog.json'

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeZone: 'UTC',
})

export function ChangelogSettings() {
  if (!changelog.releases.length) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-sm">
          Aún no hay novedades publicadas.
        </CardContent>
      </Card>
    )
  }

  return (
    <div aria-label="Novedades del producto" className="space-y-4">
      {changelog.releases.map((release) => (
        <Card key={release.date}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-foreground font-serif text-base font-semibold tracking-wide uppercase">
                  {release.title}
                </h2>
                <CardDescription className="mt-2 flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  <time dateTime={release.date}>
                    {dateFormatter.format(new Date(`${release.date}T00:00:00Z`))}
                  </time>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {release.sections.map((section) => (
              <section key={section.title}>
                <h3 className="text-foreground text-sm font-semibold">{section.title}</h3>
                <ul className="text-muted-foreground mt-2 list-disc space-y-2 pl-5 text-sm">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>
      ))}
      <p className="text-muted-foreground text-xs">
        Las novedades describen cambios registrados en el proyecto; su disponibilidad depende del
        despliegue de cada entorno.
      </p>
    </div>
  )
}
