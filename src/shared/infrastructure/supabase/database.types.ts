export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      crm_firms: Table<
        {
          id: string
          name: string
          invoice_sequence: number
          created_at: string
          updated_at: string
        },
        {
          id?: string
          name: string
          invoice_sequence?: number
          created_at?: string
          updated_at?: string
        }
      >
      crm_firm_settings: Table<
        FirmSettingsRow,
        FirmSettingsInsert,
        Partial<FirmSettingsInsert> & { firm_id?: string; updated_at?: string }
      >
      crm_profiles: Table<
        { id: string; display_name: string; created_at: string; updated_at: string },
        { id: string; display_name?: string; created_at?: string; updated_at?: string }
      >
      crm_firm_members: Table<
        {
          firm_id: string
          user_id: string
          role: MemberRole
          status: MemberStatus
          created_at: string
          updated_at: string
        },
        {
          firm_id: string
          user_id: string
          role?: MemberRole
          status?: MemberStatus
          created_at?: string
          updated_at?: string
        }
      >
      crm_contacts: Table<
        ContactRow,
        ContactInsert,
        Partial<ContactInsert> & { id?: string; status?: ContactStatus; version?: number }
      >
      crm_cases: Table<CaseRow, CaseInsert, Partial<CaseInsert> & { id?: string; version?: number }>
      crm_case_workstreams: Table<CaseWorkstreamRow, CaseWorkstreamInsert, never>
      crm_case_activities: Table<CaseActivityRow, CaseActivityInsert, never>
      crm_case_participants: Table<CaseParticipantRow, CaseParticipantInsert, never>
      crm_case_events: Table<CaseEventRow, never, never>
      crm_case_documents: Table<CaseDocumentRow, never, never>
      crm_document_folders: Table<DocumentFolderRow, never, never>
      crm_tasks: Table<TaskRow, TaskInsert, never>
      crm_task_events: Table<TaskEventRow, never, never>
      crm_notes: Table<NoteRow, NoteInsert, Partial<NoteInsert> & { id?: string }>
      crm_note_contacts: Table<NoteContactRow, never, never>
      crm_note_permissions: Table<NotePermissionRow, never, never>
      crm_note_acknowledgements: Table<NoteAcknowledgementRow, never, never>
      crm_note_events: Table<NoteEventRow, never, never>
      crm_invoices: Table<InvoiceRow, InvoiceInsert, Partial<InvoiceInsert> & { id?: string }>
      crm_invoice_payments: Table<InvoicePaymentRow, InvoicePaymentInsert, never>
      crm_procedures: Table<
        ProcedureRow,
        ProcedureInsert,
        Partial<ProcedureInsert> & { id?: string }
      >
      crm_opportunities: Table<
        OpportunityRow,
        OpportunityInsert,
        Partial<OpportunityInsert> & { id?: string; version?: number }
      >
      crm_opportunity_events: Table<OpportunityEventRow, OpportunityEventInsert, never>
    }
    Views: Record<never, never>
    Functions: {
      crm_bootstrap_firm: { Args: { firm_name: string }; Returns: string }
      crm_archive_opportunity: {
        Args: {
          target_opportunity_id: string
          target_expected_version: number
          archive_reason: string
        }
        Returns: OpportunityRow
      }
      crm_update_case: {
        Args: {
          target_case_id: string
          target_expected_version: number
          new_title: string
          new_area: string
          new_matter_type: string
          new_nature: CaseNature
          new_general_status: string
          new_phase: string
          new_operational_status: string
          new_priority: OpportunityPriority
          new_assigned_to: string | null
          new_opened_on: string
          new_closed_on: string | null
          new_next_action: string
          new_current_position: string
        }
        Returns: CaseRow
      }
      crm_update_task: {
        Args: {
          target_task_id: string
          target_expected_version: number
          new_title: string
          new_description: string
          new_status: TaskStatus
          new_priority: OpportunityPriority
          new_due_at: string | null
          new_reminder_at: string | null
          new_assigned_to: string | null
        }
        Returns: TaskRow
      }
      crm_validate_deadline: {
        Args: {
          target_task_id: string
          target_expected_version: number
          decision: 'validated' | 'rejected'
          confirmed_due_at: string | null
          source_reference: string
          professional_note: string
        }
        Returns: TaskRow
      }
      crm_create_case_document: {
        Args: {
          target_firm_id: string
          target_case_id: string
          target_workstream_id: string | null
          document_category: string
          original_file_name: string
          content_mime_type: string
          content_size_bytes: number
          document_confidentiality: CaseDocumentRow['confidentiality']
        }
        Returns: CaseDocumentRow
      }
      crm_create_document_version: {
        Args: {
          target_document_id: string
          target_expected_version: number
          original_file_name: string
          content_mime_type: string
          content_size_bytes: number
        }
        Returns: CaseDocumentRow
      }
      crm_finalize_document_version: {
        Args: { target_document_id: string; content_checksum: string }
        Returns: CaseDocumentRow
      }
      crm_abort_document_version: { Args: { target_document_id: string }; Returns: undefined }
      crm_create_document_folder: {
        Args: {
          target_firm_id: string
          target_case_id: string
          target_parent_id: string | null
          folder_name: string
        }
        Returns: DocumentFolderRow
      }
      crm_move_case_document: {
        Args: { target_document_id: string; target_folder_id: string | null }
        Returns: CaseDocumentRow
      }
      crm_update_firm_member: {
        Args: {
          target_firm_id: string
          target_user_id: string
          new_role: MemberRole
          new_status: 'active' | 'disabled'
        }
        Returns: undefined
      }
      crm_update_opportunity: {
        Args: {
          target_opportunity_id: string
          target_expected_version: number
          new_title: string
          new_area: string
          new_priority: OpportunityPriority
          new_operational_status: string
          new_source: string
          new_description: string
          new_assigned_to: string | null
          new_estimated_amount: number | null
        }
        Returns: OpportunityRow
      }
      crm_transition_opportunity: {
        Args: {
          target_opportunity_id: string
          target_stage: OpportunityStage
          target_substage: string
          transition_reason?: string | null
        }
        Returns: OpportunityRow
      }
      crm_save_firm_settings: {
        Args: {
          target_firm_id: string
          new_firm_name: string
          new_legal_name: string
          new_tax_id: string
          new_address: string
          new_professional_registration: string
        }
        Returns: undefined
      }
      crm_save_note: {
        Args: {
          target_firm_id: string
          target_note_id: string | null
          target_payload: Json
          event_type: string
          event_detail?: string | null
        }
        Returns: NoteRow
      }
      crm_acknowledge_note: {
        Args: { target_note_id: string }
        Returns: undefined
      }
    }
    Enums: {
      crm_member_role: MemberRole
      crm_member_status: MemberStatus
      crm_contact_nature: ContactNature
      crm_contact_relationship: ContactRelationship
      crm_contact_status: ContactStatus
      crm_opportunity_stage: OpportunityStage
      crm_priority: OpportunityPriority
    }
    CompositeTypes: Record<never, never>
  }
}

