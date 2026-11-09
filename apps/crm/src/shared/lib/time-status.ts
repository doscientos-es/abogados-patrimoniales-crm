export function isOverdue(dueAt: string | null, now = Date.now()) {
  if (!dueAt) return false
  const dueAtMs = new Date(dueAt).getTime()
  return Number.isFinite(dueAtMs) && dueAtMs < now
}

export function isOlderThan(timestamp: string, ageMs: number, now = Date.now()) {
  const timestampMs = new Date(timestamp).getTime()
  return Number.isFinite(timestampMs) && timestampMs <= now - ageMs
}
