import assert from 'node:assert/strict'
import { test } from 'node:test'

import { consumeInvocationToken } from './worker-auth.ts'

test('rejects malformed credentials before querying the database', async () => {
  let called = false
  const consume = async () => {
    called = true
    return true
  }
  for (const token of [null, '', 'a'.repeat(63), 'G'.repeat(64), 'a'.repeat(65)]) {
    assert.equal(await consumeInvocationToken(token, consume), false)
  }
  assert.equal(called, false)
})

test('accepts only credentials consumed by the database', async () => {
  const token = 'a'.repeat(64)
  assert.equal(await consumeInvocationToken(token, async (received) => received === token), true)
  assert.equal(await consumeInvocationToken(token, async () => false), false)
  await assert.rejects(
    consumeInvocationToken(token, async () => {
      throw new Error('database down')
    }),
  )
})
