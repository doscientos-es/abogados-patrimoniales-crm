export const NEW_CHATGPT_URL = 'https://chatgpt.com/'

// Match the database constraint: path segments are case-sensitive, IDs accept either hex case.
const conversationId = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const webConversationPath = new RegExp(`^/(?:g/[a-zA-Z0-9_-]+/)?c/${conversationId}/?$`)
const appConversationPath = new RegExp(`^/${conversationId}/?$`)

/** Accept private conversation links only, never public shares or arbitrary protocols. */
export function normalizeChatgptLink(input: string): string {
  const value = input.trim()
  if (value.length > 2048 || /[\s\\]/.test(value)) throw invalidLink()

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw invalidLink()
  }

  if (url.username || url.password || url.port || url.search || url.hash) throw invalidLink()
  const host = url.hostname.toLowerCase()
  const web =
    url.protocol === 'https:' &&
    ['chatgpt.com', 'chat.openai.com'].includes(host) &&
    webConversationPath.test(url.pathname)
  const app =
    url.protocol === 'chatgpt:' &&
    ['c', 'conversation'].includes(host) &&
    appConversationPath.test(url.pathname)
  if (!web && !app) throw invalidLink()

  return `${url.protocol}//${host}${url.pathname.replace(/\/$/, '')}`
}

function invalidLink() {
  return new Error(
    'Pega la URL privada de una conversación de ChatGPT o su deep link (chatgpt://c/… o chatgpt://conversation/…). No uses enlaces públicos de Compartir.',
  )
}
