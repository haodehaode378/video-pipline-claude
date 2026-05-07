import puppeteer from 'puppeteer'
import path from 'node:path'
import fs from 'node:fs'
import { getEpisodeDir } from '../utils/file-helper.js'
import { imagesToVideo } from '../media/ffmpeg.js'

export async function runStep4(episode, fps = 30) {
  console.log(`[Step4] Rendering video for "${episode.title}"...`)

  const dir = getEpisodeDir(episode.slug)
  const htmlPath = path.join(dir, 'index.html')
  const framesDir = path.join(dir, 'frames')
  const outputDir = path.join(dir, 'output')
  const outputPath = path.join(outputDir, `episode-${episode.slug}.mp4`)

  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true })
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  let browser
  try {
    browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 })

    // Get total duration
    const totalDuration = await page.evaluate(() => {
      const root = document.getElementById('root')
      return root?.dataset?.duration ? parseFloat(root.dataset.duration) : 60
    })

    const totalFrames = Math.ceil(totalDuration * fps)
    console.log(`[Step4] Duration: ${totalDuration}s, Frames: ${totalFrames} @ ${fps}fps`)

    // Capture frames (with a frame-skip threshold for speed — max 90 frames)
    const maxFrames = Math.min(totalFrames, 90)
    const step = Math.max(1, Math.floor(totalFrames / maxFrames))
    const actualFrames = Math.ceil(totalFrames / step)
    const actualFps = actualFrames / totalDuration

    console.log(`[Step4] Capturing ~${actualFrames} frames (step=${step}, effective ${actualFps.toFixed(1)}fps)`)

    for (let i = 0; i < totalFrames; i += step) {
      const time = i / fps
      await page.evaluate((t) => {
        if (window.__hfSeek) window.__hfSeek(t)
      }, time)
      await page.screenshot({
        path: path.join(framesDir, `frame_${String(Math.floor(i / step)).padStart(5, '0')}.png`),
      })
    }

    // Combine frames into MP4
    console.log('[Step4] Encoding MP4 with ffmpeg...')
    await imagesToVideo(framesDir, outputPath, actualFps)

    // Clean up frames to save space
    for (const f of fs.readdirSync(framesDir)) {
      fs.unlinkSync(path.join(framesDir, f))
    }
    fs.rmdirSync(framesDir)

    console.log(`[Step4] Video ready: ${outputPath}`)
    return { success: true, output: outputPath }
  } catch (err) {
    return { success: false, error: err.message }
  } finally {
    if (browser) await browser.close()
  }
}
