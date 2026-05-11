import { sendMessage } from '../ai/claude-client.js'
import { buildCodePrompt } from '../ai/prompts.js'
import { writeText, getEpisodeDir, readText } from '../utils/file-helper.js'
import styleCheck from '../utils/style-check.js'
import { info, warn } from '../utils/logger.js'
import { bootstrapRemotionProject } from '../render/remotion-bundle.js'
import { retryHtmlScene, retryCSS, retryCodePlan } from './step6-retry.js'
import { generateAllRemotionComponents } from './step6b-remotion-ai.js'
import { readStyleDecision } from '../ai/prompts.js'
import {
  normalizeHtmlAttrs,
  parsePlanJSON,
  validateGenerated,
  validateCodeBundle,
  validateCodePlanSchema,
} from './step6-shared.js'
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


function stripCodeFence(text, type) {
  if (!text) return ''
  let out = text.trim()
  out = out.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, '')
  out = out.replace(new RegExp(`^\\s*\`\`\`${type}\\s*\\r?\\n`, 'i'), '')
  out = out.replace(/^\s*```\w*\s*\r?\n/i, '')
  out = out.replace(/\r?\n```\s*$/i, '')
  return out.trim()
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
    info(`[Step6] Generating ${label} attempt ${attempt + 1}/3...`)
    const result = await generatePart(type, storyboard, slug, template, research, timeline, context, retryNote, maxTokens)
    if (result.error) {
      info(`[Step6] ${label} attempt ${attempt + 1}/3 failed: ${result.error}`)
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
      info(`[Step6] ${label} attempt ${attempt + 1}/3 succeeded`)
      return { text: code }
    }
    writeDebugArtifact(slug, type, label, attempt + 1, 'invalid', code)
    info(`[Step6] ${label} attempt ${attempt + 1}/3 failed validation: ${lastErrors.join('; ')}`)

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

    console.log(`[Step6] CSS style-check violations (attempt ${attempt + 1}):`, check.violations)
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
      console.warn('[Step6] CSS style-check retries exhausted, using last result')
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
      warn(`[Step6] ${label} failed initial generation, starting retry cascade: ${result.error}`)
      const retryResult = await retryHtmlScene({
        episode,
        storyboardScene: sceneStoryboard,
        research,
        timeline: sceneTimeline,
        context,
        label,
      })
      if (retryResult.error) {
        warn(`[Step6] ${label}: all retry approaches exhausted: ${retryResult.error}`)
        return { error: `Scene ${index + 1} (${timelineScene.id || `scene-${index + 1}`}) generation failed: ${retryResult.error}` }
      }
      sections[index] = retryResult.text
    } else {
      sections[index] = result.text
    }

    writeText(`${dir}/index.html`, assembleHtmlDocument(episode, timelineData, sections))
    info(`[Step6] Wrote partial index.html after ${label} for "${episode.title}" (${episode.slug}) at ${elapsed(startedAt)}`)
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
      "heroObjects": [{"type": "genericBadge", "label": "元素"}],
      "supportingObjects": [{"type": "flowNodes", "label": "流程"}],
      "layout": "short layout",
      "motion": ["short motion"],
      "avoidObjects": []
    }
  ]
}

