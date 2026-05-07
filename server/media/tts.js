import fs from 'node:fs'
import path from 'node:path'

const MINIMAX_BASE = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com'
const TTS_URL = `${MINIMAX_BASE}/v1/t2a_v2`

export async function synthesizeSpeech(text, outputPath) {
  const apiKey = process.env.MINIMAX_API_KEY

  if (!apiKey) {
    return { success: false, error: 'MINIMAX_API_KEY is required' }
  }

  try {
    const body = {
      model: 'speech-02-turbo',
      text,
      stream: false,
      output_format: 'hex',
      voice_setting: {
        voice_id: 'male-qn-qingse',
        speed: 1.0,
        vol: 1.0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'wav',
        channel: 1,
      },
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    console.log(`[TTS] Calling ${TTS_URL} with model ${body.model}`)

    const response = await fetch(TTS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (data.base_resp?.status_code !== 0) {
      const code = data.base_resp?.status_code
      const msg = data.base_resp?.status_msg || 'Unknown error'
      console.error(`[TTS] MiniMax error ${code}: ${msg}`)
      return { success: false, error: `MiniMax ${code}: ${msg}` }
    }

    const audioHex = data.data?.audio
    if (!audioHex) {
      return { success: false, error: 'No audio data in response' }
    }

    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(outputPath, Buffer.from(audioHex, 'hex'))

    const duration = data.extra_info?.audio_length || 0
    return { success: true, output: outputPath, duration }
  } catch (err) {
    console.error('[TTS] Error:', err.message)
    return { success: false, error: err.message }
  }
}
