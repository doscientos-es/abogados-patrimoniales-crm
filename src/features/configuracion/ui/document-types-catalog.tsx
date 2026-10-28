import { useQueryClient } from '@tanstack/react-query'
import { FileType2, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { normalizeTypeName, validateTypeName, type DocumentType } from '@/features/documentos/document-naming'
import {
  documentTypesApi,
  documentTypesKey,
  namingRulesKey,
  useDocumentTypes,
  useNamingRules,
} from '@/features/documentos/document-naming-data'

export function DocumentTypesCatalog({
  firmId,
  canManage,
}: {
  firmId: string
  canManage: boolean
}) {
  const queryClient = useQueryClient()
  const types = useDocumentTypes(firmId)
  const rules = useNamingRules(firmId)
  const [name, setName] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [rule, setRule] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string; suggestions: string } | null>(null)
  const rows = types.data?.rows ?? []
  const editable = canManage && Boolean(types.data?.available)

  const act = async (operation: () => Promise<void>, success: string, key = documentTypesKey(firmId)) => {
    try {
      await operation()
      toast.success(success)
      void queryClient.invalidateQueries({ queryKey: key })
      return true
    } catch {
      toast.error('No se ha podido guardar el cambio.')
      return false
    }
  }

  const addType = async () => {
    const validation = validateTypeName(name, rows)
    if (validation) return toast.error(validation)
    const order = rows.reduce((max, type) => Math.max(max, type.sort_order), 0) + 10
    const suggestedDescriptions = suggestions
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20)
    if (await act(() => documentTypesApi.create(firmId, normalizeTypeName(name), order, suggestedDescriptions), 'Tipo documental añadido.')) {
      setName('')
      setSuggestions('')
    }
  }

  const saveType = async () => {
    if (!editing) return
    const validation = validateTypeName(editing.name, rows, editing.id)
    if (validation) return toast.error(validation)
    const list = editing.suggestions.split(';').map((item) => item.trim()).filter(Boolean).slice(0, 20)
    if (await act(() => documentTypesApi.update(editing.id, { name: normalizeTypeName(editing.name), suggestions: list }), 'Tipo actualizado.'))
      setEditing(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileType2 className="h-4 w-4" aria-hidden="true" /> Tipos documentales de LEXIA
        </CardTitle>
        <CardDescription>
          Catálogo del despacho para las propuestas «TIPO - DESCRIPCIÓN». LEXIA no modifica los
          documentos originales; desactivar un tipo lo oculta en nuevas propuestas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!types.isLoading && !types.data?.available ? (
          <p className="bg-muted/60 text-muted-foreground rounded-md p-2.5 text-xs">
            Falta aplicar la migración «Nomenclatura documental LEXIA». El catálogo inicial solo se
            muestra en modo consulta.
          </p>
        ) : null}
        {editable ? (
          <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void addType() }}>
            <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Nuevo tipo (p. ej. QUERELLA)" aria-label="Nuevo tipo documental" />
            <Input value={suggestions} onChange={(event) => setSuggestions(event.target.value)} placeholder="Descripciones sugeridas, separadas por ;" aria-label="Descripciones sugeridas" />
            <Button type="submit" disabled={!name.trim()}><Plus className="h-4 w-4" /> Añadir</Button>
          </form>
        ) : null}
        <div className="divide-y rounded-md border">
          {rows.map((type: DocumentType) => (
            <div key={type.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              {editing?.id === type.id ? (
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <Input aria-label="Nombre del tipo documental" maxLength={60} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                  <Input aria-label="Descripciones del tipo documental" value={editing.suggestions} onChange={(event) => setEditing({ ...editing, suggestions: event.target.value })} />
                </div>
              ) : (
                <span className={`min-w-0 flex-1 ${type.active ? '' : 'text-muted-foreground line-through'}`}>
                  {type.name}{type.suggestions.length ? ` · ${type.suggestions.join('; ')}` : ''}
                </span>
              )}
              {canManage && types.data?.available ? (
                <div className="flex gap-1">
                  {editing?.id === type.id ? (
                    <Button type="button" size="sm" onClick={() => void saveType()}>Guardar</Button>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ id: type.id, name: type.name, suggestions: type.suggestions.join('; ') })}>Editar</Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => void act(() => documentTypesApi.update(type.id, { active: !type.active }), type.active ? 'Tipo desactivado.' : 'Tipo reactivado.')}>
                    {type.active ? 'Desactivar' : 'Reactivar'}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Reglas de nombrado</h3>
          <p className="text-muted-foreground text-xs">
            Preferencias del despacho que orientan las sugerencias; no se usan para entrenar modelos.
          </p>
          {editable && rules.data?.available ? (
            <form className="flex gap-2" onSubmit={async (event) => {
              event.preventDefault()
              if (rule.trim().length < 3) return
              if (await act(() => documentTypesApi.addRule(firmId, rule.trim()), 'Regla añadida.', namingRulesKey(firmId))) setRule('')
            }}>
              <Input aria-label="Nueva regla de nombrado" value={rule} maxLength={300} onChange={(event) => setRule(event.target.value)} placeholder="Nueva regla" />
              <Button type="submit" disabled={rule.trim().length < 3}><Plus className="h-4 w-4" /> Añadir</Button>
            </form>
          ) : null}
          {(rules.data?.rows ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className={item.active ? '' : 'text-muted-foreground line-through'}>{item.rule}</span>
              {canManage ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => void act(() => documentTypesApi.setRuleActive(item.id, !item.active), 'Regla actualizada.', namingRulesKey(firmId))}>
                  {item.active ? 'Desactivar' : 'Reactivar'}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}