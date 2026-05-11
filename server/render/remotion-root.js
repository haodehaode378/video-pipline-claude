export function buildRootJsx(scenes, styleConfig = {}) {
  const { colors = {}, fonts = {} } = styleConfig
  const bg = colors.background || '#1a1a2e'
  const accent = colors.accent || '#e94560'
  const font = fonts.body || 'sans-serif'

  const renamedComponents = scenes.map((sc, i) =>
    sc.component.replace(/function \w+/, `function SceneComponent${i}`),
  )

  return `import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, Composition } from 'remotion'

const SCENES = ${JSON.stringify(scenes, null, 2)}

const STYLE = {
  bg: '${bg}',
  accent: '${accent}',
  font: '${font}',
}

${renamedComponents.join('\n\n')}

const sceneComponents = [
${scenes.map((sc, i) => `  generateScene${i}(SCENES[${i}])`).join(',\n')}
]

${scenes
    .map((sc, i) => {
      const chartArg = sc.props?.chartData !== undefined ? ' chartData={scene.props?.chartData}' : ''
      return `
function generateScene${i}(scene) {
  return <SceneComponent${i} scene={scene.props?.scene || scene}${chartArg} />
}`
    })
    .join('\n')}

const totalDuration = ${scenes.reduce((s, c) => s + (c.duration || 5), 0)}

export function VideoComposition() {
  const frame = useCurrentFrame()
  const currentTime = frame / 30

  const activeIndex = SCENES.findIndex((s, i) => {
    const start = SCENES.slice(0, i).reduce((a, c) => a + (c.duration || 5), 0)
    return currentTime >= start && currentTime < start + (s.duration || 5)
  })
  if (activeIndex === -1) return null

  return sceneComponents[activeIndex]
}

export const compositions = [
  <Composition
    key="main"
    id="MainVideo"
    component={VideoComposition}
    durationInFrames={${Math.round(scenes.reduce((s, c) => s + (c.duration || 5), 0) * 30)}}
    fps={30}
    width={1920}
    height={1080}
  />,
]
`
}
