import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const marked = new Marked()
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
  ALLOW_DATA_ATTR: true
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

export function sanitizeWechatHtml(html) {
  installHooks()
  return DOMPurify.sanitize(String(html || ''), SANITIZE_CONFIG)
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function hashString(value) {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36)
}

const EMOJIS = Object.freeze({
  smile: '😄',
  smiley: '😃',
  grin: '😁',
  joy: '😂',
  laughing: '😆',
  sweat_smile: '😅',
  wink: '😉',
  blush: '😊',
  innocent: '😇',
  heart_eyes: '😍',
  kissing_heart: '😘',
  thinking: '🤔',
  neutral_face: '😐',
  expressionless: '😑',
  unamused: '😒',
  roll_eyes: '🙄',
  smirk: '😏',
  persevere: '😣',
  disappointed: '😞',
  worried: '😟',
  angry: '😠',
  rage: '😡',
  cry: '😢',
  sob: '😭',
  scream: '😱',
  confounded: '😖',
  tired_face: '😫',
  sleeping: '😴',
  mask: '😷',
  sunglasses: '😎',
  nerd_face: '🤓',
  confused: '😕',
  slightly_smiling_face: '🙂',
  upside_down_face: '🙃',
  sunglasses_face: '😎',
  ghost: '👻',
  alien: '👽',
  robot: '🤖',
  poop: '💩',
  thumbsup: '👍',
  '+1': '👍',
  thumbsdown: '👎',
  '-1': '👎',
  ok_hand: '👌',
  clap: '👏',
  wave: '👋',
  pray: '🙏',
  muscle: '💪',
  point_right: '👉',
  point_left: '👈',
  point_up: '☝️',
  fist: '✊',
  handshake: '🤝',
  heart: '❤️',
  broken_heart: '💔',
  sparkling_heart: '💖',
  blue_heart: '💙',
  green_heart: '💚',
  yellow_heart: '💛',
  purple_heart: '💜',
  orange_heart: '🧡',
  black_heart: '🖤',
  star: '⭐',
  star2: '🌟',
  sparkles: '✨',
  fire: '🔥',
  boom: '💥',
  zap: '⚡',
  rainbow: '🌈',
  sun: '☀️',
  moon: '🌙',
  cloud: '☁️',
  snowflake: '❄️',
  umbrella: '☔',
  coffee: '☕',
  beer: '🍺',
  pizza: '🍕',
  hamburger: '🍔',
  cake: '🍰',
  apple: '🍎',
  watermelon: '🍉',
  cherry: '🍒',
  tada: '🎉',
  gift: '🎁',
  balloon: '🎈',
  trophy: '🏆',
  medal: '🏅',
  soccer: '⚽',
  basketball: '🏀',
  check: '✅',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
  x: '❌',
  warning: '⚠️',
  no_entry: '⛔',
  question: '❓',
  exclamation: '❗',
  bulb: '💡',
  bookmark: '🔖',
  link: '🔗',
  lock: '🔒',
  unlock: '🔓',
  key: '🔑',
  mag: '🔍',
  hammer: '🔨',
  wrench: '🔧',
  gear: '⚙️',
  package: '📦',
  computer: '💻',
  keyboard: '⌨️',
  phone: '📱',
  camera: '📷',
  video_camera: '📹',
  bell: '🔔',
  calendar: '📅',
  clock: '🕐',
  hourglass: '⌛',
  chart_with_upwards_trend: '📈',
  chart_with_downwards_trend: '📉',
  memo: '📝',
  books: '📚',
  book: '📖',
  newspaper: '📰',
  email: '📧',
  envelope: '✉️',
  pushpin: '📌',
  round_pushpin: '📍',
  paperclip: '📎',
  scissors: '✂️',
  pencil2: '✏️',
  art: '🎨',
  musical_note: '🎵',
  headphone: '🎧',
  movie_camera: '🎥',
  game_die: '🎲',
  rocket: '🚀',
  airplane: '✈️',
  car: '🚗',
  bike: '🚲',
  ship: '🚢',
  house: '🏠',
  office: '🏢',
  school: '🏫',
  hospital: '🏥',
  bank: '🏦',
  earth_asia: '🌏',
  globe_with_meridians: '🌐',
  cn: '🇨🇳',
  us: '🇺🇸',
  jp: '🇯🇵',
  kr: '🇰🇷',
  gb: '🇬🇧'
})

