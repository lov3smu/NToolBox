import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RENDERER_DIR = path.join(root, 'src/renderer/src')

// 只读 / 筛选型弹窗：允许点外关闭（PROJECT.md §7.10 例外）
const READ_ONLY_DIALOGS = new Set([
  'src/renderer/src/views/database/components/CellViewerDialog.vue',
  'src/renderer/src/views/database/components/ErDialog.vue',
  'src/renderer/src/views/database/components/ExplainDialog.vue',
  'src/renderer/src/views/database/components/HealthDialog.vue',
  'src/renderer/src/views/database/components/HistoryDialog.vue',
  'src/renderer/src/views/database/components/ManageDialog.vue',
  'src/renderer/src/views/database/components/OperationLogDialog.vue',
  'src/renderer/src/views/database/components/ResultCompareDialog.vue',
  'src/renderer/src/views/database/components/ServerStatusDialog.vue',
  'src/renderer/src/views/database/components/SessionDialog.vue',
  'src/renderer/src/views/database/components/SqlAuditDialog.vue'
])

// 文件级白名单：点外关闭仅作用于只读面板（搜索、筛选、属性、草稿箱）
const OUTSIDE_CLICK_DIALOGS = new Set([
  'src/renderer/src/components/ScriptManager.vue',
  'src/renderer/src/components/SearchModal.vue',
  'src/renderer/src/views/WechatFormatter.vue',
  'src/renderer/src/views/database/components/HistoryDialog.vue',
  'src/renderer/src/views/database/components/OperationLogDialog.vue',
  'src/renderer/src/views/database/components/SessionDialog.vue'
])

const EDITABLE_CONTROL = /<(?:input|textarea|select)\b[^>]*\bv-model\b/s

function collectVue(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectVue(full, out)
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

function readTemplate(source) {
  const start = source.indexOf('<template>')
  if (start === -1) return ''
  const end = source.indexOf('</template>', start)
  return end === -1 ? source.slice(start) : source.slice(start, end)
}

describe('modal dismissal policy', () => {
  it('keeps outside-click dismissal off for v-modal-shell dialogs with editable controls', () => {
    const failures = []
    for (const file of collectVue(RENDERER_DIR)) {
      const rel = path.relative(root, file).split(path.sep).join('/')
      if (READ_ONLY_DIALOGS.has(rel)) continue
      const source = fs.readFileSync(file, 'utf8')
      const bindings = [...source.matchAll(/v-modal-shell="([^"]*)"/g)].map((match) => match[1])
      if (!bindings.length || !EDITABLE_CONTROL.test(readTemplate(source))) continue
      const guarded = bindings.every(
        (value) => value.trim().startsWith('{') && /closeOnOutside\s*:\s*false/.test(value)
      )
      if (!guarded) failures.push(rel)
    }
    expect(failures).toEqual([])
  })

  it('does not bind @click.self in overlays with editable controls', () => {
    const failures = []
    for (const file of collectVue(RENDERER_DIR)) {
      const rel = path.relative(root, file).split(path.sep).join('/')
      if (OUTSIDE_CLICK_DIALOGS.has(rel)) continue
      const source = fs.readFileSync(file, 'utf8')
      if (!source.includes('@click.self')) continue
      if (EDITABLE_CONTROL.test(readTemplate(source))) failures.push(rel)
    }
    expect(failures).toEqual([])
  })

  it('disables outside-click dismissal for prompt dialogs', () => {
    const source = fs.readFileSync(path.join(RENDERER_DIR, 'components/MessageDialog.vue'), 'utf8')
    expect(source).toMatch(/:close-on-outside="!prompt"/)
  })
})
