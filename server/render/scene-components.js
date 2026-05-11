export function generateTitleScene(scene, index) {
  const { title = 'Untitled', id = `scene_${index}`, duration = 5 } = scene
  return {
    id,
    component: `function TitleScene({ scene }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const progress = frame / (fps * ${duration})
  const titleOpacity = Math.min(1, progress * 3)
  const titleY = 50 - progress * 50

  return (
    <AbsoluteFill style={{ background: '${p.bg || '#1a1a2e'}', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ color: '#fff', fontSize: 64, fontWeight: 700, opacity: titleOpacity, transform: \`translateY(\${titleY}px)\`, textAlign: 'center', padding: '0 80px', fontFamily: '${p.font || 'sans-serif'}' }}>
        ${title}
      </h1>
    </AbsoluteFill>
  )
}`,
    duration,
    props: { scene },
  }
}

export function generateContentScene(scene, index) {
  const { title = '', visual = '', narration = '', id = `scene_${index}`, duration = 8 } = scene
  return {
    id,
    component: `function ContentScene({ scene }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const duration = ${duration}
  const progress = frame / (fps * duration)
  const fadeIn = Math.min(1, progress * 4)

  return (
    <AbsoluteFill style={{ background: '${p.bg || '#1a1a2e'}', padding: 80, display: 'flex', flexDirection: 'column', gap: 30 }}>
      <h2 style={{ color: '${p.accent || '#e94560'}', fontSize: 36, fontWeight: 600, opacity: fadeIn, fontFamily: '${p.font || 'sans-serif'}' }}>
        ${title}
      </h2>
      <p style={{ color: '#ccc', fontSize: 22, lineHeight: 1.6, opacity: Math.min(1, (progress - 0.1) * 4), maxWidth: 1400 }}>
        ${narration}
      </p>
      <div style={{ color: '#888', fontSize: 16, position: 'absolute', bottom: 80, opacity: Math.min(1, (progress - 0.3) * 4) }}>
        ${visual}
      </div>
    </AbsoluteFill>
  )
}`,
    duration,
    props: { scene },
  }
}

export function generateChartScene(scene, chartData, index) {
  const { title = '', visual = '', narration = '', id = `scene_${index}`, duration = 8 } = scene

  return {
    id,
    component: `function ChartScene({ scene, chartData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const duration = ${duration}
  const progress = frame / (fps * duration)
  const fadeIn = Math.min(1, progress * 3)
  const chartScale = Math.min(1, (progress - 0.15) * 3)

  return (
    <AbsoluteFill style={{ background: '${p.bg || '#1a1a2e'}', padding: 60, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ color: '${p.accent || '#e94560'}', fontSize: 34, fontWeight: 600, opacity: fadeIn }}>
        ${title}
      </h2>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: chartScale, transform: \`scale(\${0.85 + chartScale * 0.15})\` }}>
        {chartData?.imagePath ? (
          <Img src={chartData.imagePath} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ width: '78%', minHeight: 420, border: '2px solid rgba(233, 69, 96, 0.6)', borderRadius: 24, padding: 36, display: 'grid', gap: 22, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'end', height: 180 }}>
              {[0.42, 0.7, 0.54, 0.88].map((height, i) => (
                <div key={i} style={{ flex: 1, height: \`\${height * 100}%\`, background: i % 2 ? '${p.accent || '#e94560'}' : '#ffffff', opacity: 0.85, borderRadius: 12 }} />
              ))}
            </div>
            <p style={{ color: '#e5e7eb', fontSize: 28, lineHeight: 1.45, margin: 0 }}>
              ${narration}
            </p>
            <p style={{ color: '#9ca3af', fontSize: 20, lineHeight: 1.5, margin: 0 }}>
              ${visual}
            </p>
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}`,
    duration,
    props: { scene, chartData: chartData || null },
  }
}

export function generateSummaryScene(scene, index) {
  const { title = '', visual = '', id = `scene_${index}`, duration = 6 } = scene
  return {
    id,
    component: `function SummaryScene({ scene }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const duration = ${duration}
  const progress = frame / (fps * duration)
  const fadeIn = Math.min(1, progress * 2.5)
  const scale = 0.9 + Math.min(1, progress * 2) * 0.1

  return (
    <AbsoluteFill style={{ background: '${p.bg || '#1a1a2e'}', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, transform: \`scale(\${scale})\` }}>
      <h2 style={{ color: '#fff', fontSize: 42, fontWeight: 700, opacity: fadeIn, textAlign: 'center' }}>
        ${title}
      </h2>
      <p style={{ color: '#aaa', fontSize: 20, opacity: Math.min(1, (progress - 0.1) * 2.5), textAlign: 'center', maxWidth: 1200 }}>
        ${visual}
      </p>
      <div style={{ color: '${p.accent || '#e94560'}', fontSize: 18, opacity: Math.min(1, (progress - 0.3) * 2.5), marginTop: 20 }}>
        感谢观看
      </div>
    </AbsoluteFill>
  )
}`,
    duration,
    props: { scene },
  }
}

export function generateFallbackScene(scene, index) {
  const { title = '', id = `scene_${index}`, duration = 5 } = scene
  return {
    id,
    component: `function FallbackScene({ scene }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const duration = ${duration}
  const progress = frame / (fps * duration)
  const opacity = Math.sin(progress * Math.PI)

  return (
    <AbsoluteFill style={{ background: '${p.bg || '#1a1a2e'}', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <h2 style={{ color: '#fff', fontSize: 32, opacity, textAlign: 'center', padding: '0 80px' }}>
        ${title}
      </h2>
    </AbsoluteFill>
  )
}`,
    duration,
    props: { scene },
  }
}

const p = { bg: '#1a1a2e', accent: '#e94560', font: 'sans-serif' }

export function classifySceneType(scene) {
  const idx = parseInt(scene.id?.replace(/[^0-9]/g, '') || '0')
  const title = (scene.title || '').toLowerCase()
  const visual = (scene.visual || '').toLowerCase()

  if (idx === 0 || title.includes('intro') || title.includes('开场') || title.includes('介绍')) return 'title'
  if (idx >= 5 || visual.includes('summary') || visual.includes('总结') || visual.includes('回顾')) return 'summary'
  if (visual.includes('chart') || visual.includes('graph') || visual.includes('图') || visual.includes('表')) return 'chart'
  return 'content'
}

export function generateSceneComponent(scene, index) {
  const type = classifySceneType(scene)
  switch (type) {
    case 'title': return generateTitleScene(scene, index)
    case 'summary': return generateSummaryScene(scene, index)
    case 'chart': return generateChartScene(scene, null, index)
    default: return generateContentScene(scene, index)
  }
}
