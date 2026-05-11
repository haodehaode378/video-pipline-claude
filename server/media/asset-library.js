import { info, warn } from '../utils/logger.js'
import { ensureDir } from '../utils/file-helper.js'
import path from 'node:path'
import fs from 'node:fs'

async function pexelsSearch(query, apiKey, perPage = 10) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: apiKey } })
  if (!res.ok) throw new Error(`Pexels API error: ${res.status}`)
  const data = await res.json()
  return (data.photos || []).map((p) => ({
    id: `pexels-${p.id}`,
    url: p.src.large2x || p.src.large,
    previewUrl: p.src.medium,
    photographer: p.photographer,
    width: p.width,
    height: p.height,
    source: 'pexels',
  }))
}

async function unsplashSearch(query, apiKey, perPage = 10) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${apiKey}` } })
  if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`)
  const data = await res.json()
  return (data.results || []).map((p) => ({
    id: `unsplash-${p.id}`,
    url: p.urls.regular,
    previewUrl: p.urls.small,
    photographer: p.user?.name,
    width: p.width,
    height: p.height,
    source: 'unsplash',
  }))
}

export async function searchImages(query, options = {}) {
  const { pexelsKey, unsplashKey, perPage = 10 } = options
  const results = []

  try {
    if (pexelsKey) {
      const pexelsResults = await pexelsSearch(query, pexelsKey, perPage)
      results.push(...pexelsResults)
    }
  } catch (err) {
    warn(`[Assets] Pexels search failed for "${query}": ${err.message}`)
  }

  try {
    if (unsplashKey) {
      const unsplashResults = await unsplashSearch(query, unsplashKey, perPage)
      results.push(...unsplashResults)
    }
  } catch (err) {
    warn(`[Assets] Unsplash search failed for "${query}": ${err.message}`)
  }

  return results
}

export async function downloadImage(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const buffer = await res.arrayBuffer()
  fs.writeFileSync(destPath, Buffer.from(buffer))
  return destPath
}

export function extractKeywords(visualDescription) {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'shall',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'and', 'or', 'but', 'not', 'so', 'if', 'as', 'an', 'it',
    'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
    'we', 'you', 'i', 'me', 'my', 'your', 'his', 'her', 'our',
    '显示', '展示', '一个', '的', '了', '在', '是', '有', '和',
    '与', '或', '及', '等', '这', '那', '它', '他', '她',
  ])

  const words = visualDescription
    .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()))

  const unique = [...new Set(words)]
  if (unique.length <= 3) return [unique.join(' ')]
  return [unique.slice(0, Math.ceil(unique.length / 2)).join(' '), unique.join(' ')]
}

export async function fetchAssetsForStoryboard(scenes, outputDir, options = {}) {
  const assetsDir = path.join(outputDir, 'assets')
  ensureDir(assetsDir)

  const assets = {}

  for (const scene of scenes) {
    const keywords = extractKeywords(scene.visual || scene.title || '')
    if (keywords.length === 0) continue

    info(`[Assets] Searching images for scene "${scene.id}": ${keywords[0]}`)
    const results = await searchImages(keywords[0], options)

    if (results.length > 0) {
      const top = results.slice(0, 3)
      const downloaded = []

      for (let i = 0; i < top.length; i++) {
        try {
          const ext = path.extname(new URL(top[i].url).pathname).split('?')[0] || '.jpg'
          const filename = `scene_${scene.id}_${i}${ext}`
          const destPath = path.join(assetsDir, filename)
          await downloadImage(top[i].url, destPath)
          downloaded.push({ localPath: destPath, ...top[i] })
        } catch (err) {
          warn(`[Assets] Failed to download image for scene "${scene.id}": ${err.message}`)
        }
      }

      assets[scene.id] = downloaded
    }
  }

  return assets
}
