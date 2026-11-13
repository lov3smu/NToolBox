const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

function safeUrl(url) {
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null
}

const THINKING_OPEN = '<thinking>'
const THINKING_CLOSE = '</thinking>'

export function splitThinkingTags(content) {
  const thinking = []
  let rest = String(content || '').replace(/<thinking>([\s\S]*?)<\/thinking>/g, (_match, text) => {
    if (text.trim()) thinking.push(text.trim())
    return ''
  })
  const open = rest.indexOf(THINKING_OPEN)
  if (open !== -1) {
    const tail = rest.slice(open + THINKING_OPEN.length).trim()
    if (tail) thinking.push(tail)
    rest = rest.slice(0, open)
  }
  rest = rest.replaceAll(THINKING_CLOSE, '')
  return { thinking: thinking.join('\n'), content: rest }
}

export function trimPartialThinkingTag(text) {
  const tags = [THINKING_OPEN, THINKING_CLOSE]
  for (let len = Math.min(THINKING_CLOSE.length - 1, text.length); len > 0; len -= 1) {
    const tail = text.slice(-len)
    if (tags.some((tag) => tag.startsWith(tail))) return text.slice(0, -len)
  }
  return text
}

export function stripThinking(content) {
  return content
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .replace(/<thinking>[\s\S]*$/g, '')
    .trim()
}

export function renderMarkdown(content) {
  if (!content) return ''

  const source = escapeHtml(stripThinking(String(content)))
  const blocks = []
  const inline = []

  let text = source.replace(/[\uE000\uE001]/g, '').replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    blocks.push(`<pre class="code-block"><code data-lang="${lang}">${code.replace(/\n$/, '')}</code></pre>`)
    return `\uE000${blocks.length - 1}\uE000`
  })

  text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
    inline.push(`<code class="inline-code">${code}</code>`)
    return `\uE001${inline.length - 1}\uE001`
  })

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    const href = safeUrl(url)
    return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>` : label
  })

  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')

  const lines = text.split('\n')
  let html = ''
  let listTag = null

  const closeList = () => {
    if (listTag) {
      html += `</${listTag}>`
      listTag = null
    }
  }

  for (const line of lines) {
    if (!line.trim()) {
      closeList()
      continue
    }

    if (/^\uE000\d+\uE000$/.test(line)) {
      closeList()
      html += line
      continue
    }

    let match = line.match(/^(#{1,6})\s+(.*)$/)
    if (match) {
      closeList()
      const level = match[1].length
      html += `<h${level}>${match[2]}</h${level}>`
      continue
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      closeList()
      html += '<hr>'
      continue
    }

    match = line.match(/^\s*[-*+]\s+(.*)$/)
    if (match) {
      if (listTag !== 'ul') {
        closeList()
        html += '<ul>'
        listTag = 'ul'
      }
      html += `<li>${match[1]}</li>`
      continue
    }

    match = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (match) {
      if (listTag !== 'ol') {
        closeList()
        html += '<ol>'
        listTag = 'ol'
      }
      html += `<li>${match[1]}</li>`
      continue
    }

    match = line.match(/^&gt;\s?(.*)$/)
    if (match) {
      closeList()
      html += `<blockquote>${match[1]}</blockquote>`
      continue
    }

    closeList()
    html += `${line}<br>`
  }

  closeList()

  return html
    .replace(/\uE000(\d+)\uE000/g, (_match, index) => blocks[index])
    .replace(/\uE001(\d+)\uE001/g, (_match, index) => inline[index])
}