const ALERT_TITLES = Object.freeze({
  note: '提示',
  info: '信息',
  tip: '技巧',
  important: '重要',
  warning: '警告',
  caution: '注意',
  abstract: '摘要',
  summary: '总结',
  tldr: '太长不看',
  todo: '待办',
  success: '成功',
  done: '完成',
  question: '问题',
  help: '帮助',
  faq: '常见问题',
  failure: '失败',
  fail: '失败',
  missing: '缺失',
  danger: '危险',
  error: '错误',
  bug: '缺陷',
  example: '示例',
  quote: '引用',
  cite: '引用',
  theorem: '定理',
  lemma: '引理',
  corollary: '推论',
  proposition: '命题',
  definition: '定义',
  axiom: '公理',
  postulate: '公设',
  assumption: '假设',
  proof: '证明',
  remark: '备注'
})

const ALERT_ICONS = Object.freeze({
  note: 'ⓘ',
  info: 'ⓘ',
  tip: '💡',
  important: '❗',
  warning: '⚠',
  caution: '⚠',
  abstract: '📋',
  summary: '📋',
  tldr: '📋',
  todo: '☑',
  success: '✅',
  done: '✅',
  question: '❓',
  help: '❓',
  faq: '❓',
  failure: '✖',
  fail: '✖',
  missing: '✖',
  danger: '⚡',
  error: '⚡',
  bug: '🐞',
  example: '📝',
  quote: '❝',
  cite: '❝',
  theorem: '💡',
  lemma: '💡',
  corollary: '💡',
  proposition: '💡',
  definition: '📖',
  axiom: '📖',
  postulate: '📖',
  assumption: '📖',
  proof: '✔',
  remark: '💬'
})

const ALERT_COLORS = Object.freeze({
  note: '#3b82f6',
  info: '#3b82f6',
  tip: '#10b981',
  important: '#8b5cf6',
  warning: '#f59e0b',
  caution: '#ef4444',
  abstract: '#8b5cf6',
  summary: '#8b5cf6',
  tldr: '#8b5cf6',
  todo: '#3b82f6',
  success: '#10b981',
  done: '#10b981',
  question: '#6b7280',
  help: '#6b7280',
  faq: '#6b7280',
  failure: '#ef4444',
  fail: '#ef4444',
  missing: '#ef4444',
  danger: '#ef4444',
  error: '#ef4444',
  bug: '#ef4444',
  example: '#06b6d4',
  quote: '#6b7280',
  cite: '#6b7280',
  theorem: '#8b5cf6',
  lemma: '#8b5cf6',
  corollary: '#8b5cf6',
  proposition: '#8b5cf6',
  definition: '#0ea5e9',
  axiom: '#0ea5e9',
  postulate: '#0ea5e9',
  assumption: '#0ea5e9',
  proof: '#10b981',
  remark: '#6b7280'
})

export function getAlertMeta(type) {
  const key = String(type || '').toLowerCase()
  return {
    type: key,
    title: ALERT_TITLES[key] || type,
    icon: ALERT_ICONS[key] || 'ⓘ',
    color: ALERT_COLORS[key] || '#3b82f6'
  }
}

