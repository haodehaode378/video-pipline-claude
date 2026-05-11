import fs from 'node:fs'
import path from 'node:path'
import { resolveWorkspacePath } from './file-helper.js'

function getLogFile() {
  return process.env.LOG_FILE_PATH
    ? resolveWorkspacePath(process.env.LOG_FILE_PATH)
    : resolveWorkspacePath('server.log')
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

function writeLine(level, message) {
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}\n`
  try {
    const logFile = getLogFile()
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    fs.appendFileSync(logFile, line)
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
    const logFile = getLogFile()
    if (!fs.existsSync(logFile)) return []
    const content = fs.readFileSync(logFile, 'utf-8')
    const lines = content.trim().split('\n')
    return lines.slice(-limit)
  } catch {
    return []
  }
}
