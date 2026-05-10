import { sendMessage } from '../ai/claude-client.js'
import { buildScriptPrompt } from '../ai/prompts.js'
import { writeText, getScriptDir, readText } from '../utils/file-helper.js'
import { info } from '../utils/logger.js'

function stripJsonFence(text = '') {
  return text
    .trim()
    .replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, '')
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

function safeDebugName(value = '') {
  return String(value)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'storyboard'
}

function writeDebugArtifact(scriptDir, label, attempt, status, content) {
  writeText(`${scriptDir}/debug/${safeDebugName(label)}-attempt-${attempt}.${status}.json`, content || '')
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

  let storyboard
  let lastError = ''
  let retryNote = ''

  for (let attempt = 1; attempt <= 3; attempt++) {
    info(`[Step1] Generating storyboard attempt ${attempt}/3 for "${episode.title}" (${episode.slug})...`)
    const prompt = retryNote ? `${user}\n\nRegeneration requirements:\n${retryNote}` : user
    const result = await sendMessage(system, prompt, { maxTokens: 4000 })
    if (result.error) {
      lastError = result.error
      writeDebugArtifact(scriptDir, 'storyboard', attempt, 'error', result.error)
      info(`[Step1] storyboard attempt ${attempt}/3 failed: ${result.error}`)
      retryNote = `Previous attempt failed: ${result.error}. Return compact complete valid JSON only.`
      continue
    }

    writeDebugArtifact(scriptDir, 'storyboard', attempt, 'raw', result.text)
    try {
      storyboard = parseStoryboard(result.text)
      writeDebugArtifact(scriptDir, 'storyboard', attempt, 'valid', JSON.stringify({ version: 1, scenes: storyboard }, null, 2))
      info(`[Step1] storyboard attempt ${attempt}/3 succeeded`)
      break
    } catch (err) {
      lastError = err.message
      writeDebugArtifact(scriptDir, 'storyboard', attempt, 'invalid', stripJsonFence(result.text))
      info(`[Step1] storyboard attempt ${attempt}/3 failed validation: ${err.message}`)
      retryNote = [
        `Previous storyboard JSON was invalid: ${err.message}.`,
        'Return one complete valid JSON object only.',
        'Use exactly 6 scenes.',
        'Keep every field short so the JSON closes completely.',
        'Do not use markdown fences or explanations.',
      ].join('\n')
    }
  }

  if (!storyboard) {
    return { success: false, error: `Invalid storyboard JSON: ${lastError}` }
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

export const step1ScriptInternals = {
  parseStoryboard,
  stripJsonFence,
}
