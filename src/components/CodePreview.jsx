import { useState } from 'react'

const htmlTabs = [
  { key: 'html', label: 'HTML' },
  { key: 'css', label: 'CSS' },
  { key: 'js', label: 'JavaScript' },
]

function sceneLabel(planScene) {
  if (!planScene) return ''
  const object = planScene.heroObjects?.[0]?.type || planScene.supportingObjects?.[0]?.type || ''
  return [planScene.sceneType, object].filter(Boolean).join(' · ')
}

function getVisualPlanScene(code, component, index) {
  const scenes = code.visualPlan?.scenes || []
  return scenes.find((scene) => scene.id === component.id) || scenes[index] || null
}

function getRemotionTabs(code) {
  return (code.remotionComponents || []).map((component, index) => {
    const planScene = getVisualPlanScene(code, component, index)
    const suffix = sceneLabel(planScene)
    return {
      key: component.id || `scene-${index + 1}`,
      label: suffix ? `${component.id || `scene-${index + 1}`} · ${suffix}` : component.id || `Scene ${index + 1}`,
      value: component.component || '',
      planScene,
    }
  })
}

function VisualPlanSummary({ scenes = [], activeKey, onSelect }) {
  if (!scenes.length) return null

  return (
    <div className="mb-4 grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">视觉方案</h3>
        <span className="text-xs text-gray-600">{scenes.length} 个场景</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {scenes.map((scene, index) => {
          const key = scene.id || `scene-${index + 1}`
          const active = key === activeKey
          const heroObjects = (scene.heroObjects || []).map((item) => item.type).join(', ') || 'genericBadge'
          const avoided = (scene.avoidObjects || []).join(', ')
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`text-left border rounded-lg p-3 transition-colors ${
                active
                  ? 'border-tech-500/70 bg-tech-500/10'
                  : 'border-gray-800 bg-gray-950/70 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-gray-300">{key}</span>
                <span className="text-[11px] text-tech-300">{scene.sceneType || 'genericVisual'}</span>
              </div>
              <div className="text-[11px] text-gray-500 mb-1">{scene.visualDomain || 'general'}</div>
              <div className="text-xs text-gray-300 truncate" title={heroObjects}>
                {heroObjects}
              </div>
              {avoided && (
                <div className="mt-1 text-[11px] text-red-300/80 truncate" title={avoided}>
                  avoid: {avoided}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CodePreview({ code, slug, onSaved }) {
  const [active, setActive] = useState('html')
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  if (!code) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-2">代码预览</h3>
        <p className="text-gray-600 text-sm">代码尚未生成</p>
      </div>
    )
  }

  const isRemotion = code.type === 'remotion' || Array.isArray(code.remotionComponents)
  const tabs = isRemotion ? getRemotionTabs(code) : htmlTabs
  const activeKey = tabs.some((t) => t.key === active) ? active : tabs[0]?.key
  const currentTab = tabs.find((t) => t.key === activeKey)
  const current = editing[activeKey] ?? (isRemotion ? currentTab?.value : code[activeKey]) ?? ''
  const visualScenes = isRemotion && Array.isArray(code.visualPlan?.scenes) ? code.visualPlan.scenes : []

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const updated = isRemotion
        ? {
            ...code,
            remotionComponents: (code.remotionComponents || []).map((component, index) => {
              const key = component.id || `scene-${index + 1}`
              return editing[key] === undefined ? component : { ...component, component: editing[key] }
            }),
          }
        : { ...code, ...editing }
      const res = await fetch(`/api/episodes/${encodeURIComponent(slug)}/code`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '保存失败')
      }
      setMsg('已保存')
      const savedEpisode = await res.json()
      if (onSaved) onSaved(savedEpisode.codeContent || updated, savedEpisode)
    } catch (err) {
      setMsg(`错误：${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <VisualPlanSummary
        scenes={visualScenes}
        activeKey={activeKey}
        onSelect={(key) => setActive(key)}
      />

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`shrink-0 px-3 py-1 rounded text-xs transition-colors ${
                activeKey === t.key
                  ? 'bg-tech-500/20 text-tech-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {msg && <span className={`text-xs ${msg.startsWith('错误') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-tech-600 hover:bg-tech-500 disabled:opacity-50 text-white px-3 py-1 rounded text-xs transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      <textarea
        className="w-full h-64 bg-gray-950 border border-gray-700 rounded-lg p-3 font-mono text-xs text-gray-300 resize-y focus:outline-none focus:border-tech-500"
        value={current}
        onChange={(e) => setEditing({ ...editing, [activeKey]: e.target.value })}
        spellCheck={false}
      />
    </div>
  )
}
