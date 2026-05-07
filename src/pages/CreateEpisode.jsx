import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const templates = [
  { id: 'linear', label: '线性结构', desc: '数组、链表、栈、队列' },
  { id: 'tree', label: '树结构', desc: '二叉树、堆、BST、AVL' },
  { id: 'graph', label: '图结构', desc: 'BFS/DFS、最短路径' },
  { id: 'sort', label: '排序与查找', desc: '快排、归并、二分查找' },
]

export default function CreateEpisode() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [duration, setDuration] = useState(3)
  const [template, setTemplate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: topic.trim(), keywords, duration, template }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '创建失败')
      }

      const episode = await res.json()
      navigate(`/episode/${episode.slug}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">新建剧集</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1">主题标题</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="如：栈和队列"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-tech-500 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">知识点关键词</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="栈、队列、FIFO、LIFO（逗号分隔）"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-tech-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            目标时长：{duration} 分钟
          </label>
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
          <label className="block text-sm text-gray-400 mb-2">预设模板</label>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTemplate(t.id)}
                className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                  template === t.id
                    ? 'border-tech-500 bg-tech-500/10'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-900'
                }`}
              >
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-tech-600 hover:bg-tech-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {loading ? '创建中...' : '开始生成'}
        </button>
      </form>
    </div>
  )
}
