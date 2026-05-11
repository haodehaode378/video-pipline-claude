const p = { bg: '#1a1a2e', accent: '#e94560', font: 'sans-serif' }

function sceneMeta(scene, index, defaultDuration = 8) {
  return {
    id: scene.id || `scene_${index}`,
    duration: scene.duration || defaultDuration,
    props: { scene },
  }
}

function baseComponent(name, scene, index, body, defaultDuration = 8) {
  const { id, duration, props } = sceneMeta(scene, index, defaultDuration)
  return {
    id,
    component: `function ${name}({ scene }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const duration = ${duration}
  const progress = Math.min(1, frame / Math.max(1, fps * duration))
  const enter = Math.min(1, progress * 3)
  const pulse = 0.5 + Math.sin(frame / 9) * 0.5
  const title = scene.title || 'Untitled'
  const narration = scene.narration || ''
  const accent = '${p.accent}'
  const bg = '${p.bg}'
  const font = '${p.font}'

${body}
}`,
    duration,
    props,
  }
}

function textBlock(kicker) {
  return `      <div style={{ width: 560, display: 'grid', gap: 22, zIndex: 2 }}>
        <div style={{ color: accent, fontSize: 18, fontWeight: 700, letterSpacing: 0, opacity: enter }}>
          ${kicker}
        </div>
        <h2 style={{ color: '#f8fafc', fontSize: 54, lineHeight: 1.08, margin: 0, fontFamily: font, opacity: enter, transform: 'translateY(' + (24 - enter * 24) + 'px)' }}>
          {title}
        </h2>
        <p style={{ color: '#cbd5e1', fontSize: 25, lineHeight: 1.5, margin: 0, opacity: Math.min(1, (progress - 0.12) * 3) }}>
          {narration}
        </p>
      </div>`
}

function bubbleField() {
  return `      <div className="bubble-field" style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.68 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} style={{
            position: 'absolute',
            left: (8 + i * 11) + '%',
            top: (72 - ((frame * (0.18 + i * 0.015) + i * 13) % 86)) + '%',
            width: 18 + (i % 4) * 10,
            height: 18 + (i % 4) * 10,
            borderRadius: '999px',
            border: '2px solid rgba(255,255,255,0.22)',
            background: i % 3 === 0 ? 'rgba(37,99,235,0.16)' : 'rgba(244,63,94,0.12)',
          }} />
        ))}
      </div>`
}

function symbolBadge() {
  return `          <div className="symbol-badge" style={{ width: 170, height: 170, borderRadius: '999px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 48px rgba(37,99,235,0.42)', transform: 'scale(' + (0.9 + enter * 0.1) + ')' }}>
            <div style={{ position: 'absolute', inset: 0, background: '#2563eb' }} />
            <div style={{ position: 'absolute', left: -18, right: -18, top: 57, height: 55, background: '#f8fafc', transform: 'rotate(-12deg)' }} />
            <div style={{ position: 'absolute', inset: '50% 0 0 0', background: '#ef4444' }} />
          </div>`
}

function schoolGate(color, delay) {
  return `          <div className="topic-object school-gate" style={{ width: 260, height: 240, position: 'relative', transform: 'translateY(' + (30 - Math.max(0, enter - ${delay}) * 46) + 'px)', opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4) }}>
            <div style={{ position: 'absolute', left: 20, right: 20, top: 46, height: 34, borderRadius: 10, background: ${color}, boxShadow: '0 0 34px rgba(96,165,250,0.34)' }} />
            <div style={{ position: 'absolute', left: 30, top: 80, width: 42, height: 130, borderRadius: 10, background: 'rgba(248,250,252,0.92)' }} />
            <div style={{ position: 'absolute', right: 30, top: 80, width: 42, height: 130, borderRadius: 10, background: 'rgba(248,250,252,0.92)' }} />
            <div style={{ position: 'absolute', left: 96, top: 92, width: 68, height: 118, borderRadius: '999px 999px 8px 8px', border: '8px solid rgba(248,250,252,0.92)', borderBottom: 0 }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, height: 12, borderRadius: 999, background: 'rgba(148,163,184,0.45)' }} />
          </div>`
}

