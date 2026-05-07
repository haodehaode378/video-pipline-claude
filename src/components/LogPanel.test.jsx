import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LogPanel from './LogPanel'

describe('LogPanel', () => {
  it('renders log entries', () => {
    const logs = ['[INFO] Step 1 started', '[INFO] Step 1 completed']
    render(<LogPanel logs={logs} />)
    expect(screen.getByText('[INFO] Step 1 started')).toBeTruthy()
    expect(screen.getByText('[INFO] Step 1 completed')).toBeTruthy()
  })

  it('shows empty state when no logs', () => {
    render(<LogPanel logs={[]} />)
    expect(screen.getByText('暂无日志')).toBeTruthy()
  })

  it('shows 运行日志 header by default', () => {
    render(<LogPanel logs={['test']} />)
    expect(screen.getByText('运行日志')).toBeTruthy()
  })

  it('shows 服务器日志 header when live=true', () => {
    render(<LogPanel live={true} />)
    expect(screen.getByText('服务器日志')).toBeTruthy()
  })

  it('renders with default logs (empty)', () => {
    const { container } = render(<LogPanel />)
    expect(container).toBeTruthy()
    expect(screen.getByText('暂无日志')).toBeTruthy()
  })
})
