import { describe, expect, it } from 'vitest'
import { buildTimeline } from './step-timeline.js'

describe('buildTimeline', () => {
  it('uses real audio duration plus padding as scene duration', () => {
    const timeline = buildTimeline([
      { id: 'scene-01', narration: 'A', visual: 'V', audioDuration: 4.2, minDuration: 3, maxDuration: 8 },
      { id: 'scene-02', narration: 'B', visual: 'V', audioDuration: 2.1, minDuration: 3, maxDuration: 8 },
    ])

    expect(timeline.scenes[0].start).toBe(0)
    expect(timeline.scenes[0].duration).toBe(4.5)
    expect(timeline.scenes[1].start).toBe(4.5)
    expect(timeline.scenes[1].duration).toBe(3)
    expect(timeline.totalDuration).toBe(7.5)
  })

  it('marks overMax but does not shrink audio-driven duration', () => {
    const timeline = buildTimeline([
      { id: 'scene-01', narration: 'A', visual: 'V', audioDuration: 9, minDuration: 3, maxDuration: 5 },
    ])

    expect(timeline.scenes[0].duration).toBe(9.3)
    expect(timeline.scenes[0].overMax).toBe(true)
    expect(timeline.warnings[0]).toContain('scene-01')
  })
})
