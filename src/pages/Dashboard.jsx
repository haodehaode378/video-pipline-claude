import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const statusConfig = {
  pending: { label: '待生成', color: 'bg-gray-600' },
  running: { label: '生成中', color: 'bg-tech-500 animate-pulse' },
  completed: { label: '已完成', color: 'bg-green-500' },
  failed: { label: '失败', color: 'bg-red-500' },
}

function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig.pending
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export default function Dashboard() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/episodes')
      .then((r) => r.json())
      .then(setEpisodes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">剧集总览</h1>
        <Link
          to="/create"
          className="bg-tech-600 hover:bg-tech-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + 新建剧集
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">加载中...</div>
      ) : episodes.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">暂无剧集</p>
          <p>点击「新建剧集」开始你的第一条微课视频</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {episodes.map((ep) => (
            <Link
              key={ep.slug}
              to={`/episode/${ep.slug}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-tech-600 transition-colors"
            >
              <div className="aspect-video bg-gray-800 rounded-lg mb-3 flex items-center justify-center text-gray-600 text-sm">
                {ep.status === 'completed' ? '▶ 点击查看' : '缩略图'}
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{ep.title}</h3>
                <StatusBadge status={ep.status} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{ep.duration} 分钟</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
