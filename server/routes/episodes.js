import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { getEpisodeDir, getScriptDir, readJSON, resolveWorkspacePath, writeJSON, writeText } from '../utils/file-helper.js'
import { startPipeline, stepOrder } from '../pipeline/orchestrator.js'
import { readLogs, error } from '../utils/logger.js'
import { bootstrapRemotionProject } from '../render/remotion-bundle.js'

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

  const episodeDir = getEpisodeDir(episode.slug)
  const expectedSceneCount = episode.storyboardContent?.scenes?.length
    || episode.codeContent?.remotionComponents?.length
    || 0
  const snapshotDir = path.join(episodeDir, 'snapshots')
  const snapshotCount = fs.existsSync(snapshotDir)
    ? fs.readdirSync(snapshotDir).filter((name) => /^scene_\d+\.png$/i.test(name)).length
    : 0
  const silentVideoPath = path.join(episodeDir, 'output', `episode-${episode.slug}.mp4`)
  const finalVideoPath = path.join(episodeDir, 'output', `episode-${episode.slug}-voiceover.mp4`)

  if (expectedSceneCount > 0 && snapshotCount >= expectedSceneCount && steps.snapshot !== 'completed') {
    steps.snapshot = 'completed'
  }
  if (fs.existsSync(silentVideoPath) && steps.render !== 'completed') {
    steps.render = 'completed'
  }
  if (fs.existsSync(finalVideoPath) && steps.mux !== 'completed') {
    steps.mux = 'completed'
  }
  const hasRunningStep = Object.values(steps).includes('running')
  if (episode.status === 'running' && !hasRunningStep) {
    if (steps.mux === 'completed') {
      episode.status = 'completed'
      episode.error = null
    } else {
      episode.status = 'failed'
      episode.error ||= '流水线被中断，请从未完成步骤重跑。'
    }
  } else if (steps.mux === 'completed' && episode.status !== 'completed') {
    episode.status = 'completed'
    episode.error = null
  }

  const legacyFallbackDetected =
    !episode.codeFallback
    && episode.steps?.code === 'completed'
    && typeof episode.codeContent?.html === 'string'
    && /\bship-mark\b/.test(episode.codeContent.html)

  return {
    ...episode,
    steps,
    researchBrief: episode.researchBrief || buildDefaultResearchBrief(episode),
    codeFallback: legacyFallbackDetected
      ? {
          used: true,
          reason: '历史记录未保存具体降级原因；该代码内容匹配本地兜底模板。',
          at: episode.updatedAt || null,
        }
      : episode.codeFallback,
  }
}

function storyboardToMarkdown(storyboard) {
  const scenes = Array.isArray(storyboard) ? storyboard : storyboard?.scenes
  const lines = ['| Scene | Visual | Narration |', '|---|---|---|']
  for (const scene of scenes || []) {
    lines.push(`| ${scene.id} | ${String(scene.visual || '').replace(/\|/g, '/')} | ${String(scene.narration || '').replace(/\|/g, '/')} |`)
  }
  return lines.join('\n')
}

function validateStoryboardPayload(payload) {
  const scenes = Array.isArray(payload) ? payload : payload?.scenes
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return { error: 'scenes must be a non-empty array' }
  }

  const normalized = []
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const id = String(scene.id || `scene-${String(i + 1).padStart(2, '0')}`).trim()
    const visual = String(scene.visual || '').trim()
    const narration = String(scene.narration || '').trim()
    const minDuration = Number(scene.minDuration || 3)
    const maxDuration = Number(scene.maxDuration || Math.max(minDuration, 8))

    if (!id) return { error: `scene ${i + 1} id is required` }
    if (!visual) return { error: `${id} visual is required` }
    if (!narration) return { error: `${id} narration is required` }
    if (!Number.isFinite(minDuration) || minDuration <= 0) return { error: `${id} minDuration is invalid` }
    if (!Number.isFinite(maxDuration) || maxDuration < minDuration) return { error: `${id} maxDuration is invalid` }

    normalized.push({
      id,
      title: String(scene.title || `镜头 ${i + 1}`).trim(),
      visual,
      narration,
      intent: String(scene.intent || '').trim(),
      minDuration,
      maxDuration,
      animationHint: String(scene.animationHint || '').trim(),
    })
  }

  return { storyboard: { version: 1, scenes: normalized } }
}

