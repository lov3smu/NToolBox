import { describe, it, expect } from 'vitest'
import { joinPath } from '../src/renderer/src/utils/path.js'

describe('joinPath', () => {
  it('joins POSIX paths with forward slashes', () => {
    expect(joinPath('/data/svn/Develop', ['11 - Database Script'])).toBe('/data/svn/Develop/11 - Database Script')
  })

  it('returns the base without trailing separator when no parts remain', () => {
    expect(joinPath('/data/svn/Develop/11 - Database Script', [])).toBe('/data/svn/Develop/11 - Database Script')
  })

  it('joins Windows paths with backslashes', () => {
    expect(joinPath('C:\\work\\base', ['scripts', 'sql'])).toBe('C:\\work\\base\\scripts\\sql')
    expect(joinPath('C:\\work\\base\\', [])).toBe('C:\\work\\base')
  })

  it('accepts Windows paths written with forward slashes', () => {
    expect(joinPath('C:/work/base', ['scripts'])).toBe('C:/work/base/scripts')
  })

  it('defaults to forward slashes for relative bases', () => {
    expect(joinPath('scripts', ['2024'])).toBe('scripts/2024')
  })
})
