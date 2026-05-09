function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripInlineMarkup(value = '') {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function parseTime(value = '') {
  const [min = '0', sec = '0'] = value.trim().split(':')
  return Number(min) * 60 + Number(sec)
}

function parseRange(value = '') {
  const normalized = value.replace(/[–—]/g, '-')
  const [startRaw, endRaw] = normalized.split('-')
  const start = parseTime(startRaw)
  const end = parseTime(endRaw)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end, duration: end - start }
}

function splitMarkdownRow(row) {
  const cells = []
  let current = ''
  let escaped = false
  for (const ch of row.trim()) {
    if (ch === '\\' && !escaped) {
      escaped = true
      current += ch
      continue
    }
    if (ch === '|' && !escaped) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
    escaped = false
  }
  cells.push(current.trim())
  return cells.filter((cell, index, arr) => !(index === 0 && cell === '') && !(index === arr.length - 1 && cell === ''))
}

export function parseScriptTable(script = '') {
  const scenes = []
  const rows = script.split(/\r?\n/)

  for (const row of rows) {
    if (!row.trim().startsWith('|')) continue
    if (/^\|\s*-+/.test(row)) continue
    if (/\btime\b/i.test(row) && /\bvisual\b/i.test(row)) continue
    if (/时间/.test(row) && /画面|视觉/.test(row)) continue

    const cells = splitMarkdownRow(row)
    if (cells.length < 3) continue
    const range = parseRange(cells[0])
    if (!range) continue

    scenes.push({
      ...range,
      visual: stripInlineMarkup(cells[1]),
      narration: stripInlineMarkup(cells.slice(2).join(' | ')),
    })
  }

  return scenes
}

