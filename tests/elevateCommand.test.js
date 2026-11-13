import { describe, it, expect } from 'vitest'
import { buildElevatedMkdirCommand } from '../src/main/utils/elevateCommand.js'

describe('buildElevatedMkdirCommand', () => {
  it('uses cmd on Windows', () => {
    expect(buildElevatedMkdirCommand('C:\\Program Files\\Demo', 'win32')).toBe(
      'cmd /c if not exist "C:\\Program Files\\Demo" mkdir "C:\\Program Files\\Demo"'
    )
  })

  it('uses mkdir -p on Linux and macOS', () => {
    expect(buildElevatedMkdirCommand('/data/svn/Develop', 'linux')).toBe("mkdir -p '/data/svn/Develop'")
    expect(buildElevatedMkdirCommand('/Users/demo/Documents', 'darwin')).toBe("mkdir -p '/Users/demo/Documents'")
  })

  it('keeps paths with spaces and quotes intact on POSIX', () => {
    expect(buildElevatedMkdirCommand("/tmp/it's here", 'linux')).toBe("mkdir -p '/tmp/it'\\''s here'")
  })
})
