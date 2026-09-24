import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TaskInboxItemRow } from '@/shared/infrastructure/supabase'

import { TaskInbox } from './task-workspace'

describe('TaskInbox', () => {
  it('moves a personal inbox entry by drag-and-drop without changing task state', () => {
    const onMove = vi.fn().mockResolvedValue(undefined)
    const item: TaskInboxItemRow = {
      id: 'inbox-item-1',
      firm_id: 'firm-1',
      user_id: 'user-1',
      task_id: null,
      capture_text: 'Revisar la documentación.',
      stage: 'inbox',
      position: 0,
      created_at: '2026-09-20T09:00:00.000Z',
      updated_at: '2026-09-20T09:00:00.000Z',
    }
    const setData = vi.fn()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      getData: vi.fn(() => item.id),
      setData,
    } as unknown as DataTransfer

    render(
      <TaskInbox items={[item]} tasks={[]} pending={false} onCapture={vi.fn()} onMove={onMove} />,
    )

    const dragHandle = screen.getByRole('button', {
      name: 'Arrastrar entrada Revisar la documentación.',
    })
    const clarifyStage = screen.getByTestId('task-inbox-stage-clarify')
    fireEvent.dragStart(dragHandle, { dataTransfer })
    fireEvent.dragOver(clarifyStage, { dataTransfer })
    fireEvent.drop(clarifyStage, { dataTransfer })

    expect(setData).toHaveBeenCalledWith('text/plain', item.id)
    expect(onMove).toHaveBeenCalledWith(item.id, 'clarify')
  })
})