function blastFurnace(color, delay) {
  return `          <div className="topic-object blast-furnace" style={{ width: 240, height: 330, position: 'relative', transform: 'translateY(' + (34 - Math.max(0, enter - ${delay}) * 52) + 'px)', opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4) }}>
            <div style={{ position: 'absolute', left: 58, top: 30, width: 124, height: 250, clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)', background: 'linear-gradient(90deg, rgba(255,255,255,0.18), ' + ${color} + ', rgba(0,0,0,0.3))', boxShadow: '0 32px 70px rgba(0,0,0,0.34)' }} />
            <div style={{ position: 'absolute', left: 32, right: 32, bottom: 36, height: 16, borderRadius: 999, background: '#f97316', boxShadow: '0 0 34px rgba(249,115,22,0.72)' }} />
            <div style={{ position: 'absolute', left: 92, top: 0, width: 56, height: 54, borderRadius: '50% 50% 14px 14px', background: 'linear-gradient(#fde68a, #ef4444)', filter: 'blur(0.4px)', transform: 'scale(' + (0.86 + pulse * 0.18) + ')' }} />
          </div>`
}

function bookObject(color, delay) {
  return `          <div className="topic-object book-object" style={{ width: 260, height: 220, position: 'relative', transform: 'translateY(' + (28 - Math.max(0, enter - ${delay}) * 44) + 'px)', opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4) }}>
            <div style={{ position: 'absolute', left: 18, top: 42, width: 108, height: 140, borderRadius: '16px 8px 8px 16px', background: 'rgba(248,250,252,0.94)', transform: 'skewY(-6deg)', boxShadow: '0 26px 52px rgba(0,0,0,0.28)' }} />
            <div style={{ position: 'absolute', right: 18, top: 42, width: 108, height: 140, borderRadius: '8px 16px 16px 8px', background: ${color}, transform: 'skewY(6deg)', boxShadow: '0 26px 52px rgba(0,0,0,0.28)' }} />
            {[0,1,2].map((i) => <div key={i} style={{ position: 'absolute', left: 46, top: 76 + i * 28, width: 58, height: 5, borderRadius: 999, background: 'rgba(15,23,42,0.32)' }} />)}
          </div>`
}

function crystalLattice(color, delay) {
  return `          <div className="topic-object crystal-lattice" style={{ width: 270, height: 260, position: 'relative', transform: 'scale(' + (0.82 + Math.max(0, enter - ${delay}) * 0.18) + ')', opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4) }}>
            {[0,1,2,3,4].map((i) => (
              <div key={i} style={{ position: 'absolute', left: 48 + (i % 2) * 108, top: 34 + i * 42, width: 38, height: 38, borderRadius: 999, background: i % 2 ? ${color} : '#f8fafc', boxShadow: '0 0 28px rgba(96,165,250,0.34)' }} />
            ))}
            {[0,1,2,3].map((i) => <div key={i} style={{ position: 'absolute', left: 78, top: 58 + i * 42, width: 124, height: 5, borderRadius: 999, background: 'linear-gradient(90deg, #60a5fa, #fb7185)', transform: 'rotate(' + (i % 2 ? -18 : 18) + 'deg)' }} />)}
          </div>`
}

function gearLoop(color, delay) {
  return `          <div className="topic-object gear-loop" style={{ width: 250, height: 250, borderRadius: 999, border: '24px dashed ' + ${color}, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 36, fontWeight: 900, transform: 'rotate(' + (frame * 0.4) + 'deg) scale(' + (0.82 + Math.max(0, enter - ${delay}) * 0.18) + ')', opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4), boxShadow: '0 0 42px rgba(96,165,250,0.3)' }}>
            <div style={{ transform: 'rotate(' + (-frame * 0.4) + 'deg)' }}>闭环</div>
          </div>`
}

