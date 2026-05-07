import puppeteer from 'puppeteer'
import path from 'node:path'
import fs from 'node:fs'
import { getEpisodeDir } from '../utils/file-helper.js'

export async function runStep3(episode) {
  console.log(`[Step3] Taking snapshots for "${episode.title}"...`)

  const dir = getEpisodeDir(episode.slug)
  const htmlPath = path.join(dir, 'index.html')
  const snapDir = path.join(dir, 'snapshots')
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true })

  let browser
  try {
    browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 })

    // Get all scene data-start times
    const scenes = await page.evaluate(() => {
      const els = document.querySelectorAll('.scene[data-start]')
      return Array.from(els).map((el) => ({
        start: parseFloat(el.dataset.start),
      }))
    })

    if (scenes.length === 0) {
      console.warn('[Step3] No .scene[data-start] elements found — taking single screenshot')
      await page.screenshot({ path: path.join(snapDir, 'scene_00.png') })
      return { success: true, output: snapDir, count: 1 }
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

    console.log(`[Step3] Captured ${scenes.length} snapshots`)
    return { success: true, output: snapDir, count: scenes.length }
  } catch (err) {
    return { success: false, error: err.message }
  } finally {
    if (browser) await browser.close()
  }
}
