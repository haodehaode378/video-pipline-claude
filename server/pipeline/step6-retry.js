import { sendMessage } from '../ai/claude-client.js'
import { buildCodePrompt, resolveStyleColors } from '../ai/prompts.js'
import { validateGenerated, normalizeHtmlAttrs } from './step6-shared.js'
import { info, warn } from '../utils/logger.js'

/**
 * Single retry attempt for a given type.
 */
async function attemptRetry({
  type, slug, template, storyboard, research, timeline, context,
  retryNote, maxTokens, temperature, label,
}) {
  const { system, user } = buildCodePrompt(type, storyboard, slug, template, research, timeline, context)
  const prompt = retryNote ? `${user}\n\n${retryNote}` : user

  const result = await sendMessage(system, prompt, {
    maxTokens: maxTokens || 6000,
    temperature: temperature ?? 0.3,
  })

  if (result.error) {
    warn(`[Step6] ${label}: API error: ${result.error}`)
    return { error: result.error }
  }

  let code = result.text.trim()
  code = code.replace(/```[\w-]*\s*|```\s*/g, '').trim()

  if (type === 'html-scene' || type === 'html') {
    code = normalizeHtmlAttrs(code)
  }

  const errors = validateGenerated(type, code)
  if (errors.length) {
    warn(`[Step6] ${label}: validation failed: ${errors.join('; ')}`)
    return { error: errors.join('; ') }
  }

  info(`[Step6] ${label}: succeeded`)
  return { text: code }
}

/**
 * Retry scene HTML generation with progressively simpler approaches.
 */
export async function retryHtmlScene({
  episode, storyboardScene, research, timeline, context, label,
}) {
  const slug = episode.slug
  const template = episode.template || ''

  // Level 2: structural example
  const examplePrompt = `The previous attempt failed validation.

Here is the REQUIRED structure — fill in YOUR content while keeping this exact pattern:

<section class="scene scene-viz-TOPIC" data-start="START_SEC" data-duration="DURATION_SEC">
  <div class="scene-shell">
    <p class="scene-kicker">TOPIC CATEGORY</p>
    <h1 class="scene-title">Scene Title Here</h1>
    <p class="scene-summary">Brief explanation of this scene.</p>
    <div class="visual-panel viz-diagram">
      <div class="node viz-node">Point 1</div>
      <div class="connector viz-connector"></div>
      <div class="node viz-node">Point 2</div>
    </div>
  </div>
</section>

Return ONLY this section element. Replace placeholders with real content. No markdown fences.`

  const result2 = await attemptRetry({
    type: 'html-scene', slug, template, storyboard: storyboardScene, research, timeline, context,
    retryNote: examplePrompt, maxTokens: 6000, label: `${label} [L2:example]`,
  })
  if (result2 && !result2.error) return result2

  // Level 3: minimal
  const minimalPrompt = `Generate the SIMPLEST valid scene possible. Use minimal HTML:

<section class="scene scene-minimal" data-start="START" data-duration="DURATION">
  <div class="scene-shell">
    <h1 class="scene-title">TITLE</h1>
    <p class="scene-summary">DESCRIPTION</p>
    <div class="visual-panel"><div class="diagram">KEY POINT</div></div>
  </div>
</section>

Fill placeholders with actual content. Return only the section.`

  const result3 = await attemptRetry({
    type: 'html-scene', slug, template, storyboard: storyboardScene, research, timeline, context,
    retryNote: minimalPrompt, maxTokens: 4000, temperature: 0.3, label: `${label} [L3:minimal]`,
  })
  if (result3 && !result3.error) return result3

  // Level 4: cold/deterministic
  const coldPrompt = `Generate ONE valid HTML section element. Be extremely simple. Follow the pattern exactly. Return ONLY <section ...>...</section>.`
  const result4 = await attemptRetry({
    type: 'html-scene', slug, template, storyboard: storyboardScene, research, timeline, context,
    retryNote: coldPrompt, maxTokens: 3000, temperature: 0.1, label: `${label} [L4:cold]`,
  })
  if (result4 && !result4.error) return result4

  return { error: `All scene HTML retry approaches exhausted for ${label}` }
}

/**
 * Retry CSS generation with progressively simpler prompts.
 */
