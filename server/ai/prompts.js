import { readJSON } from '../utils/file-helper.js'

function loadStyleConfig() {
  return readJSON('data/style-config.json') || {}
}

function readStyleDecision(slug) {
  try {
    return readJSON(`videos/${slug}/style-decision.json`) || null
  } catch {
    return null
  }
}

function buildStyleDirective(slug) {
  const decision = readStyleDecision(slug)
  if (!decision) return ''
  return `
## Visual Style Directive (AI-selected for this topic)
Style name: ${decision.styleName}
Color palette:
  - Background: ${decision.colorPalette?.background || '#0d1117'}
  - Card: ${decision.colorPalette?.card || '#161b22'}
  - Accent: ${decision.colorPalette?.accent || '#58a6ff'}
  - Text: ${decision.colorPalette?.text || '#f0f6fc'}
  - Code: ${decision.colorPalette?.code || '#e6edf3'}
Typography:
  - Body: ${decision.typography?.body || 'system-ui, sans-serif'}
  - Code: ${decision.typography?.code || 'JetBrains Mono, monospace'}
Visual density: ${decision.visualDensity || 'balanced'}
Animation intensity: ${decision.animationIntensity || 'minimal'}
Decorative elements: ${(decision.decorativeElements || []).join(', ')}
Layout strategy: ${decision.sceneLayoutStrategy || 'Visual panel left, text content right'}
Forbidden: ${(decision.forbiddenPatterns || []).join(', ')}
`
}

function resolveStyleColors(slug) {
  const decision = readStyleDecision(slug)
  const style = loadStyleConfig()
  return {
    bg: decision?.colorPalette?.background || style.colors?.background || '#0d1117',
    card: decision?.colorPalette?.card || style.colors?.card || '#161b22',
    accent: decision?.colorPalette?.accent || style.colors?.accent || '#58a6ff',
    text: decision?.colorPalette?.text || style.colors?.text || '#f0f6fc',
    code: decision?.colorPalette?.code || style.colors?.code || '#e6edf3',
    bodyFont: decision?.typography?.body || style.fonts?.body || 'system-ui, sans-serif',
    codeFont: decision?.typography?.code || style.fonts?.code || 'JetBrains Mono, monospace',
    animation: decision?.animationIntensity || style.animation || 'minimal',
  }
}

export function buildResearchSearcherPrompt(episode, task = {}) {
  const name = task.name || 'Searcher'
  const focus = task.focus || 'general research material'
  const researchBrief = episode.researchBrief || 'No user-confirmed research brief provided.'
  return {
    system: [
      `You are the ${name} agent in a micro-course generation pipeline.`,
      'Use the same AI API to collect background material for the topic.',
      `Your focus: ${focus}.`,
      'Follow the user-confirmed Chinese research brief exactly.',
      'If your model/API has web-search capability, use it through the provider capability.',
      'If no live web access is available, say so explicitly and produce a knowledge-based research brief with uncertainty notes.',
      'Do not invent URLs. Only include URLs if you are confident they are real.',
      'Return Chinese Markdown.',
    ].join(' '),
    user: `Topic: ${episode.title}
Keywords: ${episode.keywords || 'none'}
Target duration: about ${episode.duration || 3} minutes

User-confirmed research brief:
${researchBrief}

User-provided material:
${episode.sourceMaterial || 'none'}

Return Chinese Markdown with:
- Search status
- Key facts
- Definitions
- Mechanisms or process
- Examples
- Common misconceptions
- Visual ideas for HTML animation
- Candidate references or source names
- Unknowns / needs verification`,
  }
}

export function buildResearchAnalystPrompt(episode, searchMaterial) {
  const researchBrief = episode.researchBrief || 'No user-confirmed research brief provided.'
  return {
    system: [
      'You are the Analyst agent.',
      'Turn collected material into a factual research.md for a short educational video.',
      'Be concrete, concise, and useful for script and HTML animation generation.',
      'Do not fabricate facts or sources.',
      'Output Chinese Markdown.',
    ].join(' '),
    user: `Topic: ${episode.title}
Keywords: ${episode.keywords || 'none'}
Target duration: about ${episode.duration || 3} minutes

User-confirmed research brief:
${researchBrief}

Collected material:
${searchMaterial}

Output only Chinese Markdown with these sections:
# Research: ${episode.title}
## Core conclusions
## Concept definition
## Key mechanism
## Example
## Common misconceptions
## Visual suggestions
## Script points
## References
## Unverified points

Rules:
- Follow the user-confirmed research brief.
- Mark uncertain information as "Needs verification".
- Visual suggestions must be specific enough for HTML/CSS/JS generation.
- Keep it suitable for a micro-course video.`,
  }
}

