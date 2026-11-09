/** Readable message of anything thrown (Error, Supabase/Postgrest error object, string). */
export function errorMessage(failure: unknown, fallback: string): string {
  if (typeof failure === 'string' && failure) return failure
  if (failure && typeof failure === 'object' && 'message' in failure) {
    const message = String(failure.message)
    if (message) return message
  }
  return fallback
}
