import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const VIDEOS_DIR = path.join(PROJECT_ROOT, 'videos')
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts')

export function resolveWorkspacePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath)
}

export function readJSON(filePath) {
  const resolved = resolveWorkspacePath(filePath)
  try {
    if (!fs.existsSync(resolved)) return null
    return JSON.parse(fs.readFileSync(resolved, 'utf-8'))
  } catch (err) {
    console.error(`readJSON failed: ${resolved}`, err.message)
    return null
  }
}

export function writeJSON(filePath, data) {
  const resolved = resolveWorkspacePath(filePath)
  const dir = path.dirname(resolved)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2), 'utf-8')
}

export function writeText(filePath, content) {
  const resolved = resolveWorkspacePath(filePath)
  const dir = path.dirname(resolved)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(resolved, content, 'utf-8')
}

export function readText(filePath) {
  const resolved = resolveWorkspacePath(filePath)
  try {
    if (!fs.existsSync(resolved)) return null
    return fs.readFileSync(resolved, 'utf-8')
  } catch (err) {
    console.error(`readText failed: ${resolved}`, err.message)
    return null
  }
}

export function ensureDir(dirPath) {
  const resolved = resolveWorkspacePath(dirPath)
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true })
}

export function getEpisodeDir(slug) {
  const dir = path.join(VIDEOS_DIR, slug)
  ensureDir(dir)
  return dir
}

export function getScriptDir(slug) {
  const dir = path.join(SCRIPTS_DIR, slug)
  ensureDir(dir)
  return dir
}