function headphonesObject(color, delay) {
  return `          <div className="topic-object headphones" style={{ width: 280, height: 260, position: 'relative', transform: 'translateY(' + (28 - Math.max(0, enter - ${delay}) * 46) + 'px)', opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4) }}>
            <div style={{ position: 'absolute', left: 52, top: 22, width: 176, height: 156, borderRadius: '120px 120px 40px 40px', border: '18px solid ' + ${color}, borderBottom: 0, boxShadow: '0 0 40px rgba(96,165,250,0.34)' }} />
            <div style={{ position: 'absolute', left: 28, bottom: 24, width: 74, height: 116, borderRadius: 30, background: 'linear-gradient(160deg, rgba(255,255,255,0.96), ' + ${color} + ')', boxShadow: '0 26px 48px rgba(0,0,0,0.30)' }} />
            <div style={{ position: 'absolute', right: 28, bottom: 24, width: 74, height: 116, borderRadius: 30, background: 'linear-gradient(200deg, rgba(255,255,255,0.96), ' + ${color} + ')', boxShadow: '0 26px 48px rgba(0,0,0,0.30)' }} />
            <div style={{ position: 'absolute', left: 118, top: 172, width: 44, height: 44, borderRadius: 999, background: '#f8fafc', boxShadow: '0 0 26px rgba(255,255,255,0.38)' }} />
          </div>`
}

function audioWavesObject(color, delay) {
  return `          <div className="topic-object audio-waves" style={{ width: 270, height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, transform: 'scale(' + (0.82 + Math.max(0, enter - ${delay}) * 0.18) + ')', opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4) }}>
            {[0,1,2,3,4,5,6].map((i) => (
              <div key={i} style={{ width: 18, height: 42 + Math.abs(3 - i) * 28 + pulse * 38, borderRadius: 999, background: i % 2 ? ${color} : '#f8fafc', boxShadow: '0 0 30px rgba(96,165,250,0.32)' }} />
            ))}
          </div>`
}

function chipObject(color, delay) {
  return `          <div className="topic-object chip" style={{ width: 240, height: 240, position: 'relative', borderRadius: 26, background: 'linear-gradient(135deg, rgba(255,255,255,0.18), ' + ${color} + ', rgba(15,23,42,0.82))', border: '2px solid rgba(255,255,255,0.28)', boxShadow: '0 28px 58px rgba(0,0,0,0.34)', transform: 'rotate(' + (-8 + enter * 8) + 'deg) scale(' + (0.84 + Math.max(0, enter - ${delay}) * 0.16) + ')', opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4) }}>
            {[0,1,2,3,4].map((i) => <div key={'h' + i} style={{ position: 'absolute', left: -18, top: 34 + i * 34, width: 18, height: 7, borderRadius: 999, background: '#94a3b8' }} />)}
            {[0,1,2,3,4].map((i) => <div key={'r' + i} style={{ position: 'absolute', right: -18, top: 34 + i * 34, width: 18, height: 7, borderRadius: 999, background: '#94a3b8' }} />)}
            <div style={{ position: 'absolute', inset: 54, borderRadius: 18, border: '2px solid rgba(255,255,255,0.34)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 28, fontWeight: 900 }}>BT</div>
          </div>`
}

function topicObject(type, color = "'#2563eb'", delay = 0) {
  switch (type) {
    case 'schoolGate': return schoolGate(color, delay)
    case 'blastFurnace': return blastFurnace(color, delay)
    case 'book': return bookObject(color, delay)
    case 'crystalLattice': return crystalLattice(color, delay)
    case 'gearLoop': return gearLoop(color, delay)
    case 'headphones': return headphonesObject(color, delay)
    case 'audioWaves': return audioWavesObject(color, delay)
    case 'chip': return chipObject(color, delay)
    case 'sodaCan': return sodaCan('badge', '#2563eb', delay)
    case 'drinkCup': return sodaCan('letter', '#ef4444', delay)
    default: return symbolBadge()
  }
}

function sceneObjectTypes(scene) {
  const planned = scene.visualPlan?.heroObjects
  if (Array.isArray(planned) && planned.length > 0) {
    return planned.map((item) => typeof item === 'string' ? item : item?.type).filter(Boolean)
  }
  return []
}

