import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'

const statusConfig = {
  pending: { label: '待生成', color: 'bg-gray-600' },
  running: { label: '生成中', color: 'bg-tech-500 animate-pulse' },
  research_completed: { label: '资料完成', color: 'bg-amber-500' },
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

function Thumbnail({ slug, status }) {
  const [imgOk, setImgOk] = useState(true)
  const src = `/videos/${slug}/snapshots/scene_01.png`

  if (status === 'completed' && imgOk) {
    return (
      <img
        src={src}
        alt=""
        className="aspect-video bg-gray-800 rounded-lg mb-3 object-cover"
        onError={() => setImgOk(false)}
      />
    )
  }

  return (
    <div className="aspect-video bg-gray-800 rounded-lg mb-3 flex items-center justify-center text-gray-600 text-sm">
      {status === 'running' ? '生成中...' : status === 'failed' ? '生成失败' : '暂无缩略图'}
    </div>
  )
}

export default function Dashboard() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEpisodes = useCallback(() => {
    setLoading(true)
    fetch('/api/episodes')
      .then((r) => r.json())
      .then(setEpisodes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchEpisodes, 0)
    return () => clearTimeout(timer)
  }, [fetchEpisodes])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">剧集总览</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchEpisodes}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
          <Link
            to="/create"
            className="bg-tech-600 hover:bg-tech-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            新建剧集
          </Link>
        </div>
      </div>

      {!loading && episodes.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">暂无剧集</p>
          <p>点击“新建剧集”开始第一条微课视频。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {episodes.map((ep) => (
            <Link
              key={ep.slug}
              to={`/episode/${ep.slug}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-tech-600 transition-colors group"
            >
              <Thumbnail slug={ep.slug} status={ep.status} />
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium group-hover:text-tech-400 transition-colors truncate">
                  {ep.title}
                </h3>
                <StatusBadge status={ep.status} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {ep.duration} 分钟
                {ep.createdAt && ` · ${new Date(ep.createdAt).toLocaleDateString()}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
