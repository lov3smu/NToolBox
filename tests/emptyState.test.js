import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'src/renderer/src')
const COMPONENT = path.join(SRC, 'components/EmptyState.vue')
const COMPONENT_SOURCE = fs.readFileSync(COMPONENT, 'utf8')
const TEXT_FILE = /\.(js|vue)$/
const RAW_MARKUP = /empty-state-(icon|title|hint|actions)/

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

describe('empty state component', () => {
  it('supports the five shared sizes and defaults to md', () => {
    expect(COMPONENT_SOURCE).toContain("const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']")
    expect(COMPONENT_SOURCE).toMatch(/size:\s*\{\s*type:\s*String,\s*default:\s*'md'\s*\}/)
    expect(COMPONENT_SOURCE).toContain('`is-${sizeClass}`')
  })

  it('scales padding and icon size through design tokens', () => {
    for (const size of ['xl', 'lg', 'sm', 'xs']) {
      const rule = COMPONENT_SOURCE.match(new RegExp(`\\.empty-state\\.is-${size} \\{[^}]*\\}`))
      expect(rule, size).toBeTruthy()
      expect(rule[0]).toContain('padding:')
      const iconRule = COMPONENT_SOURCE.match(
        new RegExp(`\\.empty-state\\.is-${size} \\.empty-state-icon \\{[^}]*\\}`)
      )
      expect(iconRule, `icon ${size}`).toBeTruthy()
      expect(iconRule[0]).toContain('width:')
    }
  })

  it('renders the shared empty-state markup only through the component', () => {
    const offenders = []

    for (const file of collectFiles(SRC)) {
      if (file === COMPONENT) continue
      const lines = fs.readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (RAW_MARKUP.test(line) && !line.includes(':deep(')) {
          offenders.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })
})
