import { sendMessage } from '../ai/claude-client.js'
import { buildCodePrompt } from '../ai/prompts.js'
import { writeText, getEpisodeDir, readText } from '../utils/file-helper.js'
import styleCheck from '../utils/style-check.js'

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

function validateGenerated(type, code) {
  const errors = []
  if (!code || code.length < 200) errors.push('output is too short')
  if (code.includes('```')) errors.push('contains markdown code fence')

  if (type === 'html') {
    if (!/<!doctype html>/i.test(code)) errors.push('missing <!DOCTYPE html>')
    if (!/<\/html>/i.test(code)) errors.push('missing </html>')
    if (!/<div[^>]+id=["']root["'][^>]*data-duration=/i.test(code)) errors.push('missing #root[data-duration]')
    if (!/<section[^>]+class=["'][^"']*scene/i.test(code)) errors.push('missing section.scene elements')
    if (!/<section[^>]+data-start=/i.test(code)) errors.push('missing section[data-start]')
    if (!/script\.js/i.test(code)) errors.push('missing script.js reference')
    if (!/style\.css/i.test(code)) errors.push('missing style.css reference')
  }

  if (type === 'css') {
    if (!braceBalance(code)) errors.push('unbalanced CSS braces')
  }

  if (type === 'js') {
    if (!/window\.__hfSeek/.test(code)) errors.push('missing window.__hfSeek')
    if (!/narrations/.test(code)) errors.push('missing narrations data')
    try {
      // Parse only. Do not execute browser code in Node.
      new Function(code)
    } catch (err) {
      errors.push(`JS syntax error: ${err.message}`)
    }
  }

  return errors
}

async function generatePart(type, script, slug, template, research, retryNote = '') {
  const { system, user } = buildCodePrompt(type, script, slug, template, research)
  const prompt = retryNote ? `${user}\n\nRegeneration requirements:\n${retryNote}` : user
  return sendMessage(system, prompt, { maxTokens: 12000 })
}

async function generateValidatedPart(type, script, slug, template, research) {
  let retryNote = ''
  let lastErrors = []

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await generatePart(type, script, slug, template, research, retryNote)
    if (result.error) return { error: result.error }

    const code = stripCodeFence(result.text, type)
    lastErrors = validateGenerated(type, code)
    if (lastErrors.length === 0) {
      return { text: code }
    }

    retryNote = [
      `Previous ${type} output was invalid: ${lastErrors.join('; ')}.`,
      'Return one complete file only.',
      'Do not use markdown fences.',
      type === 'html' ? 'HTML must contain real <section class="scene" data-start="..."> elements inside #root.' : '',
      type === 'js' ? 'JavaScript must be syntactically complete and expose window.__hfSeek(seconds).' : '',
    ].filter(Boolean).join('\n')
  }

  return { error: `Invalid ${type} after retries: ${lastErrors.join('; ')}` }
}

export async function runStep2(episode) {
  console.log(`[Step2] Generating code for "${episode.title}"...`)

  const scriptPath = `scripts/${episode.slug}/script.md`
  const script = readText(scriptPath)
  if (!script) {
    return { success: false, error: 'Script not found. Run Step 1 first.' }
  }

  const research = readText(`scripts/${episode.slug}/research.md`) || ''
  const dir = getEpisodeDir(episode.slug)
  const slug = episode.slug

  const htmlResult = await generateValidatedPart('html', script, slug, episode.template, research)
  if (htmlResult.error) return { success: false, error: `HTML: ${htmlResult.error}` }
  writeText(`${dir}/index.html`, htmlResult.text)
  console.log('[Step2] HTML generated')

  let cssResult = await generateValidatedPart('css', script, slug, episode.template, research)
  if (cssResult.error) return { success: false, error: `CSS: ${cssResult.error}` }

  for (let attempt = 0; attempt < 3; attempt++) {
    const check = styleCheck(cssResult.text)
    if (check.passed) break

    console.log(`[Step2] CSS style-check violations (attempt ${attempt + 1}):`, check.violations)
    if (attempt < 2) {
      const retryPrompt = `Previous CSS violated these constraints: ${check.violations.join(', ')}.\nReturn complete plain CSS only, no markdown fences.\n\nResearch:\n${research}\n\nScript:\n${script}`
      const retry = await sendMessage(
        'You are a frontend expert. Regenerate valid CSS only.',
        retryPrompt,
        { maxTokens: 8000 },
      )
      if (retry.error) return { success: false, error: `CSS: ${retry.error}` }
      const code = stripCodeFence(retry.text, 'css')
      const errors = validateGenerated('css', code)
      if (errors.length) return { success: false, error: `CSS: ${errors.join('; ')}` }
      cssResult = { text: code }
    } else {
      console.warn('[Step2] CSS style-check retries exhausted, using last result')
    }
  }
  writeText(`${dir}/style.css`, cssResult.text)
  console.log('[Step2] CSS generated')

  const jsResult = await generateValidatedPart('js', script, slug, episode.template, research)
  if (jsResult.error) return { success: false, error: `JS: ${jsResult.error}` }
  writeText(`${dir}/script.js`, jsResult.text)
  console.log('[Step2] JS generated')

  return {
    success: true,
    output: { html: `${dir}/index.html`, css: `${dir}/style.css`, js: `${dir}/script.js` },
    codeContent: {
      html: htmlResult.text,
      css: cssResult.text,
      js: jsResult.text,
    },
  }
}
