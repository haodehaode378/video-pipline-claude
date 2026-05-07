import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import VideoPlayer from './VideoPlayer'

describe('VideoPlayer', () => {
  it('renders video element when src is provided', () => {
    const { container } = render(<VideoPlayer src="/videos/test/video.mp4" />)
    const video = container.querySelector('video')
    expect(video).toBeTruthy()
  })

  it('shows placeholder when no src', () => {
    render(<VideoPlayer />)
    expect(screen.getByText('视频预览')).toBeTruthy()
  })

  it('shows placeholder for empty string src', () => {
    render(<VideoPlayer src="" />)
    expect(screen.getByText('视频预览')).toBeTruthy()
  })

  it('video element has controls attribute', () => {
    const { container } = render(<VideoPlayer src="/video.mp4" />)
    const video = container.querySelector('video')
    expect(video.hasAttribute('controls')).toBe(true)
  })
})
