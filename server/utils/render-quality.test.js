import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Test the exported inspectRenderQuality with a mock page
describe('render-quality', () => {
  let mod

  beforeAll(async () => {
    mod = await import('./render-quality.js')
  })

  it('detects when seek does not switch scenes', async () => {
    const scenes = [
      { start: 0, duration: 10 },
      { start: 10, duration: 10 },
    ]
    const page = {
      evaluate: async (fn) => {
        if (typeof fn === 'function') {
          return {
            visibleScenes: [{ id: 's1', start: '0', text: 'Same', rect: { width: 1920, height: 1080 } }],
            bodyText: 'Same',
          }
        }
        return null
      },
      screenshot: async () => Buffer.alloc(1000, 65),
    }

    const result = await mod.inspectRenderQuality(page, scenes)
    expect(result.passed).toBe(false)
    expect(result.errors.some((e) => e.includes('seek does not switch'))).toBe(true)
  })

  it('detects empty text in scenes', async () => {
    const scenes = [{ start: 0, duration: 5 }]
    const page = {
      evaluate: async (fn) => {
        if (typeof fn === 'function') {
          return {
            visibleScenes: [{ id: 's1', start: '0', text: '', rect: { width: 1920, height: 1080 } }],
            bodyText: '',
          }
        }
        return null
      },
      screenshot: async () => Buffer.alloc(500, 66),
    }

    const result = await mod.inspectRenderQuality(page, scenes)
    expect(result.passed).toBe(false)
    expect(result.errors.some((e) => e.includes('has no visible text'))).toBe(true)
  })

  it('passes with distinct scenes and varying screenshots', async () => {
    const scenes = [
      { start: 0, duration: 5 },
      { start: 5, duration: 5 },
    ]
    let call = 0
    const page = {
      evaluate: async (fn) => {
        if (typeof fn === 'function') {
          call++
          return {
            visibleScenes: [{ id: `s${call}`, start: `${(call - 1) * 5}`, text: `Scene ${call} content here`, rect: { width: 1920, height: 1080 } }],
            bodyText: `Body ${call} different text`,
          }
        }
        return null
      },
      screenshot: async () => Buffer.from(Array(1000).fill(call * 50)),
    }

    const result = await mod.inspectRenderQuality(page, scenes, { minTextChanges: 1 })
    expect(result.passed).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
