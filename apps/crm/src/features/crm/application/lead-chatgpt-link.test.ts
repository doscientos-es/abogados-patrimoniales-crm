import { describe, expect, it } from 'vitest'

import { normalizeChatgptLink } from './lead-chatgpt-link'

const id = '12345678-1234-1234-1234-123456789abc'

describe('normalizeChatgptLink private conversation allowlist', () => {
  it.each([
    [` https://chatgpt.com/c/${id}/ `, `https://chatgpt.com/c/${id}`],
    [`https://chat.openai.com/c/${id}`, `https://chat.openai.com/c/${id}`],
    [`https://chatgpt.com/c/${id.toUpperCase()}`, `https://chatgpt.com/c/${id.toUpperCase()}`],
    [
      `https://chatgpt.com/g/g-legal-assistant/c/${id}`,
      `https://chatgpt.com/g/g-legal-assistant/c/${id}`,
    ],
    [`chatgpt://c/${id}`, `chatgpt://c/${id}`],
    [`chatgpt://conversation/${id}`, `chatgpt://conversation/${id}`],
  ])('accepts a private conversation: %s', (input, expected) => {
    expect(normalizeChatgptLink(input)).toBe(expected)
  })

  it.each([
    '',
    'not a URL',
    'javascript:alert(1)',
    'data:text/html,test',
    'https://chatgpt.com/',
    `http://chatgpt.com/c/${id}`,
    `https://chatgpt.com.evil.example/c/${id}`,
    `https://evil.example/c/${id}`,
    `https://chatgpt.com@evil.example/c/${id}`,
    `https://user:password@chatgpt.com/c/${id}`,
    `https://chatgpt.com:8443/c/${id}`,
    `https://chatgpt.com/share/${id}`,
    `https://chatgpt.com/c/${id}?redirect=https://evil.example`,
    `https://chatgpt.com/c/${id}#fragment`,
    `https://chatgpt.com/c/${id}/extra`,
    `https://chatgpt.com/C/${id}`,
    `https://chatgpt.com\\c\\${id}`,
    `https://chatgpt.com/c/\n${id}`,
    'https://chatgpt.com/c/not-a-conversation',
    `file:///c/${id}`,
    `chatgpt://evil.example/c/${id}`,
    `chatgpt://c/${id}?url=https://evil.example`,
    `chatgpt://share/${id}`,
    `https://chatgpt.com/g/${'a'.repeat(2048)}/c/${id}`,
  ])('rejects unsafe, shared or non-conversation links: %s', (input) => {
    expect(() => normalizeChatgptLink(input)).toThrow('Pega la URL privada')
  })
})
