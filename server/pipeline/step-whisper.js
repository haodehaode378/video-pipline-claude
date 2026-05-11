import { info, warn } from '../utils/logger.js'
import { getEpisodeDir, readJSON, writeText } from '../utils/file-helper.js'
import path from 'node:path'

export async function runWhisperStep(episode) {
  const slug = episode.slug
  info(`[Whisper] Starting subtitle generation for "${episode.title}" (${slug})`)

  const whisperMode = process.env.WHISPER_MODE || 'api'
  const whisperApiKey = process.env.WHISPER_API_KEY

  if (whisperMode === 'api' && !whisperApiKey) {
    warn('[Whisper] WHISPER_API_KEY not configured — skipping subtitles')
    return { success: true, subtitles: null, skipped: true }
  }

  try {
    const episodeDir = getEpisodeDir(slug)
    const audioPath = path.join(episodeDir, 'narration.wav')

    const { transcribe } = await import('../media/whisper.js')
    const { segmentsToSrt, segmentsToAss } = await import('../media/subtitle.js')

    const result = await transcribe(audioPath, {
      mode: whisperMode,
      language: process.env.WHISPER_LANGUAGE || 'zh',
      model: process.env.WHISPER_MODEL || 'whisper-1',
    })

    const srtContent = segmentsToSrt(result.segments)
    const assContent = segmentsToAss(result.segments)

    const srtPath = path.join(episodeDir, `episode-${slug}.srt`)
    const assPath = path.join(episodeDir, `episode-${slug}.ass`)
    writeText(srtPath, srtContent)
    writeText(assPath, assContent)

    info(`[Whisper] Generated subtitles: ${result.segments.length} segments`)
    return {
      success: true,
      subtitles: {
        segments: result.segments,
        srtPath,
        assPath,
        language: result.language,
      },
    }
  } catch (err) {
    warn(`[Whisper] Subtitle generation failed: ${err.message} — continuing without subtitles`)
    return { success: true, subtitles: null, skipped: true, warning: err.message }
  }
}
