import { describe, expect, it } from 'vitest'
import { step2CodeInternals } from './step2-code.js'

const {
  assembleHtmlDocument,
  buildSafeCSS,
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
} = step2CodeInternals

function validHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="root" data-duration="12">
    <section class="scene scene-one" data-start="0" data-duration="4"></section>
    <section class="scene scene-two" data-start="4" data-duration="4"></section>
    <section class="scene scene-three" data-start="8" data-duration="4"></section>
  </div>
  <script src="script.js"></script>
</body>
</html>`
}

describe('step2 deterministic timeline controller', () => {
  it('defines a strict JSON schema response format for code plans', () => {
    expect(CODE_PLAN_RESPONSE_FORMAT.type).toBe('json_schema')
    expect(CODE_PLAN_RESPONSE_FORMAT.json_schema.strict).toBe(true)
    expect(CODE_PLAN_RESPONSE_FORMAT.json_schema.schema.additionalProperties).toBe(false)
    expect(CODE_PLAN_RESPONSE_FORMAT.json_schema.schema.required).toEqual([
      'visualStyle',
      'sharedClasses',
      'scenes',
    ])
  })

  it('validates code plan objects against the local schema rules', () => {
    const validPlan = {
      visualStyle: 'Dark technical explainer with geometric process panels.',
      sharedClasses: ['scene', 'scene-shell', 'visual-panel'],
      scenes: [{
        id: 'scene-01',
        start: 0,
        duration: 4,
        layout: 'Centered title with process diagram.',
        visualElements: ['title', 'diagram'],
        animationBeats: ['fade in title', 'pulse diagram'],
        requiredClasses: ['scene', 'scene-shell', 'viz-diagram'],
      }],
    }

    expect(validateCodePlanSchema(validPlan)).toEqual([])
    expect(validateGenerated('plan', JSON.stringify(validPlan))).toEqual([])
  })

  it('rejects code plans with extra fields or non-string visual element objects', () => {
    const invalidPlan = {
      visualStyle: 'Dark technical explainer.',
      sharedClasses: ['scene'],
      extra: true,
      scenes: [{
        id: 'scene-01',
        start: 0,
        duration: 4,
        layout: 'Centered title.',
        visualElements: [{ type: 'text', content: 'not allowed' }],
        animationBeats: ['fade in'],
        requiredClasses: ['scene'],
      }],
    }

    const errors = validateCodePlanSchema(invalidPlan)
    expect(errors).toContain('unexpected top-level field: extra')
    expect(errors).toContain('scenes[0].visualElements[0] must be a non-empty string')
    expect(validateGenerated('plan', JSON.stringify(invalidPlan))).toEqual(errors)
  })

  it('normalizes debug artifact names', () => {
    expect(safeDebugName('HTML scene 1/6 (scene-01)')).toBe('html-scene-1-6-scene-01')
    expect(safeDebugName('')).toBe('part')
  })

  it('validates one scene section without requiring a full document', () => {
    const section = `<section class="scene atom-scene" data-start="0" data-duration="4">
  <div class="scene-shell">
    <h1>Atom test</h1>
    <p>One focused timed scene with visible content.</p>
  </div>
</section>`

    expect(validateGenerated('html-scene', section)).toEqual([])
    expect(validateGenerated('html-scene', `<!DOCTYPE html>${section}`)).toContain(
      'scene HTML must not include document wrapper, links, or scripts',
    )
  })

  it('assembles a progressive index.html with pending scene placeholders', () => {
    const html = assembleHtmlDocument(
      { title: 'Progressive HTML' },
      {
        totalDuration: 8,
        scenes: [
          { id: 'scene-01', title: 'Ready', start: 0, duration: 4 },
          { id: 'scene-02', title: 'Pending', start: 4, duration: 4 },
        ],
      },
      [
        `<section class="scene ready-scene" data-start="0" data-duration="4">
  <h1>Ready</h1>
