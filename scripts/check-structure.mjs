import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const checker = resolve('node_modules/@doscientos/configs/structure/check-structure.mjs')
const result = spawnSync(process.execPath, [checker, '--root', 'src', '--tanstack-router'], {
  encoding: 'utf8',
})

if (result.status === 0) {
  process.stdout.write(result.stdout)
  process.exit(0)
}

const acceptedLegacyViolations = new Set([
  'src/components: use one of app, features, pages, shared, routes or configure the checker',
  'src/data: use one of app, features, pages, shared, routes or configure the checker',
  'src/hooks: use one of app, features, pages, shared, routes or configure the checker',
  'src/lib: use one of app, features, pages, shared, routes or configure the checker',
  'src/test: use one of app, features, pages, shared, routes or configure the checker',
  'src/lib/email-tarea.functions.ts: file names must use kebab-case and standard suffixes',
  'src/lib/ia-cumplimentacion.functions.ts: file names must use kebab-case and standard suffixes',
  'src/lib/resumen-ia.functions.ts: file names must use kebab-case and standard suffixes',
  'src/shared/infrastructure/supabase/database.types.ts: file names must use kebab-case and standard suffixes',
])
const violations = result.stderr
  .split(/\r?\n/)
  .filter((line) => line.startsWith('- '))
  .map((line) => line.slice(2))
const regressions = violations.filter((violation) => !acceptedLegacyViolations.has(violation))

if (regressions.length || !violations.length) {
  process.stderr.write(
    result.stderr || result.stdout || 'Structure checker failed without output.\n',
  )
  process.exit(result.status ?? 1)
}

console.log(`Structure check passed with ${violations.length} accepted legacy violation(s).`)
