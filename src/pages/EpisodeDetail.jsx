import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import PipelineTimeline from '../components/PipelineTimeline'
import VideoPlayer from '../components/VideoPlayer'
import LogPanel from '../components/LogPanel'
import ScriptEditor from '../components/ScriptEditor'
import CodePreview from '../components/CodePreview'
import { usePipelineStatus } from '../hooks/usePipelineStatus'

const stepOrder = ['research', 'script', 'code', 'snapshot', 'render', 'narration', 'tts', 'mux']
const stepNames = {
  research: '资料收集',
  script: 'AI 脚本生成',
  code: 'HTML/CSS/JS 代码生成',
  snapshot: '场景截图',
  render: '视频渲染',
  narration: '旁白分段提取',
  tts: 'TTS 语音合成',
  mux: '最终合成',
}

function computeCurrentStep(episode) {
  const steps = episode.steps || {}
  for (let i = 0; i < stepOrder.length; i++) {
    if (steps[stepOrder[i]] === 'running') return i + 1
  }
  for (let i = 0; i < stepOrder.length; i++) {
    if (steps[stepOrder[i]] !== 'completed') return i + 1
  }
  return stepOrder.length + 1
}

function buildLogs(episode) {
  const logs = []
  const t = new Date(episode.updatedAt).toLocaleTimeString()
  logs.push(`[${t}] 流水线状态：${episode.status}`)

  for (const key of stepOrder) {
    const s = episode.steps?.[key] || 'pending'
    if (s === 'running') logs.push(`  ${stepNames[key]} - 执行中`)
    else if (s === 'completed') logs.push(`  ${stepNames[key]} - 完成`)
    else if (s === 'failed') logs.push(`  ${stepNames[key]} - 失败`)
    else logs.push(`  ${stepNames[key]} - 等待`)
  }
  if (episode.error) logs.push(`  错误：${episode.error}`)
  return logs
}

export default function EpisodeDetail() {
  const { slug } = useParams()
  const [episode, setEpisode] = useState(null)
  const [error, setError] = useState('')
  const generateStartedRef = useRef(false)

  const { episode: wsEpisode, connected } = usePipelineStatus(slug)

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

  const startGenerate = useCallback(async () => {
    if (generateStartedRef.current) return
    generateStartedRef.current = true
    try {
      const res = await fetch(`/api/episodes/${encodeURIComponent(slug)}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '后续生成启动失败')
      }
      fetchEpisode()
    } catch (err) {
      setError(err.message)
      generateStartedRef.current = false
    }
  }, [fetchEpisode, slug])

  useEffect(() => {
    const timer = setTimeout(fetchEpisode, 0)
    return () => clearTimeout(timer)
  }, [fetchEpisode])

  const displayEpisode = wsEpisode || episode

  useEffect(() => {
    if (!displayEpisode || displayEpisode.status !== 'running') return
    const interval = connected ? 10000 : 3000
    const timer = setInterval(fetchEpisode, interval)
    return () => clearInterval(timer)
  }, [displayEpisode, connected, fetchEpisode])

  useEffect(() => {
    if (displayEpisode?.status !== 'research_completed') return
    const timer = setTimeout(startGenerate, 0)
    return () => clearTimeout(timer)
  }, [displayEpisode?.status, startGenerate])

  if (error && !displayEpisode) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg mb-2">加载失败</p>
        <p>{error}</p>
      </div>
    )
  }

  if (!displayEpisode) {
    return <div className="text-center py-20 text-gray-500">加载中...</div>
  }

  const currentStep = computeCurrentStep(displayEpisode)
  const logs = buildLogs(displayEpisode)
  const voiceoverVideo = `/videos/${slug}/output/episode-${slug}-voiceover.mp4`
  const silentVideo = `/videos/${slug}/output/episode-${slug}.mp4`
  const videoReady = displayEpisode.steps?.mux === 'completed'
  const videoSrc = videoReady ? voiceoverVideo : (displayEpisode.steps?.render === 'completed' ? silentVideo : null)

  const currentStepKey = stepOrder[currentStep - 1]
  const currentStepName = currentStepKey ? stepNames[currentStepKey] : '完成'
  const statusText =
    displayEpisode.status === 'completed'
      ? '已完成'
      : displayEpisode.status === 'failed'
        ? '失败'
        : displayEpisode.status === 'research_completed'
          ? '资料已完成，正在启动生成'
          : '进行中'

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">{displayEpisode.title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {statusText} · {displayEpisode.duration} 分钟
        {displayEpisode.template ? ` · 风格：${displayEpisode.template}` : ' · 使用全局风格'}
      </p>

      <PipelineTimeline currentStep={currentStep} failed={displayEpisode.status === 'failed'} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-4">
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-400 mb-2">当前步骤</h2>
            <p className="text-gray-300">
              Step {currentStep}: {currentStepName}
              {displayEpisode.status === 'running' ? ' - 执行中' : displayEpisode.status === 'completed' ? ' - 全部完成' : ''}
            </p>
          </section>

          {error && (
            <section className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
              <h2 className="text-sm font-medium text-red-400 mb-2">页面错误</h2>
              <p className="text-red-300 text-sm">{error}</p>
            </section>
          )}

          {displayEpisode.error && (
            <section className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
              <h2 className="text-sm font-medium text-red-400 mb-2">错误信息</h2>
              <p className="text-red-300 text-sm">{displayEpisode.error}</p>
            </section>
          )}

          {displayEpisode.status === 'failed' && (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    fetch(`/api/episodes/${encodeURIComponent(slug)}/retry`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ step: 'research' }),
                    }).then(() => fetchEpisode())
                  }}
                  className="bg-tech-600 hover:bg-tech-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  从资料收集重试
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {stepOrder.map((key) => {
                  if (displayEpisode.steps?.[key] !== 'failed') return null
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        fetch(`/api/episodes/${encodeURIComponent(slug)}/retry`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ step: key }),
                        }).then(() => fetchEpisode())
                      }}
                      className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300 px-3 py-1.5 rounded-lg text-xs transition-colors"
                    >
                      重试：{stepNames[key]}
                    </button>
                  )
                })}
              </div>
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
              {displayEpisode.status === 'failed' ? '下载视频（已失败）' : '下载视频（待生成）'}
            </button>
          )}
          <LogPanel logs={logs} live />
        </aside>
      </div>

      {displayEpisode.steps?.research === 'completed' && (
        <section className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-400 mb-3">资料研究</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-300 bg-gray-950 border border-gray-800 rounded-lg p-4 max-h-96 overflow-auto">
            {displayEpisode.researchContent || '资料文件已生成，等待刷新内容。'}
          </pre>
        </section>
      )}

      {displayEpisode.steps?.script === 'completed' && (
        <div className="mt-6">
          <ScriptEditor
            content={displayEpisode.scriptContent}
            slug={slug}
            onSaved={(content) => setEpisode((prev) => ({ ...prev, scriptContent: content }))}
          />
        </div>
      )}

      {displayEpisode.steps?.code === 'completed' && (
        <div className="mt-6">
          <CodePreview
            code={displayEpisode.codeContent}
            slug={slug}
            onSaved={(code) => setEpisode((prev) => ({ ...prev, codeContent: code }))}
          />
        </div>
      )}
    </div>
  )
}
