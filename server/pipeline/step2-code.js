import { sendMessage } from '../ai/claude-client.js'
import { buildCodePrompt } from '../ai/prompts.js'
import { writeText, getEpisodeDir, readText } from '../utils/file-helper.js'
import styleCheck from '../utils/style-check.js'
import { generateLocalCodeBundle } from '../utils/local-codegen.js'
import { info, warn } from '../utils/logger.js'

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
