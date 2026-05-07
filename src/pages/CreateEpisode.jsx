import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const MODE_SINGLE = 'single'
const MODE_BATCH = 'batch'

export default function CreateEpisode() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(MODE_SINGLE)
  const [topic, setTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [sourceMaterial, setSourceMaterial] = useState('')
  const [duration, setDuration] = useState(3)
  const [template, setTemplate] = useState('')
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [batchTopics, setBatchTopics] = useState('')
  const [batchProgress, setBatchProgress] = useState(null)

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => setTemplates(data || []))
      .catch(() => setTemplates([]))
  }, [])

  const createEpisode = async (title) => {
    const res = await fetch('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        keywords,
        duration,
        template,
        sourceMaterial,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '创建失败')
    }
    return res.json()
  }

  const startResearch = async (slug) => {
    const res = await fetch(`/api/episodes/${encodeURIComponent(slug)}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '资料收集启动失败')
    }
  }

  const handleSingleSubmit = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    setError('')

    try {
      const episode = await createEpisode(topic.trim())
      await startResearch(episode.slug)
      navigate(`/episode/${episode.slug}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchSubmit = async () => {
    const titles = batchTopics
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)

    if (titles.length === 0) return

    setLoading(true)
    setError('')
    setBatchProgress({ total: titles.length, done: 0, ok: 0, fail: 0, slugs: [] })

    let ok = 0
    let fail = 0
    const slugs = []

    for (let i = 0; i < titles.length; i++) {
      try {
        const episode = await createEpisode(titles[i])
        await startResearch(episode.slug)
        ok++
        slugs.push(episode.slug)
      } catch {
        fail++
      }
      setBatchProgress({ total: titles.length, done: i + 1, ok, fail, slugs: [...slugs] })
    }

    setLoading(false)
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">新建剧集</h1>

      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setMode(MODE_SINGLE)}
          className={`px-4 py-1.5 rounded text-sm transition-colors ${
            mode === MODE_SINGLE ? 'bg-tech-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          单个生成
        </button>
        <button
          onClick={() => setMode(MODE_BATCH)}
          className={`px-4 py-1.5 rounded text-sm transition-colors ${
            mode === MODE_BATCH ? 'bg-tech-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          批量生成
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {mode === MODE_SINGLE ? (
          <form onSubmit={handleSingleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1">主题标题</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：栈和队列"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-tech-500 transition-colors"
                required
              />
            </div>

            <SharedFields
              keywords={keywords}
              setKeywords={setKeywords}
              sourceMaterial={sourceMaterial}
              setSourceMaterial={setSourceMaterial}
              duration={duration}
              setDuration={setDuration}
              template={template}
              setTemplate={setTemplate}
              templates={templates}
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-tech-600 hover:bg-tech-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? '创建并收集资料中...' : '开始收集资料'}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1">批量主题，每行一个</label>
              <textarea
                value={batchTopics}
                onChange={(e) => setBatchTopics(e.target.value)}
                placeholder={'栈和队列\n二叉树遍历\n图的 BFS 和 DFS\n快速排序原理'}
                rows={8}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-tech-500 transition-colors resize-y"
              />
              <p className="text-xs text-gray-600 mt-1">
                {batchTopics.split('\n').filter((t) => t.trim()).length} 个主题
              </p>
            </div>

            <SharedFields
              keywords={keywords}
              setKeywords={setKeywords}
              sourceMaterial={sourceMaterial}
              setSourceMaterial={setSourceMaterial}
              duration={duration}
              setDuration={setDuration}
              template={template}
              setTemplate={setTemplate}
              templates={templates}
            />

            <button
              onClick={handleBatchSubmit}
              disabled={loading}
              className="bg-tech-600 hover:bg-tech-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? '批量收集资料中...' : '批量开始'}
            </button>

            {batchProgress && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-tech-500 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400">
                    {batchProgress.done}/{batchProgress.total}
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>成功 {batchProgress.ok}</span>
                  <span>失败 {batchProgress.fail}</span>
                </div>
                {batchProgress.slugs.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">已创建剧集</p>
                    {batchProgress.slugs.map((s, i) => (
                      <Link
                        key={s}
                        to={`/episode/${s}`}
                        className="block text-sm text-tech-400 hover:text-tech-300 transition-colors"
                      >
                        #{i + 1} {s}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SharedFields({
  keywords,
  setKeywords,
  sourceMaterial,
  setSourceMaterial,
  duration,
  setDuration,
  template,
  setTemplate,
  templates,
}) {
  return (
    <>
      <div>
        <label className="block text-sm text-gray-400 mb-1">知识点关键词</label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="栈、队列、FIFO、LIFO，用逗号分隔"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-tech-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">补充素材</label>
        <textarea
          value={sourceMaterial}
          onChange={(e) => setSourceMaterial(e.target.value)}
          placeholder="可粘贴课程要求、参考文本、必须覆盖的知识点。留空则主要依赖搜索资料。"
          rows={4}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-tech-500 transition-colors resize-y"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">目标时长：{duration} 分钟</label>
        <input
          type="range"
          min="1"
          max="10"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full accent-tech-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">视觉风格</label>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-tech-500 transition-colors"
        >
          <option value="">使用全局默认</option>
          {templates.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2">
          {template
            ? templates.find((t) => t.slug === template)?.description || '已选择单集风格'
            : '未选择单集风格时，生成会使用风格配置页里的全局默认。'}
        </p>
      </div>
    </>
  )
}
