import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'src/renderer/src')
const componentSource = fs.readFileSync(path.join(SRC, 'components/CopyButton.vue'), 'utf8')

const MIGRATED_VIEWS = [
  'views/UnixTimestamp.vue',
  'views/TextToolbox.vue',
  'views/Codec.vue',
  'views/Cron.vue',
  'views/SystemTools.vue',
  'views/TemplateCenter.vue',
  'views/HttpClient.vue',
  'views/ExtensionMarket.vue',
  'views/database/components/CellViewerDialog.vue'
]

describe('copy button', () => {
  it('supports the five shared sizes and defaults to md', () => {
    expect(componentSource).toContain("const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']")
    expect(componentSource).toMatch(/size:\s*\{\s*type:\s*String,\s*default:\s*'md'\s*\}/)
    expect(componentSource).toContain('`is-${sizeClass}`')
    expect(componentSource).toContain('`is-${variantClass}`')
  })

  it('scales height and icon size through design tokens', () => {
    for (const size of ['xl', 'lg', 'sm', 'xs']) {
      const rule = componentSource.match(new RegExp(`\\.copy-button\\.is-${size} \\{[^}]*\\}`))
      expect(rule, size).toBeTruthy()
      expect(rule[0]).toContain('var(--control-height')
      const widthRule = componentSource.match(new RegExp(`\\.copy-button\\.is-icon\\.is-${size} \\{[^}]*\\}`))
      expect(widthRule, `icon ${size}`).toBeTruthy()
      expect(widthRule[0]).toContain('var(--control-height')
    }
  })

  it('routes clipboard writes through the shared helper', () => {
    expect(componentSource).toContain("from '@/utils/clipboard'")
    expect(componentSource).not.toContain('navigator.clipboard')
    expect(componentSource).not.toContain('execCommand')
  })

  it('replaces hand-rolled copy actions in migrated views', () => {
    for (const relative of MIGRATED_VIEWS) {
      const file = path.join(SRC, relative)
      const source = fs.readFileSync(file, 'utf8')
      expect(source, relative).toContain('CopyButton')
      expect(source, relative).not.toContain('copyToClipboard')
    }
  })
})