function keywordList(text) {
  return stripInlineMarkup(text)
    .split(/[，。；、,.!?！？\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 5)
}

function parseMaybeJSON(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function scenesFromTimeline(timeline) {
  const parsed = parseMaybeJSON(timeline)
  const scenes = parsed?.scenes
  if (!Array.isArray(scenes) || scenes.length === 0) return []
  return scenes.map((scene) => ({
    start: Number(scene.start || 0),
    end: Number(scene.end || Number(scene.start || 0) + Number(scene.duration || 0)),
    duration: Number(scene.duration || 0),
    visual: scene.visual || scene.title || '',
    narration: scene.narration || scene.title || '',
  })).filter((scene) => Number.isFinite(scene.start) && Number.isFinite(scene.duration) && scene.duration > 0)
}

function detectVisualKind(title = '', visual = '') {
  const text = `${title} ${visual}`
  if (/大学|学院|学校|校区|高校|招生|学科|专业/.test(text)) return 'campus'
  if (/手机|K70|Redmi|红米|屏幕|快充|骁龙|电池/.test(text)) return 'device'
  if (/钢|冶金|材料|高炉|矿|工业|工艺|工厂|炼/.test(text)) return 'industry'
  return 'concept'
}

export function generateLocalCodeBundle(episode, script, timeline = null) {
  const timelineScenes = scenesFromTimeline(timeline)
  const parsedScenes = timelineScenes.length ? timelineScenes : parseScriptTable(script)
  const fallbackScenes = parsedScenes.length ? parsedScenes : [{
    start: 0,
    end: Math.max(30, Number(episode.duration || 1) * 60),
    duration: Math.max(30, Number(episode.duration || 1) * 60),
    visual: episode.title,
    narration: episode.title,
  }]
  const timelineData = parseMaybeJSON(timeline)
  const totalDuration = Number(timelineData?.totalDuration) || Math.max(...fallbackScenes.map((scene) => scene.end))
  const title = episode.title || 'Micro Course'

  const sceneHtml = fallbackScenes.map((scene, index) => {
    const bullets = keywordList(scene.visual)
    const bulletHtml = bullets.map((item) => `<span>${escapeHtml(item)}</span>`).join('')
    const visualChipHtml = bullets.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join('')
    const visualKind = detectVisualKind(title, scene.visual)
    return `
      <section class="scene scene-${index % 4}" data-start="${scene.start}" data-duration="${scene.duration}">
        <div class="scene-number">${String(index + 1).padStart(2, '0')}</div>
        <div class="visual-stage">
          <div class="topic-visual visual-${visualKind} mark-${index % 3}">
            <div class="visual-symbol">
              <div class="symbol-core">${escapeHtml(String(index + 1).padStart(2, '0'))}</div>
              <div class="symbol-line line-a"></div>
              <div class="symbol-line line-b"></div>
              <div class="symbol-line line-c"></div>
            </div>
            <div class="core-node"></div>
            <div class="visual-chip-row">
              ${visualChipHtml}
            </div>
          </div>
          <div class="pulse-ring ring-a"></div>
          <div class="pulse-ring ring-b"></div>
        </div>
        <div class="content-panel">
          <p class="eyebrow">${escapeHtml(title)}</p>
          <h2>${escapeHtml(scene.narration || title)}</h2>
          <p class="visual-copy">${escapeHtml(scene.visual)}</p>
          <div class="keyword-row">${bulletHtml}</div>
        </div>
      </section>`
  }).join('\n')

  const narrations = fallbackScenes.map((scene) => ({
    start: scene.start,
    end: scene.end,
    text: scene.narration,
  }))

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="root" data-duration="${totalDuration}">
${sceneHtml}
  </div>
  <script src="script.js"></script>
</body>
</html>`

  const css = `* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #111111;
  color: #f4f1e8;
  font-family: "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif;
}

#root {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    radial-gradient(circle at 20% 20%, rgba(224,49,49,0.22), transparent 30%),
    #111111;
  background-size: 80px 80px, 80px 80px, auto, auto;
}

.scene {
  position: absolute;
  inset: 0;
  display: none;
  width: 100%;
  height: 100%;
  padding: 72px 96px;
  overflow: hidden;
}

.scene.active {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 720px;
  align-items: center;
  gap: 72px;
}

.scene::before {
  content: "";
  position: absolute;
  inset: 28px;
  border: 4px solid #f4f1e8;
  pointer-events: none;
}

.scene-number {
  position: absolute;
  top: 54px;
  left: 72px;
  font-size: 44px;
  font-weight: 900;
  color: #e03131;
  letter-spacing: 0;
}

.visual-stage {
  position: relative;
  width: 100%;
  height: 620px;
  border: 4px solid #f4f1e8;
  background: #19334d;
  box-shadow: 16px 16px 0 #e03131;
}

.visual-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.09) 0 2px, transparent 2px 34px),
    linear-gradient(135deg, rgba(255,255,255,0.18), transparent 40%);
}

.topic-visual {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(72%, 520px);
  height: 420px;
  transform: translate(-50%, -50%);
  transform-origin: center;
  animation: visualDrift 8s ease-in-out infinite;
}

.visual-symbol {
  position: absolute;
  left: 50%;
  top: 32px;
  width: 300px;
  height: 300px;
  transform: translateX(-50%);
  background: #111111;
  border: 6px solid #f4f1e8;
  border-radius: 18px;
  box-shadow: 14px 14px 0 #e03131;
}

.symbol-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 112px;
  height: 112px;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  background: #ffd43b;
  border: 5px solid #111111;
  color: #111111;
  font-size: 42px;
  font-weight: 900;
}

.symbol-line {
  position: absolute;
  background: #f4f1e8;
  border: 3px solid #111111;
}

.line-a {
  left: 26px;
  right: 26px;
  top: 52px;
  height: 18px;
}

.line-b {
  left: 42px;
  right: 42px;
  bottom: 52px;
  height: 18px;
}

.line-c {
  left: 50%;
  top: 40px;
  bottom: 40px;
  width: 18px;
  transform: translateX(-50%);
}

.visual-device .visual-symbol {
  width: 210px;
  height: 330px;
  border-radius: 32px;
}