function comparisonCard(label, color, score, objectType, offset) {
  return `            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, border: '1px solid rgba(255,255,255,0.15)', background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))', padding: 34, transform: 'translateY(' + (${offset} - enter * ${offset}) + 'px)', opacity: enter }}>
              <div style={{ position: 'absolute', inset: 'auto -60px -100px auto', width: 260, height: 260, borderRadius: 999, background: '${color}', opacity: 0.24 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#fff', fontSize: 48, fontWeight: 900 }}>${label}</div>
                <div className="symbol-badge" style={{ width: 74, height: 74, borderRadius: 999, background: '${color}', boxShadow: '0 0 30px ${color}' }} />
              </div>
              <div style={{ height: 330, display: 'grid', placeItems: 'center' }}>
${topicObject(objectType, `'${color}'`, 0)}
              </div>
              <div className="metric-bars" style={{ display: 'grid', gap: 14 }}>
                <div style={{ height: 14, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                  <div style={{ width: ${score} + '%', height: '100%', background: '${color}', borderRadius: 999 }} />
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 24 }}>{${score}}% 信号强度</div>
              </div>
            </div>`
}

function sodaCan(label, color, delay) {
  return `          <div className="soda-can" style={{
            width: 190,
            height: 360,
            borderRadius: 30,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.2), ${color} 28%, ${color} 72%, rgba(0,0,0,0.32))',
            boxShadow: '0 34px 70px rgba(0,0,0,0.36)',
            position: 'relative',
            transform: 'translateY(' + (34 - Math.max(0, enter - ${delay}) * 52) + 'px) rotate(' + (${delay} ? 5 : -5) + 'deg)',
            opacity: Math.min(1, Math.max(0, enter - ${delay}) * 2.4),
          }}>
            <div style={{ position: 'absolute', top: 18, left: 34, right: 34, height: 16, borderRadius: 999, background: 'rgba(255,255,255,0.52)' }} />
            <div style={{ position: 'absolute', inset: '86px 32px auto', height: 120, display: 'grid', placeItems: 'center' }}>
              ${label === 'badge' ? symbolBadge() : `<div style={{ color: '#fff', fontSize: 34, fontWeight: 800, transform: 'rotate(-7deg)' }}>A</div>`}
            </div>
            <div style={{ position: 'absolute', bottom: 30, left: 28, right: 28, height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.32)' }} />
          </div>`
}

export function generateOpeningHookScene(scene, index) {
  const objects = sceneObjectTypes(scene)
  const leftObject = objects[0] || 'genericBadge'
  const rightObject = objects[1] || objects[0] || 'genericBadge'
  return baseComponent('OpeningHookScene', scene, index, `  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 70% 25%, rgba(37,99,235,0.24), transparent 34%), radial-gradient(circle at 20% 70%, rgba(244,63,94,0.20), transparent 34%), ' + bg, padding: 76, fontFamily: font, overflow: 'hidden' }}>
${bubbleField()}
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 70 }}>
${textBlock('OPENING HOOK')}
        <div className="visual-stage opening-hook" style={{ flex: 1, minWidth: 840, height: 760, position: 'relative', display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '999px', background: 'conic-gradient(from 140deg, rgba(37,99,235,0.9), rgba(255,255,255,0.9), rgba(244,63,94,0.85), rgba(37,99,235,0.9))', filter: 'blur(1px)', opacity: 0.24 + pulse * 0.18, transform: 'scale(' + (0.86 + enter * 0.12) + ')' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 94, zIndex: 1 }}>
${topicObject(leftObject, "'#2563eb'", 0)}
            <div style={{ color: '#f8fafc', fontSize: 96, fontWeight: 900, opacity: enter, textShadow: '0 0 34px rgba(255,255,255,0.26)' }}>?</div>
${topicObject(rightObject, "'#ef4444'", 0.18)}
          </div>
          <div className="metric-sparks" style={{ position: 'absolute', bottom: 86, display: 'flex', gap: 22, opacity: Math.min(1, (progress - 0.32) * 3) }}>
            {['冲突', '选择', '反转'].map((item, i) => (
              <div key={item} style={{ color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '12px 22px', background: i === 1 ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.08)' }}>{item}</div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )`, 7)
}

