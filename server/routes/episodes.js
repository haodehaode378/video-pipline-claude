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

function buildDefaultResearchBrief({ title, keywords, duration, sourceMaterial }) {
  return `# 资料收集要求：${title}

## 目标观众
- 中文短视频观众，默认没有系统背景知识。

## 视频目标
- 用约 ${duration || 3} 分钟讲清楚「${title}」的核心概念、关键机制和一个可视化例子。

## 资料收集问题
1. 这个主题的准确定义是什么？
2. 它解决什么问题，为什么重要？
3. 核心机制或步骤是什么？
4. 有哪些适合做成动画的例子、类比或过程图？
5. 常见误解、边界条件或容易讲错的点是什么？

## 必须收集
- 权威定义或可靠背景说明。
- 3-5 个关键事实。
- 1 个适合短视频讲解的具体例子。
- 2-4 个可视化/动画建议。
- 不确定内容必须标注“待核实”，不能编造来源。

## 避免
- 不要泛泛而谈。
- 不要堆砌百科式背景。
- 不要使用无法验证的数据。
- 不要把不确定信息写成确定结论。

## 用户补充素材
${sourceMaterial || '无'}

## 关键词
${keywords || '无'}
`
}

function normalizeEpisode(episode) {
  const steps = { ...defaultSteps(), ...(episode.steps || {}) }
  if (!episode.steps?.timeline && episode.steps?.mux === 'completed') {
    steps.timeline = 'completed'
  }
  return {
    ...episode,
    steps,
    researchBrief: episode.researchBrief || buildDefaultResearchBrief(episode),
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
    researchBrief: buildDefaultResearchBrief({ title, keywords, duration, sourceMaterial }),
    status: 'brief_pending',
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

  if (req.body?.researchBrief !== undefined) {
    episode.researchBrief = req.body.researchBrief
  }
  if (!episode.researchBrief?.trim()) {
    return res.status(400).json({ error: 'researchBrief is required before research' })
  }

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

router.put('/:slug/research-brief', (req, res) => {
  const { episodes, episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })
  if (typeof req.body.content !== 'string' || !req.body.content.trim()) {
    return res.status(400).json({ error: 'content is required' })
  }

  episode.researchBrief = req.body.content
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
