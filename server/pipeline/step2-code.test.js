import { describe, expect, it } from 'vitest'
import { step2CodeInternals } from './step2-code.js'

const { buildTimelineControllerJS, validateGenerated, validateCodeBundle, tryRecoveredBundle } = step2CodeInternals

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

  it('rejects JavaScript that creates or replaces scene DOM', () => {
    const badJs = `
const narrations = [];
document.createElement('section');
document.body.appendChild(document.createElement('div'));
window.__hfSeek = function() {};
`

    expect(validateGenerated('js', badJs)).toContain('JS must not create or replace primary scene DOM')
  })
})
