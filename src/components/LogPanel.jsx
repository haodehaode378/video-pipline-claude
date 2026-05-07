export default function LogPanel({ logs = [] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
        运行日志
      </h3>
      <div className="h-48 overflow-y-auto space-y-1 font-mono">
        {logs.length > 0 ? (
          logs.map((line, i) => (
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
