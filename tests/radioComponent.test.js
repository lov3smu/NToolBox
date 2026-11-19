import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_DIR = 'src/renderer/src'
const TEXT_FILE = /\.(js|vue)$/
const COMPONENT_FILE = path.join(root, SCAN_DIR, 'components/RadioOption.vue')
const RAW_RADIO = /type=["']radio["']/

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(full, out)
    } else if (TEXT_FILE.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('radio component', () => {
  it('keeps raw radio inputs inside RadioOption', () => {
    const offenders = []

    for (const file of collectFiles(path.join(root, SCAN_DIR))) {
      if (file === COMPONENT_FILE) continue
      const lines = fs.readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (RAW_RADIO.test(line)) {
          offenders.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })
})