function protectInlineCode(line, transform) {
  const pattern = /(`+)([\s\S]*?)\1/g
  let result = ''
  let lastIndex = 0
  let match = pattern.exec(line)
  while (match) {
    result += transform(line.slice(lastIndex, match.index))
    result += match[0]
    lastIndex = match.index + match[0].length
    match = pattern.exec(line)
  }
  result += transform(line.slice(lastIndex))
  return result
}

function createMathPlaceholder(text, display) {
  const id = `m${Math.random().toString(36).slice(2, 10)}`
  return { id, tex: text.trim(), display }
}

function replaceInlineMath(text, addMath) {
  let result = ''
  let index = 0

  while (index < text.length) {
    const rest = text.slice(index)

    const displayMatch = /^\$\$([^$\n]+?)\$\$/.exec(rest)
    if (displayMatch) {
      const placeholder = addMath(displayMatch[1], true)
      result += `<span data-wx-math="${placeholder.id}" data-display="1"></span>`
      index += displayMatch[0].length
      continue
    }

    const latexInline = /^\\\(([\s\S]*?)\\\)/.exec(rest)
    if (latexInline) {
      const placeholder = addMath(latexInline[1], false)
      result += `<span data-wx-math="${placeholder.id}"></span>`
      index += latexInline[0].length
      continue
    }

    const latexBlock = /^\\\[([\s\S]*?)\\\]/.exec(rest)
    if (latexBlock) {
      const placeholder = addMath(latexBlock[1], true)
      result += `<span data-wx-math="${placeholder.id}" data-display="1"></span>`
      index += latexBlock[0].length
      continue
    }

    if (text[index] === '$' && text[index + 1] !== '$') {
      const previous = index > 0 ? text[index - 1] : ''
      const next = text[index + 1]
      if (!/[A-Za-z0-9_\\$]/.test(previous) && next && !/[\s$]/.test(next)) {
        let cursor = index + 1
        while (cursor < text.length) {
          if (text[cursor] === '\\') {
            cursor += 2
            continue
          }
          if (text[cursor] === '$' && text[cursor - 1] !== ' ' && text[cursor + 1] !== '$') break
          if (text[cursor] === '\n') break
          cursor += 1
        }
        if (cursor < text.length && text[cursor] === '$' && cursor > index + 1) {
          const tex = text.slice(index + 1, cursor)
          if (tex.trim()) {
            const placeholder = addMath(tex, false)
            result += `<span data-wx-math="${placeholder.id}"></span>`
            index = cursor + 1
            continue
          }
        }
      }
    }

    result += text[index]
    index += 1
  }

  return result
}

function replaceRuby(text) {
  return text
    .replace(/\[([^\]]+)\]\{([^}]+)\}/g, (_, base, ruby) => renderRuby(base, ruby))
    .replace(/\[([^\]]+)\]\^\(([^)]+)\)/g, (_, base, ruby) => renderRuby(base, ruby))
}

function renderRuby(text, ruby) {
  const separator = /[・．。-]/g
  const base = String(text).trim()
  const reading = String(ruby).trim()
  if (!base || !reading) return escapeHtml(base || reading)

  if (separator.test(reading)) {
    const parts = reading.split(/[・．。-]/).filter((part) => part.trim() !== '')
    const chars = Array.from(base)
    if (chars.length >= parts.length) {
      const result = []
      let cursor = 0
      for (let index = 0; index < parts.length; index += 1) {
        const remainingParts = parts.length - index
        const count = remainingParts === 1 ? chars.length - cursor : 1
        const chunk = chars.slice(cursor, cursor + count).join('')
        result.push(rubyTag(chunk, parts[index]))
        cursor += count
      }
      if (cursor < chars.length) result.push(escapeHtml(chars.slice(cursor).join('')))
      return result.join('')
    }
    return chars.map((char, index) => (parts[index] ? rubyTag(char, parts[index]) : escapeHtml(char))).join('')
  }

  return rubyTag(base, reading)
}

function rubyTag(text, ruby) {
  return `<ruby data-text="${escapeHtml(text)}" data-ruby="${escapeHtml(ruby)}">${escapeHtml(text)}<rp>(</rp><rt>${escapeHtml(ruby)}</rt><rp>)</rp></ruby>`
}

function replaceMarkup(text) {
  let result = text
  result = result.replace(/(^|[^=])==(?=\S)([^=\n]+?)==/g, (_, prefix, value) => `${prefix}<mark>${value}</mark>`)
  result = result.replace(/(^|[^+])\+\+(?=\S)([^+\n]+?)\+\+/g, (_, prefix, value) => `${prefix}<u>${value}</u>`)
  result = result.replace(
    /(^|[^~])~(?!~)([^~\n]+?)~(?!~)/g,
    (_, prefix, value) => `${prefix}<span data-wx-wavy="1">${value}</span>`
  )
  result = result.replace(/(^|[^^])\^([^\s^]+)\^/g, (_, prefix, value) => `${prefix}<sup>${value}</sup>`)
  return result
}

function replaceEmoji(text) {
  return text.replace(/:([a-z0-9_+-]+):/g, (match, name) => EMOJIS[name.toLowerCase()] || match)
}

function transformInline(text, state) {
  return protectInlineCode(text, (segment) => {
    let result = replaceInlineMath(segment, (tex, display) => {
      const placeholder = createMathPlaceholder(tex, display)
      state.math.push(placeholder)
      return placeholder
    })
    result = result.replace(/\[\^([^\]\s]+)\]/g, (match, id) => {
      const footnote = state.footnoteMap.get(id)
      if (!footnote) return match
      return `<sup data-wx-fn="${escapeHtml(id)}">[${footnote.index}]</sup>`
    })
    result = replaceMarkup(result)
    result = replaceRuby(result)
    result = replaceEmoji(result)
    return result
  })
}

function transformMarkdown(source) {
  const state = {
    math: [],
    diagrams: [],
    plantuml: [],
    footnotes: [],
    footnoteMap: new Map(),
    hasToc: false
  }

  const lines = String(source || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')

  const filtered = []
  let fenceMarker = null
  for (const line of lines) {
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (!fenceMarker) fenceMarker = fence[1]
      else if (line.trim().startsWith(fenceMarker)) fenceMarker = null
      filtered.push(line)
      continue
    }
    if (!fenceMarker) {
      const definition = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(line)
      if (definition) {
        const id = definition[1]
        if (!state.footnoteMap.has(id)) {
          const entry = { id, text: definition[2].trim(), index: state.footnotes.length + 1 }
          state.footnoteMap.set(id, entry)
          state.footnotes.push(entry)
        }
        continue
      }
    }
    filtered.push(line)
  }

  const output = []
  for (let index = 0; index < filtered.length; index += 1) {
    const line = filtered[index]

    const fence = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[^\n]*$/.exec(line)
    if (fence) {
      const marker = fence[1]
      const language = (fence[2] || '').toLowerCase()
      const body = []
      let cursor = index + 1
      while (cursor < filtered.length && !filtered[cursor].trim().startsWith(marker)) {
        body.push(filtered[cursor])
        cursor += 1
      }
      const code = body.join('\n')
      if (language === 'mermaid') {
        const key = hashString(code)
        state.diagrams.push({ key, code })
        output.push('', `<div data-wx-mermaid="${key}"></div>`, '')
      } else if (language === 'plantuml' || language === 'puml') {
        const key = hashString(code)
        state.plantuml.push({ key, code })
        output.push('', `<div data-wx-plantuml="${key}"></div>`, '')
      } else {
        output.push(line, ...body)
        if (cursor < filtered.length) output.push(filtered[cursor])
      }
      index = cursor
      continue
    }

    const alertContainer = /^:::[ \t]*([\w-]+)[ \t]*(.*)$/.exec(line)
    if (alertContainer) {
      const type = alertContainer[1]
      const title = alertContainer[2].trim()
      const body = []
      let cursor = index + 1
      while (cursor < filtered.length && !/^:::[ \t]*$/.test(filtered[cursor].trim())) {
        body.push(filtered[cursor])
        cursor += 1
      }
      const header = `[!${type}]${title ? ` ${title}` : ''}`
      output.push(`> ${header}`)
      for (const bodyLine of body) output.push(`> ${bodyLine}`)
      output.push('')
      index = cursor
      continue
    }

    if (/^\[TOC\][ \t]*$/.test(line)) {
      state.hasToc = true
      output.push('', '<div data-wx-toc="1"></div>', '')
      continue
    }

    const blockMath = /^ {0,3}\$\$[ \t]*(.*)$/.exec(line)
    if (blockMath) {
      const first = blockMath[1]
      if (first.includes('$$')) {
        const tex = first.slice(0, first.indexOf('$$'))
        if (tex.trim()) {
          const placeholder = createMathPlaceholder(tex, true)
          state.math.push(placeholder)
          output.push('', `<div data-wx-math="${placeholder.id}" data-display="1"></div>`, '')
        }
        continue
      }
      const body = [first]
      let cursor = index + 1
      let closed = false
      while (cursor < filtered.length) {
        const closing = /^(.*?)\$\$[ \t]*$/.exec(filtered[cursor])
        if (closing) {
          if (closing[1].trim()) body.push(closing[1])
          closed = true
          break
        }
        body.push(filtered[cursor])
        cursor += 1
      }
      if (closed) {
        const placeholder = createMathPlaceholder(body.join('\n'), true)
        state.math.push(placeholder)
        output.push('', `<div data-wx-math="${placeholder.id}" data-display="1"></div>`, '')
        index = cursor
      } else {
        output.push(transformInline(line, state))
      }
      continue
    }

    const latexBlockStart = /^ {0,3}\\\[[ \t]*(.*)$/.exec(line)
    if (latexBlockStart) {
      const body = [latexBlockStart[1]]
      let cursor = index + 1
      let closed = false
      while (cursor < filtered.length) {
        const closing = /^(.*?)\\\][ \t]*$/.exec(filtered[cursor])
        if (closing) {
          if (closing[1].trim()) body.push(closing[1])
          closed = true
          break
        }
        body.push(filtered[cursor])
        cursor += 1
      }
      if (closed) {
        const placeholder = createMathPlaceholder(body.join('\n'), true)
        state.math.push(placeholder)
        output.push('', `<div data-wx-math="${placeholder.id}" data-display="1"></div>`, '')
        index = cursor
      } else {
        output.push(transformInline(line, state))
      }
      continue
    }

    output.push(transformInline(line, state))
  }

  return { markdown: output.join('\n'), state }
}

export function renderWechatInline(source) {
  try {
    return sanitizeWechatHtml(marked.parseInline(String(source || '')))
  } catch {
    return escapeHtml(source)
  }
}

export function renderWechatMarkdown(source) {
  const { markdown, state } = transformMarkdown(source)
  let html
  try {
    html = marked.parse(markdown, { async: false })
  } catch (error) {
    console.error('[wechat] Markdown 解析失败:', error)
    html = `<p>${escapeHtml(source)}</p>`
  }
  return { html: sanitizeWechatHtml(html), state }
}

export function buildFootnotesHtml(footnotes) {
  if (!footnotes || footnotes.length === 0) return ''
  const items = footnotes
    .map(
      (item) =>
        `<p data-wx-fn-item="${escapeHtml(item.id)}"><span data-wx-fn-index="1">[${item.index}]</span> ${renderWechatInline(item.text)}</p>`
    )
    .join('')
  return `<section data-wx-footnotes="1">${items}</section>`
}

export function extractHeadings(root) {
  return Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) => ({
    id: heading.id,
    level: Number(heading.tagName.slice(1)),
    text: heading.textContent.trim()
  }))
}

export function buildTocHtml(headings) {
  const items = headings.filter((heading) => heading.level > 1)
  if (items.length === 0) {
    return '<p data-wx-toc-empty="1">暂无标题</p>'
  }
  const minLevel = Math.min(...items.map((item) => item.level))
  let html = '<nav data-wx-toc-nav="1"><ul>'
  for (const item of items) {
    const depth = Math.max(0, item.level - minLevel)
    html += `<li data-wx-toc-level="${depth}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`
  }
  html += '</ul></nav>'
  return html
}

