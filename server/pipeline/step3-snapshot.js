import puppeteer from 'puppeteer'
import path from 'node:path'
import fs from 'node:fs'
import { getEpisodeDir } from '../utils/file-helper.js'
import { inspectRenderQuality } from '../utils/render-quality.js'
import { info, warn } from '../utils/logger.js'

const RENDER_ENGINE = process.env.RENDER_ENGINE || 'remotion'

export async function runStep3(episode) {
  const slug = episode.slug
  info(`[Step3] Taking snapshots for "${episode.title}" (${slug})`)

  const dir = getEpisodeDir(slug)

  if (RENDER_ENGINE === 'remotion') {
    return runRemotionSnapshots(episode, dir)
  }

  const htmlPath = path.join(dir, 'index.html')
  const snapDir = path.join(dir, 'snapshots')
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true })

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
      return { success: false, error: `Page error before snapshot: ${pageErrors.slice(0, 3).join('; ')}` }
    }

    const scenes = await page.evaluate(() => {
      const els = document.querySelectorAll('.scene[data-start]')
      return Array.from(els).map((el) => ({
        start: parseFloat(el.dataset.start),
      }))
    })

    if (scenes.length === 0) {
      return { success: false, error: 'No .scene[data-start] elements found. Generated HTML is not renderable.' }
    }

    const quality = await inspectRenderQuality(page, scenes)
    if (!quality.passed) {
      return { success: false, error: `Snapshot quality check failed: ${quality.errors.join('; ')}` }
    }

    for (let i = 0; i < scenes.length; i++) {
      const t = scenes[i].start
      await page.evaluate((time) => {
        if (window.__hfSeek) window.__hfSeek(time)
      }, t)
      await new Promise((r) => setTimeout(r, 200))
      await page.screenshot({
        path: path.join(snapDir, `scene_${String(i).padStart(2, '0')}.png`),
      })
    }

    info(`[Step3] Captured ${scenes.length} snapshots`)
    return { success: true, output: snapDir, count: scenes.length }
  } catch (err) {
    return { success: false, error: err.message }
  } finally {
    if (browser) await browser.close()
  }
}

async function runRemotionSnapshots(episode, dir) {
  info(`[Step3:Remotion] Taking stills for "${episode.title}"`)

  try {
    const { renderRemotionStill } = await import('../render/remotion-bundle.js')
    const remotionDir = path.join(dir, 'remotion')
    const snapDir = path.join(dir, 'snapshots')
    if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true })

    if (!fs.existsSync(path.join(remotionDir, 'entry.jsx'))) {
      warn('[Step3:Remotion] Remotion project not found — skipping snapshots')
      return { success: true, output: snapDir, count: 0, skipped: true }
    }

    const componentsPath = path.join(dir, 'remotion-components.json')
    if (!fs.existsSync(componentsPath)) {
      warn('[Step3:Remotion] No components manifest — skipping snapshots')
      return { success: true, output: snapDir, count: 0, skipped: true }
    }

    const components = JSON.parse(fs.readFileSync(componentsPath, 'utf-8'))
    const fps = 30
    const failures = []

    for (let i = 0; i < components.length; i++) {
      const frameStart = components.slice(0, i).reduce((s, c) => s + (c.duration || 5) * fps, 0)
      const midFrame = Math.floor(frameStart + (components[i].duration || 5) * fps / 2)
      try {
        await renderRemotionStill(remotionDir, midFrame, path.join(snapDir, `scene_${String(i).padStart(2, '0')}.png`))
      } catch (err) {
        warn(`[Step3:Remotion] Still render failed for scene ${i}: ${err.message}`)
        failures.push(`scene ${i}: ${err.message}`)
      }
    }

    if (failures.length > 0) {
      return { success: false, error: `Still render failed: ${failures.join('; ')}` }
    }

    info(`[Step3:Remotion] Captured stills for ${components.length} scenes`)
    return { success: true, output: snapDir, count: components.length }
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      warn('[Step3:Remotion] @remotion not installed — skipping snapshots')
      return { success: true, output: path.join(dir, 'snapshots'), count: 0, skipped: true }
    }
    return { success: false, error: err.message }
  }
}