function resetStepsAfter(episode, stepName) {
  const startIdx = stepOrder.indexOf(stepName)
  if (startIdx === -1) return
  for (let i = startIdx; i < stepOrder.length; i++) {
    episode.steps[stepOrder[i]] = 'pending'
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
  episode.codeFallback = null
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

  const startStep = episode.steps.script === 'completed' && episode.storyboardContent ? 'narration' : 'script'

  episode.status = 'running'
  episode.error = null
  if (startStep === 'script') episode.codeFallback = null
  if (startStep === 'narration') resetStepsAfter(episode, 'narration')
  episode.updatedAt = new Date().toISOString()
  writeEpisodes(episodes)

  const options = startStep === 'script' ? { stopAfter: 'script' } : {}
  startPipeline(episode, startStep, options).catch((err) => {
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

router.put('/:slug/storyboard', (req, res) => {
  const { episodes, episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  const result = validateStoryboardPayload(req.body)
  if (result.error) return res.status(400).json({ error: result.error })

  const scriptDir = getScriptDir(episode.slug)
  const markdown = storyboardToMarkdown(result.storyboard)
  writeText(`${scriptDir}/storyboard.json`, JSON.stringify(result.storyboard, null, 2))
  writeText(`${scriptDir}/script.md`, markdown)

  episode.storyboardContent = result.storyboard
  episode.scriptContent = markdown
  resetStepsAfter(episode, 'narration')
  episode.status = 'storyboard_ready'
  episode.error = null
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

function validateCodeContent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'code payload must be an object' }
  }

  const isRemotion = payload.type === 'remotion' || Array.isArray(payload.remotionComponents)
  if (!isRemotion) return { codeContent: payload }

  if (!Array.isArray(payload.remotionComponents) || payload.remotionComponents.length === 0) {
    return { error: 'remotionComponents must be a non-empty array' }
  }

  for (let i = 0; i < payload.remotionComponents.length; i++) {
    const component = payload.remotionComponents[i]
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      return { error: `remotionComponents[${i}] must be an object` }
    }
    if (typeof component.component !== 'string' || !component.component.trim()) {
      return { error: `remotionComponents[${i}].component is required` }
    }
    if (!/^function\s+\w+\s*\(/.test(component.component.trim())) {
      return { error: `remotionComponents[${i}].component must start with a function declaration` }
    }
  }

  return {
    codeContent: {
      ...payload,
      type: 'remotion',
    },
  }
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
}

function clearGeneratedRenderArtifacts(episode) {
  const episodeDir = getEpisodeDir(episode.slug)
  const snapshotDir = path.join(episodeDir, 'snapshots')
  if (fs.existsSync(snapshotDir)) {
    for (const name of fs.readdirSync(snapshotDir)) {
      if (/^scene_\d+\.png$/i.test(name)) removeIfExists(path.join(snapshotDir, name))
    }
  }

  const outputDir = path.join(episodeDir, 'output')
  removeIfExists(path.join(outputDir, `episode-${episode.slug}.mp4`))
  removeIfExists(path.join(outputDir, `episode-${episode.slug}-voiceover.mp4`))
  removeIfExists(path.join(episodeDir, `episode-${episode.slug}.srt`))
}

router.put('/:slug/code', async (req, res) => {
  const { episodes, episode } = findEpisode(req.params.slug)
  if (!episode) return res.status(404).json({ error: 'not found' })

  const result = validateCodeContent(req.body)
  if (result.error) return res.status(400).json({ error: result.error })

  episode.codeContent = result.codeContent
  episode.updatedAt = new Date().toISOString()
  if (Array.isArray(result.codeContent.remotionComponents)) {
    const episodeDir = getEpisodeDir(episode.slug)
    const remotionDir = path.join(episodeDir, 'remotion')
    await bootstrapRemotionProject(episode.slug, result.codeContent.remotionComponents, remotionDir)
    writeText(path.join(episodeDir, 'remotion-components.json'), JSON.stringify(result.codeContent.remotionComponents, null, 2))
    clearGeneratedRenderArtifacts(episode)
    resetStepsAfter(episode, 'snapshot')
    episode.status = 'code_ready'
    episode.error = null
  }
  writeEpisodes(episodes)
  res.json(episode)
})

router.get('/:slug/download', (req, res) => {
  const { slug } = req.params
  const filePath = resolveWorkspacePath(path.join('videos', slug, 'output', `episode-${slug}-voiceover.mp4`))

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
  if (stepOrder.indexOf(step) <= stepOrder.indexOf('code')) {
    episode.codeFallback = null
  }
  episode.updatedAt = new Date().toISOString()
  writeEpisodes(episodes)

  startPipeline(episode, step).catch((err) => {
    error(`Retry failed for ${req.params.slug}: ${err.message}`)
  })

  res.json(episode)
})

export default router
export { clearGeneratedRenderArtifacts, normalizeEpisode, resetStepsAfter, storyboardToMarkdown, validateCodeContent, validateStoryboardPayload }