function safeSelector(selector) {
  const value = selector.trim()
  if (!value) return false
  if (/[@:[\]]/.test(value)) return false
  if (/(javascript|expression|behavior|binding)/i.test(value)) return false
  return true
}

export function applyCustomCss(root, css) {
  const source = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '')
  if (!source.trim()) return
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  let match = rulePattern.exec(source)
  let applied = 0
  while (match && applied < 500) {
    const selectors = match[1].split(',')
    const declarations = match[2]
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
    for (const selector of selectors) {
      if (!safeSelector(selector)) continue
      let elements
      try {
        elements = root.querySelectorAll(selector)
      } catch {
        continue
      }
      for (const element of elements) {
        for (const declaration of declarations) {
          const split = declaration.indexOf(':')
          if (split === -1) continue
          const property = declaration.slice(0, split).trim()
          const value = declaration
            .slice(split + 1)
            .replace(/!important/gi, '')
            .trim()
          if (!property || /^(behavior|-moz-binding)$/i.test(property)) continue
          if (/(expression|javascript:)/i.test(value)) continue
          element.style.setProperty(property, value)
        }
      }
    }
    applied += 1
    match = rulePattern.exec(source)
  }
}

export function splitHighlightedHtmlByLines(html) {
  const lines = []
  let current = ''
  const openTags = []
  let index = 0
  while (index < html.length) {
    if (html[index] === '<') {
      let tag = '<'
      index += 1
      while (index < html.length && html[index] !== '>') {
        tag += html[index]
        index += 1
      }
      if (index < html.length) {
        tag += '>'
        index += 1
      }
      current += tag
      if (tag.startsWith('</span')) openTags.pop()
      else if (tag.startsWith('<span')) openTags.push(tag)
    } else if (html[index] === '\n') {
      lines.push(current + '</span>'.repeat(openTags.length))
      current = openTags.join('')
      index += 1
    } else {
      current += html[index]
      index += 1
    }
  }
  lines.push(current)
  return lines
}

