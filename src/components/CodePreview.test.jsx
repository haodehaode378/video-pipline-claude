import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CodePreview from './CodePreview'

describe('CodePreview', () => {
  it('renders Remotion scene components', () => {
    render(
      <CodePreview
        slug="demo"
        code={{
          type: 'remotion',
          remotionComponents: [
            { id: 'scene-01', component: 'function SceneOne() { return <AbsoluteFill /> }' },
          ],
        }}
      />,
    )

    expect(screen.getByText('scene-01')).toBeTruthy()
    expect(screen.getByDisplayValue('function SceneOne() { return <AbsoluteFill /> }')).toBeTruthy()
  })
})
