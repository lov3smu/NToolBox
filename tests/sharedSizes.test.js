import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const COMPONENTS = [
  'src/renderer/src/components/MessageDialog.vue',
  'src/renderer/src/components/settings/SettingSelect.vue',
  'src/renderer/src/components/settings/SettingModelPicker.vue',
  'src/renderer/src/components/RadioOption.vue',
  'src/renderer/src/components/AppSelect.vue',
  'src/renderer/src/components/AppInput.vue',
  'src/renderer/src/components/AppTextarea.vue',
  'src/renderer/src/components/TabBar.vue',
  'src/renderer/src/components/OverflowMenu.vue',
  'src/renderer/src/components/Toast.vue',
  'src/renderer/src/components/HoverPopover.vue',
  'src/renderer/src/components/SendToMenu.vue',
  'src/renderer/src/components/SplitPicker.vue',
  'src/renderer/src/components/NotificationCenter.vue',
  'src/renderer/src/components/SearchModal.vue',
  'src/renderer/src/components/PluginInstallDialog.vue',
  'src/renderer/src/components/EmptyState.vue',
  'src/renderer/src/components/CopyButton.vue',
  'src/renderer/src/components/FilePropertiesDialog.vue'
]

const SIZE_RULE = /\.is-(xl|lg|sm|xs)\b/g

describe('shared component sizes', () => {
  it.each(COMPONENTS)('%s exposes five sizes and defaults to md', (file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    expect(source).toContain("['xl', 'lg', 'md', 'sm', 'xs']")
    expect(source).toMatch(/default: 'md'/)
    expect(source).toContain('sizeClass')
  })

  it.each(COMPONENTS)('%s styles every non-default size via tokens', (file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    const style = source.slice(source.indexOf('<style'))
    const sizes = [...style.matchAll(SIZE_RULE)].map((match) => match[1])
    expect(new Set(sizes)).toEqual(new Set(['xl', 'lg', 'sm', 'xs']))
    expect(style).toMatch(/var\(--(control-height|font-size|icon-size)/)
  })
})
