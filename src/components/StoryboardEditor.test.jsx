import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import StoryboardEditor from './StoryboardEditor'

const storyboard = {
  version: 1,
  scenes: [
    {
      id: 'scene-01',
      title: '开场',
      visual: '显示标题',
      narration: '这是开场旁白。',
      intent: '吸引注意',
      minDuration: 3,
      maxDuration: 8,
      animationHint: '淡入',
    },
  ],
}

const originalFetch = global.fetch

describe('StoryboardEditor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('renders editable storyboard fields', () => {
    render(<StoryboardEditor storyboard={storyboard} slug="demo" />)
    expect(screen.getByDisplayValue('scene-01')).toBeTruthy()
    expect(screen.getByDisplayValue('显示标题')).toBeTruthy()
    expect(screen.getByDisplayValue('这是开场旁白。')).toBeTruthy()
  })

  it('saves edited storyboard', async () => {
    const onSaved = vi.fn()
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ slug: 'demo', storyboardContent: storyboard }),
    }))

    render(<StoryboardEditor storyboard={storyboard} slug="demo" onSaved={onSaved} />)
    fireEvent.change(screen.getByDisplayValue('显示标题'), { target: { value: '显示流程图' } })
    fireEvent.click(screen.getByText('保存分镜'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, options] = global.fetch.mock.calls[0]
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body).scenes[0].visual).toBe('显示流程图')
    expect(onSaved).toHaveBeenCalled()
  })

  it('validates required narration before saving', () => {
    global.fetch = vi.fn()
    render(<StoryboardEditor storyboard={storyboard} slug="demo" />)
    fireEvent.change(screen.getByDisplayValue('这是开场旁白。'), { target: { value: '' } })
    fireEvent.click(screen.getByText('保存分镜'))
    expect(screen.getByText(/缺少旁白/)).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
