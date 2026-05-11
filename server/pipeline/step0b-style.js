import { sendMessage } from '../ai/claude-client.js'
import { writeJSON, readText, readJSON, getEpisodeDir } from '../utils/file-helper.js'
import { listTemplates } from '../utils/templates.js'
import { info, warn } from '../utils/logger.js'

export async function runStyleAutoSelection(episode) {
  const slug = episode.slug
  const episodeDir = getEpisodeDir(slug)
  const research = readText(`scripts/${slug}/research.md`) || readText(`videos/${slug}/research.md`) || ''
  const storyboard = readText(`scripts/${slug}/storyboard.json`) || readText(`videos/${slug}/storyboard.json`) || '{}'
  const styleConfig = readJSON('data/style-config.json') || {}

  const system = [
    'You are a visual design director for educational micro-course videos.',
    'Analyze the topic, research, and storyboard to decide the optimal visual style.',
    'Output only valid JSON matching the schema exactly.',
    'Choose colors, typography, and animation that fit the topic content — not generic defaults.',
    'Be specific and intentional. No "standard" or "generic" answers.',
    'Styles should be distinctive and topic-appropriate. A steel metallurgy video should look different from a consumer electronics video.',
  ].join(' ')

  const user = `Topic: ${episode.title}
Keywords: ${episode.keywords || ''}

Research excerpt:
${String(research).slice(0, 4000)}

Storyboard:
${String(storyboard).slice(0, 2000)}

Decide a visual style that fits this specific topic. Output JSON:
{
  "styleName": "A distinctive style name (e.g. \"Dark technical with neon circuit accents\")",
  "colorPalette": {
    "background": "#hex — main background color",
    "card": "#hex — card/panel surface color",
    "accent": "#hex — highlight/accent color",
    "text": "#hex — primary text color",
    "code": "#hex — code block text color"
  },
  "typography": {
    "body": "body font family",
    "code": "code font family"
  },
  "visualDensity": "sparse | balanced | dense",
  "animationIntensity": "minimal | moderate | dynamic",
  "decorativeElements": ["specific visual elements to use, e.g. \"circuit traces\", \"data flow arrows\"],
  "sceneLayoutStrategy": "description of layout approach for scenes",
  "forbiddenPatterns": ["patterns to avoid for this topic"]
}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await sendMessage(system, user, {
      maxTokens: 2000,
      temperature: 0.4,
    })
    if (result.error) {
      warn(`[Style] attempt ${attempt}/3 failed: ${result.error}`)
      continue
    }
    try {
      const text = result.text.replace(/```json\s*|```\s*/g, '').trim()
      const parsed = JSON.parse(text)
      if (!parsed.styleName || !parsed.colorPalette?.background) {
        warn(`[Style] attempt ${attempt}/3: incomplete JSON, retrying`)
        continue
      }
      writeJSON(`${episodeDir}/style-decision.json`, parsed)
      info(`[Style] Auto-selected style for "${episode.title}": ${parsed.styleName}`)
      return { success: true, style: parsed }
    } catch (err) {
      warn(`[Style] attempt ${attempt}/3 JSON parse failed: ${err.message}`)
    }
  }

  // Fallback: derive from style-config.json — still dynamic, not hardcoded
  const fb = styleConfig
  const fallback = {
    styleName: 'Default technical dark',
    colorPalette: {
      background: fb.colors?.background || '#0d1117',
      card: fb.colors?.card || '#161b22',
      accent: fb.colors?.accent || '#58a6ff',
      text: fb.colors?.text || '#f0f6fc',
      code: fb.colors?.code || '#e6edf3',
    },
    typography: {
      body: fb.fonts?.body || 'system-ui, sans-serif',
      code: fb.fonts?.code || 'JetBrains Mono, monospace',
    },
    visualDensity: 'balanced',
    animationIntensity: fb.animation || 'minimal',
    decorativeElements: ['geometric shapes', 'gradient accents'],
    sceneLayoutStrategy: 'Visual panel left, text content right',
    forbiddenPatterns: [],
  }
  writeJSON(`${episodeDir}/style-decision.json`, fallback)
  warn(`[Style] All AI attempts failed, using config-derived fallback for "${episode.title}"`)
  return { success: true, style: fallback }
}
