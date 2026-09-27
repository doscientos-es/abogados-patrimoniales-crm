import type { Json, ProcedureRow } from '@/shared/infrastructure/supabase'

export type ProcedureSection = {
  type: 'objective' | 'responsibilities' | 'step' | 'templates' | 'quality' | 'metrics'
  id?: string
  title: string
  description?: string
  content?: string
  required?: boolean
}

export type ProcedureChecklistItem = {
  id: string
  title: string
  description: string
  required: boolean
  completed: boolean
  note: string
}

export type ProcedureRun = {
  id: string
  firm_id: string
  procedure_id: string
  procedure_version: number
  version: number
  procedure_snapshot: Json
  case_id: string | null
  opportunity_id: string | null
  status: 'in_progress' | 'completed' | 'cancelled'
  checklist: Json
  notes: string
  started_by: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ProcedureEvent = {
  id: string
  firm_id: string
  procedure_id: string
  run_id: string | null
  actor_id: string | null
  event_type: string
  payload: Json
  created_at: string
}

export type SaveProcedureInput = Omit<
  Pick<ProcedureRow, 'id' | 'version' | 'slug' | 'title' | 'phase' | 'description' | 'status'>,
  'id'
> & { id: string | null; sections: ProcedureSection[] }

export type EditableProcedure = Omit<ProcedureRow, 'sections'> & { sections: ProcedureSection[] }
