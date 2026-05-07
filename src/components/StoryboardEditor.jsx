import { useEffect, useMemo, useState } from 'react'

function normalizeScenes(storyboard) {
  const scenes = Array.isArray(storyboard) ? storyboard : storyboard?.scenes
  return (scenes || []).map((scene, index) => ({
    id: scene.id || `scene-${String(index + 1).padStart(2, '0')}`,
    title: scene.title || `镜头 ${index + 1}`,
    visual: scene.visual || '',
    narration: scene.narration || '',
    intent: scene.intent || '',
    minDuration: Number(scene.minDuration || 3),
    maxDuration: Number(scene.maxDuration || 8),
    animationHint: scene.animationHint || '',
  }))
}

function makeScene(index) {
  return {
    id: `scene-${String(index + 1).padStart(2, '0')}`,
    title: `镜头 ${index + 1}`,
    visual: '',
    narration: '',
    intent: '',
    minDuration: 3,
    maxDuration: 8,
    animationHint: '',
  }
}

function validateScenes(scenes) {
  if (scenes.length === 0) return '至少需要一个镜头'
  for (const scene of scenes) {
    if (!scene.visual.trim()) return `${scene.id} 缺少画面描述`
    if (!scene.narration.trim()) return `${scene.id} 缺少旁白`
    if (!Number.isFinite(Number(scene.minDuration)) || Number(scene.minDuration) <= 0) return `${scene.id} 最小时长无效`
    if (!Number.isFinite(Number(scene.maxDuration)) || Number(scene.maxDuration) < Number(scene.minDuration)) {
      return `${scene.id} 最大时长不能小于最小时长`
    }
  }
  return ''
}

export default function StoryboardEditor({ storyboard, slug, onSaved, onContinue }) {
  const initialScenes = useMemo(() => normalizeScenes(storyboard), [storyboard])
  const [scenes, setScenes] = useState(initialScenes)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setScenes(initialScenes)
  }, [initialScenes])

  const updateScene = (index, patch) => {
    setScenes((prev) => prev.map((scene, i) => (i === index ? { ...scene, ...patch } : scene)))
  }

  const moveScene = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= scenes.length) return
    setScenes((prev) => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  const save = async () => {
    const error = validateScenes(scenes)
    if (error) {
      setMessage(`错误：${error}`)
      return null
    }

    setSaving(true)
    setMessage('')
    try {
      const payload = { version: 1, scenes }
      const res = await fetch(`/api/episodes/${encodeURIComponent(slug)}/storyboard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      setMessage('已保存')
      if (onSaved) onSaved(data)
      return data
    } catch (err) {
      setMessage(`错误：${err.message}`)
      return null
    } finally {
      setSaving(false)
    }
  }

  const saveAndContinue = async () => {
    const saved = await save()
    if (saved && onContinue) onContinue()
  }

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-1">分镜编辑</h2>
          <p className="text-xs text-gray-600">修改旁白后会重新生成 TTS、时间轴和视频。</p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className={`text-xs ${message.startsWith('错误') ? 'text-red-400' : 'text-green-400'}`}>{message}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            {saving ? '保存中...' : '保存分镜'}
          </button>
          <button
            onClick={saveAndContinue}
            disabled={saving}
            className="bg-tech-600 hover:bg-tech-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            保存并继续生成
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {scenes.map((scene, index) => (
          <div key={`${scene.id}-${index}`} className="border border-gray-800 rounded-lg p-4 bg-gray-950">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <input
                  value={scene.id}
                  onChange={(e) => updateScene(index, { id: e.target.value })}
                  className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                />
                <input
                  value={scene.title}
                  onChange={(e) => updateScene(index, { title: e.target.value })}
                  className="w-56 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => moveScene(index, -1)} className="text-xs text-gray-400 hover:text-white">上移</button>
                <button onClick={() => moveScene(index, 1)} className="text-xs text-gray-400 hover:text-white">下移</button>
                <button
                  onClick={() => setScenes((prev) => prev.filter((_, i) => i !== index))}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  删除
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-gray-500">
                画面描述
                <textarea
                  value={scene.visual}
                  onChange={(e) => updateScene(index, { visual: e.target.value })}
                  rows={4}
                  className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 resize-y"
                />
              </label>
              <label className="text-xs text-gray-500">
                旁白
                <textarea
                  value={scene.narration}
                  onChange={(e) => updateScene(index, { narration: e.target.value })}
                  rows={4}
                  className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 resize-y"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
              <label className="text-xs text-gray-500 md:col-span-2">
                教学意图
                <input
                  value={scene.intent}
                  onChange={(e) => updateScene(index, { intent: e.target.value })}
                  className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
                />
              </label>
              <label className="text-xs text-gray-500">
                最小时长
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={scene.minDuration}
                  onChange={(e) => updateScene(index, { minDuration: Number(e.target.value) })}
                  className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
                />
              </label>
              <label className="text-xs text-gray-500">
                最大时长
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={scene.maxDuration}
                  onChange={(e) => updateScene(index, { maxDuration: Number(e.target.value) })}
                  className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
                />
              </label>
            </div>

            <label className="block text-xs text-gray-500 mt-3">
              动画提示
              <input
                value={scene.animationHint}
                onChange={(e) => updateScene(index, { animationHint: e.target.value })}
                className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
              />
            </label>
          </div>
        ))}
      </div>

      <button
        onClick={() => setScenes((prev) => [...prev, makeScene(prev.length)])}
        className="mt-4 border border-gray-700 hover:border-tech-500 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors"
      >
        新增镜头
      </button>
    </section>
  )
}
