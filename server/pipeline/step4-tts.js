import path from 'node:path'
import fs from 'node:fs'
import { getEpisodeDir, readText, writeText } from '../utils/file-helper.js'
import { synthesizeSpeech } from '../media/tts.js'
import { concatAudio, getAudioDuration } from '../media/ffmpeg.js'

function readSegments(episodeDir) {
  const text = readText(path.join(episodeDir, 'narration', 'segments.json'))
  if (!text) return null
  return JSON.parse(text)
}

export async function runStep4(episode) {
  console.log(`[Step4] Generating TTS audio for "${episode.title}"...`)

  try {
    const episodeDir = getEpisodeDir(episode.slug)
    const segments = readSegments(episodeDir)

    if (!Array.isArray(segments)) {
      return { success: false, error: 'segments.json not found. Run Step 3 first.' }
    }
    if (segments.length === 0) {
      return { success: false, error: 'No segments in segments.json' }
    }

    const ttsDir = path.join(episodeDir, 'output', 'tts')
    if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true })

    const ttsFiles = []
    const updatedSegments = []

    for (const seg of segments) {
      const txtPath = path.join(episodeDir, 'narration', seg.textFile)
      const narrationText = readText(txtPath)

      if (!narrationText || !narrationText.trim()) {
        return { success: false, error: `Empty narration for segment ${seg.id}` }
      }

      const rawWav = path.join(ttsDir, `seg_${String(seg.index).padStart(3, '0')}.wav`)
      console.log(`[Step4] Synthesizing segment ${seg.id}: "${narrationText.slice(0, 30)}..."`)

      const result = await synthesizeSpeech(narrationText.trim(), rawWav)
      if (!result.success) {
        return { success: false, error: `TTS failed for segment ${seg.id}: ${result.error}` }
      }

      const audioDuration = await getAudioDuration(rawWav)
      ttsFiles.push(rawWav)
      updatedSegments.push({
        ...seg,
        audioFile: path.relative(episodeDir, rawWav).replace(/\\/g, '/'),
        audioDuration,
      })
    }

    const outputWav = path.join(episodeDir, 'output', 'narration.wav')
    console.log(`[Step4] Concatenating ${ttsFiles.length} audio segments...`)
    await concatAudio(ttsFiles, outputWav)
    writeText(path.join(episodeDir, 'narration', 'segments.json'), JSON.stringify(updatedSegments, null, 2))

    console.log(`[Step4] Full narration ready: ${outputWav}`)
    return { success: true, output: outputWav, segments: updatedSegments }
  } catch (err) {
    console.error('[Step4] Error:', err.message)
    return { success: false, error: err.message }
  }
}
