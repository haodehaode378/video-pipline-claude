import { describe, expect, it } from 'vitest'
import { buildAssistantUserPrompt, normalizeMessages } from './assistant.js'

describe('assistant route helpers', () => {
  it('keeps only recent user and assistant messages', () => {
    const messages = [
      { role: 'system', content: 'ignore' },
      ...Array.from({ length: 13 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `m${index}` })),
    ]

    const normalized = normalizeMessages(messages)

    expect(normalized).toHaveLength(12)
    expect(normalized[0].content).toBe('m1')
    expect(normalized.every((message) => ['user', 'assistant'].includes(message.role))).toBe(true)
  })

  it('builds a prompt with page context and chat history', () => {
    const prompt = buildAssistantUserPrompt({
      context: { page: 'create', topic: '栈和队列' },
      messages: [{ role: 'user', content: '帮我想一个角度' }],
    })

    expect(prompt).toContain('"page": "create"')
    expect(prompt).toContain('栈和队列')
    expect(prompt).toContain('用户：帮我想一个角度')
  })
})
