const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '180000', 10)
const MAX_ATTEMPTS = parseInt(process.env.OPENAI_MAX_ATTEMPTS || '3', 10)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientError(message = '') {
  return /terminated|timeout|aborted|econnreset|socket|network|fetch failed/i.test(message)
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
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
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

      const data = await response.json()
      const choice = data.choices?.[0]
      const text = choice?.message?.content

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
