function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = (seconds % 60).toFixed(3).replace('.', ',')
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(6, '0')}`
}

export function segmentsToSrt(segments) {
  if (!segments || segments.length === 0) return ''

  return segments
    .map((seg, i) => {
      const start = formatSrtTime(seg.start)
      const end = formatSrtTime(seg.end)
      return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`
    })
    .join('\n')
}

export function segmentsToAss(segments) {
  if (!segments || segments.length === 0) return ''

  const header = `[Script Info]
Title: Auto-generated subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,24,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const events = segments
    .map((seg) => {
      const start = formatAssTime(seg.start)
      const end = formatAssTime(seg.end)
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${seg.text}`
    })
    .join('\n')

  return header + events + '\n'
}

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = (seconds % 60).toFixed(2)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(5, '0')}`
}

export function alignSubtitlesToTimeline(subtitleSegments, timelineScenes) {
  if (!subtitleSegments || !timelineScenes) return subtitleSegments

  return subtitleSegments.map((seg) => {
    const scene = timelineScenes.find(
      (s) => seg.start >= s.start && seg.start < s.end
    )
    return { ...seg, sceneId: scene?.id || null }
  })
}
