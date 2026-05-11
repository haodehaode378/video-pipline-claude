import path from 'node:path'
import { getEpisodeDir, getScriptDir, readText, writeText } from '../utils/file-helper.js'

function readStoryboard(scriptDir) {
  const text = readText(path.join(scriptDir, 'storyboard.json'))
  if (!text) return null
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : parsed.scenes
}

export async function runStep3(episode) {
  console.log(`[Step3] Extracting narration for "${episode.title}"...`)

  try {
    const scriptDir = getScriptDir(episode.slug)
    const storyboard = readStoryboard(scriptDir)

    if (!Array.isArray(storyboard) || storyboard.length === 0) {
      return { success: false, error: 'storyboard.json not found or empty. Run Step 1 first.' }
    }

    const episodeDir = getEpisodeDir(episode.slug)
    const narrationDir = path.join(episodeDir, 'narration')
    const segments = storyboard.map((scene, index) => {
      const id = scene.id || `scene-${String(index + 1).padStart(2, '0')}`
      const textFile = `seg_${String(index).padStart(3, '0')}.txt`
      const narration = String(scene.narration || '').trim()
      writeText(path.join(narrationDir, textFile), narration)

      return {
        index,
        id,
        title: scene.title || '',
        visual: scene.visual || '',
        narration,
        intent: scene.intent || '',
        minDuration: Number(scene.minDuration || 5),
        maxDuration: Number(scene.maxDuration || 15),
        animationHint: scene.animationHint || '',
        textFile,
      }
    })

    const empty = segments.find((segment) => !segment.narration)
    if (empty) {
      return { success: false, error: `Empty narration for segment ${empty.id}` }
    }

    writeText(path.join(narrationDir, 'segments.json'), JSON.stringify(segments, null, 2))

    console.log(`[Step3] Narration written to ${narrationDir}`)
    return { success: true, segments }
  } catch (err) {
    console.error('[Step3] Error:', err.message)
    return { success: false, error: err.message }
  }
}
