import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CodePreview from './CodePreview'

const originalFetch = global.fetch

describe('CodePreview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('renders Remotion scene components with visual plan context', () => {
    render(
      <CodePreview
        slug="demo"
        code={{
          type: 'remotion',
          visualPlan: {
            scenes: [{
              id: 'scene-01',
              sceneType: 'openingHook',
              visualDomain: 'consumer_electronics',
              heroObjects: [{ type: 'headphones' }, { type: 'audioWaves' }],
              avoidObjects: ['sodaCan', 'drinkCup'],
            }],
          },
          remotionComponents: [
            { id: 'scene-01', component: 'function SceneOne() { return <AbsoluteFill /> }' },
          ],
        }}
      />,
    )

    expect(screen.getByText('视觉方案')).toBeTruthy()
    expect(screen.getByText('scene-01 · openingHook · headphones')).toBeTruthy()
    expect(screen.getByText('consumer_electronics')).toBeTruthy()
    expect(screen.getByText('headphones, audioWaves')).toBeTruthy()
    expect(screen.getByText('avoid: sodaCan, drinkCup')).toBeTruthy()
    expect(screen.getByDisplayValue('function SceneOne() { return <AbsoluteFill /> }')).toBeTruthy()
  })

  it('selects the matching component when a visual plan card is clicked', () => {
    render(
      <CodePreview
        slug="demo"
        code={{
          type: 'remotion',
          visualPlan: {
            scenes: [
              { id: 'scene-01', sceneType: 'openingHook', heroObjects: [{ type: 'headphones' }] },
              { id: 'scene-02', sceneType: 'comparison', heroObjects: [{ type: 'chip' }] },
            ],
          },
          remotionComponents: [
            { id: 'scene-01', component: 'function SceneOne() { return null }' },
            { id: 'scene-02', component: 'function SceneTwo() { return null }' },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByText('scene-02'))
    expect(screen.getByDisplayValue('function SceneTwo() { return null }')).toBeTruthy()
  })

  it('saves Remotion code with an encoded slug, visual plan, and backend response', async () => {
    const onSaved = vi.fn()
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        slug: '武汉科技大学-mp0m08ml',
        codeContent: {
          type: 'remotion',
          visualPlan: {
            scenes: [{ id: 'scene-01', sceneType: 'openingHook', heroObjects: [{ type: 'schoolGate' }] }],
          },
          remotionComponents: [
            { id: 'scene-01', component: 'function SceneOne() { return null }' },
          ],
        },
      }),
    }))

    render(
      <CodePreview
        slug="武汉科技大学-mp0m08ml"
        code={{
          type: 'remotion',
          visualPlan: {
            scenes: [{ id: 'scene-01', sceneType: 'openingHook', heroObjects: [{ type: 'schoolGate' }] }],
          },
          remotionComponents: [
            { id: 'scene-01', component: 'function SceneOne() { return <AbsoluteFill /> }' },
          ],
        }}
        onSaved={onSaved}
      />,
    )

    fireEvent.change(screen.getByDisplayValue('function SceneOne() { return <AbsoluteFill /> }'), {
      target: { value: 'function SceneOne() { return null }' },
    })
    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch.mock.calls[0][0]).toBe('/api/episodes/%E6%AD%A6%E6%B1%89%E7%A7%91%E6%8A%80%E5%A4%A7%E5%AD%A6-mp0m08ml/code')

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.remotionComponents[0].component).toBe('function SceneOne() { return null }')
    expect(body.visualPlan.scenes[0].heroObjects[0].type).toBe('schoolGate')
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'remotion' }),
      expect.objectContaining({ slug: '武汉科技大学-mp0m08ml' }),
    )
  })

  it('shows backend save errors', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'remotionComponents[0].component is required' }),
    }))

    render(
      <CodePreview
        slug="demo"
        code={{
          type: 'remotion',
          remotionComponents: [
            { id: 'scene-01', component: 'function SceneOne() { return null }' },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByText('保存'))

    expect(await screen.findByText('错误：remotionComponents[0].component is required')).toBeTruthy()
  })
})