export function generateComparisonScene(scene, index) {
  const objects = sceneObjectTypes(scene)
  const leftObject = objects[0] || 'genericBadge'
  const rightObject = objects[1] || objects[0] || 'genericBadge'
  return baseComponent('ComparisonScene', scene, index, `  const leftScore = 52 + Math.round(pulse * 16)
  const rightScore = 100 - leftScore

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #101628, #1b2038)', padding: 72, fontFamily: font, overflow: 'hidden' }}>
${bubbleField()}
      <div style={{ display: 'grid', gridTemplateColumns: '470px 1fr', gap: 54, height: '100%', alignItems: 'center' }}>
${textBlock('COMPARISON')}
        <div className="split-compare" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, height: 720 }}>
${comparisonCard('A', '#2563eb', 'leftScore', leftObject, -26)}
${comparisonCard('B', '#ef4444', 'rightScore', rightObject, 26)}
        </div>
      </div>
    </AbsoluteFill>
  )`, 8)
}

export function generateTimelineScene(scene, index) {
  return baseComponent('TimelineScene', scene, index, `  const nodes = ['起点', '转折', '扩张', '现在']
  const active = Math.min(nodes.length - 1, Math.floor(progress * nodes.length))

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #111827, #172033)', padding: 76, fontFamily: font, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '500px 1fr', gap: 60, height: '100%', alignItems: 'center' }}>
${textBlock('TIMELINE')}
        <div className="timeline-rail" style={{ position: 'relative', height: 640, padding: '80px 60px', borderRadius: 30, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ position: 'absolute', left: 120, right: 120, top: '50%', height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ position: 'absolute', left: 120, top: '50%', width: (Math.max(0.08, progress) * 75) + '%', height: 8, borderRadius: 999, background: 'linear-gradient(90deg, #2563eb, #f43f5e)' }} />
          {nodes.map((node, i) => (
            <div key={node} className="timeline-node" style={{ position: 'absolute', left: (90 + i * 250), top: 250 + (i % 2 ? 92 : -92), width: 180, opacity: enter }}>
              <div style={{ width: 78, height: 78, borderRadius: 999, display: 'grid', placeItems: 'center', background: i <= active ? accent : 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 28, fontWeight: 800, boxShadow: i <= active ? '0 0 34px rgba(244,63,94,0.36)' : 'none' }}>{i + 1}</div>
              <div style={{ marginTop: 18, color: '#e2e8f0', fontSize: 25, fontWeight: 700 }}>{node}</div>
              <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 18 }}>阶段 {i + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )`, 9)
}

export function generateDataVisualScene(scene, index) {
  return baseComponent('DataVisualScene', scene, index, `  const pointsA = [[100,270],[190,170],[280,205],[370,120],[460,155],[550,95]]
  const pointsB = [[100,215],[190,235],[280,155],[370,205],[460,125],[550,175]]
  const toPoints = (pts) => pts.map((pt) => pt.join(',')).join(' ')

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 72% 28%, rgba(37,99,235,0.20), transparent 35%), #111827', padding: 72, fontFamily: font }}>
      <div style={{ display: 'grid', gridTemplateColumns: '470px 1fr', gap: 58, height: '100%', alignItems: 'center' }}>
${textBlock('DATA VISUAL')}
        <div className="data-visual" style={{ height: 720, borderRadius: 30, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', opacity: enter }}>
          <svg className="radar-graphic" viewBox="0 0 720 520" width="860" height="620" role="img">
            <g transform="translate(360 260)" opacity={0.95}>
              {[80, 140, 200].map((r) => (
                <polygon key={r} points={[0,1,2,3,4,5].map((i) => {
                  const angle = -Math.PI / 2 + i * Math.PI / 3
                  return (Math.cos(angle) * r) + ',' + (Math.sin(angle) * r)
                }).join(' ')} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
              ))}
              {[0,1,2,3,4,5].map((i) => {
                const angle = -Math.PI / 2 + i * Math.PI / 3
                return <line key={i} x1="0" y1="0" x2={Math.cos(angle) * 220} y2={Math.sin(angle) * 220} stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
              })}
              <polyline points={toPoints(pointsA.map(([x,y]) => [x - 360, y - 260]))} fill="rgba(37,99,235,0.28)" stroke="#60a5fa" strokeWidth="5" transform={'scale(' + (0.8 + enter * 0.2) + ')'} />
              <polyline points={toPoints(pointsB.map(([x,y]) => [x - 360, y - 260]))} fill="rgba(244,63,94,0.22)" stroke="#fb7185" strokeWidth="5" transform={'scale(' + (0.72 + enter * 0.28) + ')'} />
              {[0,1,2,3,4,5].map((i) => {
                const angle = -Math.PI / 2 + i * Math.PI / 3
                return <circle key={i} cx={Math.cos(angle) * 206} cy={Math.sin(angle) * 206} r={8 + pulse * 4} fill={i % 2 ? '#fb7185' : '#60a5fa'} />
              })}
            </g>
            <g className="metric-bars" transform="translate(70 430)">
              {[0.78, 0.62, 0.88].map((value, i) => (
                <g key={i} transform={'translate(' + (i * 190) + ' 0)'}>
                  <rect width="150" height="16" rx="8" fill="rgba(255,255,255,0.14)" />
                  <rect width={150 * value * enter} height="16" rx="8" fill={i % 2 ? '#fb7185' : '#60a5fa'} />
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  )`, 8)
}

