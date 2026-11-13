<template>
  <div ref="editorContainer" class="markdown-editor-host" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  placeholder
} from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from '@codemirror/language'
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { getResolvedTheme } from '@/utils/theme'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'scroll', 'cursor', 'image'])

const editorContainer = ref(null)
let editorView = null

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13.5px',
    fontFamily: "'JetBrains Mono', 'Consolas', 'Monaco', monospace",
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--text-primary)'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: '1.7'
  },
  '.cm-content': {
    padding: '14px 0',
    caretColor: 'var(--editor-caret)',
    minHeight: '100%',
    backgroundColor: 'var(--editor-bg)'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-gutter-bg)',
    borderRight: '1px solid var(--editor-border)',
    color: 'var(--text-tertiary)'
  },
  '.cm-line': {
    padding: '0 14px'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(var(--accent-rgb), 0.05)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(var(--accent-rgb), 0.08)',
    color: 'var(--accent-color)'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--editor-selection)'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--editor-caret)'
  }
})

const themeCompartment = new Compartment()

function getThemeExtensions() {
  return getResolvedTheme() === 'dark' ? [oneDark, editorTheme] : [editorTheme]
}

function handleThemeChange() {
  if (!editorView) return
  editorView.dispatch({ effects: themeCompartment.reconfigure(getThemeExtensions()) })
}

function focus() {
  editorView?.focus()
}

function getSelection() {
  if (!editorView) return ''
  const range = editorView.state.selection.main
  if (range.from === range.to) return ''
  return editorView.state.sliceDoc(range.from, range.to)
}

function wrapSelection(before, after, placeholderText = '文本') {
  const view = editorView
  if (!view) return
  const range = view.state.selection.main
  const selected = view.state.sliceDoc(range.from, range.to)
  const text = selected || placeholderText
  const start = range.from + before.length
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: `${before}${text}${after}` },
    selection: { anchor: start, head: start + text.length }
  })
  focus()
}

function toggleLineMark(prefix, matcher) {
  const view = editorView
  if (!view) return
  const range = view.state.selection.main
  const startLine = view.state.doc.lineAt(range.from)
  const endLine = view.state.doc.lineAt(range.to)
  const changes = []

  for (let number = startLine.number; number <= endLine.number; number += 1) {
    const line = view.state.doc.line(number)
    const match = line.text.match(matcher)
    if (match) {
      changes.push({
        from: line.from,
        to: line.from + match[0].length,
        insert: match[0] === prefix ? '' : prefix
      })
    } else {
      changes.push({ from: line.from, insert: prefix })
    }
  }

  if (changes.length) view.dispatch({ changes })
  focus()
}

function insertBlock(text, selectText = '') {
  const view = editorView
  if (!view) return
  const range = view.state.selection.main
  const line = view.state.doc.lineAt(range.from)
  const prefix = line.from === range.from && line.text.trim() === '' ? '' : '\n'
  const insert = `${prefix}${text}\n`
  const blockStart = range.from + prefix.length
  const index = selectText ? text.indexOf(selectText) : -1
  const selectionStart = blockStart + (index >= 0 ? index : 0)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: selectionStart, head: selectionStart + (index >= 0 ? selectText.length : 0) }
  })
  focus()
}

function insertLink() {
  const view = editorView
  if (!view) return
  const range = view.state.selection.main
  const selected = view.state.sliceDoc(range.from, range.to) || '链接文字'
  const before = `[${selected}](`
  const url = 'https://'
  const start = range.from + before.length
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: `${before}${url})` },
    selection: { anchor: start, head: start + url.length }
  })
  focus()
}

function insertImage() {
  const view = editorView
  if (!view) return
  const url = 'https://'
  const insert = `![图片描述](${url})`
  const start = view.state.selection.main.from + '![图片描述]('.length
  view.dispatch({
    changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert },
    selection: { anchor: start, head: start + url.length }
  })
  focus()
}

function insertCodeBlock() {
  const view = editorView
  if (!view) return
  const range = view.state.selection.main
  const selected = view.state.sliceDoc(range.from, range.to)
  const body = selected || '代码'
  const line = view.state.doc.lineAt(range.from)
  const prefix = line.from === range.from && line.text.trim() === '' ? '' : '\n'
  const insert = `${prefix}\`\`\`\n${body}\n\`\`\`\n`
  const start = range.from + prefix.length + 4
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: start, head: start + body.length }
  })
  focus()
}

function insertTable() {
  insertBlock('| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |', '列 1')
}

function setContent(content) {
  if (!editorView) return
  if (content === editorView.state.doc.toString()) return
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: content }
  })
}

function insertText(text) {
  const view = editorView
  if (!view) return
  const range = view.state.selection.main
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: { anchor: range.from + text.length }
  })
  focus()
}

function emitCursor(state) {
  const range = state.selection.main
  const line = state.doc.lineAt(range.head)
  emit('cursor', {
    line: line.number,
    column: range.head - line.from + 1,
    selected: Math.abs(range.to - range.from),
    totalLines: state.doc.lines
  })
}

onMounted(() => {
  if (!editorContainer.value) return

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
    if (update.docChanged || update.selectionSet) emitCursor(update.state)
  })

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      indentOnInput(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      history(),
      placeholder('在此输入 Markdown，右侧实时预览…'),
      keymap.of([
        {
          key: 'Mod-b',
          run: () => {
            wrapSelection('**', '**', '粗体')
            return true
          }
        },
        {
          key: 'Mod-i',
          run: () => {
            wrapSelection('*', '*', '斜体')
            return true
          }
        },
        {
          key: 'Mod-e',
          run: () => {
            wrapSelection('`', '`', '代码')
            return true
          }
        },
        {
          key: 'Mod-k',
          run: () => {
            insertLink()
            return true
          }
        },
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab
      ]),
      themeCompartment.of(getThemeExtensions()),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        scroll: (_event, view) => {
          const el = view.scrollDOM
          const max = el.scrollHeight - el.clientHeight
          emit('scroll', max > 0 ? el.scrollTop / max : 0)
        },
        paste: (event) => {
          const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'))
          if (files.length === 0) return false
          event.preventDefault()
          for (const file of files) emit('image', file)
          return true
        },
        drop: (event) => {
          const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'))
          if (files.length === 0) return false
          event.preventDefault()
          for (const file of files) emit('image', file)
          return true
        }
      }),
      updateListener,
      EditorState.allowMultipleSelections.of(false)
    ]
  })

  editorView = new EditorView({ state, parent: editorContainer.value })
  window.addEventListener('ntb-theme-changed', handleThemeChange)
})

onUnmounted(() => {
  window.removeEventListener('ntb-theme-changed', handleThemeChange)
  editorView?.destroy()
  editorView = null
})

watch(
  () => props.modelValue,
  (value) => setContent(value)
)

defineExpose({
  focus,
  getSelection,
  setContent,
  insertText,
  wrapSelection,
  toggleLineMark,
  insertBlock,
  insertLink,
  insertImage,
  insertCodeBlock,
  insertTable
})
</script>

<style scoped>
.markdown-editor-host {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--editor-bg);
}

.markdown-editor-host :deep(.cm-editor) {
  height: 100%;
}

.markdown-editor-host :deep(.cm-scroller) {
  overflow: auto;
}
</style>
