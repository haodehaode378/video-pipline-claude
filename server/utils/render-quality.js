function compactText(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function textSignature(text) {
  return compactText(text).slice(0, 120)
}

function imageDifference(a, b) {
  if (!a || !b || a.length !== b.length) return 1
  let changed = 0
  const step = 16
  for (let i = 0; i < a.length; i += step) {
    if (Math.abs(a[i] - b[i]) > 8) changed++
  }
  return changed / Math.ceil(a.length / step)
}

export async function inspectRenderQuality(page, scenes, options = {}) {
  const {
    minTextChanges = Math.min(2, Math.max(1, scenes.length - 1)),
    minImageDifference = 0.01,
  } = options
  const samples = []
  let previousImage = null
  let imageChanges = 0

  for (const scene of scenes) {
    const t = scene.start
    await page.evaluate((time) => {
      window.__hfSeek(time)
    }, t)
    await new Promise((r) => setTimeout(r, 200))

    const sample = await page.evaluate(() => {
      const visibleScenes = Array.from(document.querySelectorAll('.scene[data-start]'))
        .filter((el) => {
          const style = window.getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0
        })
        .map((el) => {
          const rect = el.getBoundingClientRect()
          return {
            id: el.id || '',
            start: el.dataset.start || '',
            text: el.innerText || '',
            rect: { width: rect.width, height: rect.height },
          }
        })

      return {
        visibleScenes,
        bodyText: document.body.innerText || '',
      }
    })

    const image = await page.screenshot({ encoding: 'binary' })
    if (previousImage && imageDifference(previousImage, image) >= minImageDifference) {
      imageChanges++
    }
    previousImage = image

    samples.push({
      time: t,
      visibleScenes: sample.visibleScenes,
      text: textSignature(sample.visibleScenes.map((sceneSample) => sceneSample.text).join(' ')),
      bodyText: textSignature(sample.bodyText),
    })
  }

  const errors = []
  for (const sample of samples) {
    if (sample.visibleScenes.length !== 1) {
      errors.push(`time ${sample.time}s has ${sample.visibleScenes.length} visible scenes`)
      continue
    }
    if (!sample.text) errors.push(`time ${sample.time}s has no visible text`)
  }

  const uniqueStarts = new Set(samples.map((sample) => sample.visibleScenes[0]?.start).filter(Boolean))
  if (uniqueStarts.size < Math.min(2, scenes.length)) {
    errors.push('seek does not switch visible scenes')
  }

  const uniqueTexts = new Set(samples.map((sample) => sample.text).filter(Boolean))
  if (uniqueTexts.size < minTextChanges + 1) {
    errors.push('visible text does not change enough across scenes')
  }

  if (scenes.length > 1 && imageChanges === 0) {
    errors.push('screenshots are visually identical across scenes')
  }

  return { passed: errors.length === 0, errors, samples }
}

