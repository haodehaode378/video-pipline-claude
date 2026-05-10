import { afterEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
})

describe('sendMessage empty content diagnostics', () => {
  it('logs response metadata when a non-streaming response has no content', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_STREAM = 'false'
    vi.resetModules()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-test',
        model: 'test-model',
        object: 'chat.completion',
        choices: [{ finish_reason: 'stop', message: { role: 'assistant' } }],
        usage: { total_tokens: 12 },
      }),
    })))

    const { sendMessage } = await import('./claude-client.js')
    const result = await sendMessage('system', 'user')

    expect(result.error).toContain('No content in response')
    expect(warn).toHaveBeenCalledWith(
      'AI API empty content diagnostics:',
      expect.stringContaining('"finish_reason":"stop"'),
    )
  })

  it('passes reasoning_split for MiniMax-compatible endpoints and strips think tags', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_BASE_URL = 'https://api.minimaxi.com/v1'
    process.env.OPENAI_MODEL = 'MiniMax-M2.7'
    process.env.OPENAI_STREAM = 'false'
    vi.resetModules()

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '<think>hidden reasoning</think>{"ok":true}',
          },
        }],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { sendMessage } = await import('./claude-client.js')
    const result = await sendMessage('system', 'user')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(body.reasoning_split).toBe(true)
    expect(result.text).toBe('{"ok":true}')
  })

  it('passes JSON schema response_format through to the API body', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_STREAM = 'false'
    vi.resetModules()

    const responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'test_schema',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
    }

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"ok":true}',
          },
        }],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { sendMessage } = await import('./claude-client.js')
    await sendMessage('system', 'user', { responseFormat })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(body.response_format).toEqual(responseFormat)
  })

  it('retries once without response_format when an OpenAI-compatible API rejects json_schema', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_STREAM = 'false'
    vi.resetModules()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'test_schema',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
    }

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'unknown parameter: response_format',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: '{"ok":true}',
            },
          }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const { sendMessage } = await import('./claude-client.js')
    const result = await sendMessage('system', 'user', { responseFormat })
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body)

    expect(result.text).toBe('{"ok":true}')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(firstBody.response_format).toEqual(responseFormat)
    expect(secondBody.response_format).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      'AI API does not support structured response_format; retrying without response_format.',
    )
  })

  it('does not fallback for unrelated client errors', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_STREAM = 'false'
    vi.resetModules()

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'title is required',
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { sendMessage } = await import('./claude-client.js')
    const result = await sendMessage('system', 'user', {
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: 'test_schema',
          strict: true,
          schema: { type: 'object' },
        },
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.error).toContain('title is required')
  })

  it('does not make an extra fallback request when responseFormat is not configured', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_STREAM = 'false'
    vi.resetModules()

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'unknown parameter: response_format',
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { sendMessage } = await import('./claude-client.js')
    const result = await sendMessage('system', 'user')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.error).toContain('unknown parameter: response_format')
  })
})
