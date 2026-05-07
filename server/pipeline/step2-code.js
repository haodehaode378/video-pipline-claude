import { sendMessage } from '../ai/claude-client.js'
import { buildCodePrompt } from '../ai/prompts.js'
import { writeText, getEpisodeDir, readText } from '../utils/file-helper.js'
import styleCheck from '../utils/style-check.js'

async function generatePart(type, script, slug) {
  const { system, user } = buildCodePrompt(type, script, slug)
  return sendMessage(system, user, { maxTokens: 8192 })
}

export async function runStep2(episode) {
  console.log(`[Step2] Generating code for "${episode.title}"...`)

  const scriptPath = `scripts/${episode.slug}/script.md`
  const script = readText(scriptPath)
  if (!script) {
    return { success: false, error: 'Script not found. Run Step 1 first.' }
  }

  const dir = getEpisodeDir(episode.slug)
  const slug = episode.slug

  // Generate HTML
  const htmlResult = await generatePart('html', script, slug)
  if (htmlResult.error) return { success: false, error: `HTML: ${htmlResult.error}` }
  writeText(`${dir}/index.html`, htmlResult.text)
  console.log(`[Step2] HTML generated`)

  // Generate CSS (with style-check retry)
  let cssResult = await generatePart('css', script, slug)
  for (let attempt = 0; attempt < 3; attempt++) {
    const check = styleCheck(cssResult.text)
    if (check.passed) break
    console.log(`[Step2] CSS style-check violations (attempt ${attempt + 1}):`, check.violations)
    if (attempt < 2) {
      const retryPrompt = `上一次生成的 CSS 违反了以下风格约束：${check.violations.join(', ')}。请重新生成，严格遵守所有约束。`
      cssResult = await sendMessage(
        '你是前端专家。严格遵守 CSS 风格约束重新生成。',
        retryPrompt + '\n\n' + script,
        { maxTokens: 4096 },
      )
    } else {
      console.warn('[Step2] CSS style-check retries exhausted, using last result')
    }
  }
  if (cssResult.error) return { success: false, error: `CSS: ${cssResult.error}` }
  writeText(`${dir}/style.css`, cssResult.text)
  console.log(`[Step2] CSS generated`)

  // Generate JS
  const jsResult = await generatePart('js', script, slug)
  if (jsResult.error) return { success: false, error: `JS: ${jsResult.error}` }
  writeText(`${dir}/script.js`, jsResult.text)
  console.log(`[Step2] JS generated`)

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
