import type { CalendarJob, CalendarJobDetails } from './calendar.ts'

type DetailsQuery = { job_id: string; expected_lease: string; expected_revision: number }

export async function calendarJobDetails(
  job: CalendarJob,
  lookup: (query: DetailsQuery) => Promise<CalendarJobDetails | null>,
) {
  if (!job.active) return undefined
  const details = await lookup({
    job_id: job.id,
    expected_lease: job.lease_id,
    expected_revision: job.revision,
  })
  if (!details) throw new Error('Calendar job details unavailable')
  return details
}