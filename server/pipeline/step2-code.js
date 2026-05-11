import { sendMessage } from '../ai/claude-client.js'
import { buildCodePrompt } from '../ai/prompts.js'
import { writeText, getEpisodeDir, readText } from '../utils/file-helper.js'
import styleCheck from '../utils/style-check.js'
import { generateLocalCodeBundle } from '../utils/local-codegen.js'
import { info, warn } from '../utils/logger.js'
import { generateSceneComponent, classifySceneType } from '../render/scene-components.js'
import { bootstrapRemotionProject } from '../render/remotion-bundle.js'
import path from 'node:path'
import fs from 'node:fs'

const RENDER_ENGINE = process.env.RENDER_ENGINE || 'remotion'

const ALLOWED_SCENE_TYPES = [
  'openingHook',
  'comparison',
  'timeline',
  'dataVisual',
  'experiment',
  'mechanism',
  'processFlow',
  'finale',
  'genericVisual',
]

const ALLOWED_VISUAL_OBJECTS = [
  'schoolGate',
  'blastFurnace',
  'book',
  'graduationCap',
  'labFlask',
  'crystalLattice',
  'gearLoop',
  'timelineRail',
  'flowNodes',
  'brainDiagram',
  'sodaCan',
  'drinkCup',
  'chartRadar',
  'chip',
  'networkGraph',
  'headphones',
  'audioWaves',
  'citySkyline',
  'moneyStack',
  'leafEnergy',
  'rocket',
  'vehicle',
  'filmFrame',
  'sportsCourt',
  'medicalCross',
  'factory',
  'shoppingBag',
  'genericBadge',
]

const CODE_PLAN_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'micro_course_code_plan',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['visualStyle', 'sharedClasses', 'scenes'],
      properties: {
        visualStyle: {
          type: 'string',
          minLength: 1,
        },
        sharedClasses: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
        },
        scenes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'start', 'duration', 'layout', 'visualElements', 'animationBeats', 'requiredClasses'],
            properties: {
              id: {
                type: 'string',
                minLength: 1,
              },
              start: {
                type: 'number',
              },
              duration: {
                type: 'number',
                exclusiveMinimum: 0,
              },
              layout: {
                type: 'string',
                minLength: 1,
              },
              visualElements: {
                type: 'array',
                items: {
                  type: 'string',
                  minLength: 1,
                },
              },
              animationBeats: {
                type: 'array',
                items: {
                  type: 'string',
                  minLength: 1,
                },
              },
              requiredClasses: {
                type: 'array',
                items: {
                  type: 'string',
                  minLength: 1,
                },
              },
            },
          },
        },
      },
    },
  },
}

