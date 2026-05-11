const EFFECTS = {
  fadeIn: {
    name: 'fadeIn',
    label: '淡入',
    buildFilter({ duration = 1 }) {
      return { filter: `fade=t=in:d=${duration}:color=black`, label: 'fv' }
    },
  },

  fadeOut: {
    name: 'fadeOut',
    label: '淡出',
    buildFilter({ totalDuration = 60, duration = 1 }) {
      const start = Math.max(0, totalDuration - duration)
      return { filter: `fade=t=out:st=${start}:d=${duration}:color=black`, label: 'fv' }
    },
  },

  kenBurns: {
    name: 'kenBurns',
    label: 'Ken Burns',
    buildFilter({ totalDuration = 60 }) {
      return {
        filter: `zoompan=z='min(1.2,1+0.2*on/${totalDuration})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30`,
        label: 'fv',
      }
    },
  },

  speedCurve: {
    name: 'speedCurve',
    label: '速度曲线',
    buildFilter({ speedFactor = 1.2 }) {
      return { filter: `setpts=${(1 / speedFactor).toFixed(3)}*PTS`, label: 'fv' }
    },
  },

  subtitleBurn: {
    name: 'subtitleBurn',
    label: '字幕烧入',
    buildFilter({ subtitlePath }) {
      if (!subtitlePath) return null
      const escaped = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')
      return { filter: `subtitles='${escaped}':force_style='FontSize=24'`, label: 'fv' }
    },
  },
}

const AUDIO_EFFECTS = {
  bgmMix: {
    name: 'bgmMix',
    label: 'BGM混音',
    buildFilter({ bgmPath, bgmVolume = 0.15 }) {
      if (!bgmPath) return null
      const escaped = bgmPath.replace(/\\/g, '/').replace(/:/g, '\\:')
      return { filter: `[1:a]volume=${bgmVolume}[bgmv];[0:a][bgmv]amix=inputs=2:duration=first[fa]` }
    },
  },
}

export function buildVideoFilters(effectNames, options = {}) {
  const { totalDuration = 60, subtitlePath } = options
  const parts = []

  for (const name of effectNames) {
    const effect = EFFECTS[name]
    if (!effect) continue

    const effectOpts = { totalDuration, subtitlePath }
    if (name === 'fadeIn') effectOpts.duration = options.fadeInDuration || 1
    if (name === 'fadeOut') {
      effectOpts.totalDuration = totalDuration
      effectOpts.duration = options.fadeOutDuration || 1
    }
    if (name === 'subtitleBurn') effectOpts.subtitlePath = subtitlePath
    if (name === 'speedCurve') effectOpts.speedFactor = options.speedFactor || 1.2

    const result = effect.buildFilter(effectOpts)
    if (result) parts.push(result.filter)
  }

  if (parts.length === 0) return null
  return parts.join(',')
}

export function buildAudioFilters(effectNames, options = {}) {
  const { bgmPath, bgmVolume = 0.15 } = options
  const parts = []

  for (const name of effectNames) {
    const effect = AUDIO_EFFECTS[name]
    if (!effect) continue

    const result = effect.buildFilter({ bgmPath, bgmVolume })
    if (result) parts.push(result.filter)
  }

  if (parts.length === 0) return null
  return parts.join(';')
}

export { EFFECTS, AUDIO_EFFECTS }
