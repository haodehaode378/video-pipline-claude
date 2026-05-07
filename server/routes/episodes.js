import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { readJSON, writeJSON } from '../utils/file-helper.js'
import { startPipeline, stepOrder } from '../pipeline/orchestrator.js'
import { readLogs, error } from '../utils/logger.js'

const STYLE_CONFIG_PATH = 'data/style-config.json'

const router = Router()
const DATA_PATH = 'data/episodes.json'

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function defaultSteps() {
  return Object.fromEntries(stepOrder.map((step) => [step, 'pending']))
}

function normalizeEpisode(episode) {
  return {
    ...episode,
    steps: { ...defaultSteps(), ...(episode.steps || {}) },
  }
}

function readEpisodes() {
  return (readJSON(DATA_PATH) || []).map(normalizeEpisode)
}

function writeEpisodes(episodes) {
  writeJSON(DATA_PATH, episodes.map(normalizeEpisode))
}

function findEpisode(slug) {
  const episodes = readEpisodes()
  return { episodes, episode: episodes.find((e) => e.slug === slug) }
}

router.post('/', async (req, res) => {
  const { title, keywords, duration, template, sourceMaterial } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })

  const slugBase = slugify(title) || 'episode'
  const slug = `${slugBase}-${Date.now().toString(36)}`
  const episode = {
    slug,
    title,
    keywords: keywords || '',
    duration: duration || 3,
    template: template || '',
    sourceMaterial: sourceMaterial || '',
    status: 'pending',
    steps: defaultSteps(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  }

  const episodes = readEpisodes()
  episodes.push(episode)
  writeEpisodes(episodes)

  res.status(201).json(episode)
})

router.post('/:slug/research', async (req, res) => {
  const { episodes, episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  episode.status = 'running'
  episode.error = null
  episode.steps.research = 'pending'
  episode.updatedAt = new Date().toISOString()
  writeEpisodes(episodes)

  startPipeline(episode, 'research', { stopAfter: 'research' }).catch((err) => {
    error(`Research failed for ${req.params.slug}: ${err.message}`)
  })

  res.json(episode)
})

router.post('/:slug/generate', async (req, res) => {
  const { episodes, episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })
  if (episode.steps.research !== 'completed') {
    return res.status(409).json({ error: 'research must be completed before generation' })
  }

  episode.status = 'running'
  episode.error = null
  episode.updatedAt = new Date().toISOString()
  writeEpisodes(episodes)

  startPipeline(episode, 'script').catch((err) => {
    error(`Generate failed for ${req.params.slug}: ${err.message}`)
  })

  res.json(episode)
})

router.get('/', (req, res) => {
  const episodes = readEpisodes()
  res.json(episodes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})

router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100
  res.json(readLogs(limit))
})

router.get('/style-config', (req, res) => {
  const config = readJSON(STYLE_CONFIG_PATH) || {}
  res.json(config)
})

router.put('/style-config', (req, res) => {
  writeJSON(STYLE_CONFIG_PATH, req.body)
  res.json(req.body)
})

router.get('/:slug', (req, res) => {
  const { episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })
  res.json(episode)
})

router.put('/:slug/script', (req, res) => {
  const { episodes, episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  episode.scriptContent = req.body.content
  episode.updatedAt = new Date().toISOString()
  writeEpisodes(episodes)
  res.json(episode)
})

router.put('/:slug/code', (req, res) => {
  const { episodes, episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  episode.codeContent = req.body
  episode.updatedAt = new Date().toISOString()
  writeEpisodes(episodes)
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
  const { episodes, episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  const step = req.body.step || 'research'
  if (!stepOrder.includes(step)) return res.status(400).json({ error: `unknown step: ${step}` })

  episode.steps[step] = 'pending'
  episode.status = 'running'
  episode.error = null
  episode.updatedAt = new Date().toISOString()
  writeEpisodes(episodes)

  startPipeline(episode, step).catch((err) => {
    error(`Retry failed for ${req.params.slug}: ${err.message}`)
  })

  res.json(episode)
})

export default router
