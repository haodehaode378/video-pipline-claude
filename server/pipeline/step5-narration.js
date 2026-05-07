import path from 'node:path'
import { getEpisodeDir, getScriptDir, readText, writeText } from '../utils/file-helper.js'

/**
 * Parse "M:SS" or "MM:SS" time string to seconds.
 */
function timeToSeconds(t) {
  const parts = t.trim().split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

/**
 * Parse the three-column markdown table from script.md.
 * Returns array of { start, end, visual, narration }.
 */
function parseScriptTable(markdown) {
  const lines = markdown.split('\n')
  const segments = []

  for (const line of lines) {
    // Match table rows: | time | visual | narration |
    const match = line.match(/^\|\s*([\d:]+-[\d:]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/)
    if (!match) continue

    const timeRange = match[1]
    const visual = match[2].trim()
    const narration = match[3].trim()

    // Skip header row
    if (timeRange.includes('时间') || timeRange.includes('----')) continue

    const [startStr, endStr] = timeRange.split('-')
    segments.push({
      start: timeToSeconds(startStr),
      end: timeToSeconds(endStr),
      visual,
      narration,
    })
  }

  return segments
}

export async function runStep5(episode) {
  console.log(`[Step5] Extracting narration for "${episode.title}"...`)

  try {
    const scriptDir = getScriptDir(episode.slug)
    const scriptPath = path.join(scriptDir, 'script.md')
    const scriptText = readText(scriptPath)

    if (!scriptText) {
      return { success: false, error: 'script.md not found — run Step 1 first' }
    }

    const segments = parseScriptTable(scriptText)

    if (segments.length === 0) {
      return { success: false, error: 'No narration segments found in script.md' }
    }

    console.log(`[Step5] Found ${segments.length} narration segments`)

    // Write segments
    const episodeDir = getEpisodeDir(episode.slug)
    const narrationDir = path.join(episodeDir, 'narration')

    // Write each segment's narration text
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const filename = `seg_${String(i).padStart(3, '0')}.txt`
      const filePath = path.join(narrationDir, filename)
      writeText(filePath, seg.narration)
      seg.textFile = filename
      seg.id = i
    }

    // Write segments.csv
    const csvHeader = 'id,start,end,text_file'
    const csvRows = segments.map(
      (s) => `${s.id},${s.start},${s.end},${s.textFile}`
    )
    const csvContent = [csvHeader, ...csvRows].join('\n')
    writeText(path.join(narrationDir, 'segments.csv'), csvContent)

    console.log(`[Step5] Narration written to ${narrationDir}`)
    return { success: true, segments }
  } catch (err) {
    console.error('[Step5] Error:', err.message)
    return { success: false, error: err.message }
  }
}
