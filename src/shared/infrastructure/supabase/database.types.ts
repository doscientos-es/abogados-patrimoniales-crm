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
      crm_cases: Table<CaseReferenceRow, never, never>
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

export type CaseReferenceRow = {
  id: string
  firm_id: string
  reference: string
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
