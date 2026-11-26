const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const CIF_LETTERS = 'JABCDEFGHI'

/** Returns a warning only for recognizable Spanish IDs, not foreign documents. */
export function spanishDocumentWarning(raw: string): string | null {
  const value = raw.toUpperCase().replace(/[\s.-]/g, '')
  if (/^(?:[0-9]{8}|[XYZ][0-9]{7})[A-Z]$/.test(value)) {
    const digits = value.slice(0, -1).replace(/^[XYZ]/, (letter) => String('XYZ'.indexOf(letter)))
    return DNI_LETTERS[Number(digits) % 23] === value.at(-1)
      ? null
      : 'La letra de control del DNI o NIE no es válida.'
  }
  if (!/^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-Z]$/.test(value)) return null
  const first = value.charAt(0)
  let sum = 0
  for (let index = 1; index <= 7; index++) {
    const digit = Number(value.charAt(index)) * (index % 2 === 1 ? 2 : 1)
    sum += digit > 9 ? digit - 9 : digit
  }
  const control = (10 - (sum % 10)) % 10
  const last = value.at(-1)
  const valid = 'KPQRSW'.includes(first)
    ? last === CIF_LETTERS[control]
    : 'ABEH'.includes(first)
      ? last === String(control)
      : last === String(control) || last === CIF_LETTERS[control]
  return valid ? null : 'El dígito de control del CIF no es válido.'
}

export function validContactEmail(value: string): boolean {
  return !value.trim() || /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value.trim())
}
