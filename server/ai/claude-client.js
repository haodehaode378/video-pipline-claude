const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function sendMessage(systemPrompt, userMessage, options = {}) {
  const { maxTokens = 4096, temperature = 1 } = options

  if (!OPENAI_API_KEY) {
    return { error: 'OPENAI_API_KEY is not set' }
  }

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
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
      return { error: `OpenAI API error ${response.status}: ${errText.slice(0, 300)}` }
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content

    if (!text) {
      return { error: 'No content in response' }
    }

    return { text }
  } catch (err) {
    console.error('AI API error:', err.message)
    return { error: err.message }
  }
}