export function generateExperimentScene(scene, index) {
  return baseComponent('ExperimentScene', scene, index, `  const reveal = progress > 0.48

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #111827, #20243a)', padding: 72, fontFamily: font, overflow: 'hidden' }}>
${bubbleField()}
      <div style={{ display: 'grid', gridTemplateColumns: '450px 1fr', gap: 58, height: '100%', alignItems: 'center' }}>
${textBlock('EXPERIMENT')}
        <div className="experiment-stage split-compare" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, height: 710 }}>
          {['盲测', '揭晓'].map((label, i) => (
            <div key={label} style={{ borderRadius: 30, border: '1px solid rgba(255,255,255,0.15)', background: i ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.13)', padding: 34, position: 'relative', overflow: 'hidden', opacity: enter }}>
              <div style={{ color: '#fff', fontSize: 34, fontWeight: 800 }}>{label}</div>
              <div style={{ height: 380, display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 190, height: 190, borderRadius: 999, background: '#f8fafc', position: 'relative', boxShadow: '0 28px 60px rgba(0,0,0,0.28)' }}>
                  <div style={{ position: 'absolute', left: 38, right: 38, top: 70, height: 18, borderRadius: 999, background: i === 0 ? '#111827' : '#60a5fa', transform: reveal && i ? 'rotate(-8deg)' : 'none' }} />
                  <div style={{ position: 'absolute', left: 70, top: 112, width: 50, height: 24, borderBottom: '7px solid #111827', borderRadius: '0 0 999px 999px', transform: reveal && i ? 'rotate(180deg)' : 'none' }} />
                </div>
              </div>
              <div className="metric-bars" style={{ display: 'grid', gap: 16 }}>
                <div style={{ color: '#cbd5e1', fontSize: 24 }}>{i ? '品牌信号覆盖' : '即时偏好上升'}</div>
                <div style={{ height: 18, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                  <div style={{ width: ((i ? 57 : 68) * enter) + '%', height: '100%', borderRadius: 999, background: i ? '#fb7185' : '#60a5fa' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )`, 9)
}

export function generateMechanismScene(scene, index) {
  return baseComponent('MechanismScene', scene, index, `  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 66% 40%, rgba(14,165,233,0.18), transparent 34%), #111827', padding: 72, fontFamily: font, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '470px 1fr', gap: 58, height: '100%', alignItems: 'center' }}>
${textBlock('MECHANISM')}
        <div className="mechanism-diagram" style={{ height: 720, borderRadius: 30, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.055)', display: 'grid', placeItems: 'center', opacity: enter }}>
          <svg viewBox="0 0 820 620" width="900" height="680" role="img">
            <path d="M240 340 C170 250 210 130 330 110 C440 20 600 80 622 205 C720 240 715 410 610 450 C570 565 380 560 330 480 C270 490 205 435 240 340 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.36)" strokeWidth="5" />
            <circle className="node reward" cx="350" cy="360" r={58 + pulse * 8} fill="rgba(244,63,94,0.72)" />
            <circle className="node memory" cx="500" cy="270" r={50 + pulse * 6} fill="rgba(96,165,250,0.75)" />
            <circle className="node decision" cx="545" cy="390" r={42 + pulse * 5} fill="rgba(34,197,94,0.62)" />
            <path d="M350 360 C420 315 455 300 500 270" fill="none" stroke="#60a5fa" strokeWidth="8" strokeLinecap="round" strokeDasharray="18 18" strokeDashoffset={-frame % 36} />
            <path d="M500 270 C560 310 565 348 545 390" fill="none" stroke="#fb7185" strokeWidth="8" strokeLinecap="round" strokeDasharray="18 18" strokeDashoffset={frame % 36} />
            {[['奖励',350,454],['记忆',500,194],['决策',545,470]].map(([label,x,y]) => (
              <text key={label} x={x} y={y} fill="#e2e8f0" fontSize="28" textAnchor="middle" fontWeight="700">{label}</text>
            ))}
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  )`, 8)
}

