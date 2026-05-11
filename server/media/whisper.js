import { info } from '../utils/logger.js'
import { whisperLocal } from './whisper-local.js'
import { whisperApi } from './whisper-api.js'

export async function transcribe(audioPath, options = {}) {
  const mode = options.mode || process.env.WHISPER_MODE || 'api'

  info(`[Whisper] Transcribing with mode: ${mode}`)

  if (mode === 'local') {
    return whisperLocal(audioPath, options)
  }

  return whisperApi(audioPath, options)
}