</section>`,
      ],
    )

    expect(validateGenerated('html', html)).toEqual([])
    expect(html).toContain('ready-scene')
    expect(html).toContain('scene-pending')
    expect(html).toContain('data-start="4"')
  })

  it('builds a valid local replacement section when AI scene HTML is empty', () => {
    const section = localSceneSection(
      { id: 'scene-01', title: 'Fallback Scene', start: 0, duration: 5, narration: 'Narration text.' },
      { visual: 'A clear visual description.' },
      { visualElements: ['element one', 'element two'] },
    )

    expect(validateGenerated('html-scene', section)).toEqual([])
    expect(section).toContain('scene-local')
    expect(section).toContain('Fallback Scene')
    expect(section).toContain('element one')
  })

  it('builds valid JS without creating primary scene DOM', () => {
    const js = buildTimelineControllerJS({
      scenes: [
        { start: 0, end: 4, duration: 4, narration: 'one' },
        { start: 4, end: 8, duration: 4, narration: 'two' },
        { start: 8, end: 12, duration: 4, narration: 'three' },
      ],
    })

    expect(validateGenerated('js', js)).toEqual([])
    expect(js).toContain('window.__hfSeek')
    expect(js).not.toMatch(/\b(innerHTML|insertAdjacentHTML|createElement|appendChild)\b/)
  })

  it('accepts AI HTML and CSS with the deterministic JS controller', () => {
    const css = '.scene { display: none; } .scene.active { display: block; }'
    const result = tryRecoveredBundle(validHtml(), css, {
      scenes: [
        { start: 0, end: 4, duration: 4, narration: 'one' },
        { start: 4, end: 8, duration: 4, narration: 'two' },
        { start: 8, end: 12, duration: 4, narration: 'three' },
      ],
    })

    expect(result.error).toBeUndefined()
    expect(validateCodeBundle(validHtml(), css, result.js)).toEqual([])
  })

  it('keeps generated HTML renderable with safe CSS when AI CSS fails', () => {
    const css = buildSafeCSS()
    const result = tryRecoveredBundle(validHtml(), css, {
      scenes: [
        { start: 0, end: 4, duration: 4, narration: 'one' },
        { start: 4, end: 8, duration: 4, narration: 'two' },
        { start: 8, end: 12, duration: 4, narration: 'three' },
      ],
    })

    expect(result.error).toBeUndefined()
    expect(validateGenerated('css', css)).toEqual([])
    expect(validateCodeBundle(validHtml(), css, result.js)).toEqual([])
  })

  it('appends active scene visibility rules after AI CSS', () => {
    const css = withRuntimeSceneCSS('.scene { opacity: 0; visibility: hidden; }')

    expect(css).toContain('.scene[data-start].active')
    expect(css).toContain('opacity: 1 !important')
    expect(validateGenerated('css', css)).toEqual([])
  })

  it('rejects JavaScript that creates or replaces scene DOM', () => {
    const badJs = `