export function generateProcessFlowScene(scene, index) {
  return baseComponent('ProcessFlowScene', scene, index, `  const nodes = ['输入', '处理', '变化', '结果']

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #0f172a, #172033)', padding: 72, fontFamily: font, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 58, height: '100%', alignItems: 'center' }}>
${textBlock('PROCESS FLOW')}
        <div className="flow-diagram" style={{ height: 720, borderRadius: 30, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.055)', position: 'relative', opacity: enter }}>
          {nodes.map((node, i) => (
            <div key={node} className="flow-node node" style={{ position: 'absolute', left: 82 + i * 245, top: 270 + (i % 2 ? 80 : -30), width: 170, height: 140, borderRadius: 24, background: i % 2 ? 'rgba(244,63,94,0.22)' : 'rgba(37,99,235,0.24)', border: '1px solid rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', color: '#f8fafc', fontSize: 30, fontWeight: 800, transform: 'scale(' + (0.86 + Math.min(1, Math.max(0, progress * 4 - i)) * 0.14) + ')' }}>
              {node}
            </div>
          ))}
          {[0,1,2].map((i) => (
            <div key={i} className="connector" style={{ position: 'absolute', left: 235 + i * 245, top: 340 + (i % 2 ? 36 : 4), width: 150, height: 6, borderRadius: 999, background: 'linear-gradient(90deg, #60a5fa, #fb7185)', opacity: Math.min(1, Math.max(0, progress * 5 - i - 1)) }} />
          ))}
          <div style={{ position: 'absolute', left: 92, right: 92, bottom: 86, height: 16, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <div style={{ width: (progress * 100) + '%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #60a5fa, #fb7185)' }} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )`, 8)
}

export function generateFinaleScene(scene, index) {
  const objects = sceneObjectTypes(scene)
  const mainObject = objects[0] || 'genericBadge'
  return baseComponent('FinaleScene', scene, index, `  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 42%, rgba(244,63,94,0.18), transparent 38%), radial-gradient(circle at 50% 40%, rgba(37,99,235,0.20), transparent 52%), #111827', padding: 72, fontFamily: font, overflow: 'hidden' }}>
${bubbleField()}
      <div className="finale-symbol" style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'grid', gap: 34, justifyItems: 'center', maxWidth: 1120 }}>
${topicObject(mainObject, "'#2563eb'", 0)}
          <h2 style={{ color: '#f8fafc', fontSize: 62, lineHeight: 1.08, margin: 0, opacity: enter, transform: 'translateY(' + (28 - enter * 28) + 'px)' }}>{title}</h2>
          <p style={{ color: '#cbd5e1', fontSize: 28, lineHeight: 1.45, margin: 0, opacity: Math.min(1, (progress - 0.1) * 3) }}>{narration}</p>
          <div className="metric-bars" style={{ width: 520, height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', opacity: enter }}>
            <div style={{ width: (progress * 100) + '%', height: '100%', background: 'linear-gradient(90deg, #2563eb, #f8fafc, #ef4444)' }} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )`, 6)
}

