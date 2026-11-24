export async function consumeInvocationToken(
  token: string | null,
  consume: (token: string) => Promise<boolean>,
) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return false
  return (await consume(token)) === true
}
