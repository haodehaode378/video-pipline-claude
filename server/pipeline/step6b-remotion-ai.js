import { sendMessage } from '../ai/claude-client.js'
import { resolveStyleColors } from '../ai/prompts.js'
import { info, warn } from '../utils/logger.js'

/**
 * Generate a single Remotion/React scene component via AI.
 * Replaces the 9 hardcoded scene components in scene-components.js.
 */
export async function generateRemotionComponent(scene, visualPlanScene, index, styleDecision) {
  const sceneType = visualPlanScene?.sceneType || 'genericVisual'
  const heroObjects = visualPlanScene?.heroObjects || []
  const title = scene.title || scene.id || `Scene ${index + 1}`
  const narration = scene.narration || ''
  const duration = scene.duration || 8

  const system = [
    'You are a Remotion/React animation expert for educational video.',
    'Generate exactly one React function component using Remotion APIs.',
    'Use: AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate from "remotion".',
    'Import from "remotion" only.',
    'Return only the component code, no markdown fences.',
    'The component must accept { scene, index } props.',
    'Use inline React styles (style={{...}}), NO CSS imports or className.',
    `Scene type: ${sceneType}.`,
  ].join(' ')

  const heroLabels = heroObjects.map((o) => (typeof o === 'object' ? o.label : o)).join(', ')

  const user = `Generate a Remotion scene component:

Title: ${title}
Narration excerpt: ${String(narration).slice(0, 200)}
Duration: ${duration}s at 30fps (${Math.round(duration * 30)} frames)
Hero visual objects: ${heroLabels || 'generic shapes'}
Scene type: ${sceneType}

The component must:
- Import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
- Use <AbsoluteFill> as the root element with style={{ backgroundColor: '${styleDecision.bg || '#0d1117'}' }}
- Use useCurrentFrame() and useVideoConfig() for animation timing
- Use spring() for enter animations and interpolate() for progress-based effects
- Animate hero objects based on frame progress (enter, hold, exit phases)
- Include title text and visual elements matching the scene type
- Export as default: export default function Scene${index}({ scene, index }) { ... }

Color palette:
- Background: ${styleDecision.bg}
- Accent: ${styleDecision.accent}
- Text: ${styleDecision.text}

Return ONLY the React component code. No markdown fences.`

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await sendMessage(system, user, {
      maxTokens: 6000,
      temperature: 0.6,
    })

    if (result.error) {
      warn(`[Remotion] Scene ${index} attempt ${attempt}/3 AI error: ${result.error}`)
      continue
    }

    let code = result.text.trim()
    code = code.replace(/```[\w-]*\s*|```\s*/g, '').trim()

    if (!code.includes('function Scene') || !code.includes('useCurrentFrame')) {
      warn(`[Remotion] Scene ${index} attempt ${attempt}/3: missing required Remotion APIs`)
      continue
    }

    if (!code.includes('export default')) {
      if (code.includes('function Scene')) {
        code = code.replace(/function Scene/, 'export default function Scene')
      } else {
        warn(`[Remotion] Scene ${index} attempt ${attempt}/3: missing export`)
        continue
      }
    }

    info(`[Remotion] Scene ${index} generated successfully (attempt ${attempt}/3)`)
    return {
      component: code,
      sceneType,
      title,
      duration,
    }
  }

  // All AI attempts failed — generate a minimal generic component dynamically
  warn(`[Remotion] Scene ${index}: all AI attempts failed, using dynamic minimal component`)
  return generateMinimalComponent(index, title, duration, styleDecision)
}

/**
 * Dynamic minimal component — derived from style-decision, NOT hardcoded constants.
 */
function generateMinimalComponent(index, title, durationSec, style) {
  const totalFrames = Math.round((durationSec || 8) * 30)
  const bg = style.bg || '#0d1117'
  const accent = style.accent || '#58a6ff'
  const text = style.text || '#f0f6fc'

  return {
    component: `import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

export default function Scene${index}({ scene, index }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, 15, durationInFrames - 15, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  return (
    <AbsoluteFill style={{
      backgroundColor: "${bg}",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: 80,
      opacity: progress,
    }}>
      <h1 style={{
        color: "${text}",
        fontSize: 72,
        fontWeight: 800,
        textAlign: "center",
        transform: \`translateY(\${(1 - titleSpring) * 30}px)\`,
        opacity: titleSpring,
      }}>
        ${title.replace(/`/g, '\\`').replace(/\$/g, '\\$')}
      </h1>
      <div style={{
        marginTop: 48,
        width: 120,
        height: 4,
        backgroundColor: "${accent}",
        borderRadius: 2,
        transform: \`scaleX(\${titleSpring})\`,
      }} />
      <p style={{
        color: "${text}",
        fontSize: 32,
        opacity: 0.8,
        textAlign: "center",
        maxWidth: 800,
        marginTop: 40,
      }}>
        {scene?.narration?.slice(0, 100) || ""}
      </p>
    </AbsoluteFill>
  );
}
`,
    sceneType: 'genericVisual',
    title,
    duration: durationSec,
    source: 'dynamic-minimal',
  }
}

/**
 * Generate all Remotion components for an episode.
 */
export async function generateAllRemotionComponents(scenes, visualPlan, styleDecision, storyboardScenes) {
  const results = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const storyScene = storyboardScenes.find((s) => s.id === scene.id) || storyboardScenes[i] || {}
    const planScene = visualPlan?.scenes?.find((s) => s.id === scene.id) || visualPlan?.scenes?.[i] || {}

    const merged = {
      ...storyScene,
      ...scene,
      duration: scene.duration || storyScene.duration || 5,
    }

    const result = await generateRemotionComponent(merged, planScene, i, styleDecision)
    if (result.error) {
      warn(`[Remotion] Scene ${i} (${scene.id}): ${result.error}`)
      return { error: `Failed to generate component for scene ${i} (${scene.id}): ${result.error}`, partial: results }
    }
    results.push(result)
  }

  return { components: results }
}
