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
  return {
    system: [
      `You are the ${name} agent in a micro-course generation pipeline.`,
      'Use the same AI API to collect background material for the topic.',
      `Your focus: ${focus}.`,
      'If your model/API has web-search capability, use it through the provider capability.',
      'If no live web access is available, say so explicitly and produce a knowledge-based research brief with uncertainty notes.',
      'Do not invent URLs. Only include URLs if you are confident they are real.',
    ].join(' '),
    user: `Topic: ${episode.title}
Keywords: ${episode.keywords || 'none'}
Target duration: about ${episode.duration || 3} minutes
User-provided material:
${episode.sourceMaterial || 'none'}

Return Markdown with:
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
  return {
    system: [
      'You are the Analyst agent.',
      'Turn collected material into a factual research.md for a short educational video.',
      'Be concrete, concise, and useful for script and HTML animation generation.',
      'Do not fabricate facts or sources.',
    ].join(' '),
    user: `Topic: ${episode.title}
Keywords: ${episode.keywords || 'none'}
Target duration: about ${episode.duration || 3} minutes

Collected material:
${searchMaterial}

Output only Markdown with these sections:
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
- Mark uncertain information as "Needs verification".
- Visual suggestions must be specific enough for HTML/CSS/JS generation.
- Keep it suitable for a micro-course video.`,
  }
}

export function buildResearchVerifierPrompt(episode, draftResearch, searchMaterial) {
  return {
    system: [
      'You are the Verifier agent.',
      'Review the draft research for completeness, accuracy, and usefulness.',
      'Output the final research.md only.',
    ].join(' '),
    user: `Topic: ${episode.title}

Draft research:
${draftResearch}

Original collected material:
${searchMaterial}

Revise and output final Markdown. Requirements:
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
      'Generate an accurate, concise, animation-friendly script.',
      'Only output a three-column Markdown table.',
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
| Time | Visual | Narration |

Rules:
- Time ranges must look like 0:00-0:10.
- Visual descriptions must include layout, color, elements, animation, code blocks, and pacing.
- Narration must be natural spoken Chinese, 1-3 sentences per segment.
- Facts must come from Research or user material. Do not fabricate facts.

Fixed structure:
- 0:00-0:10 title and hook
- 0:10-0:40 concept explanation
- 0:40-1:30 animated demonstration
- 1:30-1:50 code or key-step explanation
- 1:50-end one-sentence summary

Base style constraints:
- Dark background theme, around ${bg}.
- Text color: ${text}. Code font: ${codeFont}.
- Animation intensity: ${animation}.
- Use geometric shapes, process diagrams, and code blocks.
- Body font: ${bodyFont}.`,
  }
}

export function buildCodePrompt(type, script, slug, episodeTemplate = '', research = '') {
  const style = loadStyleConfig()
  const { colors = {}, fonts = {}, animation = 'minimal', template } = style
  const bg = colors.background || '#1a1a2e'
  const card = colors.card || '#16213e'
  const accent = colors.accent || '#e94560'
  const bodyFont = fonts.body || 'sans-serif'
  const codeFont = fonts.code || 'monospace'

  const templatePrompt = getTemplatePrompt(getEffectiveTemplate(episodeTemplate, template))

  const typeGuides = {
    html: `Generate one complete HTML file for a micro-course video. Output code only, from <!DOCTYPE html> to </html>.
Requirements:
- Do not use markdown fences.
- Root element: <div id="root" data-duration="total seconds">.
- Put all visible scenes directly in HTML as real <section class="scene" data-start="start seconds" data-duration="duration seconds"> elements inside #root.
- Every scene must have both data-start and data-duration. Scene durations must cover the whole root duration without the first scene swallowing later scenes.
- Do not rely on JavaScript to create the primary scene DOM.
- Do not include inline <style>. All styling must live in style.css.
- Do not use Tailwind, Bootstrap, or utility framework class names. Use semantic classes that style.css defines.
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
- Do not autoplay audio. Do not break screenshots.`,
  }

  return {
    system: 'You are a frontend animation expert for micro-course videos. Output code only, no explanation.',
    user: `Research:
${research || 'none'}

Script:
${script}

Episode slug:
${slug}

Output type:
${type}

${typeGuides[type] || ''}
${templatePrompt}`,
  }
}
