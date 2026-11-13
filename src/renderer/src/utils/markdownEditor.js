import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'

marked.setOptions({ gfm: true, breaks: true })

const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    'script',
    'style',
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'link',
    'meta',
    'base',
    'form',
    'textarea',
    'select',
    'option',
    'button'
  ],
  FORBID_ATTR: ['style', 'srcdoc', 'formaction'],
  ALLOW_DATA_ATTR: false
}

let hooksInstalled = false

function installHooks() {
  if (hooksInstalled) return
  hooksInstalled = true

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!node.tagName) return

    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }

    if (node.tagName === 'INPUT') {
      const type = (node.getAttribute('type') || '').toLowerCase()
      if (type !== 'checkbox') {
        node.remove()
        return
      }
      node.setAttribute('disabled', '')
    }
  })
}

export function renderMarkdownPreview(source) {
  installHooks()
  const html = marked.parse(String(source || ''), { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(html, SANITIZE_CONFIG)
}

function slugify(text) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-') || 'section'
  )
}

export function decorateMarkdownPreview(root) {
  if (!root) return

  const usedIds = new Set()
  for (const heading of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (heading.id) continue
    const base = slugify(heading.textContent || '')
    let id = base
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`
      suffix += 1
    }
    usedIds.add(id)
    heading.id = id
  }

  for (const block of root.querySelectorAll('pre code')) {
    if (block.dataset.highlighted === 'yes') continue
    try {
      hljs.highlightElement(block)
    } catch {
      // 未知语言保持纯文本展示
    }
  }
}
