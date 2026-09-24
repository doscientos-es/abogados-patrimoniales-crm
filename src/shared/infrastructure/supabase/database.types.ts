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
          onboarding_sequence: number
          created_at: string
          updated_at: string
        },
        {
          id?: string
          name: string
          invoice_sequence?: number
          onboarding_sequence?: number
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
      crm_contact_documents: Table<ContactDocumentRow, ContactDocumentInsert, never>
      crm_contact_bank_accounts: Table<ContactBankAccountRow, never, never>
      crm_executions: Table<
        ExecutionRow,
        ExecutionInsert,
        Partial<ExecutionInsert> & { version?: number }
      >
      crm_execution_events: Table<ExecutionEventRow, never, never>
      crm_document_folders: Table<DocumentFolderRow, never, never>
      crm_document_task_links: Table<DocumentTaskLinkRow, never, never>
      crm_drive_connections: Table<DriveConnectionRow, DriveConnectionInsert>
      crm_drive_sync_jobs: Table<DriveSyncJobRow, DriveSyncJobInsert>
      crm_tasks: Table<TaskRow, TaskInsert, never>
      crm_task_events: Table<TaskEventRow, never, never>
      crm_task_messages: Table<TaskMessageRow, never, never>
      crm_task_evidences: Table<TaskEvidenceRow, never, never>
      crm_task_dependencies: Table<TaskDependencyRow, never, never>
      crm_task_inbox_items: Table<TaskInboxItemRow, TaskInboxItemInsert>
      crm_notes: Table<NoteRow, NoteInsert, Partial<NoteInsert> & { id?: string }>
      crm_note_contacts: Table<NoteContactRow, never, never>
      crm_note_permissions: Table<NotePermissionRow, never, never>
      crm_note_acknowledgements: Table<
        NoteAcknowledgementRow,
        { note_id: string; user_id: string },
        never
      >
      crm_note_events: Table<NoteEventRow, never, never>
      crm_invoices: Table<InvoiceRow, never, never>
      crm_invoice_lines: Table<InvoiceLineRow, never, never>
      crm_invoice_payments: Table<InvoicePaymentRow, never, never>
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
      crm_opportunity_events: Table<OpportunityEventRow, never, never>
      crm_onboardings: Table<OnboardingRow, OnboardingInsert, never>
      crm_onboarding_events: Table<OnboardingEventRow, never, never>
      crm_task_labels: Table<
        TaskLabelRow,
        TaskLabelInsert,
        Partial<TaskLabelInsert> & { id?: string }
      >
      crm_task_title_templates: Table<
        TaskTitleTemplateRow,
        TaskTitleTemplateInsert,
        Partial<TaskTitleTemplateInsert> & { id?: string }
      >
      crm_practice_areas: Table<
        PracticeAreaRow,
        PracticeAreaInsert,
        Partial<PracticeAreaInsert> & { id?: string }
      >
      crm_task_label_assignments: Table<TaskLabelAssignmentRow, TaskLabelAssignmentInsert, never>
    }
    Views: Record<never, never>
    Functions: {
      crm_merge_task_labels: {
        Args: { source_label_id: string; target_label_id: string }
        Returns: undefined
      }
      crm_derive_execution: {
        Args: { target_execution_id: string; target_expected_version: number }
        Returns: ExecutionRow
      }
      crm_replace_contact_bank_account: {
        Args: { target_firm_id: string; target_contact_id: string; bank_data: Json }
        Returns: ContactBankAccountRow
      }
      crm_update_contact_profile: {
        Args: { target_contact_id: string; target_expected_version: number; new_profile: Json }
        Returns: ContactRow
      }
      crm_bootstrap_firm: { Args: { firm_name: string }; Returns: string }
      crm_queue_drive_sync: {
        Args: { target_document_id: string; target_operation: 'upload' | 'move' | 'archive' }
        Returns: DriveSyncJobRow
      }
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
      crm_create_case: {
        Args: {
          target_firm_id: string
          target_contact_id: string
          target_opportunity_id: string | null
          new_title: string
          new_area: string
          new_matter_type: string
          new_nature: CaseNature
          new_priority: OpportunityPriority
          new_assigned_to: string | null
          new_opened_on: string
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
      crm_create_task: {
        Args: {
          target_firm_id: string
          target_case_id: string | null
          target_opportunity_id: string | null
          new_kind: TaskRow['kind']
          new_title: string
          new_description: string
          new_priority: OpportunityPriority
          new_due_at: string | null
          new_reminder_at: string | null
          new_assigned_to: string | null
          new_deadline_class?: TaskRow['deadline_class']
          initial_message?: string | null
          new_parent_task_id?: string | null
          new_meeting_details?: Json
        }
        Returns: TaskRow
      }
      crm_open_task: { Args: { target_task_id: string }; Returns: TaskRow }
      crm_set_task_status: {
        Args: {
          target_task_id: string
          target_expected_version: number
          new_status: TaskStatus
          result_text?: string | null
          cancellation_text?: string | null
        }
        Returns: TaskRow
      }
      crm_put_task_on_hold: {
        Args: {
          target_task_id: string
          target_expected_version: number
          reason: string
          review_at: string
          detail?: string | null
        }
        Returns: TaskRow
      }
      crm_complete_task: {
        Args: {
          target_task_id: string
          target_expected_version: number
          result_text: string
          continuity_decision?: string | null
        }
        Returns: TaskRow
      }
      crm_set_next_action: {
        Args: { target_task_id: string; target_expected_version: number; enabled: boolean }
        Returns: TaskRow
      }
      crm_add_task_message: {
        Args: { target_task_id: string; message_body: string }
        Returns: TaskMessageRow
      }
      crm_add_task_evidence: {
        Args: {
          target_task_id: string
          evidence_body?: string | null
          target_document_id?: string | null
        }
        Returns: TaskEvidenceRow
      }
      crm_create_task_dependency: {
        Args: { target_predecessor_id: string; target_successor_id: string }
        Returns: TaskDependencyRow
      }
      crm_remove_task_dependency: { Args: { target_dependency_id: string }; Returns: undefined }
      crm_update_task_meeting: {
        Args: {
          target_task_id: string
          target_expected_version: number
          new_meeting_details: Json
        }
        Returns: TaskRow
      }
      crm_update_special_meeting: {
        Args: {
          target_task_id: string
          target_expected_version: number
          new_meeting_details: Json
        }
        Returns: TaskRow
      }
      crm_reassign_task: {
        Args: {
          target_task_id: string
          target_expected_version: number
          new_assigned_to: string | null
        }
        Returns: TaskRow
      }
      crm_reject_task: {
        Args: { target_task_id: string; target_expected_version: number; reason: string }
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
      crm_archive_case_document: {
        Args: { target_document_id: string; target_expected_version: number }
        Returns: CaseDocumentRow
      }
      crm_update_document_workflow: {
        Args: {
          target_document_id: string
          target_expected_version: number
          target_workflow_status: CaseDocumentRow['workflow_status']
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
      crm_move_document_folder: {
        Args: { target_folder_id: string; target_parent_id: string | null }
        Returns: DocumentFolderRow
      }
      crm_link_document_task: {
        Args: { target_document_id: string; target_task_id: string }
        Returns: DocumentTaskLinkRow
      }
      crm_unlink_document_task: {
        Args: { target_document_id: string; target_task_id: string }
        Returns: undefined
      }
      crm_create_document_task: {
        Args: {
          target_document_id: string
          new_kind: TaskRow['kind']
          new_title: string
          new_description: string
          new_priority: OpportunityPriority
          new_due_at: string | null
          new_reminder_at: string | null
          new_deadline_class: TaskRow['deadline_class']
          new_assigned_to: string | null
        }
        Returns: TaskRow
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
      crm_get_firm_member_assignment_count: {
        Args: { target_firm_id: string; target_user_id: string }
        Returns: number
      }
      crm_delete_firm_member: {
        Args: { target_firm_id: string; target_user_id: string }
        Returns: number
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
      crm_update_opportunity_details: {
        Args: { target_opportunity_id: string; target_expected_version: number; new_details: Json }
        Returns: OpportunityRow
      }
      crm_log_opportunity_communication: {
        Args: {
          target_opportunity_id: string
          communication_type: string
          subject_or_summary: string
        }
        Returns: undefined
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
      crm_create_onboarding: {
        Args: {
          target_firm_id: string
          target_contact_id: string
          target_opportunity_id: string
          new_matter_title: string
          new_quote_reference: string
          new_quote_amount: number | null
          new_assigned_to: string | null
          new_proforma_sent_on: string
          new_next_action: string
        }
        Returns: OnboardingRow
      }
      crm_update_onboarding_action: {
        Args: {
          target_onboarding_id: string
          target_expected_version: number
          new_next_action: string
        }
        Returns: OnboardingRow
      }
      crm_transition_onboarding: {
        Args: {
          target_onboarding_id: string
          target_expected_version: number
          transition_action: string
          occurred_on: string | null
          scheduled_at: string | null
          new_engagement_mode: string | null
        }
        Returns: OnboardingRow
      }
      crm_log_onboarding_communication: {
        Args: {
          target_onboarding_id: string
          communication_type: string
          subject_or_summary: string
        }
        Returns: undefined
      }
      crm_open_onboarding_case: {
        Args: {
          target_onboarding_id: string
          target_expected_version: number
          new_title: string
          new_area: string
          new_matter_type: string
          new_nature: CaseNature
          new_priority: OpportunityPriority
          new_assigned_to: string | null
          new_next_action: string
          new_current_position: string
        }
        Returns: CaseRow
      }
      crm_save_invoice_draft: {
        Args: {
          target_firm_id: string
          target_invoice_id: string | null
          target_expected_version: number
          target_case_id: string
          target_contact_id: string
          new_recipient_name: string
          new_concept: string
          new_currency: string
          new_issued_on: string
          new_due_on: string | null
          new_lines: Json
        }
        Returns: InvoiceRow
      }
      crm_issue_invoice: {
        Args: {
          target_invoice_id: string
          target_expected_version: number
          new_issued_on: string
          new_due_on: string | null
        }
        Returns: InvoiceRow
      }
      crm_discard_invoice_draft: {
        Args: {
          target_invoice_id: string
          target_expected_version: number
          discard_reason: string
        }
        Returns: InvoiceRow
      }
      crm_register_invoice_payment: {
        Args: {
          target_invoice_id: string
          new_amount: number
          new_received_on: string
          new_payment_method: InvoicePaymentRow['payment_method']
          new_external_reference: string
        }
        Returns: InvoicePaymentRow
      }
      crm_create_credit_note: {
        Args: {
          target_invoice_id: string
          target_expected_version: number
          rectification_reason: string
        }
        Returns: InvoiceRow
      }
      crm_global_search: {
        Args: { target_firm_id: string; search_term: string }
        Returns: {
          id: string
          entity_type: string
          title: string
          subtitle: string
          href: string
          rank: number
        }[]
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

export type TaskLabelRow = {
  id: string
  firm_id: string
  name: string
  color: string
  archived: boolean
  created_at: string
  updated_at: string
}
export type TaskLabelInsert = { firm_id: string; name: string; color?: string; archived?: boolean }
export type TaskTitleTemplateRow = {
  id: string
  firm_id: string
  title: string
  archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
export type TaskTitleTemplateInsert = {
  firm_id: string
  title: string
  archived?: boolean
  sort_order?: number
}
export type PracticeAreaRow = {
  id: string
  firm_id: string
  parent_id: string | null
  name: string
  archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
export type PracticeAreaInsert = {
  firm_id: string
  parent_id?: string | null
  name: string
  archived?: boolean
  sort_order?: number
}
export type TaskLabelAssignmentRow = { label_id: string; task_id: string; created_at: string }
export type TaskLabelAssignmentInsert = { label_id: string; task_id: string }
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
export type TaskStatus = 'pending' | 'in_progress' | 'waiting' | 'completed' | 'cancelled'

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

export type ContactDocumentType = 'identification' | 'privacy' | 'authority' | 'power' | 'other'
export type ContactDocumentRow = {
  id: string
  firm_id: string
  contact_id: string
  document_type: ContactDocumentType
  name: string
  original_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  document_status: 'current' | 'pending' | 'expiring' | 'expired' | 'revoked' | 'not_applicable'
  document_number: string
  issued_on: string | null
  expires_on: string | null
  signed_on: string | null
  observations: string
  tags: string[]
  uploaded_by: string
  created_at: string
}
export type ContactDocumentInsert = Omit<
  ContactDocumentRow,
  'id' | 'created_at' | 'uploaded_by'
> & {
  id?: string
  created_at?: string
  uploaded_by?: string
}
export type ContactBankAccountRow = {
  id: string
  firm_id: string
  contact_id: string
  holder: string
  tax_id: string
  iban: string
  bank_name: string
  bic: string
  sepa_mandate: boolean
  sepa_signed_on: string | null
  mandate_status: 'current' | 'pending' | 'revoked' | 'not_applicable'
  observations: string
  valid_from: string
  valid_until: string | null
  created_by: string
  created_at: string
}

export type ExecutionRow = {
  id: string
  firm_id: string
  case_id: string
  workstream_id: string | null
  modality: 'judicial' | 'extrajudicial'
  execution_type: string
  status: string
  title: string
  object: string
  debtor: string
  beneficiary: string
  performance: string
  claimed_amount: number
  recovered_amount: number
  responsible_id: string | null
  started_on: string
  current_position: string
  next_action: string
  dependency: string
  scope: string
  budget_status: string
  next_review_on: string | null
  derived_from_id: string | null
  original_nature: string
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}
export type ExecutionInsert = Omit<
  ExecutionRow,
  'id' | 'version' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at'
> & {
  id?: string
  version?: number
  created_by?: string | null
  updated_by?: string | null
  created_at?: string
  updated_at?: string
}
export type ExecutionEventRow = {
  id: string
  firm_id: string
  execution_id: string
  event_type: 'created' | 'updated' | 'derived'
  changed_fields: string[]
  actor_id: string | null
  created_at: string
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
  workflow_status: 'inbox' | 'in_progress' | 'processed'
  is_current: boolean
  archived_at: string | null
  archived_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  drive_file_id?: string | null
  drive_parent_id?: string | null
  drive_sync_status?: 'not_configured' | 'pending' | 'synced' | 'error'
  drive_synced_at?: string | null
  drive_error?: string | null
}

export type DriveConnectionRow = {
  firm_id: string
  root_folder_id: string
  root_folder_name: string
  status: 'disconnected' | 'connected' | 'error'
  last_sync_at: string | null
  last_error: string | null
  connected_at: string | null
  connected_by: string | null
  created_at: string
  updated_at: string
}

export type DriveConnectionInsert = Partial<DriveConnectionRow> & { firm_id: string }

export type DriveSyncJobRow = {
  id: string
  firm_id: string
  document_id: string | null
  operation: 'upload' | 'move' | 'archive'
  status: 'pending' | 'running' | 'done' | 'error'
  attempts: number
  error: string | null
  created_at: string
  processed_at: string | null
}

export type DriveSyncJobInsert = Partial<DriveSyncJobRow> & {
  firm_id: string
  operation: DriveSyncJobRow['operation']
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

export type DocumentTaskLinkRow = {
  id: string
  firm_id: string
  case_id: string
  document_logical_id: string
  task_id: string
  created_by: string | null
  created_at: string
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
  is_next_action: boolean
  waiting_reason: string | null
  waiting_until: string | null
  waiting_detail: string
  completion_result: string
  cancellation_reason: string
  opened_at: string | null
  opened_by: string | null
  rejection_reason: string
  rejected_at: string | null
  parent_task_id: string | null
  meeting_details: Json
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
  is_next_action?: boolean
  waiting_reason?: string | null
  waiting_until?: string | null
  waiting_detail?: string
  completion_result?: string
  cancellation_reason?: string
  opened_at?: string | null
  opened_by?: string | null
  rejection_reason?: string
  rejected_at?: string | null
  parent_task_id?: string | null
  meeting_details?: Json
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

export type TaskMessageRow = {
  id: string
  firm_id: string
  task_id: string
  author_id: string | null
  body: string
  message_type: 'initial_assignment' | 'comment' | 'system'
  created_at: string
}

export type TaskEvidenceRow = {
  id: string
  firm_id: string
  task_id: string
  created_by: string | null
  body: string
  document_id: string | null
  created_at: string
}

export type TaskDependencyRow = {
  id: string
  firm_id: string
  predecessor_task_id: string
  successor_task_id: string
  created_by: string | null
  created_at: string
}

export type TaskInboxItemRow = {
  id: string
  firm_id: string
  user_id: string
  task_id: string | null
  capture_text: string
  stage: 'inbox' | 'clarify' | 'delegate' | 'next' | 'now' | 'waiting' | 'weekly_review'
  position: number
  created_at: string
  updated_at: string
}

export type TaskInboxItemInsert = Omit<TaskInboxItemRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
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

export type InvoiceKind = 'standard' | 'credit_note'

export type InvoiceRow = {
  id: string
  firm_id: string
  case_id: string
  contact_id: string
  series: string
  fiscal_year: number
  invoice_number: number | null
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
  kind: InvoiceKind
  rectifies_invoice_id: string | null
  cancellation_reason: string
  issued_at: string | null
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type InvoiceLineRow = {
  id: string
  firm_id: string
  invoice_id: string
  line_number: number
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  net_amount: number
  tax_amount: number
  created_at: string
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

export type OnboardingPhase = 'proforma' | 'payment' | 'formal_start' | 'completed'
export type OnboardingEngagementMode = 'pending' | 'in_person' | 'video_call' | 'phone_call'

export type OnboardingRow = {
  id: string
  firm_id: string
  contact_id: string
  opportunity_id: string | null
  case_id: string | null
  reference: string
  matter_title: string
  phase: OnboardingPhase
  phase_changed_on: string
  quote_reference: string | null
  quote_amount: number | null
  proforma_sent_on: string
  payment_confirmed_on: string | null
  formal_start_scheduled_at: string | null
  formal_start_completed_at: string | null
  assigned_to: string | null
  next_action: string
  engagement_mode: OnboardingEngagementMode
  details: Json
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type OnboardingInsert = Omit<
  OnboardingRow,
  'id' | 'version' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at'
> & {
  phase_changed_on?: string
  quote_reference?: string | null
  quote_amount?: number | null
  payment_confirmed_on?: string | null
  formal_start_scheduled_at?: string | null
  formal_start_completed_at?: string | null
  assigned_to?: string | null
  next_action?: string
  engagement_mode?: OnboardingEngagementMode
  details?: Json
}

export type OnboardingEventRow = {
  id: string
  firm_id: string
  onboarding_id: string
  event_type: string
  payload: Json
  actor_id: string | null
  created_at: string
}
