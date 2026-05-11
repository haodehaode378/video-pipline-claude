const steps = [
  { key: 'research', label: '资料收集' },
  { key: 'script', label: '生成分镜' },
  { key: 'assets', label: '素材获取' },
  { key: 'narration', label: '生成旁白' },
  { key: 'tts', label: '生成 TTS' },
  { key: 'timeline', label: '校准时间轴' },
  { key: 'code', label: '生成 React' },
  { key: 'snapshot', label: 'Remotion 截图' },
  { key: 'render', label: 'Remotion 渲染' },
  { key: 'whisper', label: '字幕生成' },
  { key: 'mux', label: '合成成片' },
]

export default function PipelineTimeline({
  currentStep = 0,
  failed = false,
  stepStatuses = {},
  onRestartStep,
  restartDisabled = false,
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {steps.map(({ key, label }, i) => {
        const stepNum = i + 1
        const isDone = stepNum < currentStep
        const isActive = stepNum === currentStep
        const isFailed = failed && isActive
        const status = stepStatuses[key] || 'pending'
        const canRestart = Boolean(onRestartStep) && status !== 'running'
        return (
          <div key={key} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isFailed
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : isDone
                    ? 'bg-green-500/20 text-green-400'
                    : isActive
                      ? 'bg-tech-500/20 text-tech-400 border border-tech-500/50'
                      : 'bg-gray-800 text-gray-500'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  isFailed
                    ? 'bg-red-500 text-white'
                    : isDone
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-tech-500 text-white'
                        : 'bg-gray-700'
                }`}
              >
                {isFailed ? '!' : isDone ? '✓' : stepNum}
              </span>
              {label}
              {onRestartStep && (
                <button
                  type="button"
                  onClick={() => onRestartStep(key)}
                  disabled={restartDisabled || !canRestart}
                  className="ml-1 rounded border border-current/30 px-1.5 py-0.5 text-[10px] leading-none opacity-80 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                  title={`从${label}重新开始`}
                >
                  重跑
                </button>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-4 h-px ${
                  isFailed ? 'bg-red-500' : stepNum <= currentStep ? 'bg-tech-500' : 'bg-gray-700'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
