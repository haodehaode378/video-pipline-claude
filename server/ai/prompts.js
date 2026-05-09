import { readJSON } from '../utils/file-helper.js'
import { getTemplateContent } from '../utils/templates.js'

function loadStyleConfig() {
  return readJSON('data/style-config.json') || {}
}

function getTemplatePrompt(slug) {
  if (!slug) return ''
  const t = getTemplateContent(slug)
  if (!t) return ''

  const idx = t.content.indexOf('# Hard Prompt')
  const content = idx === -1 ? t.content : t.content.slice(idx)
  return `\n\n## Style Template Constraint: ${t.name}\n${content}`
}

function getEffectiveTemplate(episodeTemplate, globalTemplate) {
  return episodeTemplate || globalTemplate || ''
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

export function buildScriptPrompt(topic, keywords, duration, sourceMaterial, research = '') {
  const style = loadStyleConfig()
  const { colors = {}, fonts = {}, animation = 'minimal' } = style
  const bg = colors.background || '#1a1a2e'
  const text = colors.text || '#ffffff'
  const bodyFont = fonts.body || 'sans-serif'
  const codeFont = fonts.code || 'monospace'

  return {
    system: [
      'You are a micro-course video script writer.',
      'Generate an accurate, concise, animation-friendly storyboard.',
      'Only output valid JSON. Do not use markdown fences.',
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
      "narration": "natural spoken Chinese narration, 1-3 sentences",
      "intent": "what this scene teaches",
      "minDuration": 3,
      "maxDuration": 8,
      "animationHint": "intro/hold/outro animation guidance"
    }
  ]
}

Rules:
- Return 5-8 scenes for the whole video.
- Visual descriptions must include layout, color, elements, animation, code blocks when relevant, and pacing.
- Narration must be natural spoken Chinese, 1-3 short sentences per scene.
- minDuration and maxDuration are initial pacing hints only; final timing will be based on real TTS audio duration.
- maxDuration must be greater than or equal to minDuration.
- Facts must come from Research or user material. Do not fabricate facts.
- Use Chinese for title, visual, narration, intent, and animationHint.
- Use this story arc: title hook, concept explanation, mechanism/demo, key-step explanation, summary.

Base style constraints:
- Dark background theme, around ${bg}.
- Text color: ${text}. Code font: ${codeFont}.
- Animation intensity: ${animation}.
- Use geometric shapes, process diagrams, and code blocks.
- Body font: ${bodyFont}.`,
  }
}

export function buildCodePrompt(type, storyboard, slug, episodeTemplate = '', research = '', timeline = '', context = '') {
  const style = loadStyleConfig()
  const { colors = {}, fonts = {}, animation = 'minimal', template } = style
  const bg = colors.background || '#1a1a2e'
  const card = colors.card || '#16213e'
  const accent = colors.accent || '#e94560'
  const bodyFont = fonts.body || 'sans-serif'
  const codeFont = fonts.code || 'monospace'

  const templatePrompt = getTemplatePrompt(getEffectiveTemplate(episodeTemplate, template))

  const typeGuides = {
    plan: `Generate a compact JSON implementation plan for a micro-course HTML video. Output valid JSON only.
Requirements:
- Do not use markdown fences.
- Do not output HTML, CSS, or JavaScript.
- The plan must guide later code generation and must be concise.
- Include: visualStyle, sharedClasses, scenes.
- Each scene must include: id, start, duration, layout, visualElements, animationBeats, requiredClasses.
- Use semantic class names only. Do not use Tailwind, Bootstrap, or utility framework class names.
- Do not use any legacy ship/warship visual terms unless the topic is explicitly a ship or aircraft carrier.
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
- Link same-directory style.css and script.js.
- Use dark visual base: background ${bg}, card ${card}, accent ${accent}.`,

    css: `Generate complete CSS. Output CSS code only.
Requirements:
- Do not use markdown fences.
- Stable 1920x1080 layout. No overlapping text.
- Background ${bg}, card ${card}, accent ${accent}.
- Body font: ${bodyFont}. Code font: ${codeFont}.
- Use CSS @keyframes. Animation intensity: ${animation}.
- Define all classes used by the HTML.
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
${templatePrompt}`,
  }
}
