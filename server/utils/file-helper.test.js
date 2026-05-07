import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { readJSON, writeJSON, readText, writeText, ensureDir } from './file-helper.js'

const TMP = path.resolve('test-tmp')

beforeEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true })
  fs.mkdirSync(TMP, { recursive: true })
})

afterEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true })
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
})
