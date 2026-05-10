import { describe, expect, it } from 'vitest'
import { step1ScriptInternals } from './step1-script.js'

const { parseStoryboard, stripJsonFence } = step1ScriptInternals

describe('step1 storyboard parsing', () => {
  it('strips MiniMax think tags before JSON parsing', () => {
    const text = `<think>The model reasons here.</think>
{
  "version": 1,
  "scenes": [
    {
      "id": "scene-01",
      "title": "标题",
      "visual": "中央标题与几何图形缓慢出现",
      "narration": "这是一句简短旁白。",
      "intent": "开场",
      "minDuration": 3,
      "maxDuration": 6,
      "animationHint": "淡入"
    }
  ]
}`

    expect(stripJsonFence(text).startsWith('{')).toBe(true)
    expect(parseStoryboard(text)).toHaveLength(1)
  })
})
