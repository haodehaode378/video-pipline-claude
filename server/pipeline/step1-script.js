import { sendMessage } from '../ai/claude-client.js'
import { buildScriptPrompt } from '../ai/prompts.js'
import { writeText, getScriptDir } from '../utils/file-helper.js'

export async function runStep1(episode) {
  console.log(`[Step1] Generating script for "${episode.title}"...`)

  const { system, user } = buildScriptPrompt(
    episode.title,
    episode.keywords,
    episode.duration,
    episode.sourceMaterial,
  )

  const result = await sendMessage(system, user, { maxTokens: 4096 })
  if (result.error) {
    return { success: false, error: result.error }
  }

  const scriptDir = getScriptDir(episode.slug)
  const outputPath = `${scriptDir}/script.md`
  writeText(outputPath, result.text)

  console.log(`[Step1] Script saved: ${outputPath}`)
  return { success: true, output: outputPath, content: result.text }
}