export type MemberRole = 'owner' | 'admin' | 'lawyer' | 'paralegal'
export type MemberStatus = 'invited' | 'active' | 'disabled'
export type FirmSettingsRow = {
  firm_id: string
  legal_name: string
  tax_id: string
  address: string
  professional_registration: string
  created_at: string
  updated_at: string
}
export type FirmSettingsInsert = {
  firm_id: string
  legal_name?: string
  tax_id?: string
  address?: string
  professional_registration?: string
  created_at?: string
  updated_at?: string
}
export type ContactNature = 'person' | 'company' | 'court' | 'public_body'
export type ContactRelationship =
  | 'lead'
  | 'client'
  | 'collaborator'
  | 'third_party'
  | 'counterparty'
  | 'supplier'
export type ContactStatus = 'active' | 'inactive' | 'archived'
export type OpportunityStage =
  | 'entry'
  | 'qualification'
  | 'first_meeting'
  | 'quote'
  | 'validation'
  | 'engagement'
  | 'won'
  | 'lost'
export type OpportunityPriority = 'low' | 'medium' | 'high'
export type CaseNature = 'judicial' | 'extrajudicial'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type ContactRow = {
  id: string
  firm_id: string
  reference: string
  nature: ContactNature
  relationship: ContactRelationship
  status: ContactStatus
  display_name: string
  first_name: string | null
  last_name: string | null
  legal_name: string | null
  tax_id: string | null
  email: string | null
  phone: string | null
  source: string | null
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ContactInsert = {
  firm_id: string
  nature: ContactNature
  relationship: ContactRelationship
  display_name: string
  status?: ContactStatus
  first_name?: string | null
  last_name?: string | null
  legal_name?: string | null
  tax_id?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
  details?: Json
}

export type CaseRow = {
  id: string
  firm_id: string
  case_number: number
  reference: string
  primary_contact_id: string
  opportunity_id: string | null
  title: string
  area: string
  matter_type: string
  nature: CaseNature
  general_status: string
  phase: string
  operational_status: string
  priority: OpportunityPriority
  assigned_to: string | null
  opened_on: string
  closed_on: string | null
  next_action: string
  current_position: string
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type CaseInsert = {
  id?: string
  firm_id: string
  case_number?: number
  primary_contact_id: string
  opportunity_id?: string | null
  title: string
  area?: string
  matter_type?: string
  nature: CaseRow['nature']
  general_status?: string
  phase?: string
  operational_status?: string
  priority?: OpportunityPriority
  assigned_to?: string | null
  opened_on?: string
  closed_on?: string | null
  next_action?: string
  current_position?: string
  details?: Json
}

export type CaseWorkstreamRow = {
  id: string
  firm_id: string
  case_id: string
  parent_id: string | null
  title: string
  work_type: string
  description: string
  status: string
  priority: OpportunityPriority
  assigned_to: string | null
  starts_on: string | null
  target_on: string | null
  resolved_on: string | null
  closed_on: string | null
  sort_order: number
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type CaseWorkstreamInsert = {
  id?: string
  firm_id: string
  case_id: string
  parent_id?: string | null
  title: string
  work_type?: string
  description?: string
  status?: string
  priority?: OpportunityPriority
  assigned_to?: string | null
  starts_on?: string | null
  target_on?: string | null
  resolved_on?: string | null
  closed_on?: string | null
  sort_order?: number
  details?: Json
}

export type CaseActivityRow = {
  id: string
  firm_id: string
  case_id: string
  workstream_id: string | null
  activity_type: string
  title: string
  description: string
  occurred_at: string
  assigned_to: string | null
  status: string
  result: string
  next_action: string
  time_spent_hours: number
  billable: boolean
  client_visible: boolean
  client_informed: boolean
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type CaseActivityInsert = {
  id?: string
  firm_id: string
  case_id: string
  workstream_id?: string | null
  activity_type: string
  title: string
  description?: string
  occurred_at?: string
  assigned_to?: string | null
  status?: string
  result?: string
  next_action?: string
  time_spent_hours?: number
  billable?: boolean
  client_visible?: boolean
  client_informed?: boolean
  details?: Json
}

export type CaseParticipantRow = {
  id: string
  firm_id: string
  case_id: string
  contact_id: string | null
  name: string
  role: string
  confidentiality: 'normal' | 'restricted' | 'confidential'
  details: Json
  created_at: string
}

export type CaseParticipantInsert = {
  id?: string
  firm_id: string
  case_id: string
  contact_id?: string | null
  name: string
  role: string
  confidentiality?: CaseParticipantRow['confidentiality']
  details?: Json
}

export type CaseEventRow = {
  id: string
  firm_id: string
  case_id: string
  entity_type: 'case' | 'workstream' | 'activity' | 'participant'
  entity_id: string
  action: 'created' | 'updated' | 'deleted'
  changed_fields: string[]
  actor_id: string | null
  created_at: string
}

export type CaseDocumentRow = {
  id: string
  firm_id: string
  case_id: string
  workstream_id: string | null
  folder_id: string | null
  logical_document_id: string
  previous_version_id: string | null
  version: number
  category: string
  original_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  confidentiality: 'normal' | 'restricted' | 'confidential'
  checksum_sha256: string | null
  content_status: 'pending' | 'validated' | 'rejected'
  is_current: boolean
  archived_at: string | null
  archived_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DocumentFolderRow = {
  id: string
  firm_id: string
  case_id: string
  parent_id: string | null
  name: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TaskRow = {
  id: string
  firm_id: string
  opportunity_id: string | null
  case_id: string | null
  workstream_id: string | null
  kind: 'task' | 'reminder' | 'event' | 'deadline'
  title: string
  description: string
  status: TaskStatus
  priority: OpportunityPriority
  due_on: string | null
  due_at: string | null
  reminder_at: string | null
  deadline_class: 'judicial' | 'extrajudicial' | null
  validation_status: 'not_required' | 'proposed' | 'validated' | 'rejected'
  deadline_source: string
  validation_note: string
  validated_by: string | null
  validated_at: string | null
  completed_at: string | null
  critical: boolean
  assigned_to: string | null
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type TaskInsert = {
  id?: string
  firm_id: string
  opportunity_id?: string | null
  case_id?: string | null
  workstream_id?: string | null
  kind?: TaskRow['kind']
  title: string
  description?: string
  status?: TaskStatus
  priority?: OpportunityPriority
  due_on?: string | null
  due_at?: string | null
  reminder_at?: string | null
  deadline_class?: TaskRow['deadline_class']
  validation_status?: TaskRow['validation_status']
  deadline_source?: string
  validation_note?: string
  critical?: boolean
  assigned_to?: string | null
  details?: Json
}

export type TaskEventRow = {
  id: string
  firm_id: string
  task_id: string
  event_type: string
  payload: Json
  actor_id: string | null
  created_at: string
}

export type NoteRow = {
  id: string
  firm_id: string
  scope: 'person' | 'case' | 'opportunity' | 'execution' | 'quote'
  origin_id: string
  origin_label: string
  title: string | null
  content: string
  case_id: string | null
  opportunity_id: string | null
  status: 'active' | 'resolved' | 'archived'
  highlighted: boolean
  critical: boolean
  requires_acknowledgement: boolean
  validity: 'permanent' | 'temporary'
  starts_on: string | null
  review_on: string | null
  expires_on: string | null
  expiry_action: 'archive' | 'confirm'
  review_pending: boolean
  snoozed_until: string | null
  visibility: 'team' | 'restricted'
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  resolved_by: string | null
  resolved_at: string | null
  archived_by: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type NoteInsert = Omit<NoteRow, 'id' | 'created_at' | 'updated_at'>
export type NoteContactRow = { note_id: string; firm_id: string; contact_id: string }
export type NotePermissionRow = {
  note_id: string
  firm_id: string
  user_id: string
  created_at: string
}
export type NoteAcknowledgementRow = { note_id: string; user_id: string; acknowledged_at: string }
export type NoteEventRow = {
  id: string
  note_id: string
  firm_id: string
  event_type: string
  detail: string | null
  actor_id: string | null
  created_at: string
}

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'written_off'

export type InvoiceRow = {
  id: string
  firm_id: string
  case_id: string
  contact_id: string
  series: string
  fiscal_year: number
  invoice_number: number
  reference: string
  recipient_name: string
  concept: string
  currency: string
  net_amount: number
  tax_amount: number
  total_amount: number
  issued_on: string
  due_on: string | null
  paid_on: string | null
  status: InvoiceStatus
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type InvoiceInsert = Omit<
  InvoiceRow,
  | 'id'
  | 'reference'
  | 'total_amount'
  | 'version'
  | 'created_by'
  | 'updated_by'
  | 'created_at'
  | 'updated_at'
> & {
  series?: string
  fiscal_year?: number
  recipient_name?: string
  currency?: string
  net_amount?: number
  tax_amount?: number
  issued_on?: string
  status?: InvoiceStatus
  details?: Json
}

export type InvoicePaymentRow = {
  id: string
  firm_id: string
  invoice_id: string
  amount: number
  received_on: string
  payment_method: 'transfer' | 'card' | 'cash' | 'direct_debit' | 'other'
  external_reference: string
  details: Json
  created_by: string | null
  created_at: string
}

export type InvoicePaymentInsert = Omit<InvoicePaymentRow, 'id' | 'created_by' | 'created_at'> & {
  received_on?: string
  payment_method?: InvoicePaymentRow['payment_method']
  external_reference?: string
  details?: Json
}

export type ProcedureRow = {
  id: string
  firm_id: string
  slug: string
  title: string
  phase: string
  description: string
  sections: Json
  status: 'draft' | 'active' | 'archived'
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ProcedureInsert = Omit<
  ProcedureRow,
  'id' | 'version' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at'
> & {
  description?: string
  sections?: Json
  status?: ProcedureRow['status']
}

export type OpportunityRow = {
  id: string
  firm_id: string
  archived_at: string | null
  archived_by: string | null
  archive_reason: string | null
  reference: string
  contact_id: string
  title: string
  area: string
  stage: OpportunityStage
  substage: string
  priority: OpportunityPriority
  operational_status: string
  source: string
  description: string
  assigned_to: string | null
  estimated_amount: number | null
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type OpportunityInsert = {
  firm_id: string
  archived_at?: string | null
  archived_by?: string | null
  archive_reason?: string | null
  contact_id: string
  title: string
  area?: string
  stage?: OpportunityStage
  substage?: string
  priority?: OpportunityPriority
  operational_status?: string
  source?: string
  description?: string
  assigned_to?: string | null
  estimated_amount?: number | null
  details?: Json
}

export type OpportunityEventRow = {
  id: string
  firm_id: string
  opportunity_id: string
  event_type: string
  payload: Json
  actor_id: string | null
  created_at: string
}

export type OpportunityEventInsert = {
  firm_id: string
  opportunity_id: string
  event_type: string
  payload?: Json
}
