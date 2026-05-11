import { useState } from 'react'

const htmlTabs = [
  { key: 'html', label: 'HTML' },
  { key: 'css', label: 'CSS' },
  { key: 'js', label: 'JavaScript' },
]

function getRemotionTabs(code) {
  return (code.remotionComponents || []).map((component, index) => ({
    key: component.id || `scene-${index + 1}`,
    label: component.id || `Scene ${index + 1}`,
    value: component.component || '',
  }))
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                activeKey === t.key
                  ? 'bg-tech-500/20 text-tech-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
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
