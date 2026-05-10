export default function SubtitlePreview({ subtitles }) {
  if (!subtitles || !subtitles.segments || subtitles.segments.length === 0) return null

  const { segments, language } = subtitles

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white">
        字幕预览
        {language && (
          <span className="ml-2 text-xs font-normal text-gray-400">({language})</span>
        )}
        <span className="ml-2 text-xs font-normal text-gray-500">{segments.length} 条</span>
      </h3>
      <div className="bg-gray-800/50 rounded-lg p-4 max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-left border-b border-gray-700">
              <th className="py-1 pr-3 w-16">#</th>
              <th className="py-1 pr-3 w-28">时间</th>
              <th className="py-1">字幕</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-1 pr-3 text-gray-500 font-mono text-xs">{i + 1}</td>
                <td className="py-1 pr-3 text-gray-400 font-mono text-xs">
                  {formatTime(seg.start)} → {formatTime(seg.end)}
                </td>
                <td className="py-1 text-gray-200">{seg.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1)
  return `${m}:${s.padStart(4, '0')}`
}
