import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SnapshotGallery from './SnapshotGallery'

describe('SnapshotGallery', () => {
  it('renders snapshot images for storyboard scenes', () => {
    render(
      <SnapshotGallery
        slug="demo-video"
        scenes={[
          { id: 'scene-01', title: '开场' },
          { id: 'scene-02', title: '结尾' },
        ]}
      />,
    )

    expect(screen.getByText('Remotion 截图')).toBeTruthy()
    expect(screen.getByText('2 张')).toBeTruthy()
    expect(screen.getByAltText('开场 截图').getAttribute('src')).toBe('/videos/demo-video/snapshots/scene_00.png')
    expect(screen.getByAltText('结尾 截图').getAttribute('src')).toBe('/videos/demo-video/snapshots/scene_01.png')
  })
})
