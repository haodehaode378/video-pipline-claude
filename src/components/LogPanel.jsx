import { useState, useEffect } from 'react'

export default function LogPanel({ logs = [], live = false }) {
  const [serverLogs, setServerLogs] = useState([])

  useEffect(() => {
    if (!live) return
    const fetchLogs = () => {
      fetch('/api/episodes/logs?limit=50')
        .then((r) => r.json())
        .then(setServerLogs)
        .catch(() => {})
    }
    fetchLogs()
    const timer = setInterval(fetchLogs, 5000)
    return () => clearInterval(timer)
  }, [live])

  const display = live ? serverLogs : logs

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
        {live ? '服务器日志' : '运行日志'}
      </h3>
      <div className="h-48 overflow-y-auto space-y-1 font-mono">
        {display.length > 0 ? (
          display.map((line, i) => (
            <p key={i} className="text-xs text-gray-500">
              {line}
            </p>
          ))
        ) : (
          <p className="text-xs text-gray-600">暂无日志</p>
        )}
      </div>
    </div>
  )
}
