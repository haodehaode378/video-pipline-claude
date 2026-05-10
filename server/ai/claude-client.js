const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || process.env.MOONSHOT_API_KEY || '').trim()
const REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '600000', 10)
const MAX_ATTEMPTS = parseInt(process.env.OPENAI_MAX_ATTEMPTS || '3', 10)
const STREAM_RESPONSES = process.env.OPENAI_STREAM !== 'false'
const USE_REASONING_SPLIT =
  process.env.OPENAI_REASONING_SPLIT === 'true'
  || (process.env.OPENAI_REASONING_SPLIT !== 'false' && /minimax/i.test(OPENAI_BASE_URL))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientError(message = '') {
  return /terminated|timeout|aborted|econnreset|socket|network|fetch failed/i.test(message)
}

function isResponseFormatUnsupported(status, message = '') {
  if (status < 400 || status >= 500) return false
  const text = String(message).toLowerCase()
  const mentionsStructuredFormat = /response_format|json_schema|schema|strict/.test(text)
  const mentionsUnsupportedParam =
    /unsupported|unknown parameter|invalid parameter|unrecognized|not supported|unavailable|extra inputs are not permitted/.test(text)
  return mentionsStructuredFormat && mentionsUnsupportedParam
}

function buildRequestBody(systemPrompt, userMessage, maxTokens, temperature, stream, responseFormat) {
  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature,
    stream,
  }
  if (responseFormat) body.response_format = responseFormat
  if (USE_REASONING_SPLIT) body.reasoning_split = true
  return body
}

function stripReasoningTags(text = '') {
  return String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*<think>[\s\S]*$/i, '')
    .trim()
}

function readContentDelta(data) {
  const choice = data.choices?.[0]
  return stripReasoningTags(choice?.delta?.content || choice?.message?.content || '')
}

function summarizeChoice(choice) {
  if (!choice) return null
  return {
    finish_reason: choice.finish_reason || null,
    keys: Object.keys(choice),
    messageKeys: choice.message ? Object.keys(choice.message) : [],
    deltaKeys: choice.delta ? Object.keys(choice.delta) : [],
  }
}

function summarizeResponse(data) {
  return {
    id: data?.id || null,
    model: data?.model || null,
    object: data?.object || null,
    choices: Array.isArray(data?.choices) ? data.choices.length : null,
    choice: summarizeChoice(data?.choices?.[0]),
    usage: data?.usage || null,
  }
}

async function readStreamedText(response) {
  if (!response.body) return { error: 'Streaming response body is empty' }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  const stats = {
    chunks: 0,
    dataEvents: 0,
    contentEvents: 0,
    done: false,
    lastChoice: null,
    lastResponse: null,
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    stats.chunks++
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(':')) continue
      if (!trimmed.startsWith('data:')) continue

      const payload = trimmed.slice(5).trim()
      stats.dataEvents++
      if (payload === '[DONE]') {
        stats.done = true
        return { text, streamStats: stats }
      }

      try {
        const data = JSON.parse(payload)
        const delta = readContentDelta(data)
        if (delta) stats.contentEvents++
        stats.lastChoice = summarizeChoice(data.choices?.[0])
        stats.lastResponse = summarizeResponse(data)
        text += delta
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
        const delta = readContentDelta(data)
        if (delta) stats.contentEvents++
        stats.lastChoice = summarizeChoice(data.choices?.[0])
        stats.lastResponse = summarizeResponse(data)
        text += delta
      } catch (err) {
        return { error: `Invalid streaming response: ${err.message}` }
      }
    } else {
      stats.done = true
    }
  }

  return { text, streamStats: stats }
}

export async function sendMessage(systemPrompt, userMessage, options = {}) {
  const { maxTokens = 4096, temperature = 1, responseFormat = null } = options

  if (!OPENAI_API_KEY) {
    return { error: 'OPENAI_API_KEY is not set' }
  }

  let activeResponseFormat = responseFormat
  let didFallbackWithoutResponseFormat = false

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
          activeResponseFormat,
        )),
      })

      if (!response.ok) {
        const errText = await response.text()
        const message = `OpenAI API error ${response.status}: ${errText.slice(0, 300)}`
        if (
          activeResponseFormat
          && !didFallbackWithoutResponseFormat
          && isResponseFormatUnsupported(response.status, errText)
        ) {
          didFallbackWithoutResponseFormat = true
          activeResponseFormat = null
          console.warn('AI API does not support structured response_format; retrying without response_format.')
          attempt--
          continue
        }
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
      const text = stripReasoningTags(STREAM_RESPONSES ? result.text : choice?.message?.content)

      if (!text) {
        const diagnostics = STREAM_RESPONSES
          ? { stream: result.streamStats || null }
          : summarizeResponse(result)
        const reasonTokens = diagnostics?.stream?.lastResponse?.usage?.completion_tokens_details?.reasoning_tokens
        const hint = reasonTokens ? ` (${reasonTokens} reasoning tokens consumed, 0 content — increase maxTokens)` : ''
        console.warn('AI API empty content diagnostics:', JSON.stringify(diagnostics))
        return { error: `No content in response${choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : ''}${hint}` }
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
