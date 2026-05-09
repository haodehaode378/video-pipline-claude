import { sendMessage } from '../ai/claude-client.js'
import { buildCodePrompt } from '../ai/prompts.js'
import { writeText, getEpisodeDir, readText } from '../utils/file-helper.js'
import styleCheck from '../utils/style-check.js'
import { generateLocalCodeBundle } from '../utils/local-codegen.js'
import { info, warn } from '../utils/logger.js'

function stripCodeFence(text, type) {
  if (!text) return ''
  let out = text.trim()
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

function validatePlan(code) {
  const errors = []
  const parsed = parsePlanJSON(code)
  if (parsed.__parseError) errors.push(`invalid JSON: ${parsed.__parseError}`)
  if (!parsed.__parseError && !Array.isArray(parsed.scenes)) errors.push('missing scenes array')
  if (!parsed.__parseError && !parsed.visualStyle) errors.push('missing visualStyle')
  if (!parsed.__parseError && !Array.isArray(parsed.sharedClasses)) errors.push('missing sharedClasses array')
  if (/\b(ship-mark|turret-a|turret-b|wake|shipDrift)\b/.test(code)) {
    errors.push('legacy ship fallback visual is not allowed')
  }
  return errors
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
    if (/\b(md:|lg:|xl:|sm:|flex-col|items-center|justify-center|h-full|text-center|rounded-lg)\b/.test(code)) {
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
  if (/\b(md:|lg:|xl:|sm:|flex-col|items-center|justify-center|h-full|text-center|rounded-lg)\b/.test(html + js)) {
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

async function generatePart(type, storyboard, slug, template, research, timeline, context = '', retryNote = '', maxTokens = 12000) {
  const { system, user } = buildCodePrompt(type, storyboard, slug, template, research, timeline, context)
  const prompt = retryNote ? `${user}\n\nRegeneration requirements:\n${retryNote}` : user
  return sendMessage(system, prompt, { maxTokens })
}

async function generateValidatedPart(type, storyboard, slug, template, research, timeline, context = '', maxTokens = 12000, label = type) {
  let retryNote = ''
  let lastErrors = []

  for (let attempt = 0; attempt < 3; attempt++) {
    info(`[Step2] Generating ${label} attempt ${attempt + 1}/3...`)
    const result = await generatePart(type, storyboard, slug, template, research, timeline, context, retryNote, maxTokens)
    if (result.error) {
      info(`[Step2] ${label} attempt ${attempt + 1}/3 failed: ${result.error}`)
      return { error: result.error }
    }

    const code = stripCodeFence(result.text, type)
    lastErrors = validateGenerated(type, code)
    if (lastErrors.length === 0) {
      info(`[Step2] ${label} attempt ${attempt + 1}/3 succeeded`)
      return { text: code }
    }
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
      4500,
      label,
    )
    if (result.error) return { error: `${label}: ${result.error}` }

    sections[index] = result.text
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

export const step2CodeInternals = {
  assembleHtmlDocument,
  buildTimelineControllerJS,
  validateGenerated,
  validateCodeBundle,
  tryRecoveredBundle,
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
  const planResult = await generateValidatedPart('plan', storyboard, slug, episode.template, research, timeline, '', 7000, 'code plan')
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
  if (cssResult.error) return fallbackResult(episode, storyboard, timeline, dir, `CSS: ${cssResult.error}`)
  info(`[Step2] CSS generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

  info(`[Step2] Building deterministic timeline controller for "${episode.title}" (${episode.slug})...`)
  const jsResult = tryRecoveredBundle(htmlResult.text, cssResult.text, timelineData)
  if (jsResult.error) return fallbackResult(episode, storyboard, timeline, dir, `Deterministic JS: ${jsResult.error}`)

  const bundleErrors = validateCodeBundle(htmlResult.text, cssResult.text, jsResult.js)
  if (bundleErrors.length) {
    return fallbackResult(episode, storyboard, timeline, dir, `Code bundle validation failed: ${bundleErrors.join('; ')}`)
  }

  writeCodeBundle(dir, { html: htmlResult.text, css: cssResult.text, js: jsResult.js })
  info(`[Step2] HTML/CSS/JS all generated for "${episode.title}" (${episode.slug}) after ${elapsed(startedAt)}`)

  return {
    success: true,
    output: { html: `${dir}/index.html`, css: `${dir}/style.css`, js: `${dir}/script.js` },
    codePlan: parsePlanJSON(planResult.text),
    codeContent: {
      html: htmlResult.text,
      css: cssResult.text,
      js: jsResult.js,
    },
  }
}
