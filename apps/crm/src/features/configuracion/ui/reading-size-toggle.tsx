import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'lex-reading-size'

function applyReadingSize(enabled: boolean) {
  document.documentElement.toggleAttribute('data-reading-large', enabled)
}

export function ReadingSizeToggle() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) === 'large'
      // Se lee tras la hidratación para mantener la salida del servidor y cliente iguales.
      // oxlint-disable-next-line react(set-state-in-effect)
      setEnabled(saved)
      applyReadingSize(saved)
    } catch {
      // La preferencia sigue funcionando durante esta sesión sin almacenamiento disponible.
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      const next = event.key === STORAGE_KEY && event.newValue === 'large'
      setEnabled(next)
      applyReadingSize(next)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      applyReadingSize(false)
    }
  }, [])

  function toggle() {
    const next = !enabled
    setEnabled(next)
    applyReadingSize(next)
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, 'large')
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // El cambio se mantiene activo hasta cerrar o recargar la página.
    }
  }

  return (
    <Button
      type="button"
      variant={enabled ? 'secondary' : 'ghost'}
      size="icon"
      aria-label="Lectura ampliada"
      aria-pressed={enabled}
      title="Lectura ampliada (se guarda en este navegador)"
      onClick={toggle}
    >
      <span aria-hidden="true" className="text-base font-semibold">
        Aa
      </span>
    </Button>
  )
}
