import { createFileRoute } from '@tanstack/react-router'

import { ProceduresPage } from '@/features/procedimientos'

export const Route = createFileRoute('/procedimientos/')({
  head: () => ({
    meta: [
      { title: 'Procedimientos del despacho — LEX' },
      {
        name: 'description',
        content: 'Biblioteca versionada de procedimientos internos y sus ejecuciones.',
      },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: ProceduresPage,
})
