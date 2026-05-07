import { sendMessage } from '../ai/claude-client.js'
import { buildScriptPrompt } from '../ai/prompts.js'
import { writeText, getScriptDir, readText } from '../utils/file-helper.js'

function stripJsonFence(text = '') {
  return text
    .trim()
    .replace(/^\s*```json\s*/i, '')
    .replace(/^\s*```\w*\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function parseStoryboard(text) {
  const parsed = JSON.parse(stripJsonFence(text))
  const scenes = Array.isArray(parsed) ? parsed : parsed.scenes
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('storyboard JSON must contain a non-empty scenes array')
  }

  return scenes.map((scene, index) => {
    const id = scene.id || `scene-${String(index + 1).padStart(2, '0')}`
    const narration = String(scene.narration || '').trim()
    const visual = String(scene.visual || '').trim()
    const minDuration = Number(scene.minDuration || 3)
    const maxDuration = Number(scene.maxDuration || Math.max(minDuration + 3, 8))

    if (!narration) throw new Error(`${id} narration is required`)
    if (!visual) throw new Error(`${id} visual is required`)
    if (!Number.isFinite(minDuration) || minDuration <= 0) throw new Error(`${id} minDuration is invalid`)
    if (!Number.isFinite(maxDuration) || maxDuration < minDuration) throw new Error(`${id} maxDuration is invalid`)

    return {
      id,
      title: String(scene.title || `镜头 ${index + 1}`).trim(),
      visual,
      narration,
      intent: String(scene.intent || '').trim(),
      minDuration,
      maxDuration,
      animationHint: String(scene.animationHint || '').trim(),
    }
  })
}

function storyboardToMarkdown(storyboard) {
  const lines = ['| Scene | Visual | Narration |', '|---|---|---|']
  for (const scene of storyboard) {
    lines.push(`| ${scene.id} | ${scene.visual.replace(/\|/g, '/')} | ${scene.narration.replace(/\|/g, '/')} |`)
  }
  return lines.join('\n')
}

export async function runStep1(episode) {
  console.log(`[Step1] Generating script for "${episode.title}"...`)

  const scriptDir = getScriptDir(episode.slug)
  const research = readText(`${scriptDir}/research.md`)
  if (!research) {
    return { success: false, error: 'research.md not found. Run research first.' }
  }

  const { system, user } = buildScriptPrompt(
    episode.title,
    episode.keywords,
    episode.duration,
    episode.sourceMaterial,
    research,
  )

  const result = await sendMessage(system, user, { maxTokens: 4096 })
  if (result.error) {
    return { success: false, error: result.error }
  }

  let storyboard
  try {
    storyboard = parseStoryboard(result.text)
  } catch (err) {
    return { success: false, error: `Invalid storyboard JSON: ${err.message}` }
  }

  const outputPath = `${scriptDir}/script.md`
  const storyboardPath = `${scriptDir}/storyboard.json`
  const markdown = storyboardToMarkdown(storyboard)
  writeText(storyboardPath, JSON.stringify({ version: 1, scenes: storyboard }, null, 2))
  writeText(outputPath, markdown)

  console.log(`[Step1] Script saved: ${outputPath}`)
  return {
    success: true,
    output: outputPath,
    storyboardOutput: storyboardPath,
    content: markdown,
    storyboardContent: { version: 1, scenes: storyboard },
  }
}
