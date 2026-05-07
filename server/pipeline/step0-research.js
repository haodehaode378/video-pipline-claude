import { sendMessage } from '../ai/claude-client.js'
import {
  buildResearchAnalystPrompt,
  buildResearchSearcherPrompt,
  buildResearchVerifierPrompt,
} from '../ai/prompts.js'
import { writeText, getScriptDir } from '../utils/file-helper.js'

const SEARCHER_TASKS = [
  {
    name: 'ConceptSearcher',
    focus: 'definitions, background, prerequisites, core facts, and important terminology',
  },
  {
    name: 'MechanismSearcher',
    focus: 'mechanism, step-by-step process, examples, edge cases, and common misconceptions',
  },
  {
    name: 'VisualSearcher',
    focus: 'visual explanation ideas, animation scenes, code/demo material, and script hooks',
  },
]

async function runSearcher(episode, task) {
  const prompt = buildResearchSearcherPrompt(episode, task)
  const result = await sendMessage(prompt.system, prompt.user, {
    maxTokens: 4096,
    temperature: 1,
  })

  if (result.error) {
    return `## ${task.name}\nERROR: ${result.error}`
  }

  return `## ${task.name}\n${result.text}`
}

export async function runStep0(episode) {
  console.log(`[Step0] Researching "${episode.title}" with parallel AI agents...`)

  const searcherOutputs = await Promise.all(
    SEARCHER_TASKS.map((task) => runSearcher(episode, task)),
  )

  const collectedMaterial = searcherOutputs.join('\n\n---\n\n')

  const analystPrompt = buildResearchAnalystPrompt(episode, collectedMaterial)
  const draft = await sendMessage(analystPrompt.system, analystPrompt.user, {
    maxTokens: 8192,
    temperature: 1,
  })
  if (draft.error) {
    return { success: false, error: `Analyst: ${draft.error}` }
  }

  const verifierPrompt = buildResearchVerifierPrompt(episode, draft.text, collectedMaterial)
  const verified = await sendMessage(verifierPrompt.system, verifierPrompt.user, {
    maxTokens: 8192,
    temperature: 1,
  })
  if (verified.error) {
    return { success: false, error: `Verifier: ${verified.error}` }
  }

  const scriptDir = getScriptDir(episode.slug)
  const outputPath = `${scriptDir}/research.md`
  writeText(outputPath, verified.text)

  console.log(`[Step0] Research saved: ${outputPath}`)
  return { success: true, output: outputPath, content: verified.text }
}
