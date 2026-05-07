import { readJSON, writeJSON } from '../utils/file-helper.js'
import { info, error } from '../utils/logger.js'
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

const stepOrder = ['script', 'code', 'snapshot', 'render', 'narration', 'tts', 'mux']

function updateEpisode(slug, updater) {
  const episodes = readJSON(DATA_PATH) || []
  const idx = episodes.findIndex((e) => e.slug === slug)
  if (idx === -1) return
  updater(episodes[idx])
  episodes[idx].updatedAt = new Date().toISOString()
  writeJSON(DATA_PATH, episodes)
  if (broadcast) broadcast(slug, episodes[idx])
}

function getStepIndex(stepName) {
  return stepOrder.indexOf(stepName)
}

export async function startPipeline(episode, startFrom) {
  const slug = episode.slug
  const fps = parseInt(process.env.RENDER_FPS) || 30
  const startIdx = startFrom ? getStepIndex(startFrom) : 0
  info(`[Pipeline] Starting for "${episode.title}" (${slug})${startFrom ? ` from step: ${startFrom}` : ''}`)

  updateEpisode(slug, (ep) => {
    ep.status = 'running'
    ep.error = null
    // Reset steps from startFrom onward
    for (let i = startIdx; i < stepOrder.length; i++) {
      ep.steps[stepOrder[i]] = 'pending'
    }
  })

  // Step 1: Script
  if (startIdx <= 0) {
    updateEpisode(slug, (ep) => { ep.steps.script = 'running' })
    const r = await runStep1(episode)
    if (!r.success) {
      updateEpisode(slug, (ep) => {
        ep.steps.script = 'failed'
        ep.status = 'failed'
        ep.error = r.error
      })
      return
    }
    updateEpisode(slug, (ep) => {
      ep.steps.script = 'completed'
      ep.scriptContent = r.content
    })
  }

  // Step 2: Code
  if (startIdx <= 1) {
    updateEpisode(slug, (ep) => { ep.steps.code = 'running' })
    const r = await runStep2(episode)
    if (!r.success) {
      updateEpisode(slug, (ep) => {
        ep.steps.code = 'failed'
        ep.status = 'failed'
        ep.error = r.error
      })
      return
    }
    updateEpisode(slug, (ep) => {
      ep.steps.code = 'completed'
      if (r.codeContent) ep.codeContent = r.codeContent
    })
  }

  // Steps 3+4: parallel
  if (startIdx <= 2 || startIdx <= 3) {
    updateEpisode(slug, (ep) => {
      if (startIdx <= 2) ep.steps.snapshot = 'running'
      if (startIdx <= 3) ep.steps.render = 'running'
    })

    const promises = []
    if (startIdx <= 2) promises.push(runStep3(episode))
    else promises.push(Promise.resolve({ success: true, skip: true }))
    if (startIdx <= 3) promises.push(runStep4(episode, fps))
    else promises.push(Promise.resolve({ success: true, skip: true }))

    const [s3, s4] = await Promise.all(promises)

    updateEpisode(slug, (ep) => {
      if (startIdx <= 2) ep.steps.snapshot = s3.success ? 'completed' : 'failed'
      if (startIdx <= 3) ep.steps.render = s4.success ? 'completed' : 'failed'
    })

    if (!s3.success || !s4.success) {
      updateEpisode(slug, (ep) => {
        ep.status = 'failed'
        ep.error = [s3.error, s4.error].filter(Boolean).join('; ')
      })
      return
    }
  }

  // Step 5: Narration
  if (startIdx <= 4) {
    updateEpisode(slug, (ep) => { ep.steps.narration = 'running' })
    const r = await runStep5(episode)
    if (!r.success) {
      updateEpisode(slug, (ep) => {
        ep.steps.narration = 'failed'
        ep.status = 'failed'
        ep.error = r.error
      })
      return
    }
    updateEpisode(slug, (ep) => { ep.steps.narration = 'completed' })
  }

  // Step 6: TTS
  if (startIdx <= 5) {
    updateEpisode(slug, (ep) => { ep.steps.tts = 'running' })
    const r = await runStep6(episode)
    if (!r.success) {
      updateEpisode(slug, (ep) => {
        ep.steps.tts = 'failed'
        ep.status = 'failed'
        ep.error = r.error
      })
      return
    }
    updateEpisode(slug, (ep) => { ep.steps.tts = 'completed' })
  }

  // Step 7: Mux
  if (startIdx <= 6) {
    updateEpisode(slug, (ep) => { ep.steps.mux = 'running' })
    const r = await runStep7(episode)
    updateEpisode(slug, (ep) => {
      ep.steps.mux = r.success ? 'completed' : 'failed'
      ep.status = r.success ? 'completed' : 'failed'
      if (!r.success) ep.error = r.error
    })
  }

  info(`[Pipeline] Completed for "${episode.title}"`)
}
