import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import PipelineTimeline from '../components/PipelineTimeline'
import VideoPlayer from '../components/VideoPlayer'
import LogPanel from '../components/LogPanel'
import ScriptEditor from '../components/ScriptEditor'
import CodePreview from '../components/CodePreview'
import { usePipelineStatus } from '../hooks/usePipelineStatus'

const stepOrder = ['script', 'code', 'snapshot', 'render', 'narration', 'tts', 'mux']
const stepNames = {
  script: 'AI 脚本生成',
  code: 'HTML/CSS/JS 代码生成',
  snapshot: '场景截图',
  render: '视频渲染',
  narration: '旁白分段提取',
  tts: 'TTS 语音合成',
  mux: '最终合成',
}

function computeCurrentStep(episode) {
  const steps = episode.steps
  for (let i = 0; i < stepOrder.length; i++) {
    if (steps[stepOrder[i]] === 'running') return i + 1
  }
  // Find first non-completed step
  for (let i = 0; i < stepOrder.length; i++) {
    if (steps[stepOrder[i]] !== 'completed') return i + 1
  }
  return 8
}

function buildLogs(episode) {
  const logs = []
  const t = new Date(episode.updatedAt).toLocaleTimeString()
  logs.push(`[${t}] 流水线状态: ${episode.status}`)

  for (const key of stepOrder) {
    const s = episode.steps[key]
    if (s === 'running') logs.push(`  ⏳ ${stepNames[key]} — 执行中...`)
    else if (s === 'completed') logs.push(`  ✅ ${stepNames[key]} — 完成`)
    else if (s === 'failed') logs.push(`  ❌ ${stepNames[key]} — 失败`)
    else logs.push(`  ⬜ ${stepNames[key]} — 等待`)
  }
  if (episode.error) logs.push(`  ⚠ ${episode.error}`)
  return logs
}

export default function EpisodeDetail() {
  const { slug } = useParams()
  const [episode, setEpisode] = useState(null)
  const [error, setError] = useState('')

  // WebSocket for real-time updates
  const { episode: wsEpisode, connected } = usePipelineStatus(slug)

  // Apply WebSocket updates immediately
  useEffect(() => {
    if (wsEpisode) setEpisode(wsEpisode)
  }, [wsEpisode])

  const fetchEpisode = useCallback(async () => {
    try {
      const res = await fetch(`/api/episodes/${encodeURIComponent(slug)}`)
      if (!res.ok) throw new Error('剧集未找到')
      const data = await res.json()
      setEpisode(data)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [slug])

  useEffect(() => {
    fetchEpisode()
  }, [fetchEpisode])

  // Poll every 5s while running (fallback if WebSocket disconnects)
  useEffect(() => {
    if (!episode || episode.status !== 'running') return
    const interval = connected ? 10000 : 3000
    const timer = setInterval(fetchEpisode, interval)
    return () => clearInterval(timer)
  }, [episode?.status, connected, fetchEpisode])

  if (error && !episode) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg mb-2">加载失败</p>
        <p>{error}</p>
      </div>
    )
  }

  if (!episode) {
    return <div className="text-center py-20 text-gray-500">加载中...</div>
  }

  const currentStep = computeCurrentStep(episode)
  const logs = buildLogs(episode)
  const voiceoverVideo = `/videos/${slug}/output/episode-${slug}-voiceover.mp4`
  const silentVideo = `/videos/${slug}/output/episode-${slug}.mp4`
  const videoReady = episode.steps.mux === 'completed'
  const videoSrc = videoReady ? voiceoverVideo : (episode.steps.render === 'completed' ? silentVideo : null)

  const currentStepKey = stepOrder[currentStep - 1]
  const currentStepName = currentStepKey ? stepNames[currentStepKey] : '完成'

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">{episode.title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {episode.status === 'completed' ? '✅ 已完成' : episode.status === 'failed' ? '❌ 失败' : '🔄 进行中'}
        {' · '}{episode.duration} 分钟
      </p>

      <PipelineTimeline currentStep={currentStep} failed={episode.status === 'failed'} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-4">
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-400 mb-2">当前步骤</h2>
            <p className="text-gray-300">
              Step {currentStep}: {currentStepName}
              {episode.status === 'running' ? ' — 执行中...' : episode.status === 'completed' ? ' — 全部完成' : ''}
            </p>
          </section>

          {episode.error && (
            <section className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
              <h2 className="text-sm font-medium text-red-400 mb-2">错误信息</h2>
              <p className="text-red-300 text-sm">{episode.error}</p>
            </section>
          )}

          {episode.status === 'failed' && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  fetch(`/api/episodes/${encodeURIComponent(slug)}/retry`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  }).then(() => fetchEpisode())
                }}
                className="bg-tech-600 hover:bg-tech-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                重试
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <VideoPlayer src={videoSrc} />
          {videoReady ? (
            <a
              href={`/api/episodes/${encodeURIComponent(slug)}/download`}
              className="block w-full bg-tech-600 hover:bg-tech-500 text-white py-2 rounded-lg text-sm text-center transition-colors"
            >
              下载视频
            </a>
          ) : (
            <button
              disabled
              className="w-full bg-gray-800 text-gray-500 py-2 rounded-lg text-sm cursor-not-allowed"
            >
              {episode.status === 'failed' ? '下载视频（已失败）' : '下载视频（待生成）'}
            </button>
          )}
          <LogPanel logs={logs} />
        </aside>
      </div>

      {episode.steps.script === 'completed' && (
        <div className="mt-6">
          <ScriptEditor
            content={episode.scriptContent}
            slug={slug}
            onSaved={(content) => setEpisode((prev) => ({ ...prev, scriptContent: content }))}
          />
        </div>
      )}

      {episode.steps.code === 'completed' && (
        <div className="mt-6">
          <CodePreview
            code={episode.codeContent}
            slug={slug}
            onSaved={(code) => setEpisode((prev) => ({ ...prev, codeContent: code }))}
          />
        </div>
      )}
    </div>
  )
}
