import { useEffect } from 'react'

type CaseTitleData = { id: string; referencia: string; titulo: string }

export function useCaseDocumentTitle(id: string, expediente: CaseTitleData | null | undefined) {
  useEffect(() => {
    document.title =
      expediente?.id === id
        ? `${expediente.referencia} · ${expediente.titulo} — LEX`
        : 'Expediente — LEX'
  }, [id, expediente?.id, expediente?.referencia, expediente?.titulo])
}
