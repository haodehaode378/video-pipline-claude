import { info, warn } from '../utils/logger.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'

const execFileP = promisify(execFile)

function parseSrt(srtContent) {
  const segments = []
  const blocks = srtContent.trim().split(/\n\s*\n/)
  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length < 3) continue
    const timeLine = lines[1]
    const timeMatch = timeLine.match(/(\d+:\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+:\d+[.,]\d+)/)
    if (!timeMatch) continue
    const text = lines.slice(2).join(' ').trim()
    if (!text) continue

    segments.push({
      start: parseTimestamp(timeMatch[1]),
      end: parseTimestamp(timeMatch[2]),
      text,
    })
  }
  return segments
}

function parseTimestamp(ts) {
  const [h, m, s] = ts.replace(',', '.').split(':')
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s)
}

export async function whisperLocal(audioPath, options = {}) {
  const model = options.model || process.env.WHISPER_MODEL || 'medium'
  const language = options.language || 'zh'
  const outputDir = path.dirname(audioPath)
  const baseName = path.basename(audioPath, path.extname(audioPath))
  const srtPath = path.join(outputDir, `${baseName}.srt`)

  info(`[Whisper:Local] Running whisper.cpp with model ${model}, language ${language}`)

  const args = [
    '-m', model,
    '-l', language,
    '-f', audioPath,
    '--output-srt',
    '--output-dir', outputDir,
    '-of', baseName,
  ]

  try {
    const { stderr } = await execFileP('whisper', args, { timeout: 600000 })
    const output = stderr || ''
    info(`[Whisper:Local] Transcription complete`)

    if (!fs.existsSync(srtPath)) {
      throw new Error(`Whisper did not produce SRT output at ${srtPath}`)
    }

    const srtContent = fs.readFileSync(srtPath, 'utf-8')
    const segments = parseSrt(srtContent)

    return {
      segments,
      language,
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('whisper binary not found. Install whisper.cpp and ensure it is on PATH.')
    }
    throw err
  }
}
