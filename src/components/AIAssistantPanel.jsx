import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_MESSAGE = {
  role: 'assistant',
  content: '我可以帮你拆选题、补资料问题、整理分镜和旁白。把当前卡住的点发给我就行。',
}

function readStoredMessages(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) && parsed.length ? parsed : [DEFAULT_MESSAGE]
  } catch {
    return [DEFAULT_MESSAGE]
  }
}

export default function AIAssistantPanel({
  storageKey,
  title = 'AI 助手',
  contextLabel = '当前页面',
  context = {},
  initiallyOpen = true,
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const [messages, setMessages] = useState(() => readStoredMessages(storageKey))
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  const quickPrompts = useMemo(() => [
    '帮我把这个选题拆成更清楚的讲解角度',
    '根据当前内容补充资料收集问题',
    '给我 6 个分镜的结构建议',
  ], [])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)))
    } catch {
      // localStorage can be unavailable in private contexts.
    }
  }, [messages, storageKey])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, open])

  const send = async (content = draft) => {
    const text = content.trim()
    if (!text || loading) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setDraft('')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, messages: nextMessages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 助手暂时不可用')
      setMessages((prev) => [...prev, data.message])
    } catch (err) {
      setError(err.message)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `请求失败：${err.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = () => {
    setMessages([DEFAULT_MESSAGE])
    setError('')
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full border border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-100 px-4 py-2.5 rounded-lg text-sm transition-colors"
      >
        {open ? '收起 AI 对话' : '打开 AI 对话'}
      </button>

      {open && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-gray-200">{title}</h2>
              <p className="text-xs text-gray-500">{contextLabel}</p>
            </div>
            <button
              type="button"
              onClick={clearHistory}
              className="text-xs text-gray-500 hover:text-gray-200 transition-colors"
            >
              清空历史
            </button>
          </div>

          <div className="h-[420px] overflow-auto px-4 py-3 space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'ml-8 bg-tech-600 text-white'
                    : 'mr-8 bg-gray-950 border border-gray-800 text-gray-300'
                }`}
              >
                {message.content}
              </div>
            ))}
            {loading && (
              <div className="mr-8 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-500">
                思考中...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="px-4 py-3 border-t border-gray-800 space-y-3">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  disabled={loading}
                  className="text-xs border border-gray-700 hover:border-tech-500 disabled:opacity-50 text-gray-400 hover:text-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={4}
              placeholder="输入想法、问题或要改进的方向，Ctrl/⌘ + Enter 发送"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-tech-500 transition-colors resize-y"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !draft.trim()}
              className="w-full bg-tech-600 hover:bg-tech-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? '发送中...' : '发送'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