.visual-device .visual-symbol::before {
  content: "";
  position: absolute;
  top: 10px;
  left: 50%;
  width: 58px;
  height: 10px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #f4f1e8;
}

.visual-device .symbol-core {
  inset: 48px 20px 28px;
  width: auto;
  height: auto;
  transform: none;
  left: 20px;
  top: 48px;
  border-radius: 22px;
  background:
    linear-gradient(145deg, rgba(224,49,49,0.45), transparent 42%),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 22px),
    #19334d;
  color: #f4f1e8;
}

.visual-campus .visual-symbol {
  border-radius: 0;
  clip-path: polygon(50% 0, 100% 24%, 100% 100%, 0 100%, 0 24%);
}

.visual-campus .symbol-core {
  top: 62%;
}

.visual-campus .line-a,
.visual-campus .line-b {
  left: 34px;
  right: 34px;
}

.visual-industry .visual-symbol {
  border-radius: 8px;
  transform: translateX(-50%) skewX(-6deg);
}

.visual-industry .symbol-core {
  border-radius: 50%;
  background: #e03131;
  color: #f4f1e8;
}

.visual-industry .line-a,
.visual-industry .line-b,
.visual-industry .line-c {
  background: #ffd43b;
}

.core-node {
  position: absolute;
  right: 24px;
  top: 86px;
  width: 110px;
  height: 110px;
  background: #ffd43b;
  border: 4px solid #111111;
  box-shadow: 10px 10px 0 #111111;
  animation: nodePulse 2.4s ease-in-out infinite;
}

.core-node::before,
.core-node::after {
  content: "";
  position: absolute;
  inset: 20px;
  border: 4px solid #111111;
}

.core-node::after {
  inset: -18px;
  border-color: #f4f1e8;
  opacity: 0.45;
}

.visual-chip-row {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.visual-chip-row span {
  max-width: 180px;
  padding: 8px 10px;
  border: 3px solid #111111;
  background: #f4f1e8;
  color: #111111;
  font-size: 18px;
  font-weight: 900;
  text-align: center;
}

.pulse-ring {
  position: absolute;
  border: 4px solid #f4f1e8;
  border-radius: 50%;
  opacity: 0;
  animation: blast 3s ease-out infinite;
}

.ring-a {
  width: 180px;
  height: 180px;
  right: 18%;
  top: 28%;
}

.ring-b {
  width: 120px;
  height: 120px;
  left: 18%;
  bottom: 18%;
  animation-delay: 1.2s;
}

.content-panel {
  position: relative;
  z-index: 2;
  padding: 42px;
  background: #f4f1e8;
  color: #111111;
  border: 4px solid #111111;
  box-shadow: 16px 16px 0 #e03131;
}

.eyebrow {
  margin: 0 0 16px;
  font-size: 22px;
  font-weight: 900;
  color: #e03131;
}

h2 {
  margin: 0;
  font-size: 44px;
  line-height: 1.18;
  letter-spacing: 0;
}

.visual-copy {
  margin: 28px 0 0;
  font-size: 24px;
  line-height: 1.55;
}

.keyword-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.keyword-row span {
  display: inline-block;
  padding: 8px 12px;
  border: 3px solid #111111;
  background: #ffd43b;
  font-size: 18px;
  font-weight: 900;
}

.scene-1 .visual-stage { background: #2b2d42; }
.scene-2 .visual-stage { background: #264653; }
.scene-3 .visual-stage { background: #3a0ca3; }

@keyframes visualDrift {
  0%, 100% { transform: translate(-50%, -50%) rotate(-2deg); }
  50% { transform: translate(-50%, calc(-50% + 18px)) rotate(3deg); }
}

@keyframes nodePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes blast {
  0% { transform: scale(0.3); opacity: 0.85; }
  100% { transform: scale(1.8); opacity: 0; }
}`

  const js = `const narrations = ${JSON.stringify(narrations, null, 2)};

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

  return { html, css, js, source: 'local-fallback' }
}
