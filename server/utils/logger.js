import fs from 'node:fs'
import path from 'node:path'

const LOG_FILE = path.resolve('server.log')

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

function writeLine(level, message) {
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}\n`
  try {
    fs.appendFileSync(LOG_FILE, line)
  } catch {
    // Logging must never break the pipeline.
  }
}

export function info(msg) {
  console.log(msg)
  writeLine('info', msg)
}

export function warn(msg) {
  console.warn(msg)
  writeLine('warn', msg)
}

export function error(msg) {
  console.error(msg)
  writeLine('error', msg)
}

export function readLogs(limit = 100) {
  try {
    if (!fs.existsSync(LOG_FILE)) return []
    const content = fs.readFileSync(LOG_FILE, 'utf-8')
    const lines = content.trim().split('\n')
    return lines.slice(-limit)
  } catch {
    return []
  }
}
