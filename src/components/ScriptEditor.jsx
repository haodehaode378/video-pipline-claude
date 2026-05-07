import { useState, useMemo } from 'react'

function parseScriptTable(markdown) {
  const segments = []
  if (!markdown) return segments

  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/^\|\s*([\d:]+-[\d:]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/)
    if (!match) continue
    const timeRange = match[1]
    if (timeRange.includes('时间') || timeRange.includes('----')) continue

    const [startStr, endStr] = timeRange.split('-')
    const toSec = (t) => {
      const p = t.trim().split(':')
      return parseInt(p[0]) * 60 + parseInt(p[1])
    }

    segments.push({
      start: toSec(startStr),
      end: toSec(endStr),
      timeRange,
      visual: match[2].trim(),
      narration: match[3].trim(),
    })
  }
  return segments
}

function toMarkdown(segments) {
  const header = '| 时间 | 画面 | 旁白 |\n|------|------|------|\n'
  const rows = segments
    .map((s) => {
      const m = Math.floor(s.start / 60)
      const ss = String(s.start % 60).padStart(2, '0')
      const me = Math.floor(s.end / 60)
      const se = String(s.end % 60).padStart(2, '0')
      return `| ${m}:${ss}-${me}:${se} | ${s.visual} | ${s.narration} |`
    })
    .join('\n')
  return header + rows
}

export default function ScriptEditor({ content, slug, onSaved }) {
  const [segments, setSegments] = useState(() => parseScriptTable(content))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const hasScript = segments.length > 0

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const markdown = toMarkdown(segments)
      const res = await fetch(`/api/episodes/${slug}/script`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: markdown }),
      })
      if (!res.ok) throw new Error('保存失败')
      setMsg('已保存')
      if (onSaved) onSaved(markdown)
    } catch (err) {
      setMsg(`错误: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (!hasScript) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-2">脚本编辑</h3>
        <p className="text-gray-600 text-sm">脚本尚未生成</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">脚本编辑</h3>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.startsWith('错误') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-tech-600 hover:bg-tech-500 disabled:opacity-50 text-white px-3 py-1 rounded text-xs transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-2 text-gray-500 font-medium w-16">时间</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium w-1/3">画面</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">旁白</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                <td className="py-2 px-2 text-gray-400 text-xs align-top">
                  <input
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                    value={seg.timeRange}
                    onChange={(ev) => {
                      const next = [...segments]
                      next[i] = { ...next[i], timeRange: ev.target.value }
                      const [s, end] = ev.target.value.split('-')
                      const toS = (t) => { const p = t.trim().split(':'); return parseInt(p[0])*60 + parseInt(p[1]) }
                      if (s && end) {
                        next[i].start = toS(s)
                        next[i].end = toS(end)
                      }
                      setSegments(next)
                    }}
                  />
                </td>
                <td className="py-2 px-2 align-top">
                  <textarea
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 resize-y"
                    rows={2}
                    value={seg.visual}
                    onChange={(e) => {
                      const next = [...segments]
                      next[i] = { ...next[i], visual: e.target.value }
                      setSegments(next)
                    }}
                  />
                </td>
                <td className="py-2 px-2 align-top">
                  <textarea
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 resize-y"
                    rows={2}
                    value={seg.narration}
                    onChange={(e) => {
                      const next = [...segments]
                      next[i] = { ...next[i], narration: e.target.value }
                      setSegments(next)
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