const narrations = [];
document.createElement('section');
document.body.appendChild(document.createElement('div'));
window.__hfSeek = function() {};
`

    expect(validateGenerated('js', badJs)).toContain('JS must not create or replace primary scene DOM')
  })

  it('normalizes HTML attributes with missing spaces', () => {
    const fused = '<sectionclass="scene"data-start="0"data-duration="6.27"><divclass="scene-shell"><h1>Test</h1></div></section>'
    const normalized = normalizeHtmlAttrs(fused)
    expect(normalized).toBe('<section class="scene" data-start="0" data-duration="6.27"><div class="scene-shell"><h1>Test</h1></div></section>')
    // Validate that normalized output passes html-scene validation
    expect(validateGenerated('html-scene', normalized)).toEqual([])
  })

  it('normalizes fused semantic and viz class names from AI HTML', () => {
    const fused = '<section class="scenescene-02" data-start="4" data-duration="4"><div class="scene-shellviz-shell"><div class="visual-panelviz-panel"><span class="labelviz-tag">Test text</span></div></div></section>'
    const normalized = normalizeHtmlAttrs(fused)

    expect(normalized).toContain('class="scene scene-02"')
    expect(normalized).toContain('class="scene-shell viz-shell"')
    expect(normalized).toContain('class="visual-panel viz-panel"')
    expect(normalized).toContain('class="label viz-tag"')
    expect(validateGenerated('html-scene', normalized)).toEqual([])
  })

  it('rejects scene HTML with an unterminated tag or attribute', () => {
    const truncated = '<section class="scene" data-start="0" data-duration="4"><div class="visual-panel"><div class="viz-m'

    expect(validateGenerated('html-scene', truncated)).toContain(
      'scene HTML contains malformed or unterminated tags',
    )
  })

  it('rejects assembled HTML when an attribute swallows the next scene tag', () => {
    const malformed = validHtml().replace(
      '<section class="scene scene-one" data-start="0" data-duration="4"></section>',
      '<section class="scene" data-start="0" data-duration="4"><div class="viz-m <section class="scene scene-one" data-start="0" data-duration="4"></section>',
    )

    expect(validateCodeBundle(malformed, '.scene { display: block; }', buildTimelineControllerJS({ scenes: [] }))).toContain(
      'HTML contains malformed or unterminated tags',
    )
  })

  it('leaves already-valid HTML unchanged', () => {
    const valid = '<section class="scene" data-start="0" data-duration="4"><h1>OK</h1></section>'
    expect(normalizeHtmlAttrs(valid)).toBe(valid)
  })

  it('localSceneSection handles object visualElements without [object Object]', () => {
    const section = localSceneSection(
      { id: 'scene-test', start: 0, duration: 5 },
      { visual: 'A diagram' },
      {
        visualElements: [
          { type: 'text', content: 'Element A', class: 'viz-text' },
          { type: 'bubble', label: 'Bubble B' },
        ],
      },
    )
    expect(section).not.toContain('[object Object]')
    expect(section).toContain('Element A')
    expect(section).toContain('Bubble B')
    expect(validateGenerated('html-scene', section)).toEqual([])
  })

  it('rejects broader Tailwind-style class names in scene HTML', () => {
    const section = `<section class="scene flex rounded-xl shadow-lg" data-start="0" data-duration="4">
  <h1>Bad utility classes</h1>
</section>`

    expect(validateGenerated('html-scene', section)).toContain(
      'Tailwind-style utility classes are not allowed in generated scene HTML',
    )
  })

  it('builds topic-aware local visual plans without beverage objects for university material topics', () => {
    const plan = buildLocalVisualPlan(
      { title: '武汉科技大学为什么被称为钢铁摇篮', keywords: '大学, 冶金, 钢铁, 材料' },
      {
        scenes: [
          {
            id: 'scene-01',
            title: '校门背后的钢铁基因',
            visual: '校门、实验室和高炉意象共同入场',
          },
        ],
      },
      {
        scenes: [{ id: 'scene-01', start: 0, duration: 6 }],
      },
    )

    const scene = plan.scenes[0]
    expect(scene.visualDomain).toBe('university')
    expect(scene.heroObjects.map((item) => item.type)).toEqual(['schoolGate', 'blastFurnace', 'book'])
    expect(scene.avoidObjects).toContain('sodaCan')
    expect(scene.heroObjects.map((item) => item.type)).not.toContain('sodaCan')
  })

  it('validates API visual plans and clamps unknown visual objects', () => {
    const expectedScenes = [{ id: 'scene-01' }]
    const valid = validateVisualPlan(
      {
        source: 'api',
        scenes: [{
          id: 'scene-01',
          sceneType: 'openingHook',
          heroObjects: [{ type: 'madeUpObject', label: 'unknown' }],
        }],
      },
      expectedScenes,
    )

    expect(valid.error).toBeUndefined()
    expect(valid.visualPlan.scenes[0].heroObjects[0].type).toBe('genericBadge')

    const invalid = validateVisualPlan(
      { scenes: [{ id: 'scene-01', sceneType: 'unknownTemplate' }] },
      expectedScenes,
    )
    expect(invalid.error).toBe('scene-01.sceneType is invalid')
  })
})
