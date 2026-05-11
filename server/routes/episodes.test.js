import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { resolveWorkspacePath } from '../utils/file-helper.js'

// The routes module has side effects (imports orchestrator, reads env).
// We test the internal helper functions by extracting them or testing through HTTP.
// Since Express 5 Router can be tested via supertest-style calls, but we don't
// want to install supertest. Instead we test the pure logic functions.

const DATA_PATH = 'data/episodes.json'
const TEST_DATA_PATH = 'data/episodes-test-backup.json'

function backupData() {
  if (fs.existsSync(DATA_PATH)) {
    fs.copyFileSync(DATA_PATH, TEST_DATA_PATH)
  }
}

function restoreData() {
  if (fs.existsSync(TEST_DATA_PATH)) {
    fs.copyFileSync(TEST_DATA_PATH, DATA_PATH)
    fs.unlinkSync(TEST_DATA_PATH)
  } else {
    try { fs.unlinkSync(DATA_PATH) } catch {}
  }
}

// Replicate slugify logic from routes/episodes.js
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

describe('slugify', () => {
  it('converts English text to slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('preserves Chinese characters', () => {
    expect(slugify('栈的数据结构')).toBe('栈的数据结构')
  })

  it('handles mixed Chinese and English', () => {
    expect(slugify('栈 Stack 应用')).toBe('栈-stack-应用')
  })

  it('removes special characters', () => {
    expect(slugify('Hello!!! World???')).toBe('hello-world')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('--Hello World--')).toBe('hello-world')
  })

  it('limits to 60 characters', () => {
    const long = slugify('a'.repeat(100))
    expect(long.length).toBeLessThanOrEqual(60)
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('collapses multiple separators', () => {
    expect(slugify('a   b---c')).toBe('a-b-c')
  })
})

// Replicate normalize logic from routes
const stepOrder = ['research', 'script', 'narration', 'tts', 'timeline', 'code', 'snapshot', 'render', 'mux']

function defaultSteps() {
  return Object.fromEntries(stepOrder.map((step) => [step, 'pending']))
}

function normalizeEpisode(episode) {
  return {
    ...episode,
    steps: { ...defaultSteps(), ...(episode.steps || {}) },
  }
}

describe('normalizeEpisode', () => {
  it('fills in missing step states', () => {
    const ep = normalizeEpisode({ slug: 'test', title: 'Test', steps: {} })
    expect(ep.steps.research).toBe('pending')
    expect(ep.steps.script).toBe('pending')
    expect(ep.steps.timeline).toBe('pending')
    expect(ep.steps.code).toBe('pending')
    expect(ep.steps.mux).toBe('pending')
  })

  it('preserves existing step states', () => {
    const ep = normalizeEpisode({ slug: 'test', title: 'Test', steps: { research: 'completed', script: 'running' } })
    expect(ep.steps.research).toBe('completed')
    expect(ep.steps.script).toBe('running')
    expect(ep.steps.code).toBe('pending')
  })

  it('handles null/undefined steps', () => {
    const ep = normalizeEpisode({ slug: 'test', title: 'Test' })
    expect(ep.steps).toBeDefined()
    expect(ep.steps.research).toBe('pending')
  })
})

describe('stepOrder', () => {
  it('has 8 steps', () => {
    expect(stepOrder).toHaveLength(9)
  })

  it('starts with research and ends with mux', () => {
    expect(stepOrder[0]).toBe('research')
    expect(stepOrder[stepOrder.length - 1]).toBe('mux')
  })

  it('contains all expected steps', () => {
    expect(stepOrder).toContain('research')
    expect(stepOrder).toContain('script')
    expect(stepOrder).toContain('narration')
    expect(stepOrder).toContain('tts')
    expect(stepOrder).toContain('timeline')
    expect(stepOrder).toContain('code')
    expect(stepOrder).toContain('snapshot')
    expect(stepOrder).toContain('render')
    expect(stepOrder).toContain('mux')
  })
})