export function buildResearchVerifierPrompt(episode, draftResearch, searchMaterial) {
  const researchBrief = episode.researchBrief || 'No user-confirmed research brief provided.'
  return {
    system: [
      'You are the Verifier agent.',
      'Review the draft research for completeness, accuracy, and usefulness.',
      'Output the final Chinese research.md only.',
    ].join(' '),
    user: `Topic: ${episode.title}

User-confirmed research brief:
${researchBrief}

Draft research:
${draftResearch}

Original collected material:
${searchMaterial}

Revise and output final Markdown. Requirements:
- Follow the user-confirmed research brief.
- Keep clear headings.
- Fill missing definition, mechanism, example, misconception, and visual suggestions.
- Remove unreliable claims without support.
- Mark uncertain claims as "Needs verification".
- Do not output review commentary.`,
  }
}

export function buildScriptPrompt(topic, keywords, duration, sourceMaterial, research = '', slug = '') {
  const { animation } = loadStyleConfig()
  const animIntensity = animation || 'minimal'

  const durationMinutes = Number(duration) || 1
  const targetSeconds = durationMinutes * 60
  const narrationTargetChars = Math.round(targetSeconds * 2)
  const suggestSceneCount = Math.max(2, Math.round(durationMinutes * 3))

  return {
    system: [
      'You are a micro-course video script writer.',
      'Generate an accurate, concise, animation-friendly storyboard.',
      'Only output compact valid JSON. Do not use markdown fences.',
      'Do not output hidden reasoning, chain-of-thought, analysis, or <think> tags.',
    ].join(' '),
    user: `Topic:
${topic}

Keywords:
${keywords || 'none'}

Target duration:
About ${duration} minutes

Research:
${research || 'none'}

User-provided material:
${sourceMaterial || 'none'}

Output format:
{
  "version": 1,
  "scenes": [
    {
      "id": "scene-01",
      "title": "short Chinese title",
      "visual": "specific layout and animation description",
      "narration": "natural spoken Chinese narration, enough to fill the scene time",
      "intent": "what this scene teaches",
      "minDuration": 5,
      "maxDuration": ${Math.round(targetSeconds / suggestSceneCount * 1.5)},
      "animationHint": "intro/hold/outro animation guidance"
    }
  ]
}

Rules:
- Target: about ${durationMinutes} min (${targetSeconds}s total). Create enough scenes to fill this naturally — roughly ${suggestSceneCount} scenes is a good starting point, but adjust based on content complexity.
- Total narration across all scenes should be about ${narrationTargetChars} Chinese characters. Split naturally across scenes — simpler concepts can have shorter scenes, complex ones longer.
- Keep title <= 16 Chinese chars, visual <= 80 Chinese chars, intent <= 40 Chinese chars, animationHint <= 50 Chinese chars.
- Visual descriptions must include layout, key elements, and motion, but no long prose.
- Narration must be natural spoken Chinese, 3-5 natural sentences per scene.
- minDuration and maxDuration are initial pacing hints only; final timing will be based on real TTS audio duration.
- maxDuration must be greater than or equal to minDuration.
- Facts must come from Research or user material. Do not fabricate facts.
- Use Chinese for title, visual, narration, intent, and animationHint.
- Use this story arc: title hook, concept explanation, mechanism/demo, key-step explanation, summary.
- Output JSON must close completely. Do not add explanations before or after JSON.
- Do not include <think> tags or reasoning text. The first character must be "{" and the last character must be "}".

Visual style will be auto-selected during code generation. For now, use a dark theme as default.
Animation intensity: ${animIntensity}. Use geometric shapes, process diagrams, and code blocks.`,
  }
}

