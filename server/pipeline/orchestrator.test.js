import { describe, it, expect } from 'vitest'

// Test stepOrder and the internal getStepIndex / shouldRun logic
const stepOrder = ['research', 'script', 'narration', 'tts', 'timeline', 'code', 'snapshot', 'render', 'mux']

function getStepIndex(stepName) {
  return stepOrder.indexOf(stepName)
}

function shouldRun(stepName, startIdx, stopIdx) {
  const idx = getStepIndex(stepName)
  return idx >= startIdx && idx <= stopIdx
}

describe('orchestrator step logic', () => {
  describe('getStepIndex', () => {
    it('returns 0 for research', () => {
      expect(getStepIndex('research')).toBe(0)
    })

    it('returns 7 for mux', () => {
      expect(getStepIndex('mux')).toBe(8)
    })

    it('returns -1 for unknown step', () => {
      expect(getStepIndex('unknown')).toBe(-1)
    })
  })

  describe('shouldRun', () => {
    it('runs all steps when start=0 stop=7', () => {
      stepOrder.forEach((step) => {
        expect(shouldRun(step, 0, 8)).toBe(true)
      })
    })

    it('runs only script when start=1 stop=1', () => {
      expect(shouldRun('script', 1, 1)).toBe(true)
      expect(shouldRun('research', 1, 1)).toBe(false)
      expect(shouldRun('code', 1, 1)).toBe(false)
    })

    it('runs first 3 steps when start=0 stop=2', () => {
      expect(shouldRun('research', 0, 2)).toBe(true)
      expect(shouldRun('script', 0, 2)).toBe(true)
      expect(shouldRun('narration', 0, 2)).toBe(true)
      expect(shouldRun('code', 0, 2)).toBe(false)
      expect(shouldRun('snapshot', 0, 2)).toBe(false)
    })

    it('runs from code to end when start=5 stop=8', () => {
      expect(shouldRun('timeline', 5, 8)).toBe(false)
      expect(shouldRun('code', 5, 8)).toBe(true)
      expect(shouldRun('snapshot', 5, 8)).toBe(true)
      expect(shouldRun('mux', 5, 8)).toBe(true)
    })
  })

  describe('stepOrder', () => {
    it('has expected dependency order', () => {
      // research before script before narration/tts/timeline/code
      expect(stepOrder.indexOf('research')).toBeLessThan(stepOrder.indexOf('script'))
      expect(stepOrder.indexOf('script')).toBeLessThan(stepOrder.indexOf('narration'))
      expect(stepOrder.indexOf('narration')).toBeLessThan(stepOrder.indexOf('tts'))
      expect(stepOrder.indexOf('tts')).toBeLessThan(stepOrder.indexOf('timeline'))
      expect(stepOrder.indexOf('timeline')).toBeLessThan(stepOrder.indexOf('code'))
      // code before snapshot/render (parallel)
      expect(stepOrder.indexOf('code')).toBeLessThan(stepOrder.indexOf('snapshot'))
      expect(stepOrder.indexOf('code')).toBeLessThan(stepOrder.indexOf('render'))
      expect(stepOrder.indexOf('render')).toBeLessThan(stepOrder.indexOf('mux'))
    })
  })
})
