import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { getEpisodeDir, readText } from '../utils/file-helper.js'
import { synthesizeSpeech } from '../media/tts.js'
import { concatAudio, getAudioDuration } from '../media/ffmpeg.js'

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout || stderr)
    })
  })
}

/**
 * Align a WAV file's duration to a target duration.
 * - If actual < target: pad with silence
 * - If actual > target: speed up slightly with atempo
 */
async function alignAudio(inputPath, outputPath, targetDuration) {
  const actual = await getAudioDuration(inputPath)
  const diff = Math.abs(actual - targetDuration)

  if (diff < 0.05) {
    // Already close enough — just copy
    fs.copyFileSync(inputPath, outputPath)
    return
  }

  if (actual < targetDuration) {
    // Pad with silence
    await runFfmpeg([
      '-y', '-i', inputPath,
      '-af', `apad=pad_dur=${(targetDuration - actual).toFixed(2)}`,
      outputPath,
    ])
  } else {
    // Speed up
    const tempo = actual / targetDuration
    await runFfmpeg([
      '-y', '-i', inputPath,
      '-af', `atempo=${tempo.toFixed(3)}`,
      outputPath,
    ])
  }
}

/**
 * Read segments.csv and return parsed rows.
 */
function readSegments(episodeDir) {
  const csvPath = path.join(episodeDir, 'narration', 'segments.csv')
  const text = readText(csvPath)
  if (!text) return null

  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Skip header
  return lines.slice(1).map((line) => {
    const [id, start, end, textFile] = line.split(',')
    return {
      id: parseInt(id),
      start: parseFloat(start),
      end: parseFloat(end),
      textFile,
    }
  })
}

export async function runStep6(episode) {
  console.log(`[Step6] Generating TTS audio for "${episode.title}"...`)

  try {
    const episodeDir = getEpisodeDir(episode.slug)
    const segments = readSegments(episodeDir)

    if (!segments) {
      return { success: false, error: 'segments.csv not found — run Step 5 first' }
    }

    if (segments.length === 0) {
      return { success: false, error: 'No segments in segments.csv' }
    }

    const ttsDir = path.join(episodeDir, 'output', 'tts')
    const alignedDir = path.join(episodeDir, 'output', 'tts-aligned')
    if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true })
    if (!fs.existsSync(alignedDir)) fs.mkdirSync(alignedDir, { recursive: true })

    const ttsFiles = []

    for (const seg of segments) {
      const txtPath = path.join(episodeDir, 'narration', seg.textFile)
      const narrationText = readText(txtPath)

      if (!narrationText || !narrationText.trim()) {
        console.warn(`[Step6] Skipping empty segment ${seg.id}`)
        continue
      }

      const targetDuration = seg.end - seg.start
      const rawWav = path.join(ttsDir, `seg_${String(seg.id).padStart(3, '0')}.wav`)
      const alignedWav = path.join(alignedDir, `seg_${String(seg.id).padStart(3, '0')}.wav`)

      console.log(`[Step6] Synthesizing segment ${seg.id}: "${narrationText.slice(0, 30)}..." (${targetDuration}s)`)

      const result = await synthesizeSpeech(narrationText.trim(), rawWav)

      if (!result.success) {
        return { success: false, error: `TTS failed for segment ${seg.id}: ${result.error}` }
      }

      // Align audio duration to match the script timing
      await alignAudio(rawWav, alignedWav, targetDuration)
      ttsFiles.push(alignedWav)
    }

    // Concatenate all aligned WAVs into one full narration
    const outputWav = path.join(episodeDir, 'output', 'narration.wav')
    console.log(`[Step6] Concatenating ${ttsFiles.length} audio segments...`)
    await concatAudio(ttsFiles, outputWav)

    console.log(`[Step6] Full narration ready: ${outputWav}`)
    return { success: true, output: outputWav }
  } catch (err) {
    console.error('[Step6] Error:', err.message)
    return { success: false, error: err.message }
  }
}