export function buildMermaidPlaceholder(diagram, theme, svg) {
  if (typeof svg === 'string' && svg) {
    return `<section data-wx-diagram="mermaid" data-wx-theme="${theme}">${svg}</section>`
  }
  const failed = svg === ''
  const label = failed ? 'Mermaid 图表渲染失败，请检查语法' : 'Mermaid 图表加载中…'
  const color = failed ? '#b91c1c' : '#9ca3af'
  return `<section data-wx-diagram="mermaid" data-wx-theme="${theme}" data-key="${diagram.key}"><p style="text-align:center;color:${color};font-size:13px;padding:18px;border:1px dashed #d1d5db;border-radius:8px;background:#fafafa;">${label}</p></section>`
}

export function plantUmlUrl(code, server = 'https://www.plantuml.com/plantuml/svg/') {
  const bytes = new window.TextEncoder().encode(String(code || ''))
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return `${server}~h${hex}`
}

const mermaidCache = new Map()
let mermaidModule = null

export async function renderMermaidSvg(code, dark) {
  const key = diagramCacheKey(code, dark)
  if (mermaidCache.has(key)) return mermaidCache.get(key)

  if (!mermaidModule) {
    const module = await import('mermaid')
    mermaidModule = module.default
  }

  mermaidModule.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'default',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    flowchart: { htmlLabels: true, useMaxWidth: true },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true }
  })

  const id = `wx-mermaid-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const result = await mermaidModule.render(id, code)
  mermaidCache.set(key, result.svg)
  return result.svg
}

function diagramCacheKey(code, dark) {
  return `${hashString(code)}:${dark ? '1' : '0'}`
}

export function getCachedDiagramSvg(code, dark) {
  return mermaidCache.get(diagramCacheKey(code, dark))
}

export function isDiagramSettled(code, dark) {
  return mermaidCache.has(diagramCacheKey(code, dark))
}

export async function ensureDiagramsRendered(diagrams, dark) {
  const pending = diagrams.filter((diagram) => !isDiagramSettled(diagram.code, dark))
  if (pending.length === 0) return false
  for (const diagram of pending) {
    try {
      await renderMermaidSvg(diagram.code, dark)
    } catch (error) {
      console.warn('[wechat] Mermaid 渲染失败:', error)
      mermaidCache.set(diagramCacheKey(diagram.code, dark), '')
    }
  }
  return true
}
