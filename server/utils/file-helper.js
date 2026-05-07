import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve('data')
const VIDEOS_DIR = path.resolve('videos')
const SCRIPTS_DIR = path.resolve('scripts')

export function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (err) {
    console.error(`readJSON failed: ${filePath}`, err.message)
    return null
  }
}

export function writeJSON(filePath, data) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function writeText(filePath, content) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

export function readText(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    console.error(`readText failed: ${filePath}`, err.message)
    return null
  }
}

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
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
