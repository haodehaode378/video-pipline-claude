import { describe, it, expect } from 'vitest'
import styleCheck from './style-check.js'

describe('styleCheck', () => {
  it('passes CSS without forbidden classes', () => {
    const css = '.scene { background: #1a1a2e; color: #fff; font-family: sans-serif; }'
    const result = styleCheck(css)
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('rejects rounded-* utilities', () => {
    const css = '.card { border-radius: 8px; } .box { rounded-lg: 1px; }'
    const result = styleCheck(css)
    expect(result.passed).toBe(false)
    expect(result.violations).toContain('rounded-lg')
  })

  it('rejects rounded-sm, md, lg, xl, 2xl, 3xl', () => {
    for (const size of ['sm', 'md', 'lg', 'xl', '2xl', '3xl']) {
      const result = styleCheck(`rounded-${size}`)
      expect(result.passed).toBe(false)
      expect(result.violations).toContain(`rounded-${size}`)
    }
  })

  it('rejects shadow-* utilities except shadow-none', () => {
    const result = styleCheck('.card { shadow-md: 1px; }')
    expect(result.passed).toBe(false)
    // regex /shadow-(?!none)/ matches the prefix "shadow-"
    expect(result.violations).toContain('shadow-')
  })

  it('allows shadow-none', () => {
    const result = styleCheck('shadow-none')
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('rejects bg-gradient-*', () => {
    const result = styleCheck('bg-gradient-to-r')
    expect(result.passed).toBe(false)
    expect(result.violations).toContain('bg-gradient-')
  })

  it('rejects opacity-10 through opacity-60', () => {
    const result = styleCheck('opacity-50')
    expect(result.passed).toBe(false)
    expect(result.violations).toContain('opacity-50')
  })

  it('rejects font-light, font-thin, font-normal', () => {
    const result = styleCheck('font-thin text')
    expect(result.passed).toBe(false)
    expect(result.violations).toContain('font-thin')
  })

  it('reports multiple violations', () => {
    const css = 'rounded-lg shadow-xl bg-gradient-to-r'
    const result = styleCheck(css)
    expect(result.passed).toBe(false)
    expect(result.violations).toContain('rounded-lg')
    expect(result.violations).toContain('shadow-')
    expect(result.violations).toContain('bg-gradient-')
    expect(result.violations).toHaveLength(3)
  })

  it('handles empty CSS', () => {
    const result = styleCheck('')
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })
})
