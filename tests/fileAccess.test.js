import path from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { grantFilePath, isFilePathGranted, resetFileAccessGrants } from '../src/main/utils/fileAccess.js'

beforeEach(() => {
  resetFileAccessGrants()
})

describe('file access grants', () => {
  it('rejects files that were never granted', () => {
    expect(isFilePathGranted('/tmp/secret.sql')).toBe(false)
    expect(isFilePathGranted('')).toBe(false)
    expect(isFilePathGranted(null)).toBe(false)
  })

  it('accepts exactly the granted path and resolves relative paths', () => {
    const target = path.join(process.cwd(), 'dump.sql')
    grantFilePath('dump.sql')
    expect(isFilePathGranted(target)).toBe(true)
    expect(isFilePathGranted('dump.sql')).toBe(true)
    expect(isFilePathGranted(path.join(process.cwd(), 'other.sql'))).toBe(false)
  })

  it('does not grant directories that merely contain a granted file', () => {
    grantFilePath('/tmp/grants/a.sql')
    expect(isFilePathGranted('/tmp/grants')).toBe(false)
    expect(isFilePathGranted('/tmp/grants/../grants/a.sql')).toBe(true)
  })

  it('clears all grants on reset', () => {
    grantFilePath('/tmp/grants/a.sql')
    resetFileAccessGrants()
    expect(isFilePathGranted('/tmp/grants/a.sql')).toBe(false)
  })
})
