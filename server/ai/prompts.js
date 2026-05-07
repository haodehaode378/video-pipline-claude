import { readJSON } from '../utils/file-helper.js'
import { getTemplateContent } from '../utils/templates.js'

function loadStyleConfig() {
  return readJSON('data/style-config.json') || {}
}

function getTemplatePrompt(slug) {
  if (!slug) return ''
  const t = getTemplateContent(slug)
  if (!t) return ''
  // Return the hard prompt portion (skip the metadata header)
  const idx = t.content.indexOf('# Hard Prompt')
  if (idx === -1) return t.content
  return `\n## 风格模板约束（${t.name}）\n${t.content.slice(idx)}`
}

export function buildScriptPrompt(topic, keywords, duration, sourceMaterial) {
  const style = loadStyleConfig()
  const { colors = {}, fonts = {}, animation = 'minimal' } = style
  const bg = colors.background || '#1a1a2e'
  const accent = colors.accent || '#e94560'
  const text = colors.text || '#ffffff'
  const codeColor = colors.code || '#f0f0f0'
  const bodyFont = fonts.body || 'sans-serif'
  const codeFont = fonts.code || 'monospace'

  return {
    system: `你是微课视频脚本编剧。基于知识点生成简洁清晰的微课脚本。
严格遵守输出格式，只输出三列表格。`,

    user: `## 主题
${topic}

## 知识点
${keywords || '无'}

## 目标时长
约 ${duration} 分钟

## 源材料
${sourceMaterial || '无'}

## 输出要求
输出三列表格：| 时间 | 画面 | 旁白 |
- 时间按秒数范围（如 0:00-0:10）
- 画面描述具体：几何元素、颜色变化、动画效果
- 旁白为完整口语化文本，每段 1-3 句话

## 固定结构
- 0:00-0:10 标题与问题引入
- 0:10-0:40 概念解释
- 0:40-1:30 动画演示
- 1:30-1:50 代码点拨（2-4行关键代码）
- 1:50-结尾 一句话总结

## 风格约束
- 背景使用深色主题（${bg} 或类似）
- 文字用${text === '#ffffff' ? '白色/浅色' : text}，代码用${codeFont}字体
- 动画${animation === 'minimal' ? '简洁克制，避免过于花哨' : animation === 'moderate' ? '适度丰富，突出教学重点' : '丰富生动，体现视觉吸引力'}
- 画面以几何图形和示意图为主
- 正文字体使用${bodyFont}`,
  }
}

export function buildCodePrompt(type, script, slug) {
  const style = loadStyleConfig()
  const { colors = {}, fonts = {}, animation = 'minimal', template } = style
  const bg = colors.background || '#1a1a2e'
  const card = colors.card || '#16213e'
  const accent = colors.accent || '#e94560'
  const bodyFont = fonts.body || 'sans-serif'
  const codeFont = fonts.code || 'monospace'

  const templatePrompt = getTemplatePrompt(template)

  const typeGuides = {
    html: `生成一个微课视频的 HTML 文件。
只输出完整的 HTML 代码（含 <!DOCTYPE html> 到 </html>），不要解释。

要求：
- 根元素 <div id="root" data-duration="总秒数">
- 每个 scene 用 <section class="scene" data-start="起始秒"> 包裹
- 画面元素：标题、文字说明、几何图形（用 CSS）、代码块
- 引入同目录的 style.css 和 script.js
- 使用深色背景主题（背景 ${bg}，卡片 ${card}，强调色 ${accent}）`,

    css: `生成配套的 CSS 样式文件。
只输出完整 CSS 代码，不要解释。

要求：
- 深色背景色板（背景 ${bg}，卡片 ${card}，强调色 ${accent}）
- 字体：${bodyFont} 用于正文，${codeFont} 用于代码
- 动画：使用 CSS @keyframes，${animation === 'minimal' ? '简洁克制' : animation === 'moderate' ? '适度丰富' : '可丰富流畅'}
- 布局：flexbox/grid，保持在 1920x1080 视口内
- 禁止使用：rounded-{sm|md|lg|xl|2xl|3xl}、shadow（除 shadow-none）、bg-gradient-、opacity-{10|20|30|40|50|60}、font-{light|thin|normal}`,

    js: `生成配套的 JavaScript 文件。
只输出完整 JS 代码，不要解释。

要求：
- 实现场景调度：根据 data-duration 和 data-start 控制 scene 切换
- 暴露 window.__hfSeek(seconds) 供 Puppeteer 逐帧渲染调用
- 旁白数组：const narrations = [{ start, end, text }]
- 不影响 Puppeteer 截图的行为（如自动播放）`,
  }

  return {
    system: '你是前端动画专家，专门为微课视频编写 HTML/CSS/JS 代码。只输出代码，不要解释。',
    user: `## 脚本
${script}

## 剧集标识
${slug}

## 输出类型
${type}

${typeGuides[type] || ''}${templatePrompt}`,
  }
}
