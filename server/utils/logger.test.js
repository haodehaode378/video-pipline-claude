import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { info, warn, error, readLogs } from './logger.js'

const LOG_FILE = path.resolve('server.log')

// Save original log file state
let backup = null

beforeEach(() => {
  if (fs.existsSync(LOG_FILE)) {
    backup = fs.readFileSync(LOG_FILE, 'utf-8')
    fs.unlinkSync(LOG_FILE)
  }
})

afterEach(() => {
  if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE)
  if (backup) {
    fs.writeFileSync(LOG_FILE, backup)
    backup = null
  }
})

describe('logger', () => {
  it('readLogs returns empty array when no log file', () => {
    const logs = readLogs()
    expect(logs).toEqual([])
  })

  it('info writes to log file', () => {
    info('test message')
    const logs = readLogs()
    expect(logs.length).toBeGreaterThanOrEqual(1)
    const last = logs[logs.length - 1]
    expect(last).toContain('[INFO]')
    expect(last).toContain('test message')
  })

  it('warn writes to log file', () => {
    warn('warning message')
    const logs = readLogs()
    const last = logs[logs.length - 1]
    expect(last).toContain('[WARN]')
    expect(last).toContain('warning message')
  })

  it('error writes to log file', () => {
    error('error message')
    const logs = readLogs()
    const last = logs[logs.length - 1]
    expect(last).toContain('[ERROR]')
    expect(last).toContain('error message')
  })

  it('readLogs respects limit', () => {
    for (let i = 0; i < 10; i++) info(`msg ${i}`)
    const logs = readLogs(3)
    expect(logs.length).toBeLessThanOrEqual(3)
    expect(logs[logs.length - 1]).toContain('msg 9')
  })

  it('logs have timestamp format', () => {
    info('timestamp test')
    const logs = readLogs()
    const last = logs[logs.length - 1]
    // Format: [YYYY-MM-DD HH:MM:SS.sss] [LEVEL] message
    expect(last).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] \[INFO\] timestamp test/)
  })
})
