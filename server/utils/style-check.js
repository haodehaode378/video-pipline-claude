const forbidden = [
  /rounded-(?:sm|md|lg|xl|[23]xl)/,
  /shadow-(?!none)/,
  /bg-gradient-/,
  /opacity-(?:[1-6]0)/,
  /font-(?:light|thin|normal)/,
]

export default function styleCheck(css) {
  const violations = []
  for (const re of forbidden) {
    const match = css.match(re)
    if (match) violations.push(match[0])
  }
  return { passed: violations.length === 0, violations }
}
