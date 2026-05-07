export default function TimelinePreview({ timeline }) {
  const scenes = timeline?.scenes || []

  if (scenes.length === 0) {
    return null
  }

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-1">音频校准时间轴</h2>
          <p className="text-xs text-gray-600">总时长 {Number(timeline.totalDuration || 0).toFixed(1)} 秒，画面按真实 TTS 时长拉长。</p>
        </div>
      </div>

      {timeline.warnings?.length > 0 && (
        <div className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          {timeline.warnings.join('；')}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="py-2 pr-3 text-left font-medium">镜头</th>
              <th className="py-2 pr-3 text-left font-medium">开始</th>
              <th className="py-2 pr-3 text-left font-medium">音频</th>
              <th className="py-2 pr-3 text-left font-medium">画面</th>
              <th className="py-2 pr-3 text-left font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((scene) => (
              <tr key={scene.id} className="border-b border-gray-800/50">
                <td className="py-2 pr-3 text-gray-300">{scene.title || scene.id}</td>
                <td className="py-2 pr-3 text-gray-400">{Number(scene.start || 0).toFixed(1)}s</td>
                <td className="py-2 pr-3 text-gray-400">{Number(scene.audioDuration || 0).toFixed(1)}s</td>
                <td className="py-2 pr-3 text-gray-400">{Number(scene.duration || 0).toFixed(1)}s</td>
                <td className="py-2 pr-3">
                  {scene.overMax ? (
                    <span className="text-yellow-300">超过建议最大时长</span>
                  ) : (
                    <span className="text-green-400">正常</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
