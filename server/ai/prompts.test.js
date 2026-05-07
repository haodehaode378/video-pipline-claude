import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const STYLE_CONFIG_PATH = 'data/style-config.json'
const TMPL_DATA_PATH = 'lizi'

// Save and restore any real config
let styleBackup = null

beforeEach(() => {
  if (fs.existsSync(STYLE_CONFIG_PATH)) {
    styleBackup = fs.readFileSync(STYLE_CONFIG_PATH, 'utf-8')
  }
})

afterEach(() => {
  if (styleBackup) {
    fs.writeFileSync(STYLE_CONFIG_PATH, styleBackup)
    styleBackup = null
  } else {
    try { fs.unlinkSync(STYLE_CONFIG_PATH) } catch {}
  }
})

function writeStyleConfig(config) {
  if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true })
  fs.writeFileSync(STYLE_CONFIG_PATH, JSON.stringify(config))
}

describe('buildScriptPrompt', () => {
  it('returns system and user keys', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('栈的应用', '栈, 数据结构', 3, 'notes')
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes topic in user prompt', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('栈的应用', '栈', 3, '')
    expect(result.user).toContain('栈的应用')
  })

  it('includes keywords in user prompt', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('Topic', 'keyword1, keyword2', 5, '')
    expect(result.user).toContain('keyword1, keyword2')
  })

  it('includes duration in user prompt', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('Topic', '', 5, '')
    expect(result.user).toContain('5 minutes')
  })

  it('includes research when provided', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('Topic', '', 3, '', 'Research notes here')
    expect(result.user).toContain('Research notes here')
  })

  it('falls back to defaults when style config is missing', async () => {
    try { fs.unlinkSync(STYLE_CONFIG_PATH) } catch {}
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('Topic', '', 3, '')
    expect(result.user).toContain('#1a1a2e') // default background
    expect(result.user).toContain('#ffffff')  // default text
  })

  it('injects custom colors from style config', async () => {
    writeStyleConfig({
      colors: { background: '#000000', text: '#ff0000', accent: '#00ff00', card: '#111111' },
      fonts: {},
      animation: 'extreme',
    })
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('Topic', '', 3, '')
    expect(result.user).toContain('#000000')
    expect(result.user).toContain('#ff0000')
    expect(result.user).toContain('extreme')
  })

  it('system prompt describes script writer role', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('Topic', '', 3, '')
    expect(result.system).toContain('micro-course video script writer')
    expect(result.system).toContain('three-column')
  })

  it('user prompt specifies fixed structure sections', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildScriptPrompt } = await import('./prompts.js')
    const result = buildScriptPrompt('Topic', '', 3, '')
    expect(result.user).toContain('0:00-0:10')
    expect(result.user).toContain('0:10-0:40')
    expect(result.user).toContain('0:40-1:30')
    expect(result.user).toContain('concept explanation')
    expect(result.user).toContain('title and hook')
  })
})

describe('buildCodePrompt', () => {
  it('returns system and user for html type', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildCodePrompt } = await import('./prompts.js')
    const result = buildCodePrompt('html', '| 0:00-0:10 | Title | Narration |', 'test-slug')
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result.user).toContain('html')
  })

  it('html prompt requires DOCTYPE', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildCodePrompt } = await import('./prompts.js')
    const result = buildCodePrompt('html', 'script table', 'test')
    expect(result.user).toContain('<!DOCTYPE html>')
    expect(result.user).toContain('<div id="root"')
  })

  it('css prompt forbids markdown fences', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildCodePrompt } = await import('./prompts.js')
    const result = buildCodePrompt('css', 'script table', 'test')
    expect(result.user).toContain('Do not use markdown fences')
    expect(result.user).toContain('1920x1080')
  })

  it('js prompt includes __hfSeek requirement', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildCodePrompt } = await import('./prompts.js')
    const result = buildCodePrompt('js', 'script table', 'test')
    expect(result.user).toContain('__hfSeek')
    expect(result.user).toContain('Puppeteer')
  })

  it('injects slug into prompt', async () => {
    writeStyleConfig({ colors: {}, fonts: {}, animation: 'minimal' })
    const { buildCodePrompt } = await import('./prompts.js')
    const result = buildCodePrompt('html', 'script', 'my-episode-abc')
    expect(result.user).toContain('my-episode-abc')
  })

  it('uses default colors when style config is empty', async () => {
    writeStyleConfig({})
    const { buildCodePrompt } = await import('./prompts.js')
    const result = buildCodePrompt('css', 'script', 'slug')
    expect(result.user).toContain('#1a1a2e')
    expect(result.user).toContain('#16213e')
    expect(result.user).toContain('#e94560')
  })
})

describe('buildResearchSearcherPrompt', () => {
  it('returns system and user keys', async () => {
    const { buildResearchSearcherPrompt } = await import('./prompts.js')
    const result = buildResearchSearcherPrompt({ title: 'Test', keywords: 'k', duration: 3, sourceMaterial: '' })
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes topic in user prompt', async () => {
    const { buildResearchSearcherPrompt } = await import('./prompts.js')
    const result = buildResearchSearcherPrompt({ title: '栈', keywords: '', duration: 3, sourceMaterial: '' })
    expect(result.user).toContain('栈')
  })

  it('uses custom task name and focus', async () => {
    const { buildResearchSearcherPrompt } = await import('./prompts.js')
    const result = buildResearchSearcherPrompt(
      { title: 'X', keywords: '', duration: 3, sourceMaterial: '' },
      { name: 'CustomAgent', focus: 'algorithms' }
    )
    expect(result.system).toContain('CustomAgent')
    expect(result.system).toContain('algorithms')
  })
})

describe('buildResearchAnalystPrompt', () => {
  it('returns system and user', async () => {
    const { buildResearchAnalystPrompt } = await import('./prompts.js')
    const result = buildResearchAnalystPrompt({ title: 'Test', keywords: '', duration: 3 }, 'search material')
    expect(result.system).toContain('Analyst')
    expect(result.user).toContain('search material')
  })
})

describe('buildResearchVerifierPrompt', () => {
  it('returns system and user with draft research', async () => {
    const { buildResearchVerifierPrompt } = await import('./prompts.js')
    const result = buildResearchVerifierPrompt({ title: 'Test' }, 'draft', 'original')
    expect(result.system).toContain('Verifier')
    expect(result.user).toContain('draft')
    expect(result.user).toContain('original')
  })
})
