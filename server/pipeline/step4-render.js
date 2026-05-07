import puppeteer from 'puppeteer'
import path from 'node:path'
import fs from 'node:fs'
import { getEpisodeDir } from '../utils/file-helper.js'
import { imagesToVideo } from '../media/ffmpeg.js'
import { inspectRenderQuality } from '../utils/render-quality.js'

const MIN_EFFECTIVE_FPS = parseFloat(process.env.RENDER_MIN_EFFECTIVE_FPS || '8')
const MAX_RENDER_FRAMES = parseInt(process.env.RENDER_MAX_FRAMES || '1200', 10)

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
    const pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text())
    })
    await page.setViewport({ width: 1920, height: 1080 })

    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 300))

    if (pageErrors.length > 0) {
      return { success: false, error: `Page error before render: ${pageErrors.slice(0, 3).join('; ')}` }
    }

    const renderState = await page.evaluate(() => ({
      hasRoot: Boolean(document.getElementById('root')),
      hasSeek: typeof window.__hfSeek === 'function',
      scenes: Array.from(document.querySelectorAll('.scene[data-start]')).map((el) => ({
        start: parseFloat(el.dataset.start),
      })).filter((scene) => Number.isFinite(scene.start)),
    }))
    if (!renderState.hasRoot) return { success: false, error: 'Missing #root element' }
    if (!renderState.hasSeek) return { success: false, error: 'Missing window.__hfSeek(seconds)' }
    if (renderState.scenes.length === 0) {
      return { success: false, error: 'No .scene[data-start] elements found. Refusing to render black video.' }
    }

    const quality = await inspectRenderQuality(page, renderState.scenes)
    if (!quality.passed) {
      return { success: false, error: `Render quality check failed: ${quality.errors.join('; ')}` }
    }

    const totalDuration = await page.evaluate(() => {
      const root = document.getElementById('root')
      return root?.dataset?.duration ? parseFloat(root.dataset.duration) : 60
    })

    const totalFrames = Math.ceil(totalDuration * fps)
    console.log(`[Step4] Duration: ${totalDuration}s, Frames: ${totalFrames} @ ${fps}fps`)

    const minFrames = Math.ceil(totalDuration * MIN_EFFECTIVE_FPS)
    const maxFrames = Math.min(totalFrames, Math.max(minFrames, Math.min(MAX_RENDER_FRAMES, totalFrames)))
    const step = Math.max(1, Math.floor(totalFrames / maxFrames))
    const actualFrames = Math.ceil(totalFrames / step)
    const actualFps = actualFrames / totalDuration

    console.log(`[Step4] Capturing ~${actualFrames} frames (step=${step}, effective ${actualFps.toFixed(1)}fps)`)

    for (let i = 0; i < totalFrames; i += step) {
      const time = i / fps
      await page.evaluate((t) => {
        window.__hfSeek(t)
      }, time)
      await page.screenshot({
        path: path.join(framesDir, `frame_${String(Math.floor(i / step)).padStart(5, '0')}.png`),
      })
    }

    console.log('[Step4] Encoding MP4 with ffmpeg...')
    await imagesToVideo(framesDir, outputPath, actualFps)

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
