import path from 'node:path'
import fs from 'node:fs'
import { getEpisodeDir } from '../utils/file-helper.js'
import { muxVideoAudio } from '../media/ffmpeg.js'

export async function runStep7(episode) {
  console.log(`[Step7] Muxing final video for "${episode.title}"...`)

  try {
    const episodeDir = getEpisodeDir(episode.slug)
    const videoPath = path.join(episodeDir, 'output', `episode-${episode.slug}.mp4`)
    const audioPath = path.join(episodeDir, 'output', 'narration.wav')
    const outputPath = path.join(episodeDir, 'output', `episode-${episode.slug}-voiceover.mp4`)

    if (!fs.existsSync(videoPath)) {
      return { success: false, error: 'Video not found — run Step 4 first' }
    }

    if (!fs.existsSync(audioPath)) {
      return { success: false, error: 'Narration WAV not found — run Step 6 first' }
    }

    console.log(`[Step7] Muxing: ${videoPath} + ${audioPath}`)
    await muxVideoAudio(videoPath, audioPath, outputPath)

    console.log(`[Step7] Final video ready: ${outputPath}`)
    return { success: true, output: outputPath }
  } catch (err) {
    console.error('[Step7] Error:', err.message)
    return { success: false, error: err.message }
  }
}
