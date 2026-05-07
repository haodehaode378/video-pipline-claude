import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import TimelinePreview from './TimelinePreview'

describe('TimelinePreview', () => {
  it('renders audio calibrated durations', () => {
    render(
      <TimelinePreview
        timeline={{
          totalDuration: 7.5,
          scenes: [
            { id: 'scene-01', title: '开场', start: 0, audioDuration: 4.2, duration: 4.5, overMax: false },
            { id: 'scene-02', title: '总结', start: 4.5, audioDuration: 2.1, duration: 3, overMax: true },
          ],
          warnings: ['scene-02 too long'],
        }}
      />,
    )

    expect(screen.getByText('音频校准时间轴')).toBeTruthy()
    expect(screen.getByText('开场')).toBeTruthy()
    expect(screen.getByText('4.2s')).toBeTruthy()
    expect(screen.getByText('超过建议最大时长')).toBeTruthy()
  })

  it('renders nothing without scenes', () => {
    const { container } = render(<TimelinePreview timeline={{ scenes: [] }} />)
    expect(container.firstChild).toBeNull()
  })
})
