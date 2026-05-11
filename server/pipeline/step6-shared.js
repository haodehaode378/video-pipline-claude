/**
 * Shared validation and utility functions used by both step6-code.js and step6-retry.js.
 * Extracted to break circular dependency.
 */

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateStringArray(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`)
    return
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${path}[${index}] must be a non-empty string`)
    }
  })
}

export function validateCodePlanSchema(plan) {
  const errors = []
  if (!isPlainObject(plan)) return ['plan must be an object']

  const allowedTopLevel = new Set(['visualStyle', 'sharedClasses', 'scenes'])
  for (const key of Object.keys(plan)) {
    if (!allowedTopLevel.has(key)) errors.push(`unexpected top-level field: ${key}`)
  }

  if (typeof plan.visualStyle !== 'string' || plan.visualStyle.trim() === '') {
    errors.push('visualStyle must be a non-empty string')
  }
  validateStringArray(plan.sharedClasses, 'sharedClasses', errors)

  if (!Array.isArray(plan.scenes)) {
    errors.push('scenes must be an array')
    return errors
  }
  if (plan.scenes.length === 0) errors.push('scenes must contain at least one item')

  const allowedSceneFields = new Set([
    'id', 'start', 'duration', 'layout', 'visualElements', 'animationBeats', 'requiredClasses',
  ])
  plan.scenes.forEach((scene, index) => {
    const path = `scenes[${index}]`
    if (!isPlainObject(scene)) {
      errors.push(`${path} must be an object`)
      return
    }
    for (const key of Object.keys(scene)) {
      if (!allowedSceneFields.has(key)) errors.push(`${path} has unexpected field: ${key}`)
    }
    for (const key of allowedSceneFields) {
      if (!(key in scene)) errors.push(`${path}.${key} is required`)
    }
    if (typeof scene.id !== 'string' || scene.id.trim() === '') errors.push(`${path}.id must be a non-empty string`)
    if (typeof scene.start !== 'number' || !Number.isFinite(scene.start)) errors.push(`${path}.start must be a finite number`)
    if (typeof scene.duration !== 'number' || !Number.isFinite(scene.duration) || scene.duration <= 0) {
      errors.push(`${path}.duration must be a positive number`)
    }
    if (typeof scene.layout !== 'string' || scene.layout.trim() === '') errors.push(`${path}.layout must be a non-empty string`)
    validateStringArray(scene.visualElements, `${path}.visualElements`, errors)
    validateStringArray(scene.animationBeats, `${path}.animationBeats`, errors)
    validateStringArray(scene.requiredClasses, `${path}.requiredClasses`, errors)
  })

  return errors
}

