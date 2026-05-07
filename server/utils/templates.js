import fs from 'node:fs'
import path from 'node:path'

const LIZI_DIR = path.resolve('lizi')

function parseTemplate(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const nameMatch = content.match(/style_name:\s*(.+)/)
  const slugMatch = content.match(/style_slug:\s*(.+)/)
  // Extract the one-line description (the > quote line after "Design System")
  const descMatch = content.match(/^>\s*(.+)$/m)
  return {
    name: nameMatch ? nameMatch[1].trim() : path.basename(filePath, '.md'),
    slug: slugMatch ? slugMatch[1].trim() : '',
    description: descMatch ? descMatch[1].trim() : '',
    content,
  }
}

export function listTemplates() {
  if (!fs.existsSync(LIZI_DIR)) return []
  const files = fs.readdirSync(LIZI_DIR).filter((f) => f.endsWith('.md'))
  return files.map((f) => {
    const t = parseTemplate(path.join(LIZI_DIR, f))
    return { name: t.name, slug: t.slug, description: t.description, file: f }
  })
}

export function getTemplateContent(slug) {
  if (!fs.existsSync(LIZI_DIR)) return null
  const files = fs.readdirSync(LIZI_DIR).filter((f) => f.endsWith('.md'))
  for (const f of files) {
    const t = parseTemplate(path.join(LIZI_DIR, f))
    if (t.slug === slug) return t
  }
  return null
}
