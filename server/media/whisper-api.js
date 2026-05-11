import { info, warn } from '../utils/logger.js'
import fs from 'node:fs'

export async function whisperApi(audioPath, options = {}) {
  const apiKey = options.apiKey || process.env.WHISPER_API_KEY
  if (!apiKey) throw new Error('WHISPER_API_KEY not configured')

  const language = options.language || 'zh'
  const model = options.model || 'whisper-1'

  info(`[Whisper:API] Transcribing with model ${model}, language ${language}`)

  const formData = new FormData()
  const fileBuffer = fs.readFileSync(audioPath)
  formData.append('file', new Blob([fileBuffer]), 'narration.wav')
  formData.append('model', model)
  formData.append('language', language)
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Whisper API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const segments = (data.segments || []).map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }))

  return { segments, language: data.language || language, duration: data.duration || 0 }
}
