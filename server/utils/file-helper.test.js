import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_ROOT, readJSON, writeJSON, readText, writeText, ensureDir, resolveWorkspacePath } from './file-helper.js'

const TMP = path.resolve('test-tmp')
const ORIGINAL_CWD = process.cwd()

beforeEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true })
})

describe('readJSON / writeJSON', () => {
  it('returns null for non-existent file', () => {
    expect(readJSON(path.join(TMP, 'nope.json'))).toBeNull()
  })

  it('writes and reads JSON', () => {
    const p = path.join(TMP, 'test.json')
    writeJSON(p, { hello: 'world' })
    expect(readJSON(p)).toEqual({ hello: 'world' })
  })

  it('creates intermediate directories', () => {
    const p = path.join(TMP, 'deep', 'nested', 'data.json')
    writeJSON(p, [1, 2, 3])
    expect(readJSON(p)).toEqual([1, 2, 3])
  })

  it('resolves relative paths from the project root, not process cwd', () => {
    const outsideCwd = fs.mkdtempSync(path.join(path.dirname(PROJECT_ROOT), 'cwd-check-'))
    const relativePath = 'test-tmp/root-relative/data.json'

    process.chdir(outsideCwd)
    writeJSON(relativePath, { stable: true })

    expect(fs.existsSync(path.join(PROJECT_ROOT, relativePath))).toBe(true)
    expect(fs.existsSync(path.join(outsideCwd, relativePath))).toBe(false)
    expect(readJSON(relativePath)).toEqual({ stable: true })

    process.chdir(ORIGINAL_CWD)
    fs.rmSync(outsideCwd, { recursive: true, force: true })
  })

  it('returns null for malformed JSON', () => {
    const p = path.join(TMP, 'bad.json')
    fs.writeFileSync(p, '{not json')
    expect(readJSON(p)).toBeNull()
  })
})

describe('readText / writeText', () => {
  it('returns null for non-existent file', () => {
    expect(readText(path.join(TMP, 'nope.txt'))).toBeNull()
  })

  it('writes and reads text', () => {
    const p = path.join(TMP, 'hello.txt')
    writeText(p, 'Hello World')
    expect(readText(p)).toBe('Hello World')
  })

  it('creates intermediate directories', () => {
    const p = path.join(TMP, 'a', 'b', 'c.txt')
    writeText(p, 'deep')
    expect(readText(p)).toBe('deep')
  })

  it('returns null for unreadable file', () => {
    // readText catches errors gracefully
    expect(readText(path.join(TMP, 'nonexistent.txt'))).toBeNull()
  })
})

describe('ensureDir', () => {
  it('creates directory if not exists', () => {
    const d = path.join(TMP, 'newdir')
    ensureDir(d)
    expect(fs.existsSync(d)).toBe(true)
    expect(fs.statSync(d).isDirectory()).toBe(true)
  })

  it('does not throw if directory already exists', () => {
    const d = path.join(TMP, 'exists')
    fs.mkdirSync(d)
    expect(() => ensureDir(d)).not.toThrow()
  })

  it('exposes the project root path resolver', () => {
    expect(resolveWorkspacePath('data/episodes.json')).toBe(path.join(PROJECT_ROOT, 'data', 'episodes.json'))
  })
})