export function buildCodePrompt(type, storyboard, slug, episodeTemplate = '', research = '', timeline = '', context = '') {
  const style = resolveStyleColors(slug)
  const bg = style.bg
  const card = style.card
  const accent = style.accent
  const bodyFont = style.bodyFont
  const codeFont = style.codeFont
  const animation = style.animation

  const styleDirective = buildStyleDirective(slug)

  const typeGuides = {
    plan: `Generate a compact JSON implementation plan for a micro-course HTML video. Output valid JSON only.
Requirements:
- Do not use markdown fences.
- Do not output HTML, CSS, or JavaScript.
- The plan must match the provided JSON Schema exactly.
- Include only these top-level fields: visualStyle, sharedClasses, scenes.
- Each scene must include only: id, start, duration, layout, visualElements, animationBeats, requiredClasses.
- Use string arrays for visualElements, animationBeats, and requiredClasses.
- Use semantic class names only. Do not use Tailwind, Bootstrap, or utility framework class names.
- Choose layouts that match the topic, not a generic repeated placeholder.`,

    html: `Generate one complete HTML file for a micro-course video. Output code only, from <!DOCTYPE html> to </html>.
Requirements:
- Do not use markdown fences.
- Root element: <div id="root" data-duration="total seconds">.
- The root data-duration must exactly match Timeline.totalDuration.
- Put all visible scenes directly in HTML as real <section class="scene" data-start="start seconds" data-duration="duration seconds"> elements inside #root.
- Every scene data-start and data-duration must exactly match the matching Timeline scene.
- Every scene must have both data-start and data-duration. Scene durations must cover the whole root duration without the first scene swallowing later scenes.
- Do not rely on JavaScript to create the primary scene DOM.
- Do not include inline <style>. All styling must live in style.css.
- Do not use Tailwind, Bootstrap, or utility framework class names. Use semantic classes that style.css defines.
- Follow the provided Code Plan exactly when choosing layouts, class names, and visual elements.
- Include title text, explanatory text, geometric visuals, and code blocks.
- Link same-directory style.css and script.js.`,

    'html-scene': `Generate exactly one HTML section for one timed micro-course video scene. Output the <section> element only.
Requirements:
- Do not use markdown fences.
- Do not output <!DOCTYPE html>, <html>, <head>, <body>, <link>, or <script>.
- The root tag must be one real <section class="scene ..."> element.
- The section must include data-start and data-duration exactly matching the provided Timeline scene.
- Do not include inline <style>. All styling must live in style.css.
- Do not use Tailwind, Bootstrap, or utility framework class names.
- Never output classes like flex, grid, hidden, block, text-*, bg-*, rounded-*, shadow-*, p-*, m-*, w-*, h-*, items-*, justify-*, md:*, lg:*.
- Class names may only be: scene, scene-shell, scene-kicker, scene-title, scene-summary, visual-panel, metric, timeline, comparison, diagram, card, panel, node, connector, label, badge, and topic-specific classes prefixed with viz-.
- Keep the section compact: 8-24 child elements total, no long prose blocks, no SVG path data.
- Do not rely on JavaScript to create visible content.
- Include scene title text, explanatory text, geometric visuals, and code/scientific labels when relevant.
- Follow the matching Code Plan scene and the provided Storyboard scene.`,

    css: `Generate complete CSS. Output CSS code only.
Requirements:
- Do not use markdown fences.
- Stable 1920x1080 layout. No overlapping text.
- Background ${bg}, card ${card}, accent ${accent}.
- Body font: ${bodyFont}. Code font: ${codeFont}.
- Use CSS @keyframes. Animation intensity: ${animation}.
- Keep the CSS compact, under 300 lines.
- Define only classes used by the provided HTML.
- Allowed class selectors are: .scene, .scene-shell, .scene-kicker, .scene-title, .scene-summary, .visual-panel, .metric, .timeline, .comparison, .diagram, .card, .panel, .node, .connector, .label, .badge, .active, and classes prefixed with .viz-.
- Do not define or mention Tailwind/Bootstrap utility selectors such as .flex, .grid, .hidden, .block, .text-*, .bg-*, .rounded-*, .shadow-*, .p-*, .m-*, .w-*, .h-*, .items-*, .justify-*, .md:*, .lg:*.
- Use plain CSS with balanced braces. Prefer simple selectors and shared styles over per-scene duplication.
- Style the exact HTML provided in Context. Do not invent unrelated major class systems.
- Do not output Tailwind class names or assume any CSS framework. Use plain CSS.`,

    js: `Generate complete JavaScript. Output JS code only.
Requirements:
- Do not use markdown fences.
- Do not create the primary scene DOM. The HTML file already contains all .scene[data-start] elements.
- Do not use innerHTML, insertAdjacentHTML, document.createElement, or appendChild for primary scene content.
- Control scene switching by data-duration and data-start.
- At any seek time, exactly one matching scene should be visible.
- Expose window.__hfSeek(seconds) for Puppeteer rendering.
- Include narration data: const narrations = [{ start, end, text }].
- Narration start/end values must come from Timeline scenes.
- Do not autoplay audio. Do not break screenshots.`,
  }

  return {
    system: 'You are a frontend animation expert for micro-course videos. Output code only, no explanation.',
    user: `Research:
${research || 'none'}

Storyboard JSON:
${storyboard}

Final audio-calibrated Timeline JSON:
${timeline || 'none'}

Context from previous code generation stages:
${context || 'none'}

Episode slug:
${slug}

Output type:
${type}

${typeGuides[type] || ''}
${styleDirective}`,
  }
}

export { readStyleDecision, resolveStyleColors }