function normalizeHtmlAttrs(html) {
  // Fix AI models that omit spaces before known HTML attributes
  let out = html
    .replace(/([a-z])(class=)/gi, '$1 $2')
    .replace(/([a-z])(data-start=)/gi, '$1 $2')
    .replace(/([a-z])(data-duration=)/gi, '$1 $2')
    .replace(/([a-z])(id=)/gi, '$1 $2')
    .replace(/([a-z])(style=)/gi, '$1 $2')
    .replace(/(["'])(class=)/gi, '$1 $2')
    .replace(/(["'])(data-start=)/gi, '$1 $2')
    .replace(/(["'])(data-duration=)/gi, '$1 $2')
    .replace(/(["'])(id=)/gi, '$1 $2')
    .replace(/(["'])(style=)/gi, '$1 $2')
    .replace(/\bclass=(["'])([^"']*)\1/gi, (match, quote, value) => {
      const normalized = value
        .replace(/\b(scene)(?=(?:scene-|viz-|local|pending))/g, '$1 ')
        .replace(/\b(scene-shell)(?=viz-)/g, '$1 ')
        .replace(/\b(scene-kicker)(?=viz-)/g, '$1 ')
        .replace(/\b(scene-title)(?=viz-)/g, '$1 ')
        .replace(/\b(scene-summary)(?=viz-)/g, '$1 ')
        .replace(/\b(visual-panel)(?=viz-)/g, '$1 ')
        .replace(/\b(panel)(?=viz-)/g, '$1 ')
        .replace(/\b(card)(?=viz-)/g, '$1 ')
        .replace(/\b(metric)(?=viz-)/g, '$1 ')
        .replace(/\b(diagram)(?=viz-)/g, '$1 ')
        .replace(/\b(badge)(?=viz-)/g, '$1 ')
        .replace(/\b(label)(?=viz-)/g, '$1 ')
        .replace(/\b(connector)(?=viz-)/g, '$1 ')
        .replace(/\b(node)(?=viz-)/g, '$1 ')
        .replace(/\s+/g, ' ')
        .trim()
      return `class=${quote}${normalized}${quote}`
    })
  return out
}

function stripCodeFence(text, type) {
  if (!text) return ''
  let out = text.trim()
  out = out.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, '')
  out = out.replace(new RegExp(`^\\s*\`\`\`${type}\\s*\\r?\\n`, 'i'), '')
  out = out.replace(/^\s*```\w*\s*\r?\n/i, '')
  out = out.replace(/\r?\n```\s*$/i, '')
  return out.trim()
}

function braceBalance(text) {
  let balance = 0
  for (const ch of text) {
    if (ch === '{') balance++
    if (ch === '}') balance--
    if (balance < 0) return false
  }
  return balance === 0
}

function hasMalformedHtmlTag(html) {
  if (/<[^>]*$/i.test(html)) return true
  return /<[^>]+\b(?:class|id|style|data-start|data-duration)=(["'])[^"'>]*<[^"'>]*\1/i.test(html)
}

function parsePlanJSON(text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return { __parseError: err.message }
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateStringArray(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`)
    return
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${path}[${index}] must be a non-empty string`)
    }
  })
}

function validateCodePlanSchema(plan) {
  const errors = []
  if (!isPlainObject(plan)) return ['plan must be an object']

  const allowedTopLevel = new Set(['visualStyle', 'sharedClasses', 'scenes'])
  for (const key of Object.keys(plan)) {
    if (!allowedTopLevel.has(key)) errors.push(`unexpected top-level field: ${key}`)
  }

  if (typeof plan.visualStyle !== 'string' || plan.visualStyle.trim() === '') {
    errors.push('visualStyle must be a non-empty string')
  }
  validateStringArray(plan.sharedClasses, 'sharedClasses', errors)

  if (!Array.isArray(plan.scenes)) {
    errors.push('scenes must be an array')
    return errors
  }
  if (plan.scenes.length === 0) errors.push('scenes must contain at least one item')

  const allowedSceneFields = new Set([
    'id',
    'start',
    'duration',
    'layout',
    'visualElements',
    'animationBeats',
    'requiredClasses',
  ])
  plan.scenes.forEach((scene, index) => {
    const path = `scenes[${index}]`
    if (!isPlainObject(scene)) {
      errors.push(`${path} must be an object`)
      return
    }
    for (const key of Object.keys(scene)) {
      if (!allowedSceneFields.has(key)) errors.push(`${path} has unexpected field: ${key}`)
    }
    for (const key of allowedSceneFields) {
      if (!(key in scene)) errors.push(`${path}.${key} is required`)
    }
    if (typeof scene.id !== 'string' || scene.id.trim() === '') errors.push(`${path}.id must be a non-empty string`)
    if (typeof scene.start !== 'number' || !Number.isFinite(scene.start)) errors.push(`${path}.start must be a finite number`)
    if (typeof scene.duration !== 'number' || !Number.isFinite(scene.duration) || scene.duration <= 0) {
      errors.push(`${path}.duration must be a positive number`)
    }
    if (typeof scene.layout !== 'string' || scene.layout.trim() === '') errors.push(`${path}.layout must be a non-empty string`)
    validateStringArray(scene.visualElements, `${path}.visualElements`, errors)
    validateStringArray(scene.animationBeats, `${path}.animationBeats`, errors)
    validateStringArray(scene.requiredClasses, `${path}.requiredClasses`, errors)
  })

  return errors
}

function validatePlan(code) {
  const errors = []
  const parsed = parsePlanJSON(code)
  if (parsed.__parseError) errors.push(`invalid JSON: ${parsed.__parseError}`)
  if (!parsed.__parseError) errors.push(...validateCodePlanSchema(parsed))
  if (/\b(ship-mark|turret-a|turret-b|wake|shipDrift)\b/.test(code)) {
    errors.push('legacy ship fallback visual is not allowed')
  }
  return errors
}

function containsUtilityClassName(code) {
  return /\b(md:|lg:|xl:|sm:|flex|grid|hidden|block|text-[a-z0-9-]+|bg-[a-z0-9-]+|rounded(?:-[a-z0-9-]+)?|shadow(?:-[a-z0-9-]+)?|p[xytrbl]?-[a-z0-9-]+|m[xytrbl]?-[a-z0-9-]+|w-[a-z0-9-]+|h-[a-z0-9-]+|items-[a-z0-9-]+|justify-[a-z0-9-]+)\b/i.test(code)
}

function validateGenerated(type, code) {
  const errors = []
  const minLength = type === 'html-scene' ? 80 : 200
  if (!code || code.length < minLength) errors.push('output is too short')
  if (code.includes('```')) errors.push('contains markdown code fence')

  if (type === 'plan') {
    errors.push(...validatePlan(code))
  }

  if (type === 'html') {
    if (hasMalformedHtmlTag(code)) errors.push('HTML contains malformed or unterminated tags')
    if (!/<!doctype html>/i.test(code)) errors.push('missing <!DOCTYPE html>')
    if (!/<\/html>/i.test(code)) errors.push('missing </html>')
    if (!/<div[^>]+id=["']root["'][^>]*data-duration=/i.test(code)) errors.push('missing #root[data-duration]')
    if (!/<section[^>]+class=["'][^"']*scene/i.test(code)) errors.push('missing section.scene elements')
    if (!/<section[^>]+data-start=/i.test(code)) errors.push('missing section[data-start]')
    if (!/<section[^>]+data-duration=/i.test(code)) errors.push('missing section[data-duration]')
    if (!/script\.js/i.test(code)) errors.push('missing script.js reference')
    if (!/style\.css/i.test(code)) errors.push('missing style.css reference')
  }

  if (type === 'html-scene') {
    if (hasMalformedHtmlTag(code)) errors.push('scene HTML contains malformed or unterminated tags')
    if (/<!doctype html>|<html\b|<head\b|<body\b|<script\b|<link\b/i.test(code)) {
      errors.push('scene HTML must not include document wrapper, links, or scripts')
    }
    if (!/<section[^>]+class=["'][^"']*scene/i.test(code)) errors.push('missing section.scene element')
    if (!/<section[^>]+data-start=/i.test(code)) errors.push('missing section[data-start]')
    if (!/<section[^>]+data-duration=/i.test(code)) errors.push('missing section[data-duration]')
    if (/<style\b/i.test(code)) errors.push('scene HTML must not include inline <style>')
    if (containsUtilityClassName(code)) {
      errors.push('Tailwind-style utility classes are not allowed in generated scene HTML')
    }
  }

  if (type === 'css') {
    if (!braceBalance(code)) errors.push('unbalanced CSS braces')
  }

  if (type === 'js') {
    if (!/window\.__hfSeek/.test(code)) errors.push('missing window.__hfSeek')
    if (!/narrations/.test(code)) errors.push('missing narrations data')
    if (/\b(innerHTML|insertAdjacentHTML|createElement|appendChild)\b/.test(code)) {
      errors.push('JS must not create or replace primary scene DOM')
    }
    try {
      // Parse only. Do not execute browser code in Node.
      new Function(code)
    } catch (err) {
      errors.push(`JS syntax error: ${err.message}`)
    }
  }

  return errors
}

function validateCodeBundle(html, css, js) {
  const errors = []
  const sceneMatches = [...html.matchAll(/<section\b[^>]*class=["'][^"']*\bscene\b[^"']*["'][^>]*>/gi)]
  const starts = new Set()

  for (const match of sceneMatches) {
    const tag = match[0]
    const start = tag.match(/\bdata-start=["']([^"']+)["']/i)?.[1]
    const duration = tag.match(/\bdata-duration=["']([^"']+)["']/i)?.[1]
    if (start) starts.add(start)
    if (!duration) errors.push(`scene ${start || '(unknown)'} missing data-duration`)
  }

  if (sceneMatches.length < 3) errors.push('expected at least 3 timed scenes')
  if (/<style\b/i.test(html)) errors.push('HTML must not include inline <style>; use style.css')
  if (hasMalformedHtmlTag(html)) errors.push('HTML contains malformed or unterminated tags')
  if (/\b(innerHTML|insertAdjacentHTML|createElement|appendChild)\b/.test(js)) {
    errors.push('JS must not create or replace primary scene DOM')
  }
  if (/querySelectorAll\(["']\.scene\[data-start\]["']\)/.test(js) && !/data\.duration|dataset\.duration/.test(js)) {
    errors.push('JS scene switching must respect data-duration')
  }
  if (containsUtilityClassName(html + js)) {
    errors.push('Tailwind-style utility classes are not allowed in generated HTML/JS')
  }
  if (/\b(ship-mark|turret-a|turret-b|wake|shipDrift)\b/.test(html + css + js)) {
    errors.push('legacy ship fallback visual is not allowed')
  }
  if (!/\.scene\b/.test(css)) errors.push('CSS must define .scene layout')
  for (const start of starts) {
    if (!new RegExp(`data-start=["']${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html)) {
      errors.push(`missing scene for start ${start}`)
    }
  }
  return errors
}

function readJSONFile(filePath) {
  const text = readText(filePath)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (err) {
    return { __parseError: err.message }
  }
}

function safeDebugName(value = '') {
  return String(value)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'part'
}

function debugExtension(type) {
  if (type === 'plan') return 'json'
  if (type === 'css') return 'css'
  if (type === 'js') return 'js'
  return 'html'
}

function writeDebugArtifact(slug, type, label, attempt, status, content) {
  const dir = `${getEpisodeDir(slug)}/debug`
  const ext = status === 'error' ? 'txt' : debugExtension(type)
  const name = `${safeDebugName(label)}-attempt-${attempt}.${status}.${ext}`
  writeText(`${dir}/${name}`, content || '')
}

async function generatePart(type, storyboard, slug, template, research, timeline, context = '', retryNote = '', maxTokens = 12000) {
  const { system, user } = buildCodePrompt(type, storyboard, slug, template, research, timeline, context)
  const prompt = retryNote ? `${user}\n\nRegeneration requirements:\n${retryNote}` : user
  return sendMessage(system, prompt, {
    maxTokens,
    temperature: type === 'plan' ? 0.2 : 1,
    responseFormat: type === 'plan' ? CODE_PLAN_RESPONSE_FORMAT : null,
  })
}

async function generateValidatedPart(type, storyboard, slug, template, research, timeline, context = '', maxTokens = 12000, label = type) {
  let retryNote = ''
  let lastErrors = []

  for (let attempt = 0; attempt < 3; attempt++) {
    info(`[Step2] Generating ${label} attempt ${attempt + 1}/3...`)
    const result = await generatePart(type, storyboard, slug, template, research, timeline, context, retryNote, maxTokens)
    if (result.error) {
      info(`[Step2] ${label} attempt ${attempt + 1}/3 failed: ${result.error}`)
      writeDebugArtifact(slug, type, label, attempt + 1, 'error', result.error)
      lastErrors = [result.error]
      retryNote = [
        `Previous ${type} attempt failed: ${result.error}.`,
        'Return one complete file only.',
        'Do not use markdown fences.',
        type === 'html-scene' ? 'Return exactly one valid <section class="scene ..."> element only.' : '',
      ].filter(Boolean).join('\n')
      continue
    }

    let code = stripCodeFence(result.text, type)
    if (type === 'html-scene' || type === 'html') {
      code = normalizeHtmlAttrs(code)
    }
    lastErrors = validateGenerated(type, code)
    if (lastErrors.length === 0) {
      writeDebugArtifact(slug, type, label, attempt + 1, 'valid', code)
      info(`[Step2] ${label} attempt ${attempt + 1}/3 succeeded`)
      return { text: code }
    }
    writeDebugArtifact(slug, type, label, attempt + 1, 'invalid', code)
    info(`[Step2] ${label} attempt ${attempt + 1}/3 failed validation: ${lastErrors.join('; ')}`)

    retryNote = [
      `Previous ${type} output was invalid: ${lastErrors.join('; ')}.`,
      'Return one complete file only.',
      'Do not use markdown fences.',
      type === 'plan' ? 'Return valid JSON only with visualStyle, sharedClasses, and scenes.' : '',
      type === 'html' ? 'HTML must contain real <section class="scene" data-start="..."> elements inside #root.' : '',
      type === 'html-scene' ? 'Return exactly one valid <section class="scene ..."> element only.' : '',
      type === 'js' ? 'JavaScript must be syntactically complete and expose window.__hfSeek(seconds).' : '',
    ].filter(Boolean).join('\n')
  }

  return { error: `Invalid ${type} after retries: ${lastErrors.join('; ')}` }
}

async function generateCSSWithStyleCheck(type, storyboard, slug, template, research, timeline, context) {
  let cssResult = await generateValidatedPart(type, storyboard, slug, template, research, timeline, context)
  if (cssResult.error) return cssResult

  for (let attempt = 0; attempt < 3; attempt++) {
    const check = styleCheck(cssResult.text)
    if (check.passed) break

    console.log(`[Step2] CSS style-check violations (attempt ${attempt + 1}):`, check.violations)
    if (attempt < 2) {
      const retryPrompt = `Previous CSS violated these constraints: ${check.violations.join(', ')}.\nReturn complete plain CSS only, no markdown fences.\n\nContext:\n${context}\n\nStoryboard:\n${storyboard}\n\nTimeline:\n${timeline}`
      const retry = await sendMessage(
        'You are a frontend expert. Regenerate valid CSS only.',
        retryPrompt,
        { maxTokens: 8000 },
      )
      if (retry.error) return { error: `CSS style-check: ${retry.error}` }
      const code = stripCodeFence(retry.text, 'css')
      const errors = validateGenerated('css', code)
      if (errors.length) return { error: `CSS: ${errors.join('; ')}` }
      cssResult = { text: code }
    } else {
      console.warn('[Step2] CSS style-check retries exhausted, using last result')
    }
  }
  return cssResult
}

function writeCodeBundle(dir, bundle) {
  writeText(`${dir}/index.html`, bundle.html)
  writeText(`${dir}/style.css`, bundle.css)
  writeText(`${dir}/script.js`, bundle.js)
}

function elapsed(startedAt) {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getTimelineScenes(timelineData) {
  return Array.isArray(timelineData?.scenes) ? timelineData.scenes : []
}

function findSceneById(collection, id) {
  return Array.isArray(collection) ? collection.find((scene) => scene.id === id) : null
}

function pendingSceneSection(scene) {
  const start = Number(scene.start) || 0
  const duration = Number(scene.duration) || Math.max(0, Number(scene.end) - start) || 1
  return `<section class="scene scene-pending" data-start="${start}" data-duration="${duration}">
  <div class="scene-shell">
    <p class="scene-kicker">Generating scene</p>
    <h1>${escapeHtml(scene.title || scene.id || 'Scene')}</h1>
  </div>
</section>`
}

function localSceneSection(scene, storyboardScene = {}, planScene = {}) {
  const start = Number(scene.start) || 0
  const duration = Number(scene.duration) || Math.max(0, Number(scene.end) - start) || 1
  const title = scene.title || storyboardScene.title || planScene.id || scene.id || 'Scene'
  const narration = scene.narration || storyboardScene.narration || ''
  const visual = storyboardScene.visual || planScene.layout || ''
  const elements = Array.isArray(planScene.visualElements) ? planScene.visualElements : []
  const elementItems = elements.slice(0, 5).map((item) => {
    const text = typeof item === 'object' ? (item.content || item.label || item.type || '') : item
    return `<li>${escapeHtml(text)}</li>`
  }).join('\n')

  return `<section class="scene scene-local" data-start="${start}" data-duration="${duration}">
  <div class="scene-shell">
    <p class="scene-kicker">${escapeHtml(scene.id || 'local-scene')}</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="scene-summary">${escapeHtml(narration)}</p>
    <div class="visual-panel">
      <p>${escapeHtml(visual)}</p>
      ${elementItems ? `<ul>${elementItems}</ul>` : ''}
    </div>
  </div>
</section>`
}

function assembleHtmlDocument(episode, timelineData, sceneSections) {
  const timelineScenes = getTimelineScenes(timelineData)
  const duration = Number(timelineData?.totalDuration) || timelineScenes.reduce((max, scene) => Math.max(max, Number(scene.end) || 0), 0)
  const sections = timelineScenes.map((scene, index) => sceneSections[index] || pendingSceneSection(scene)).join('\n\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(episode.title)}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="root" data-duration="${duration}">
${sections}
  </div>
  <script src="script.js"></script>
</body>
</html>
`
}

async function generateSceneHtmlSections(episode, storyboardData, timelineData, research, planResult, dir, startedAt) {
  const timelineScenes = getTimelineScenes(timelineData)
  if (timelineScenes.length === 0) return { error: 'Timeline has no scenes' }

  const plan = parsePlanJSON(planResult.text)
  const storyboardScenes = Array.isArray(storyboardData?.scenes) ? storyboardData.scenes : []
  const planScenes = Array.isArray(plan?.scenes) ? plan.scenes : []
  const sections = []

  writeText(`${dir}/index.html`, assembleHtmlDocument(episode, timelineData, sections))

  for (let index = 0; index < timelineScenes.length; index++) {
    const timelineScene = timelineScenes[index]
    const storyboardScene = findSceneById(storyboardScenes, timelineScene.id) || storyboardScenes[index] || {}
    const planScene = findSceneById(planScenes, timelineScene.id) || planScenes[index] || {}
    const label = `HTML scene ${index + 1}/${timelineScenes.length} (${timelineScene.id || `scene-${index + 1}`})`
    const sceneStoryboard = JSON.stringify({ scene: storyboardScene }, null, 2)
    const sceneTimeline = JSON.stringify({
      totalDuration: timelineData.totalDuration,
      scene: timelineScene,
    }, null, 2)
    const context = [
      `Code Plan visual style:\n${plan.visualStyle || 'none'}`,
      `Shared classes:\n${JSON.stringify(plan.sharedClasses || [], null, 2)}`,
      `Matching Code Plan scene:\n${JSON.stringify(planScene, null, 2)}`,
      `Already generated scene count: ${sections.length}`,
      'Return only the current scene section.',
    ].join('\n\n')

    const result = await generateValidatedPart(
      'html-scene',
      sceneStoryboard,
      episode.slug,
      episode.template,
      research,
      sceneTimeline,
      context,
      8000,
      label,
    )
    if (result.error) {
      warn(`[Step2] ${label} failed, using local scene section: ${result.error}`)
      sections[index] = localSceneSection(timelineScene, storyboardScene, planScene)
    } else {
      sections[index] = result.text
    }

    writeText(`${dir}/index.html`, assembleHtmlDocument(episode, timelineData, sections))
    info(`[Step2] Wrote partial index.html after ${label} for "${episode.title}" (${episode.slug}) at ${elapsed(startedAt)}`)
  }

  const html = assembleHtmlDocument(episode, timelineData, sections)
  const htmlErrors = validateGenerated('html', html)
  if (htmlErrors.length) return { error: htmlErrors.join('; ') }
  return { text: html }
}

function buildTimelineControllerJS(timelineData) {
  const timelineScenes = Array.isArray(timelineData?.scenes) ? timelineData.scenes : []
  const narrations = timelineScenes.map((scene) => ({
    start: Number(scene.start) || 0,
    end: Number(scene.end) || Number(scene.start || 0) + Number(scene.duration || 0),
    text: scene.narration || '',
  }))

  return `const narrations = ${JSON.stringify(narrations, null, 2)};

const scenes = Array.from(document.querySelectorAll('.scene[data-start]')).map((el) => ({
  el,
  start: Number(el.dataset.start),
  duration: Number(el.dataset.duration),
}));

function activeSceneAt(time) {
  return scenes.find((scene) => time >= scene.start && time < scene.start + scene.duration) || scenes[scenes.length - 1];
}

function renderAt(time) {
  const active = activeSceneAt(time);
  for (const scene of scenes) {
    scene.el.classList.toggle('active', scene === active);
  }
}

window.__hfSeek = function(seconds) {
  renderAt(Number(seconds) || 0);
};

document.addEventListener('DOMContentLoaded', () => {
  renderAt(0);
});
`
}

function tryRecoveredBundle(html, css, timelineData) {
  const recoveredJS = buildTimelineControllerJS(timelineData)
  const recoveredErrors = [
    ...validateGenerated('js', recoveredJS),
    ...validateCodeBundle(html, css, recoveredJS),
  ]
  if (recoveredErrors.length) return { error: recoveredErrors.join('; ') }
  return { js: recoveredJS }
}

function buildSafeCSS() {
  return `* {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #080b16;
  color: #f8fafc;
  font-family: Inter, "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
}

#root {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.22), transparent 32%),
    radial-gradient(circle at 80% 30%, rgba(244, 63, 94, 0.18), transparent 34%),
    linear-gradient(135deg, #050816, #111827 52%, #020617);
}

.scene {
  position: absolute;
  inset: 0;
  display: none;
  padding: 96px 120px;
  overflow: hidden;
}

.scene.active {
  display: block;
}

.scene-shell {
  width: 100%;
  height: 100%;
  display: grid;
  align-content: center;
  gap: 32px;
}

.scene-kicker {
  margin: 0;
  color: #67e8f9;
  font-size: 30px;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  max-width: 1180px;
  font-size: 88px;
  line-height: 1.08;
  font-weight: 800;
}

h2 {
  font-size: 56px;
  line-height: 1.15;
}

p,
li {
  max-width: 1120px;
  font-size: 34px;
  line-height: 1.42;
}

.scene-summary {
  color: #dbeafe;
}

.visual-panel,
.card,
.panel,
.diagram,
.metric,
.timeline,
.comparison {
  max-width: 1280px;
  padding: 32px;
  border: 2px solid rgba(103, 232, 249, 0.5);
  background: rgba(15, 23, 42, 0.72);
  border-radius: 8px;
}

ul {
  margin: 20px 0 0;
  padding-left: 36px;
}

.scene-local .visual-panel,
.scene-pending .scene-shell {
  border: 2px dashed rgba(251, 191, 36, 0.7);
}

@keyframes softPulse {
  0%, 100% {
    opacity: 0.82;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

.scene.active .visual-panel,
.scene.active .card,
.scene.active .panel,
.scene.active .diagram {
  animation: softPulse 4s ease-in-out infinite;
}
`
}

function buildRuntimeSceneCSS() {
  return `/* Runtime scene visibility guard: appended after AI CSS. */
.scene[data-start] {
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.scene[data-start].active {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}
`
}

function withRuntimeSceneCSS(css) {
  return `${(css || '').trim()}\n\n${buildRuntimeSceneCSS()}`
}

function normalizeVisualObject(item) {
  const type = typeof item === 'string' ? item : item?.type
  const normalized = ALLOWED_VISUAL_OBJECTS.includes(type) ? type : 'genericBadge'
  return {
    type: normalized,
    label: typeof item === 'object' && item?.label ? String(item.label).slice(0, 12) : normalized,
  }
}

function localVisualDomain(text) {
  if (/(可乐|饮料|汽水|百事|可口可乐|碳酸|奶茶|咖啡|啤酒|果汁)/i.test(text)) return 'beverage_brand'
  if (/(蓝牙|耳机|耳塞|音频|降噪|声学|无线|手机|穿戴|消费电子|数码|充电盒)/i.test(text)) return 'consumer_electronics'
  if (/(大学|学校|校园|学院|武科大|教育|学生|校徽)/i.test(text)) return 'university'
  if (/(钢铁|冶金|高炉|钢水|耐火砖|材料|晶体|纳米)/i.test(text)) return 'steel_materials'
  if (/(医疗|医院|医生|药物|健康|疾病|诊断|细胞|基因|疫苗)/i.test(text)) return 'healthcare'
  if (/(金融|股票|基金|银行|投资|消费|价格|经济|市场|利润|商业模式)/i.test(text)) return 'finance_business'
  if (/(城市|武汉|北京|上海|旅游|景区|地铁|建筑|街区|地标)/i.test(text)) return 'city_travel'
  if (/(能源|电池|新能源|光伏|风电|碳中和|电力|环保|气候)/i.test(text)) return 'energy_environment'
  if (/(汽车|飞机|高铁|火车|交通|出行|物流|航天|火箭|卫星)/i.test(text)) return 'transport_space'
  if (/(体育|足球|篮球|比赛|运动员|训练|冠军|球场|赛事)/i.test(text)) return 'sports'
  if (/(电影|音乐|游戏|文学|艺术|历史|文化|博物馆|故事|人物)/i.test(text)) return 'culture_media'
  if (/(公司|品牌|营销|零售|电商|产品|用户|增长|门店|供应链)/i.test(text)) return 'business_brand'
  if (/(算法|代码|芯片|网络|数据|ai|人工智能)/i.test(text)) return 'technology'
  return 'general'
}

function localHeroObjects(domain, text) {
  if (domain === 'beverage_brand') return ['sodaCan', 'drinkCup']
  if (domain === 'consumer_electronics') return ['headphones', 'audioWaves', 'chip']
  if (domain === 'university' && /(钢铁|冶金|高炉|材料|耐火砖)/i.test(text)) return ['schoolGate', 'blastFurnace', 'book']
  if (domain === 'university') return ['schoolGate', 'book', 'graduationCap']
  if (domain === 'steel_materials') return ['blastFurnace', 'crystalLattice', 'gearLoop']
  if (domain === 'healthcare') return ['medicalCross', 'brainDiagram', 'flowNodes']
  if (domain === 'finance_business') return ['moneyStack', 'chartRadar', 'flowNodes']
  if (domain === 'city_travel') return ['citySkyline', 'timelineRail', 'flowNodes']
  if (domain === 'energy_environment') return ['leafEnergy', 'gearLoop', 'chartRadar']
  if (domain === 'transport_space') return /(航天|火箭|卫星)/i.test(text) ? ['rocket', 'networkGraph', 'chartRadar'] : ['vehicle', 'flowNodes', 'chartRadar']
  if (domain === 'sports') return ['sportsCourt', 'chartRadar', 'flowNodes']
  if (domain === 'culture_media') return ['filmFrame', 'timelineRail', 'genericBadge']
  if (domain === 'business_brand') return ['shoppingBag', 'chartRadar', 'flowNodes']
  if (domain === 'technology') return ['chip', 'networkGraph', 'chartRadar']
  return ['genericBadge', 'flowNodes']
}

function localSceneType(scene, index) {
  return classifySceneType(scene, index)
}

function buildLocalVisualPlan(episode, storyboardData, timelineData) {
  const storyboardScenes = Array.isArray(storyboardData?.scenes) ? storyboardData.scenes : []
  const timelineScenes = Array.isArray(timelineData?.scenes) ? timelineData.scenes : []
  const scenes = (timelineScenes.length ? timelineScenes : storyboardScenes).map((scene, index) => {
    const storyScene = storyboardScenes.find((s) => s.id === scene.id) || storyboardScenes[index] || {}
    const merged = { ...storyScene, ...scene }
    const text = [episode.title, episode.keywords, merged.title, merged.visual, merged.intent, merged.animationHint].filter(Boolean).join(' ')
    const visualDomain = localVisualDomain(text)
    return {
      id: merged.id || `scene-${String(index + 1).padStart(2, '0')}`,
      sceneType: localSceneType(merged, index),
      visualDomain,
      palette: [],
      heroObjects: localHeroObjects(visualDomain, text).map((type) => ({ type, label: type })),
      supportingObjects: ['flowNodes'],
      layout: index === 0 ? 'leftTextRightHero' : 'balancedDiagram',
      motion: ['heroEnter', 'nodesPulse'],
      avoidObjects: visualDomain === 'beverage_brand' ? [] : ['sodaCan', 'drinkCup'],
    }
  })
  return { version: 1, source: 'local-fallback', scenes }
}

function validateVisualPlan(plan, expectedScenes = []) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.scenes)) {
    return { error: 'visualPlan.scenes must be an array' }
  }

  const expectedIds = expectedScenes.map((scene, index) => scene.id || `scene-${String(index + 1).padStart(2, '0')}`)
  const scenes = expectedIds.map((id, index) => {
    const scene = plan.scenes.find((item) => item?.id === id) || plan.scenes[index] || {}
    const sceneType = ALLOWED_SCENE_TYPES.includes(scene.sceneType) ? scene.sceneType : null
    if (!sceneType) return { __error: `${id}.sceneType is invalid` }
    const avoidObjects = Array.isArray(scene.avoidObjects) ? scene.avoidObjects.filter((value) => typeof value === 'string').slice(0, 6) : []
    let heroObjects = Array.isArray(scene.heroObjects) ? scene.heroObjects.map(normalizeVisualObject) : []
    heroObjects = heroObjects.filter((item) => !avoidObjects.includes(item.type))
    if (scene.visualDomain !== 'beverage_brand') {
      heroObjects = heroObjects.filter((item) => !['sodaCan', 'drinkCup'].includes(item.type))
    }
    return {
      id,
      sceneType,
      visualDomain: typeof scene.visualDomain === 'string' ? scene.visualDomain.slice(0, 40) : 'general',
      palette: Array.isArray(scene.palette) ? scene.palette.filter((value) => typeof value === 'string').slice(0, 4) : [],
      heroObjects: heroObjects.length ? heroObjects.slice(0, 4) : [{ type: 'genericBadge', label: 'genericBadge' }],
      supportingObjects: Array.isArray(scene.supportingObjects) ? scene.supportingObjects.map(normalizeVisualObject).slice(0, 4) : [],
      layout: typeof scene.layout === 'string' ? scene.layout.slice(0, 40) : 'balancedDiagram',
      motion: Array.isArray(scene.motion) ? scene.motion.filter((value) => typeof value === 'string').slice(0, 4) : [],
      avoidObjects,
    }
  })

  const bad = scenes.find((scene) => scene.__error)
  if (bad) return { error: bad.__error }
  return { visualPlan: { version: 1, source: plan.source || 'api', scenes } }
}

async function generateVisualPlan(episode, storyboardData, timelineData, research) {
  const timelineScenes = Array.isArray(timelineData?.scenes) ? timelineData.scenes : []
  const localPlan = buildLocalVisualPlan(episode, storyboardData, timelineData)
  const system = [
    'You are a visual director for a Remotion educational video pipeline.',
    'Return compact valid JSON only.',
    'Choose scene types and visual objects from the allowed lists exactly.',
    'Do not generate JSX, code, SVG, or prose.',
  ].join(' ')
  const user = `Topic: ${episode.title}
Keywords: ${episode.keywords || 'none'}

Allowed sceneType values:
${ALLOWED_SCENE_TYPES.join(', ')}

Allowed hero/supporting object type values:
${ALLOWED_VISUAL_OBJECTS.join(', ')}

Storyboard:
${JSON.stringify(storyboardData, null, 2)}

Timeline:
${JSON.stringify(timelineData, null, 2)}

Research excerpt:
${String(research || '').slice(0, 3000)}

Return:
{
  "version": 1,
  "scenes": [
    {
      "id": "scene-01",
      "sceneType": "openingHook",
      "visualDomain": "short domain",
      "palette": ["#hex"],
      "heroObjects": [{"type": "schoolGate", "label": "校门"}],
      "supportingObjects": [{"type": "flowNodes", "label": "流程"}],
      "layout": "short layout",
      "motion": ["short motion"],
      "avoidObjects": ["sodaCan"]
    }
  ]
}

Rules:
- Use the exact scene ids from Timeline.
- For universities/schools, prefer schoolGate, book, graduationCap, labFlask.
- For steel/metallurgy/materials, prefer blastFurnace, crystalLattice, gearLoop.
- For bluetooth/headphones/audio/consumer electronics, prefer headphones, audioWaves, chip, networkGraph.
- For healthcare/medicine, prefer medicalCross, brainDiagram, flowNodes.
- For finance/business/economics, prefer moneyStack, chartRadar, flowNodes.
- For cities/travel/places, prefer citySkyline, timelineRail, flowNodes.
- For energy/environment, prefer leafEnergy, gearLoop, chartRadar.
- For transport/space, prefer vehicle or rocket, plus networkGraph or chartRadar.
- For sports, prefer sportsCourt, chartRadar, flowNodes.
- For culture/media/history, prefer filmFrame, timelineRail, genericBadge.
- For retail/product/brand topics that are not drinks, prefer shoppingBag, chartRadar, flowNodes.
- For beverages/cola/soft drinks only, prefer sodaCan, drinkCup.
- Never treat the generic word "brand" as beverage-related by itself.
- Put sodaCan/drinkCup in avoidObjects unless the topic is beverage related.`

  const result = await sendMessage(system, user, { maxTokens: 5000, temperature: 0.2 })
  if (result.error) {
    warn(`[Step2:VisualPlan] API failed, using local visual plan: ${result.error}`)
    return localPlan
  }

  try {
    const parsed = JSON.parse(stripCodeFence(result.text, 'json'))
    const validated = validateVisualPlan(parsed, timelineScenes)
    if (validated.error) {
      warn(`[Step2:VisualPlan] API returned invalid visual plan, using local visual plan: ${validated.error}`)
      return localPlan
    }
    return validated.visualPlan
  } catch (err) {
    warn(`[Step2:VisualPlan] API JSON parse failed, using local visual plan: ${err.message}`)
    return localPlan
  }
}

export const step2CodeInternals = {
  assembleHtmlDocument,
  buildSafeCSS,
  buildRuntimeSceneCSS,
  buildTimelineControllerJS,
  CODE_PLAN_RESPONSE_FORMAT,
  localSceneSection,
  normalizeHtmlAttrs,
  safeDebugName,
  validateCodePlanSchema,
  validateGenerated,
  validateCodeBundle,
  tryRecoveredBundle,
  buildLocalVisualPlan,
  validateVisualPlan,
  withRuntimeSceneCSS,
}

function fallbackResult(episode, storyboard, timeline, dir, reason) {
  warn(`[Step2] AI code generation failed for "${episode.title}" (${episode.slug}), using local fallback: ${reason}`)
  const bundle = generateLocalCodeBundle(episode, storyboard, timeline)
  const bundleErrors = validateCodeBundle(bundle.html, bundle.css, bundle.js)
  if (bundleErrors.length) {
    return { success: false, error: `Local fallback validation failed: ${bundleErrors.join('; ')}` }
  }
  writeCodeBundle(dir, bundle)
  writeText(`${dir}/code-plan.json`, JSON.stringify({
    fallback: true,
    reason,
    source: bundle.source || 'local-fallback',
  }, null, 2))
  return {
    success: true,
    fallback: true,
    fallbackReason: reason,
    codePlan: {
      fallback: true,
      reason,
      source: bundle.source || 'local-fallback',
    },
    output: { html: `${dir}/index.html`, css: `${dir}/style.css`, js: `${dir}/script.js` },
    codeContent: {
      html: bundle.html,
      css: bundle.css,
      js: bundle.js,
    },
  }
}

async function runRemotionCodeGen(episode, storyboardData, timelineData, dir, research = '') {
  info(`[Step2:Remotion] Generating React components for "${episode.title}" (${episode.slug})`)

  try {
    const scenes = Array.isArray(timelineData?.scenes) ? timelineData.scenes : []
    const storyboardScenes = Array.isArray(storyboardData?.scenes) ? storyboardData.scenes : []

    if (scenes.length === 0) {
      return { success: false, error: 'Timeline has no scenes' }
    }

    const visualPlan = await generateVisualPlan(episode, storyboardData, timelineData, research)
    writeText(`${dir}/visual-plan.json`, JSON.stringify(visualPlan, null, 2))

    const components = scenes.map((scene, index) => {
      const storyScene = storyboardScenes.find((s) => s.id === scene.id) || storyboardScenes[index] || {}
      const planScene = visualPlan.scenes.find((item) => item.id === scene.id) || visualPlan.scenes[index] || null
      const merged = {
        ...storyScene,
        ...scene,
        duration: scene.duration || storyScene.duration || 5,
        visualPlan: planScene,
      }
      return generateSceneComponent(merged, index)
    })

    const remotionDir = path.join(dir, 'remotion')
    await bootstrapRemotionProject(episode.slug, components, remotionDir)

    const componentsJson = JSON.stringify(components, null, 2)
    writeText(`${dir}/remotion-components.json`, componentsJson)
    for (const legacyFile of ['index.html', 'style.css', 'script.js', 'code-plan.json']) {
      const legacyPath = path.join(dir, legacyFile)
      if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath)
    }

    info(`[Step2:Remotion] Generated ${components.length} scene components for "${episode.title}"`)
    return {
      success: true,
      output: {
        remotionDir,
        components: path.join(dir, 'remotion-components.json'),
        visualPlan: path.join(dir, 'visual-plan.json'),
      },
      codePlan: { visualPlan },
      codeContent: { remotionComponents: components, visualPlan, type: 'remotion' },
    }
  } catch (err) {
    warn(`[Step2:Remotion] Failed: ${err.message} — falling back to Puppeteer`)
    return { success: false, error: `Remotion code gen failed: ${err.message}` }
  }
}

export async function runStep2(episode) {
  const startedAt = Date.now()
  info(`[Step2] Generating code for "${episode.title}" (${episode.slug})...`)

  const storyboardPath = `scripts/${episode.slug}/storyboard.json`
  const timelinePath = `${getEpisodeDir(episode.slug)}/timeline.json`
  const storyboardData = readJSONFile(storyboardPath)
  const timelineData = readJSONFile(timelinePath)
  if (!storyboardData) {
    return { success: false, error: 'storyboard.json not found. Run Step 1 first.' }
  }
  if (storyboardData.__parseError) {
    return { success: false, error: `storyboard.json is invalid: ${storyboardData.__parseError}` }
  }
  if (!timelineData) {
    return { success: false, error: 'timeline.json not found. Run timeline calibration first.' }
  }
  if (timelineData.__parseError) {
    return { success: false, error: `timeline.json is invalid: ${timelineData.__parseError}` }
  }

  const research = readText(`scripts/${episode.slug}/research.md`) || ''
  const dir = getEpisodeDir(episode.slug)
  const slug = episode.slug
  const storyboard = JSON.stringify(storyboardData, null, 2)
  const timeline = JSON.stringify(timelineData, null, 2)

  if (RENDER_ENGINE === 'remotion') {
    return runRemotionCodeGen(episode, storyboardData, timelineData, dir, research)
  }

  info(`[Step2] Generating code plan for "${episode.title}" (${episode.slug})...`)
  const planResult = await generateValidatedPart('plan', storyboard, slug, episode.template, research, timeline, '', 10000, 'code plan')
  if (planResult.error) return fallbackResult(episode, storyboard, timeline, dir, `Code plan: ${planResult.error}`)
  writeText(`${dir}/code-plan.json`, planResult.text)
  info(`[Step2] Code plan generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

  const planContext = `Code Plan JSON:\n${planResult.text}`

  info(`[Step2] Generating HTML by scene for "${episode.title}" (${episode.slug})...`)
  const htmlResult = await generateSceneHtmlSections(episode, storyboardData, timelineData, research, planResult, dir, startedAt)
  if (htmlResult.error) return fallbackResult(episode, storyboard, timeline, dir, `HTML: ${htmlResult.error}`)
  info(`[Step2] HTML generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

  const htmlContext = `${planContext}\n\nApproved HTML:\n${htmlResult.text}`

  info(`[Step2] Generating CSS for "${episode.title}" (${episode.slug})...`)
  const cssResult = await generateCSSWithStyleCheck('css', storyboard, slug, episode.template, research, timeline, htmlContext)
  const cssText = withRuntimeSceneCSS(cssResult.error ? buildSafeCSS() : cssResult.text)
  if (cssResult.error) {
    warn(`[Step2] CSS generation failed for "${episode.title}" (${episode.slug}), using safe CSS: ${cssResult.error}`)
  } else {
    info(`[Step2] CSS generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)
  }

  info(`[Step2] Building deterministic timeline controller for "${episode.title}" (${episode.slug})...`)
  const jsResult = tryRecoveredBundle(htmlResult.text, cssText, timelineData)
  if (jsResult.error) return fallbackResult(episode, storyboard, timeline, dir, `Deterministic JS: ${jsResult.error}`)

  const bundleErrors = validateCodeBundle(htmlResult.text, cssText, jsResult.js)
  if (bundleErrors.length) {
    return fallbackResult(episode, storyboard, timeline, dir, `Code bundle validation failed: ${bundleErrors.join('; ')}`)
  }

  writeCodeBundle(dir, { html: htmlResult.text, css: cssText, js: jsResult.js })
  info(`[Step2] HTML/CSS/JS all generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

  return {
    success: true,
    output: { html: `${dir}/index.html`, css: `${dir}/style.css`, js: `${dir}/script.js` },
    codePlan: parsePlanJSON(planResult.text),
    codeContent: {
      html: htmlResult.text,
      css: cssText,
      js: jsResult.js,
    },
  }
}
