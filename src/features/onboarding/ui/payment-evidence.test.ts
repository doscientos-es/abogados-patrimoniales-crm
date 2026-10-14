import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infrastructure/supabase', () => ({ getSupabaseBrowserClient: () => null }))

import { validatePaymentEvidenceFile } from './payment-evidence'

describe('justificante de pago', () => {
  it('acepta PDF', () => {
    expect(
      validatePaymentEvidenceFile(new File(['x'], 'justificante.pdf', { type: 'application/pdf' })),
    ).toBeNull()
  })

  it('rechaza formatos no admitidos por el almacenamiento privado', () => {
    expect(
      validatePaymentEvidenceFile(
        new File(['x'], 'ejecutable.exe', { type: 'application/x-msdownload' }),
      ),
    ).not.toBeNull()
  })
})
