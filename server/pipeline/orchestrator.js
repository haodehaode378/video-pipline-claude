import { readJSON, writeJSON } from '../utils/file-helper.js'
import { runStep1 } from './step1-script.js'
import { runStep2 } from './step2-code.js'
import { runStep3 } from './step3-snapshot.js'
import { runStep4 } from './step4-render.js'
import { runStep5 } from './step5-narration.js'
import { runStep6 } from './step6-tts.js'
import { runStep7 } from './step7-mux.js'

let broadcast = null
export function setBroadcaster(fn) { broadcast = fn }

const DATA_PATH = 'data/episodes.json'

function updateEpisode(slug, updater) {
  const episodes = readJSON(DATA_PATH) || []
  const idx = episodes.findIndex((e) => e.slug === slug)
  if (idx === -1) return
  updater(episodes[idx])
  episodes[idx].updatedAt = new Date().toISOString()
  writeJSON(DATA_PATH, episodes)
  if (broadcast) broadcast(slug, episodes[idx])
}

export async function startPipeline(episode) {
  const slug = episode.slug
  const fps = parseInt(process.env.RENDER_FPS) || 30
  console.log(`[Pipeline] Starting for "${episode.title}" (${slug})`)

  updateEpisode(slug, (ep) => {
    ep.status = 'running'
    ep.error = null
  })

  // Step 1: Script Generation
  updateEpisode(slug, (ep) => { ep.steps.script = 'running' })
  const s1Result = await runStep1(episode)

  if (!s1Result.success) {
    updateEpisode(slug, (ep) => {
      ep.steps.script = 'failed'
      ep.status = 'failed'
      ep.error = s1Result.error
    })
    return
  }
  updateEpisode(slug, (ep) => {
    ep.steps.script = 'completed'
    ep.scriptContent = s1Result.content
  })

  // Step 2: Code Generation
  updateEpisode(slug, (ep) => { ep.steps.code = 'running' })
  const s2Result = await runStep2(episode)

  if (!s2Result.success) {
    updateEpisode(slug, (ep) => {
      ep.steps.code = 'failed'
      ep.status = 'failed'
      ep.error = s2Result.error
    })
    return
  }
  updateEpisode(slug, (ep) => {
    ep.steps.code = 'completed'
    if (s2Result.codeContent) ep.codeContent = s2Result.codeContent
  })

  // Step 3 + Step 4 run in parallel (both depend only on Step 2 output)
  updateEpisode(slug, (ep) => {
    ep.steps.snapshot = 'running'
    ep.steps.render = 'running'
  })

  const [s3Result, s4Result] = await Promise.all([
    runStep3(episode),
    runStep4(episode, fps),
  ])

  updateEpisode(slug, (ep) => {
    ep.steps.snapshot = s3Result.success ? 'completed' : 'failed'
    ep.steps.render = s4Result.success ? 'completed' : 'failed'
    if (!s3Result.success || !s4Result.success) {
      ep.status = 'failed'
      ep.error = [s3Result.error, s4Result.error].filter(Boolean).join('; ')
    }
  })

  // Bail if Step 3 or 4 failed
  if (!s3Result.success || !s4Result.success) {
    console.log(`[Pipeline] Failed for "${episode.title}"`)
    return
  }

  // Step 5: Narration Segmentation
  updateEpisode(slug, (ep) => { ep.steps.narration = 'running' })
  const s5Result = await runStep5(episode)

  if (!s5Result.success) {
    updateEpisode(slug, (ep) => {
      ep.steps.narration = 'failed'
      ep.status = 'failed'
      ep.error = s5Result.error
    })
    return
  }
  updateEpisode(slug, (ep) => { ep.steps.narration = 'completed' })

  // Step 6: TTS Audio Generation
  updateEpisode(slug, (ep) => { ep.steps.tts = 'running' })
  const s6Result = await runStep6(episode)

  if (!s6Result.success) {
    updateEpisode(slug, (ep) => {
      ep.steps.tts = 'failed'
      ep.status = 'failed'
      ep.error = s6Result.error
    })
    return
  }
  updateEpisode(slug, (ep) => { ep.steps.tts = 'completed' })

  // Step 7: Final Video-Audio Mux
  updateEpisode(slug, (ep) => { ep.steps.mux = 'running' })
  const s7Result = await runStep7(episode)

  updateEpisode(slug, (ep) => {
    ep.steps.mux = s7Result.success ? 'completed' : 'failed'
    ep.status = s7Result.success ? 'completed' : 'failed'
    if (!s7Result.success) ep.error = s7Result.error
  })

  console.log(`[Pipeline] Completed for "${episode.title}"`)
}
