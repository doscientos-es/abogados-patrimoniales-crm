import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/shared/lib/error-message'

/** Inline form to create a folder (or a subfolder of `parentPath`) for the case. */
export function CaseFolderCreator({
  parentPath,
  onCreate,
  onDone,
}: {
  parentPath: string | null
  onCreate: (name: string) => Promise<string>
  onDone: () => void
}) {
  const [name, setName] = useState('')

  const submit = async () => {
    try {
      const created = await onCreate(name)
      toast.success(`Carpeta «${created}» creada.`)
      setName('')
      onDone()
    } catch (failure) {
      toast.error(errorMessage(failure, 'No se pudo crear la carpeta.'))
    }
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Input
        autoFocus
        aria-label="Nombre de la nueva carpeta"
        className="h-8 max-w-64"
        placeholder={parentPath ? `Subcarpeta de «${parentPath}»` : 'Nombre de la carpeta'}
        value={name}
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" size="sm" disabled={!name.trim()}>
        Crear
      </Button>
    </form>
  )
}
