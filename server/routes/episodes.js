import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { readJSON, writeJSON } from '../utils/file-helper.js'
import { startPipeline } from '../pipeline/orchestrator.js'

const router = Router()
const DATA_PATH = 'data/episodes.json'

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

router.post('/', async (req, res) => {
  const { title, keywords, duration, template } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })

  const slug = slugify(title) + '-' + Date.now().toString(36)
  const episode = {
    slug,
    title,
    keywords: keywords || '',
    duration: duration || 3,
    template: template || '',
    status: 'pending',
    steps: {
      script: 'pending',
      code: 'pending',
      snapshot: 'pending',
      render: 'pending',
      narration: 'pending',
      tts: 'pending',
      mux: 'pending',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  }

  const episodes = readJSON(DATA_PATH) || []
  episodes.push(episode)
  writeJSON(DATA_PATH, episodes)

  // 异步启动流水线
  startPipeline(episode).catch((err) => {
    console.error(`Pipeline failed for ${slug}:`, err)
  })

  res.status(201).json(episode)
})

router.get('/', (req, res) => {
  const episodes = readJSON(DATA_PATH) || []
  res.json(episodes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})

router.get('/:slug', (req, res) => {
  const episodes = readJSON(DATA_PATH) || []
  const episode = episodes.find((e) => e.slug === req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })
  res.json(episode)
})

router.put('/:slug/script', (req, res) => {
  const episodes = readJSON(DATA_PATH) || []
  const episode = episodes.find((e) => e.slug === req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  episode.scriptContent = req.body.content
  episode.updatedAt = new Date().toISOString()
  writeJSON(DATA_PATH, episodes)
  res.json(episode)
})

router.put('/:slug/code', (req, res) => {
  const episodes = readJSON(DATA_PATH) || []
  const episode = episodes.find((e) => e.slug === req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  episode.codeContent = req.body
  episode.updatedAt = new Date().toISOString()
  writeJSON(DATA_PATH, episodes)
  res.json(episode)
})

router.get('/:slug/download', (req, res) => {
  const { slug } = req.params
  const filePath = path.resolve('videos', slug, 'output', `episode-${slug}-voiceover.mp4`)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video not ready yet' })
  }

  res.download(filePath)
})

router.post('/:slug/retry', async (req, res) => {
  const episodes = readJSON(DATA_PATH) || []
  const episode = episodes.find((e) => e.slug === req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  const { step } = req.body
  if (step) episode.steps[step] = 'pending'
  episode.status = 'running'
  episode.error = null
  episode.updatedAt = new Date().toISOString()
  writeJSON(DATA_PATH, episodes)

  startPipeline(episode).catch((err) => {
    console.error(`Retry failed for ${req.params.slug}:`, err)
  })

  res.json(episode)
})

export default router