export function generateGenericVisualScene(scene, index) {
  const objects = sceneObjectTypes(scene)
  const mainObject = objects[0] || 'genericBadge'
  return baseComponent('GenericVisualScene', scene, index, `  const tiles = ['核心', '线索', '证据', '结论']

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #111827, #1f2937)', padding: 72, fontFamily: font, overflow: 'hidden' }}>
${bubbleField()}
      <div style={{ display: 'grid', gridTemplateColumns: '470px 1fr', gap: 58, height: '100%', alignItems: 'center' }}>
${textBlock('VISUAL STORY')}
        <div className="generic-visual flow-diagram" style={{ height: 720, borderRadius: 30, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.055)', position: 'relative', opacity: enter }}>
          <div style={{ position: 'absolute', left: 330, top: 170 }}>
${topicObject(mainObject, "'#2563eb'", 0)}
          </div>
          {tiles.map((tile, i) => (
            <div key={tile} className="node" style={{ position: 'absolute', left: 110 + (i % 2) * 610, top: 96 + Math.floor(i / 2) * 390, width: 190, height: 120, borderRadius: 24, background: i % 2 ? 'rgba(244,63,94,0.18)' : 'rgba(37,99,235,0.20)', border: '1px solid rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', color: '#e2e8f0', fontSize: 28, fontWeight: 800, transform: 'translateY(' + (26 - enter * 26) + 'px)' }}>
              {tile}
            </div>
          ))}
          {[0,1,2,3].map((i) => (
            <div key={i} className="connector" style={{ position: 'absolute', left: i % 2 ? 520 : 300, top: i < 2 ? 190 : 500, width: 250, height: 5, borderRadius: 999, background: 'linear-gradient(90deg, #60a5fa, #fb7185)', transform: 'rotate(' + (i % 2 ? -18 : 18) + 'deg)', opacity: Math.min(1, progress * 3) }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )`, 8)
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word))
}

const plannedSceneTypes = new Set([
  'openingHook',
  'comparison',
  'timeline',
  'dataVisual',
  'experiment',
  'mechanism',
  'processFlow',
  'finale',
  'genericVisual',
])

export function classifySceneType(scene, index = 0) {
  if (plannedSceneTypes.has(scene.visualPlan?.sceneType)) return scene.visualPlan.sceneType

  const raw = [
    scene.title,
    scene.visual,
    scene.intent,
    scene.animationHint,
  ].filter(Boolean).join(' ').toLowerCase()
  const idx = parseInt(scene.id?.replace(/[^0-9]/g, '') || `${index + 1}`, 10)

  if (includesAny(raw, ['总结', '回顾', '结尾', '收束', 'finale', 'ending', '下次', '记住']) || idx >= 6) return 'finale'
  if (includesAny(raw, ['时间轴', '历史', '起源', '演化', '发展', '里程碑', '年份', '年表', 'timeline', '189', '197', '200'])) return 'timeline'
  if (includesAny(raw, ['流程', '步骤', '路径', '链路', '因果', '递进', '转化', '闭环', '循环', '齿轮', '三链', 'process', 'flow'])) return 'processFlow'
  if (includesAny(raw, ['盲测', '蒙眼', '实验', '测试', '挑战', '反转', '揭晓', 'experiment', 'test'])) return 'experiment'
  if (includesAny(raw, ['大脑', '脑区', '机制', '神经', '系统内部', '剖面', '原理', '纹状体', '前额叶', '海马体', 'mechanism'])) return 'mechanism'
  if (includesAny(raw, ['雷达图', '图表', '数据', '比例', '百分比', '指标', '曲线', '柱状', 'chart', 'graph', 'radar'])) return 'dataVisual'
  if (includesAny(raw, ['对比', '比较', '分屏', 'vs', '差异', 'a/b', '两种', '二者', 'comparison'])) return 'comparison'
  if (idx <= 1 || includesAny(raw, ['开场', '引出', '冲突', '问题', '悬念', 'intro', 'hook'])) return 'openingHook'
  return 'genericVisual'
}

export function generateSceneComponent(scene, index) {
  const type = classifySceneType(scene, index)
  switch (type) {
    case 'openingHook': return generateOpeningHookScene(scene, index)
    case 'comparison': return generateComparisonScene(scene, index)
    case 'timeline': return generateTimelineScene(scene, index)
    case 'dataVisual': return generateDataVisualScene(scene, index)
    case 'experiment': return generateExperimentScene(scene, index)
    case 'mechanism': return generateMechanismScene(scene, index)
    case 'processFlow': return generateProcessFlowScene(scene, index)
    case 'finale': return generateFinaleScene(scene, index)
    default: return generateGenericVisualScene(scene, index)
  }
}
