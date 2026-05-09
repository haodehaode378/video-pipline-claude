const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '600000', 10)
const MAX_ATTEMPTS = parseInt(process.env.OPENAI_MAX_ATTEMPTS || '3', 10)
const STREAM_RESPONSES = process.env.OPENAI_STREAM !== 'false'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientError(message = '') {
  return /terminated|timeout|aborted|econnreset|socket|network|fetch failed/i.test(message)
}

function buildRequestBody(systemPrompt, userMessage, maxTokens, temperature, stream) {
  return {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature,
    stream,
  }
}

function readContentDelta(data) {
  const choice = data.choices?.[0]
  return choice?.delta?.content || choice?.message?.content || ''
}

async function readStreamedText(response) {
  if (!response.body) return { error: 'Streaming response body is empty' }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(':')) continue
      if (!trimmed.startsWith('data:')) continue

      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return { text }

      try {
        const data = JSON.parse(payload)
        text += readContentDelta(data)
      } catch (err) {
        return { error: `Invalid streaming response: ${err.message}` }
      }
    }
  }

  if (buffer.trim()) {
    const payload = buffer.trim().replace(/^data:\s*/, '')
    if (payload !== '[DONE]') {
      try {
        const data = JSON.parse(payload)
        text += readContentDelta(data)
      } catch (err) {
        return { error: `Invalid streaming response: ${err.message}` }
      }
    }
  }

  return { text }
}

export async function sendMessage(systemPrompt, userMessage, options = {}) {
  const { maxTokens = 4096, temperature = 1 } = options

  if (!OPENAI_API_KEY) {
    return { error: 'OPENAI_API_KEY is not set' }
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildRequestBody(
          systemPrompt,
          userMessage,
          maxTokens,
          temperature,
          STREAM_RESPONSES,
        )),
      })

      if (!response.ok) {
        const errText = await response.text()
        const message = `OpenAI API error ${response.status}: ${errText.slice(0, 300)}`
        if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
          console.warn(`AI API transient error (${attempt}/${MAX_ATTEMPTS}): ${message}`)
          await sleep(1000 * attempt)
          continue
        }
        return { error: message }
      }

      const result = STREAM_RESPONSES ? await readStreamedText(response) : await response.json()
      if (result.error) return result

      const choice = result.choices?.[0]
      const text = STREAM_RESPONSES ? result.text : choice?.message?.content

      if (!text) {
        return { error: `No content in response${choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : ''}` }
      }

      return { text }
    } catch (err) {
      const message = err.name === 'AbortError' ? `request timeout after ${REQUEST_TIMEOUT_MS}ms` : err.message
      if (attempt < MAX_ATTEMPTS && isTransientError(message)) {
        console.warn(`AI API transient error (${attempt}/${MAX_ATTEMPTS}): ${message}`)
        await sleep(1000 * attempt)
        continue
      }
      console.error('AI API error:', message)
      return { error: message }
    } finally {
      clearTimeout(timeout)
    }
  }

  return { error: 'AI API request failed after retries' }
}
