import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getClient: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: mocks.getClient,
}))

import { uploadContactDocument } from './upload-contact-document'

const file = (type = 'application/pdf') => new File(['document'], 'id.pdf', { type })

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.getClient.mockReturnValue({
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  })
  mocks.from.mockReturnValue({ insert: mocks.insert })
  mocks.storageFrom.mockReturnValue({ remove: mocks.remove, upload: mocks.upload })
  mocks.upload.mockResolvedValue({ error: null })
  mocks.insert.mockResolvedValue({ error: null })
  mocks.remove.mockResolvedValue({ error: null })
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('10000000-0000-4000-8000-000000000001')
})

afterEach(() => vi.restoreAllMocks())

describe('uploadContactDocument', () => {
  it('uploads the private file and inserts matching metadata', async () => {
    const result = await uploadContactDocument({
      firmId: 'firm-1',
      contactId: 'contact-1',
      file: file(),
      name: ' Identificación ',
      type: 'identification',
      tags: ['lead:1'],
    })

    expect(mocks.upload).toHaveBeenCalledWith(
      'firm-1/contact-1/10000000-0000-4000-8000-000000000001/id.pdf',
      expect.any(File),
      { contentType: 'application/pdf', upsert: false },
    )
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '10000000-0000-4000-8000-000000000001',
        firm_id: 'firm-1',
        contact_id: 'contact-1',
        name: 'Identificación',
        storage_path: 'firm-1/contact-1/10000000-0000-4000-8000-000000000001/id.pdf',
        document_status: 'current',
        document_number: '',
        issued_on: null,
        tags: ['lead:1'],
      }),
    )
    expect(result).toEqual({
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Identificación',
    })
  })

  it('preserves optional document details used by the personal-files form', async () => {
    await uploadContactDocument({
      firmId: 'firm-1',
      contactId: 'contact-1',
      file: file(),
      name: 'Poder',
      type: 'power',
      documentStatus: 'expiring',
      documentNumber: 'P-42',
      issuedOn: '2026-01-02',
      expiresOn: '2027-01-02',
      signedOn: '2026-01-03',
    })

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_status: 'expiring',
        document_number: 'P-42',
        issued_on: '2026-01-02',
        expires_on: '2027-01-02',
        signed_on: '2026-01-03',
      }),
    )
  })

  it('rejects unsupported files before connecting to Supabase', async () => {
    await expect(
      uploadContactDocument({
        firmId: 'firm-1',
        contactId: 'contact-1',
        file: file('text/plain'),
        name: 'Documento',
        type: 'other',
      }),
    ).rejects.toThrow('sube un PDF, JPG o PNG de hasta 25 MB')
    expect(mocks.getClient).not.toHaveBeenCalled()
  })

  it('removes the uploaded object when inserting metadata fails', async () => {
    mocks.insert.mockResolvedValue({ error: new Error('metadata failed') })

    await expect(
      uploadContactDocument({
        firmId: 'firm-1',
        contactId: 'contact-1',
        file: file(),
        name: 'Documento',
        type: 'other',
      }),
    ).rejects.toThrow('metadata failed')

    expect(mocks.remove).toHaveBeenCalledWith([
      'firm-1/contact-1/10000000-0000-4000-8000-000000000001/id.pdf',
    ])
  })
})