export async function retryCSS({
  episode, storyboard, research, timeline, htmlContext, label,
}) {
  const slug = episode.slug
  const template = episode.template || ''

  // Level 2: bare essentials
  const result2 = await attemptRetry({
    type: 'css', slug, template, storyboard, research, timeline, context: htmlContext,
    retryNote: `Generate MINIMAL CSS for a video presentation. Keep under 150 lines.
Requirements:
- .scene { display: none; } .scene.active { display: flex; }
- Basic layout for .scene-shell, .scene-kicker, .scene-title, .scene-summary
- Basic styling for .visual-panel, .diagram, .card, .panel, .node, .connector, .label, .badge
- No complex animations — just a simple opacity fade
- Return plain CSS only. No markdown fences.`,
    maxTokens: 4000, temperature: 0.2, label: `${label} [L2:bare]`,
  })
  if (result2 && !result2.error) return result2

  // Level 3: use style-decision derived CSS
  const dynamicCSS = buildDynamicSafeCSS(slug)
  if (dynamicCSS) {
    info(`[Step6] ${label}: using dynamic safe CSS from style-decision`)
    return { text: dynamicCSS, source: 'dynamic-fallback' }
  }

  return { error: 'All CSS retry approaches exhausted' }
}

/**
 * Build CSS from auto-selected style decision (not hardcoded constants).
 */
export function buildDynamicSafeCSS(slug) {
  try {
    const style = resolveStyleColors(slug)
    return `* {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: ${style.bg};
  color: ${style.text};
  font-family: ${style.bodyFont};
}

#root {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: ${style.bg};
}

.scene {
  position: absolute;
  inset: 0;
  display: none;
  padding: 96px 120px;
  overflow: hidden;
}

.scene.active {
  display: flex;
}

.scene-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 32px;
}

.scene-kicker {
  margin: 0;
  color: ${style.accent};
  font-size: 30px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

h1, h2, h3, p { margin: 0; }

h1 {
  max-width: 1180px;
  font-size: 88px;
  line-height: 1.08;
  font-weight: 800;
}

h2 { font-size: 56px; line-height: 1.15; }

p, li {
  max-width: 1120px;
  font-size: 34px;
  line-height: 1.42;
}

.scene-summary { color: ${style.text}; opacity: 0.85; }

.visual-panel, .card, .panel, .diagram, .metric, .timeline, .comparison {
  max-width: 1280px;
  padding: 32px;
  border: 2px solid ${style.accent}80;
  background: ${style.card};
  border-radius: 8px;
}

ul { margin: 20px 0 0; padding-left: 36px; }

.node, .label, .badge {
  display: inline-block;
  padding: 8px 20px;
  background: ${style.accent}22;
  border: 1px solid ${style.accent}66;
  border-radius: 4px;
  font-size: 28px;
}

.connector {
  width: 40px;
  height: 2px;
  background: ${style.accent}66;
  display: inline-block;
  vertical-align: middle;
  margin: 0 8px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.scene.active .visual-panel,
.scene.active .card,
.scene.active .panel,
.scene.active .diagram {
  animation: fadeIn 0.5s ease-out both;
}
`
  } catch (err) {
    warn(`[Step6] buildDynamicSafeCSS failed: ${err.message}`)
    return null
  }
}

/**
 * Retry code plan generation with alternative approaches.
 */
export async function retryCodePlan({
  episode, storyboard, research, timeline, label,
}) {
  const slug = episode.slug
  const template = episode.template || ''

  const result2 = await attemptRetry({
    type: 'plan', slug, template, storyboard, research, timeline, context: '',
    retryNote: `Generate a SIMPLER code plan. Use fewer visualElements per scene (max 4). Simpler layout names. Must pass strict JSON schema validation. Return valid JSON only.`,
    maxTokens: 6000, temperature: 0.1, label: `${label} [L2:simple]`,
  })
  if (result2 && !result2.error) return result2

  const result3 = await attemptRetry({
    type: 'plan', slug, template, storyboard, research, timeline, context: '',
    retryNote: `Generate a MINIMAL code plan. Each scene should have:
- layout: "standard"
- visualElements: ["title", "diagram", "summary"]
- animationBeats: ["fadeIn"]
- requiredClasses: ["scene-shell", "scene-title", "visual-panel"]
Return valid JSON only.`,
    maxTokens: 4000, temperature: 0.0, label: `${label} [L3:minimal]`,
  })
  if (result3 && !result3.error) return result3

  return { error: 'All code plan retry approaches exhausted' }
}