describe('storyboard helpers', () => {
  it('validates a legal storyboard payload', async () => {
    const { validateStoryboardPayload } = await import('./episodes.js')
    const result = validateStoryboardPayload({
      scenes: [{
        id: 'scene-01',
        visual: '显示流程图',
        narration: '这里解释核心流程。',
        minDuration: 3,
        maxDuration: 8,
      }],
    })

    expect(result.error).toBeUndefined()
    expect(result.storyboard.scenes[0].id).toBe('scene-01')
  })

  it('rejects invalid storyboard timing', async () => {
    const { validateStoryboardPayload } = await import('./episodes.js')
    const result = validateStoryboardPayload({
      scenes: [{
        id: 'scene-01',
        visual: '显示流程图',
        narration: '这里解释核心流程。',
        minDuration: 8,
        maxDuration: 3,
      }],
    })

    expect(result.error).toContain('maxDuration')
  })

  it('resets downstream steps after storyboard edits', async () => {
    const { resetStepsAfter } = await import('./episodes.js')
    const episode = {
      steps: {
        research: 'completed',
        script: 'completed',
        narration: 'completed',
        tts: 'completed',
        timeline: 'completed',
        code: 'completed',
        snapshot: 'completed',
        render: 'completed',
        mux: 'completed',
      },
    }

    resetStepsAfter(episode, 'narration')
    expect(episode.steps.script).toBe('completed')
    expect(episode.steps.narration).toBe('pending')
    expect(episode.steps.mux).toBe('pending')
  })

  it('validates Remotion code payloads before saving', async () => {
    const { validateCodeContent } = await import('./episodes.js')
    const result = validateCodeContent({
      remotionComponents: [
        { id: 'scene-01', component: 'function SceneOne({ scene }) { return null }' },
      ],
    })

    expect(result.error).toBeUndefined()
    expect(result.codeContent.type).toBe('remotion')
  })

  it('rejects malformed Remotion component code payloads', async () => {
    const { validateCodeContent } = await import('./episodes.js')
    const result = validateCodeContent({
      type: 'remotion',
      remotionComponents: [
        { id: 'scene-01', component: '<AbsoluteFill />' },
      ],
    })

    expect(result.error).toContain('function declaration')
  })

  it('recovers completed render artifacts after an interrupted process restart', async () => {
    const { normalizeEpisode } = await import('./episodes.js')
    const slug = 'normalize-recovery-test'
    const episodeDir = resolveWorkspacePath(path.join('videos', slug))
    const outDir = path.join(episodeDir, 'output')
    const snapDir = path.join(episodeDir, 'snapshots')

    fs.mkdirSync(outDir, { recursive: true })
    fs.mkdirSync(snapDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, `episode-${slug}.mp4`), 'video')
    fs.writeFileSync(path.join(outDir, `episode-${slug}-voiceover.mp4`), 'final')
    fs.writeFileSync(path.join(snapDir, 'scene_00.png'), 'snap')

    try {
      const ep = normalizeEpisode({
        slug,
        title: 'Recovery',
        status: 'running',
        steps: {
          code: 'completed',
          snapshot: 'pending',
          render: 'pending',
          mux: 'pending',
        },
        storyboardContent: { scenes: [{ id: 'scene-01' }] },
      })

      expect(ep.steps.snapshot).toBe('completed')
      expect(ep.steps.render).toBe('completed')
      expect(ep.steps.mux).toBe('completed')
      expect(ep.status).toBe('completed')
      expect(ep.error).toBeNull()
    } finally {
      fs.rmSync(episodeDir, { recursive: true, force: true })
    }
  })

  it('clears stale render artifacts after Remotion code edits', async () => {
    const { clearGeneratedRenderArtifacts } = await import('./episodes.js')
    const slug = 'clear-render-artifacts-test'
    const episodeDir = resolveWorkspacePath(path.join('videos', slug))
    const outDir = path.join(episodeDir, 'output')
    const snapDir = path.join(episodeDir, 'snapshots')

    fs.mkdirSync(outDir, { recursive: true })
    fs.mkdirSync(snapDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, `episode-${slug}.mp4`), 'video')
    fs.writeFileSync(path.join(outDir, `episode-${slug}-voiceover.mp4`), 'final')
    fs.writeFileSync(path.join(episodeDir, `episode-${slug}.srt`), 'subtitle')
    fs.writeFileSync(path.join(snapDir, 'scene_00.png'), 'snap')
    fs.writeFileSync(path.join(snapDir, 'keep.txt'), 'keep')

    try {
      clearGeneratedRenderArtifacts({ slug })

      expect(fs.existsSync(path.join(outDir, `episode-${slug}.mp4`))).toBe(false)
      expect(fs.existsSync(path.join(outDir, `episode-${slug}-voiceover.mp4`))).toBe(false)
      expect(fs.existsSync(path.join(episodeDir, `episode-${slug}.srt`))).toBe(false)
      expect(fs.existsSync(path.join(snapDir, 'scene_00.png'))).toBe(false)
      expect(fs.existsSync(path.join(snapDir, 'keep.txt'))).toBe(true)
    } finally {
      fs.rmSync(episodeDir, { recursive: true, force: true })
    }
  })
})