function hasMalformedHtmlTag(html) {
  if (/<[^>]*$/i.test(html)) return true
  return /<[^>]+\b(?:class|id|style|data-start|data-duration)=(["'])[^"'>]*<[^"'>]*\1/i.test(html)
}

function braceBalance(text) {
  let balance = 0
  for (const ch of text) {
    if (ch === '{') balance++
    if (ch === '}') balance--
    if (balance < 0) return false
  }
  return balance === 0
}

function containsUtilityClassName(code) {
  return /\b(md:|lg:|xl:|sm:|flex|grid|hidden|block|text-[a-z0-9-]+|bg-[a-z0-9-]+|rounded(?:-[a-z0-9-]+)?|shadow(?:-[a-z0-9-]+)?|p[xytrbl]?-[a-z0-9-]+|m[xytrbl]?-[a-z0-9-]+|w-[a-z0-9-]+|h-[a-z0-9-]+|items-[a-z0-9-]+|justify-[a-z0-9-]+)\b/i.test(code)
}

export function normalizeHtmlAttrs(html) {
  let out = html
    .replace(/([a-z])(class=)/gi, '$1 $2')
    .replace(/([a-z])(data-start=)/gi, '$1 $2')
    .replace(/([a-z])(data-duration=)/gi, '$1 $2')
    .replace(/([a-z])(id=)/gi, '$1 $2')
    .replace(/([a-z])(style=)/gi, '$1 $2')
    .replace(/(["'])(class=)/gi, '$1 $2')
    .replace(/(["'])(data-start=)/gi, '$1 $2')
    .replace(/(["'])(data-duration=)/gi, '$1 $2')
    .replace(/(["'])(id=)/gi, '$1 $2')
    .replace(/(["'])(style=)/gi, '$1 $2')
    .replace(/\bclass=(["'])([^"']*)\1/gi, (match, quote, value) => {
      const normalized = value
        .replace(/\b(scene)(?=(?:scene-|viz-|local|pending))/g, '$1 ')
        .replace(/\b(scene-shell)(?=viz-)/g, '$1 ')
        .replace(/\b(scene-kicker)(?=viz-)/g, '$1 ')
        .replace(/\b(scene-title)(?=viz-)/g, '$1 ')
        .replace(/\b(scene-summary)(?=viz-)/g, '$1 ')
        .replace(/\b(visual-panel)(?=viz-)/g, '$1 ')
        .replace(/\b(panel)(?=viz-)/g, '$1 ')
        .replace(/\b(card)(?=viz-)/g, '$1 ')
        .replace(/\b(metric)(?=viz-)/g, '$1 ')
        .replace(/\b(diagram)(?=viz-)/g, '$1 ')
        .replace(/\b(badge)(?=viz-)/g, '$1 ')
        .replace(/\b(label)(?=viz-)/g, '$1 ')
        .replace(/\b(connector)(?=viz-)/g, '$1 ')
        .replace(/\b(node)(?=viz-)/g, '$1 ')
        .replace(/\s+/g, ' ')
        .trim()
      return `class=${quote}${normalized}${quote}`
    })
  return out
}

export function parsePlanJSON(text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return { __parseError: err.message }
  }
}

function validatePlan(code) {
  const errors = []
  const parsed = parsePlanJSON(code)
  if (parsed.__parseError) errors.push(`invalid JSON: ${parsed.__parseError}`)
  if (!parsed.__parseError) errors.push(...validateCodePlanSchema(parsed))
  if (/\b(ship-mark|turret-a|turret-b|wake|shipDrift)\b/.test(code)) {
    errors.push('legacy ship fallback visual is not allowed')
  }
  return errors
}

export function validateGenerated(type, code) {
  const errors = []
  const minLength = type === 'html-scene' ? 80 : 200
  if (!code || code.length < minLength) errors.push('output is too short')
  if (code.includes('```')) errors.push('contains markdown code fence')

  if (type === 'plan') {
    errors.push(...validatePlan(code))
  }

  if (type === 'html') {
    if (hasMalformedHtmlTag(code)) errors.push('HTML contains malformed or unterminated tags')
    if (!/<!doctype html>/i.test(code)) errors.push('missing <!DOCTYPE html>')
    if (!/<\/html>/i.test(code)) errors.push('missing </html>')
    if (!/<div[^>]+id=["']root["'][^>]*data-duration=/i.test(code)) errors.push('missing #root[data-duration]')
    if (!/<section[^>]+class=["'][^"']*scene/i.test(code)) errors.push('missing section.scene elements')
    if (!/<section[^>]+data-start=/i.test(code)) errors.push('missing section[data-start]')
    if (!/<section[^>]+data-duration=/i.test(code)) errors.push('missing section[data-duration]')
    if (!/script\.js/i.test(code)) errors.push('missing script.js reference')
    if (!/style\.css/i.test(code)) errors.push('missing style.css reference')
  }

  if (type === 'html-scene') {
    if (hasMalformedHtmlTag(code)) errors.push('scene HTML contains malformed or unterminated tags')
    if (/<!doctype html>|<html\b|<head\b|<body\b|<script\b|<link\b/i.test(code)) {
      errors.push('scene HTML must not include document wrapper, links, or scripts')
    }
    if (!/<section[^>]+class=["'][^"']*scene/i.test(code)) errors.push('missing section.scene element')
    if (!/<section[^>]+data-start=/i.test(code)) errors.push('missing section[data-start]')
    if (!/<section[^>]+data-duration=/i.test(code)) errors.push('missing section[data-duration]')
    if (/<style\b/i.test(code)) errors.push('scene HTML must not include inline <style>')
    if (containsUtilityClassName(code)) {
      errors.push('Tailwind-style utility classes are not allowed in generated scene HTML')
    }
  }

  if (type === 'css') {
    if (!braceBalance(code)) errors.push('unbalanced CSS braces')
  }

  if (type === 'js') {
    if (!/window\.__hfSeek/.test(code)) errors.push('missing window.__hfSeek')
    if (!/narrations/.test(code)) errors.push('missing narrations data')
    if (/\b(innerHTML|insertAdjacentHTML|createElement|appendChild)\b/.test(code)) {
      errors.push('JS must not create or replace primary scene DOM')
    }
    try {
      new Function(code)
    } catch (err) {
      errors.push(`JS syntax error: ${err.message}`)
    }
  }

  return errors
}

export function validateCodeBundle(html, css, js) {
  const errors = []
  const sceneMatches = [...html.matchAll(/<section\b[^>]*class=["'][^"']*\bscene\b[^"']*["'][^>]*>/gi)]
  const starts = new Set()

  for (const match of sceneMatches) {
    const tag = match[0]
    const start = tag.match(/\bdata-start=["']([^"']+)["']/i)?.[1]
    const duration = tag.match(/\bdata-duration=["']([^"']+)["']/i)?.[1]
    if (start) starts.add(start)
    if (!duration) errors.push(`scene ${start || '(unknown)'} missing data-duration`)
  }

  if (sceneMatches.length < 3) errors.push('expected at least 3 timed scenes')
  if (/<style\b/i.test(html)) errors.push('HTML must not include inline <style>; use style.css')
  if (hasMalformedHtmlTag(html)) errors.push('HTML contains malformed or unterminated tags')
  if (/\b(innerHTML|insertAdjacentHTML|createElement|appendChild)\b/.test(js)) {
    errors.push('JS must not create or replace primary scene DOM')
  }
  if (/querySelectorAll\(["']\.scene\[data-start\]["']\)/.test(js) && !/data\.duration|dataset\.duration/.test(js)) {
    errors.push('JS scene switching must respect data-duration')
  }
  if (containsUtilityClassName(html + js)) {
    errors.push('Tailwind-style utility classes are not allowed in generated HTML/JS')
  }
  if (/\b(ship-mark|turret-a|turret-b|wake|shipDrift)\b/.test(html + css + js)) {
    errors.push('legacy ship fallback visual is not allowed')
  }
  if (!/\.scene\b/.test(css)) errors.push('CSS must define .scene layout')
  for (const start of starts) {
    if (!new RegExp(`data-start=["']${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html)) {
      errors.push(`missing scene for start ${start}`)
    }
  }
  return errors
}
