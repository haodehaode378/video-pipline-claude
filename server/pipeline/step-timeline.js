import path from 'node:path'
import { getEpisodeDir, readText, writeText } from '../utils/file-helper.js'

const DEFAULT_END_PADDING = 0.3

function readJSONText(filePath) {
  const text = readText(filePath)
  if (!text) return null
  return JSON.parse(text)
}

export function buildTimeline(segments, options = {}) {
  const endPadding = options.endPadding ?? DEFAULT_END_PADDING
  const scenes = []
  const warnings = []
  let cursor = 0

  for (const segment of segments) {
    const audioDuration = Number(segment.audioDuration || 0)
    const minDuration = Number(segment.minDuration || 0)
    const maxDuration = Number(segment.maxDuration || 0)
    const duration = Math.max(audioDuration + endPadding, minDuration, 0.5)
    const overMax = maxDuration > 0 && duration > maxDuration

    if (overMax) {
      warnings.push(`Segment ${segment.id} exceeds maxDuration: ${duration.toFixed(2)}s > ${maxDuration.toFixed(2)}s`)
    }

    const intro = Math.min(0.6, duration * 0.2)
    const outro = Math.min(0.4, duration * 0.15)
    const hold = Math.max(0, duration - intro - outro)

    scenes.push({
      id: segment.id,
      title: segment.title || '',
      visual: segment.visual || '',
      narration: segment.narration || '',
      intent: segment.intent || '',
      animationHint: segment.animationHint || '',
      start: Number(cursor.toFixed(3)),
      end: Number((cursor + duration).toFixed(3)),
      duration: Number(duration.toFixed(3)),
      audioDuration: Number(audioDuration.toFixed(3)),
      minDuration,
      maxDuration,
      overMax,
      animation: {
        intro: Number(intro.toFixed(3)),
        hold: Number(hold.toFixed(3)),
        outro: Number(outro.toFixed(3)),
      },
      audioFile: segment.audioFile || '',
    })

    cursor += duration
  }

  return {
    version: 1,
    totalDuration: Number(cursor.toFixed(3)),
    endPadding,
    scenes,
    warnings,
  }
}

export async function runTimelineStep(episode) {
  console.log(`[Timeline] Calibrating timeline for "${episode.title}"...`)

  try {
    const episodeDir = getEpisodeDir(episode.slug)
    const segmentsPath = path.join(episodeDir, 'narration', 'segments.json')
    const segments = readJSONText(segmentsPath)

    if (!Array.isArray(segments) || segments.length === 0) {
      return { success: false, error: 'segments.json not found or empty. Run TTS first.' }
    }

    const missingAudio = segments.filter((segment) => !Number(segment.audioDuration))
    if (missingAudio.length > 0) {
      return { success: false, error: `Missing audioDuration for segments: ${missingAudio.map((s) => s.id).join(', ')}` }
    }

    const timeline = buildTimeline(segments)
    const outputPath = path.join(episodeDir, 'timeline.json')
    writeText(outputPath, JSON.stringify(timeline, null, 2))

    console.log(`[Timeline] Saved: ${outputPath}`)
    return { success: true, output: outputPath, timeline, warnings: timeline.warnings }
  } catch (err) {
    console.error('[Timeline] Error:', err.message)
    return { success: false, error: err.message }
  }
}
