import path from 'node:path'
import fs from 'node:fs'
import { getEpisodeDir, readJSON } from '../utils/file-helper.js'
import { info, warn } from '../utils/logger.js'
import { muxWithEffects } from '../media/ffmpeg.js'
import { buildVideoFilters, buildAudioFilters } from '../media/ffmpeg-effects.js'

function getEnabledEffects() {
  try {
    const styleConfig = readJSON('data/style-config.json')
    if (styleConfig?.effects) {
      return Object.entries(styleConfig.effects)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
    }
  } catch {}
  return []
}

export async function runStep7(episode) {
  const slug = episode.slug
  info(`[Step7] Muxing final video for "${episode.title}" (${slug})`)

  try {
    const episodeDir = getEpisodeDir(slug)
    const videoPath = path.join(episodeDir, 'output', `episode-${slug}.mp4`)
    const audioPath = path.join(episodeDir, 'output', 'narration.wav')
    const outputPath = path.join(episodeDir, 'output', `episode-${slug}-voiceover.mp4`)

    if (!fs.existsSync(videoPath)) {
      return { success: false, error: 'Video not found — run Step 4 first' }
    }
    if (!fs.existsSync(audioPath)) {
      return { success: false, error: 'Narration WAV not found — run Step 6 first' }
    }

    const effects = getEnabledEffects()
    const videoEffects = effects.filter((e) => ['fadeIn', 'fadeOut', 'kenBurns', 'speedCurve'].includes(e))

    const timelineScenes = Array.isArray(episode.timelineContent)
      ? episode.timelineContent
      : episode.timelineContent?.scenes || []
    const totalDuration = timelineScenes.reduce((sum, s) => sum + (s.duration || 0), 0)
      || episode.timelineContent?.totalDuration
      || 60
    const videoFilters = buildVideoFilters(videoEffects, { totalDuration })

    const bgmPath = process.env.BGM_PATH || ''
    const bgmVolume = parseFloat(process.env.BGM_VOLUME) || 0.15

    let subtitlePath = null
    if (effects.includes('subtitleBurn') && episode.subtitlesContent?.assPath) {
      subtitlePath = episode.subtitlesContent.assPath
    }

    info(`[Step7] Effects: ${effects.join(', ') || 'none'}`)

    let finalOutput = outputPath
    if (videoFilters || (bgmPath && fs.existsSync(bgmPath)) || subtitlePath) {
      finalOutput = await muxWithEffects(videoPath, audioPath, outputPath, {
        videoFilters,
        bgmPath: bgmPath && fs.existsSync(bgmPath) ? bgmPath : null,
        bgmVolume,
        subtitlePath,
        totalDuration,
      })
    } else {
      finalOutput = await muxWithEffects(videoPath, audioPath, outputPath, {})
    }

    info(`[Step7] Final video ready: ${finalOutput}`)
    return { success: true, output: finalOutput }
  } catch (err) {
    info(`[Step7] Error: ${err.message}`)
    return { success: false, error: err.message }
  }
}
