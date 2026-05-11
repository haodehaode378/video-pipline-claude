import { useState, useEffect } from 'react'

const defaultConfig = {
  template: '',
  colors: { background: '#1a1a2e', card: '#16213e', accent: '#e94560', text: '#ffffff', code: '#f0f0f0' },
  fonts: { body: 'sans-serif', code: "'Fira Code', monospace" },
  animation: 'minimal',
  tts: { voice: 'general', speed: 1.0 },
}

const animationOptions = [
  { value: 'minimal', label: '简洁', desc: '克制清晰，适合严肃教学' },
  { value: 'moderate', label: '适中', desc: '适度丰富，突出重点' },
  { value: 'rich', label: '丰富', desc: '更强动效，强调视觉吸引力' },
]

const voiceOptions = [
  { value: 'general', label: '通用' },
  { value: 'male-qn-qingse', label: '青年男声' },
  { value: 'female-shaonv', label: '少女女声' },
  { value: 'male-qn-jingying', label: '精英男声' },
  { value: 'presenter_male', label: '男主持人' },
  { value: 'presenter_female', label: '女主持人' },
]

export default function StyleConfig() {
  const [config, setConfig] = useState(defaultConfig)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    Promise.all([
      fetch('/api/episodes/style-config').then((r) => r.json()),
      fetch('/api/templates').then((r) => r.json()),
    ])
      .then(([c, t]) => {
        if (c && c.colors) setConfig((prev) => ({ ...prev, ...c }))
        setTemplates(t || [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/episodes/style-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('保存失败')
      setMsg('已保存')
    } catch (err) {
      setMsg(`错误：${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const updateColor = (key, value) => setConfig((c) => ({ ...c, colors: { ...c.colors, [key]: value } }))
  const updateFont = (key, value) => setConfig((c) => ({ ...c, fonts: { ...c.fonts, [key]: value } }))
  const updateTTS = (key, value) => setConfig((c) => ({ ...c, tts: { ...c.tts, [key]: value } }))

  if (!loaded) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold mb-6">风格配置</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">风格配置</h1>
          <p className="text-sm text-gray-500">设置全局默认风格。单集未选择风格时会使用这里的配置。</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.startsWith('错误') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-tech-600 hover:bg-tech-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-300 mb-1">视觉风格</h2>
        <p className="text-xs text-gray-500 mb-2">
          视觉风格现在由 AI 在代码生成前自动选择。AI 会分析话题内容并自主决定配色、字体、动画等参数。
          下方的配色方案作为 AI 风格决策的兜底参考，当 AI 风格选择不可用时使用。
        </p>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-300 mb-4">配色方案</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'background', label: '背景色' },
            { key: 'card', label: '卡片色' },
            { key: 'accent', label: '强调色' },
            { key: 'text', label: '文字色' },
            { key: 'code', label: '代码文字色' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-xs text-gray-400 w-20">{label}</label>
              <input
                type="color"
                value={config.colors[key] || '#000000'}
                onChange={(e) => updateColor(key, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-700"
              />
              <input
                type="text"
                value={config.colors[key] || ''}
                onChange={(e) => updateColor(key, e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 font-mono"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-300 mb-4">字体</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">正文字体</label>
            <input
              type="text"
              value={config.fonts.body || ''}
              onChange={(e) => updateFont('body', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
              placeholder="sans-serif"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">代码字体</label>
            <input
              type="text"
              value={config.fonts.code || ''}
              onChange={(e) => updateFont('code', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
              placeholder="monospace"
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-300 mb-4">动画风格</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {animationOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setConfig((c) => ({ ...c, animation: opt.value }))}
              className={`p-3 rounded-lg border text-sm transition-colors ${
                config.animation === opt.value
                  ? 'border-tech-500 bg-tech-500/10 text-tech-400'
                  : 'border-gray-700 hover:border-gray-600 text-gray-400'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-300 mb-4">TTS 语音</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">音色</label>
            <select
              value={config.tts.voice || 'general'}
              onChange={(e) => updateTTS('voice', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
            >
              {voiceOptions.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">语速：{config.tts.speed?.toFixed(1) || '1.0'}x</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={config.tts.speed || 1.0}
              onChange={(e) => updateTTS('speed', parseFloat(e.target.value))}
              className="w-full accent-tech-500"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>0.5x</span><span>1.0x</span><span>2.0x</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