Rules:
- Use the exact scene ids from Timeline.
- Choose scene types and visual objects based on the topic content.
- Be specific and topic-appropriate — do NOT use generic defaults for every scene.`

  // Attempt 1: standard AI call
  let result = await sendMessage(system, user, { maxTokens: 5000, temperature: 0.2 })
  if (!result.error) {
    try {
      const parsed = JSON.parse(stripCodeFence(result.text, 'json'))
      const validated = validateVisualPlan(parsed, timelineScenes)
      if (!validated.error) return validated.visualPlan
      warn(`[Step2:VisualPlan] Validation failed: ${validated.error}, retrying...`)
    } catch (err) {
      warn(`[Step2:VisualPlan] JSON parse failed: ${err.message}, retrying...`)
    }
  } else {
    warn(`[Step2:VisualPlan] API failed: ${result.error}, retrying...`)
  }

  // Attempt 2: simpler prompt
  const retryUser = `${user}\n\nSimplified: Just return a valid visual plan with the exact scene ids. Use genericBadge and flowNodes if unsure about specific objects.`
  result = await sendMessage(system, retryUser, { maxTokens: 4000, temperature: 0.1 })

  if (!result.error) {
    try {
      const parsed = JSON.parse(stripCodeFence(result.text, 'json'))
      const validated = validateVisualPlan(parsed, timelineScenes)
      if (!validated.error) return validated.visualPlan
    } catch {}
  }

  // Attempt 3: minimal valid plan — derived from style, not hardcoded
  warn(`[Step2:VisualPlan] AI failed, constructing minimal plan from scene data`)
  return buildMinimalVisualPlan(timelineScenes)
}

function buildMinimalVisualPlan(timelineScenes) {
  const scenes = timelineScenes.map((scene, index) => ({
    id: scene.id || `scene-${String(index + 1).padStart(2, '0')}`,
    sceneType: index === 0 ? 'openingHook' : index === timelineScenes.length - 1 ? 'finale' : 'genericVisual',
    visualDomain: 'general',
    palette: [],
    heroObjects: [{ type: 'genericBadge', label: '元素' }],
    supportingObjects: [{ type: 'flowNodes', label: '流程节点' }],
    layout: 'balancedDiagram',
    motion: ['fadeIn'],
    avoidObjects: [],
  }))
  return { version: 1, source: 'minimal-dynamic', scenes }
}

export const step6CodeInternals = {
  assembleHtmlDocument,
  buildRuntimeSceneCSS,
  buildTimelineControllerJS,
  CODE_PLAN_RESPONSE_FORMAT,
  normalizeHtmlAttrs,
  safeDebugName,
  validateCodePlanSchema,
  validateGenerated,
  validateCodeBundle,
  tryRecoveredBundle,
  validateVisualPlan,
  withRuntimeSceneCSS,
  buildMinimalVisualPlan,
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

    const styleDecision = readStyleDecision(episode.slug) || {}
    const result = await generateAllRemotionComponents(scenes, visualPlan, styleDecision, storyboardScenes)
    if (result.error) {
      warn(`[Step2:Remotion] AI component generation failed: ${result.error}`)
      return { success: false, error: result.error }
    }

    const components = result.components
    const remotionDir = path.join(dir, 'remotion')
    await bootstrapRemotionProject(episode.slug, components, remotionDir)

    const componentsJson = JSON.stringify(components, null, 2)
    writeText(`${dir}/remotion-components.json`, componentsJson)
    for (const legacyFile of ['index.html', 'style.css', 'script.js', 'code-plan.json']) {
      const legacyPath = path.join(dir, legacyFile)
      if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath)
    }

    info(`[Step2:Remotion] Generated ${components.length} AI scene components for "${episode.title}"`)
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

export async function runStep6(episode) {
  const startedAt = Date.now()
  info(`[Step6] Generating code for "${episode.title}" (${episode.slug})...`)

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

  info(`[Step6] Generating code plan for "${episode.title}" (${episode.slug})...`)
  let planResult = await generateValidatedPart('plan', storyboard, slug, episode.template, research, timeline, '', 10000, 'code plan')
  if (planResult.error) {
    warn(`[Step6] Code plan initial generation failed: ${planResult.error}, starting retry cascade`)
    const planRetry = await retryCodePlan({
      episode, storyboard, research, timeline, label: 'code plan',
    })
    if (planRetry.error) {
      return { success: false, error: `Code plan generation failed after all retries: ${planRetry.error}` }
    }
    planResult = planRetry
  }
  writeText(`${dir}/code-plan.json`, planResult.text)
  info(`[Step6] Code plan generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

  const planContext = `Code Plan JSON:\n${planResult.text}`

  info(`[Step6] Generating HTML by scene for "${episode.title}" (${episode.slug})...`)
  const htmlResult = await generateSceneHtmlSections(episode, storyboardData, timelineData, research, planResult, dir, startedAt)
  if (htmlResult.error) {
    return { success: false, error: `HTML generation failed: ${htmlResult.error}` }
  }
  info(`[Step6] HTML generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

  const htmlContext = `${planContext}\n\nApproved HTML:\n${htmlResult.text}`

  info(`[Step6] Generating CSS for "${episode.title}" (${episode.slug})...`)
  let cssResult = await generateCSSWithStyleCheck('css', storyboard, slug, episode.template, research, timeline, htmlContext)
  if (cssResult.error) {
    warn(`[Step6] CSS initial generation failed: ${cssResult.error}, starting retry cascade`)
    const cssRetry = await retryCSS({
      episode, storyboard, research, timeline, htmlContext, label: 'CSS',
    })
    if (cssRetry.error) {
      return { success: false, error: `CSS generation failed after all retries: ${cssRetry.error}` }
    }
    cssResult = cssRetry
  }
  const cssText = withRuntimeSceneCSS(cssResult.text)
  info(`[Step6] CSS generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

  info(`[Step6] Building deterministic timeline controller for "${episode.title}" (${episode.slug})...`)
  const jsResult = tryRecoveredBundle(htmlResult.text, cssText, timelineData)
  if (jsResult.error) {
    return { success: false, error: `JS controller failed: ${jsResult.error}` }
  }

  const bundleErrors = validateCodeBundle(htmlResult.text, cssText, jsResult.js)
  if (bundleErrors.length) {
    return { success: false, error: `Code bundle validation failed: ${bundleErrors.join('; ')}` }
  }

  writeCodeBundle(dir, { html: htmlResult.text, css: cssText, js: jsResult.js })
  info(`[Step6] HTML/CSS/JS all generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

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
