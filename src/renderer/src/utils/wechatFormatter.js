import { decorateMarkdownPreview } from './markdownEditor'
import {
  applyCustomCss,
  buildFootnotesHtml,
  buildMermaidPlaceholder,
  buildTocHtml,
  extractHeadings,
  getAlertMeta,
  getCachedDiagramSvg,
  plantUmlUrl,
  renderWechatMarkdown,
  splitHighlightedHtmlByLines
} from './wechatMarkdown'
import { renderMathToSvg } from './wechatMath'
import {
  getCodeTheme,
  getWechatFont,
  isDarkWechatTheme,
  normalizeWechatPrefs,
  resolveLinkColor,
  resolveWechatTheme
} from './wechatThemes'

function applyStyles(element, styles) {
  if (!element || !styles) return
  for (const [property, value] of Object.entries(styles)) {
    if (value === undefined || value === null || value === '') continue
    element.style.setProperty(property, String(value))
  }
}

function applyAll(elements, styles) {
  for (const element of elements) {
    if (!element.closest) continue
    const svg = element.closest('svg')
    if (svg && svg !== element) continue
    applyStyles(element, styles)
  }
}

function withAlpha(hex, alpha) {
  const value = String(hex).replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return hex
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function scaleSpacing(value, factor) {
  if (!factor || factor === 1) return value
  return String(value).replace(/(-?\d+(?:\.\d+)?)px/g, (_, number) => `${Math.round(Number(number) * factor)}px`)
}

function styleCodeTokens(code, tokens) {
  for (const span of code.querySelectorAll('span')) {
    for (const [token, color] of Object.entries(tokens)) {
      if (span.classList.contains(`hljs-${token}`)) {
        applyStyles(span, { color })
        break
      }
    }
  }
}

function replaceTaskCheckboxes(container, theme) {
  for (const input of container.querySelectorAll('input[type="checkbox"]')) {
    const item = input.closest('li')
    const marker = document.createElement('span')
    marker.textContent = input.checked ? '✓' : '○'
    marker.setAttribute(
      'style',
      `color:${input.checked ? theme.accent : theme.muted};font-weight:700;margin-right:6px;`
    )
    input.replaceWith(marker)
    if (item) {
      item.classList.add('task-list-item')
      item.style.setProperty('list-style', 'none')
    }
  }
}

function replaceFragment(element, html) {
  const template = document.createElement('template')
  template.innerHTML = html
  element.replaceWith(template.content)
}

function extractAlertHeader(paragraph) {
  const breakElement = paragraph.querySelector('br')
  if (breakElement) {
    let header = ''
    let node = paragraph.firstChild
    while (node && node !== breakElement) {
      header += node.textContent || ''
      const next = node.nextSibling
      node.remove()
      node = next
    }
    breakElement.remove()
    if (!paragraph.textContent.trim() && !paragraph.querySelector('img, table, pre')) paragraph.remove()
    return header
  }
  const header = paragraph.textContent || ''
  paragraph.remove()
  return header
}

function expandAlerts(container, theme) {
  for (const blockquote of Array.from(container.querySelectorAll('blockquote'))) {
    const firstParagraph = blockquote.querySelector('p')
    if (!firstParagraph) continue
    const match = /^\[!([^\]\n]+)\][ \t]*([\s\S]*)$/.exec(firstParagraph.textContent || '')
    if (!match) continue

    const header = extractAlertHeader(firstParagraph)
    const headerMatch = /^\[!([^\]\n]+)\][ \t]*([\s\S]*)$/.exec(header)
    if (!headerMatch) continue
    const meta = getAlertMeta(headerMatch[1].trim())
    const customTitle = (headerMatch[2] || '').split('\n')[0].trim()

    const section = document.createElement('section')
    section.dataset.wxAlert = meta.type
    section.dataset.wxAlertColor = meta.color

    const title = document.createElement('p')
    title.dataset.wxAlertTitle = '1'
    title.textContent = `${meta.icon} ${customTitle || meta.title}`
    section.appendChild(title)

    while (blockquote.firstChild) section.appendChild(blockquote.firstChild)
    blockquote.replaceWith(section)
  }

  for (const section of container.querySelectorAll('[data-wx-alert]')) {
    const color = section.dataset.wxAlertColor || theme.accent
    applyStyles(section, {
      margin: '22px 0',
      padding: '14px 16px',
      'border-left': `4px solid ${color}`,
      'border-radius': '0 8px 8px 0',
      'background-color': withAlpha(color, 0.08),
      color: theme.text
    })
    applyAll(section.querySelectorAll('p'), {
      margin: '6px 0',
      'text-align': 'left',
      'text-indent': '0',
      color: theme.text
    })
    applyAll(section.querySelectorAll('[data-wx-alert-title]'), {
      margin: '0 0 8px',
      'font-weight': '700',
      color,
      'font-size': '1em',
      'line-height': '1.5'
    })
    applyAll(section.querySelectorAll('a'), {
      color,
      'border-bottom': `1px solid ${color}`
    })
  }
}

function expandMath(container, state, theme) {
  const placeholders = Array.from(container.querySelectorAll('[data-wx-math]'))
  if (placeholders.length === 0) return
  const lookup = new Map(state.math.map((item) => [item.id, item]))
  for (const placeholder of placeholders) {
    const id = placeholder.dataset.wxMath
    const entry = lookup.get(id)
    if (!entry) {
      placeholder.remove()
      continue
    }
    const display = entry.display || placeholder.dataset.display === '1'
    const svg = renderMathToSvg(entry.tex, display)
    const wrapper = document.createElement('span')
    wrapper.dataset.wxMathRendered = '1'
    wrapper.dataset.display = display ? '1' : '0'
    wrapper.innerHTML = svg
    if (display) {
      applyStyles(wrapper, {
        display: 'block',
        'text-align': 'center',
        margin: '18px 0',
        'max-width': '100%',
        'overflow-x': 'auto'
      })
    } else {
      applyStyles(wrapper, {
        display: 'inline-block',
        'vertical-align': 'middle',
        'max-width': '100%',
        margin: '0 2px'
      })
    }
    applyAll(wrapper.querySelectorAll('svg'), { 'max-width': '100%', height: 'auto' })
    placeholder.replaceWith(wrapper)
  }
  applyAll(container.querySelectorAll('[data-wx-math-rendered]'), { color: theme.text })
}

function expandDiagrams(container, state, dark) {
  const placeholders = Array.from(container.querySelectorAll('[data-wx-mermaid]'))
  if (placeholders.length === 0) return
  const lookup = new Map(state.diagrams.map((item) => [item.key, item]))
  for (const placeholder of placeholders) {
    const key = placeholder.dataset.wxMermaid
    const diagram = lookup.get(key)
    if (!diagram) {
      placeholder.remove()
      continue
    }
    const svg = getCachedDiagramSvg(diagram.code, dark)
    const html = buildMermaidPlaceholder(diagram, dark ? 'dark' : 'default', svg)
    replaceFragment(placeholder, html)
  }
  applyAll(container.querySelectorAll('[data-wx-diagram]'), {
    margin: '22px 0',
    'text-align': 'center',
    'overflow-x': 'auto',
    'max-width': '100%'
  })
  applyAll(container.querySelectorAll('[data-wx-diagram] svg'), {
    'max-width': '100%',
    height: 'auto',
    'font-family': getWechatFont('sans').stack,
    'letter-spacing': 'normal'
  })
  for (const label of container.querySelectorAll(
    '[data-wx-diagram] foreignObject p, [data-wx-diagram] foreignObject span'
  )) {
    applyStyles(label, {
      margin: '0',
      padding: '0',
      'line-height': '1.5',
      'text-align': 'center',
      'text-indent': '0',
      'letter-spacing': 'normal'
    })
  }
}

function expandPlantUml(container, state, server) {
  const placeholders = Array.from(container.querySelectorAll('[data-wx-plantuml]'))
  if (placeholders.length === 0) return
  const lookup = new Map(state.plantuml.map((item) => [item.key, item]))
  for (const placeholder of placeholders) {
    const key = placeholder.dataset.wxPlantuml
    const source = lookup.get(key)
    if (!source) {
      placeholder.remove()
      continue
    }
    const image = document.createElement('img')
    image.src = plantUmlUrl(source.code, server)
    image.alt = 'PlantUML 图表'
    image.dataset.wxPlantumlImage = '1'
    placeholder.replaceWith(image)
  }
}

function expandToc(container) {
  const placeholders = Array.from(container.querySelectorAll('[data-wx-toc]'))
  if (placeholders.length === 0) return
  const headings = extractHeadings(container)
  for (const placeholder of placeholders) {
    replaceFragment(placeholder, buildTocHtml(headings))
  }
}

function appendFootnotes(container, state) {
  if (state.footnotes.length === 0) return
  const template = document.createElement('template')
  template.innerHTML = buildFootnotesHtml(state.footnotes)
  while (template.content.firstChild) container.appendChild(template.content.firstChild)
}

function restructureCodeBlock(pre, prefs, codeTheme, theme, monoFont, spacing) {
  const code = pre.querySelector('code')
  if (!code) return

  const languageClass = Array.from(code.classList).find((name) => name.startsWith('language-'))
  const language = languageClass ? languageClass.slice('language-'.length) : ''

  applyStyles(pre, {
    margin: scaleSpacing('20px 0', spacing),
    padding: '16px',
    'background-color': codeTheme.bg,
    color: codeTheme.text,
    border: `1px solid ${codeTheme.dark ? 'rgba(255,255,255,0.12)' : theme.tableBorder}`,
    'border-radius': '8px',
    'overflow-x': 'auto',
    'font-size': '13px',
    'line-height': '1.65',
    'white-space': 'pre'
  })

  if (prefs.lineNumbers) {
    const lines = splitHighlightedHtmlByLines(code.innerHTML)
    const gutter = document.createElement('section')
    gutter.dataset.wxCodeGutter = '1'
    gutter.innerHTML = lines.map((_, index) => index + 1).join('<br>')
    applyStyles(gutter, {
      flex: '0 0 auto',
      'text-align': 'right',
      padding: '10px 12px',
      'border-right': `1px solid ${codeTheme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'}`,
      color: codeTheme.lineNumber,
      'user-select': 'none',
      'font-family': monoFont,
      'font-size': '13px',
      'line-height': '1.65',
      'white-space': 'pre'
    })

    const scroll = document.createElement('section')
    applyStyles(scroll, {
      flex: '1 1 auto',
      'min-width': '0',
      padding: '10px 14px',
      'overflow-x': 'auto'
    })

    const replacement = document.createElement('code')
    replacement.innerHTML = lines.map((line) => (line === '' ? '&nbsp;' : line)).join('<br>')
    applyStyles(replacement, {
      display: 'block',
      padding: '0',
      background: 'transparent',
      color: 'inherit',
      border: 'none',
      'border-radius': '0',
      'font-family': monoFont,
      'font-size': '13px',
      'line-height': '1.65',
      'white-space': 'pre',
      'word-break': 'normal'
    })
    scroll.appendChild(replacement)

    const linesWrapper = document.createElement('section')
    linesWrapper.dataset.wxCodeLines = '1'
    applyStyles(linesWrapper, {
      display: 'flex',
      'align-items': 'stretch',
      'overflow-x': 'auto',
      'font-family': monoFont,
      'font-size': '13px',
      'line-height': '1.65'
    })
    linesWrapper.appendChild(gutter)
    linesWrapper.appendChild(scroll)

    pre.innerHTML = ''
    pre.appendChild(linesWrapper)
    applyStyles(pre, { padding: '0', 'overflow-x': 'visible', 'white-space': 'normal' })
  } else {
    applyAll(pre.querySelectorAll('code'), {
      display: 'block',
      padding: '0',
      background: 'transparent',
      color: 'inherit',
      border: 'none',
      'border-radius': '0',
      'font-size': 'inherit',
      'line-height': 'inherit',
      'white-space': 'pre',
      'word-break': 'normal'
    })
  }

  if (prefs.macCode) {
    const outer = document.createElement('section')
    outer.dataset.wxCodeBlock = '1'
    applyStyles(outer, {
      margin: scaleSpacing('20px 0', spacing),
      'border-radius': '8px',
      overflow: 'hidden',
      border: `1px solid ${codeTheme.dark ? 'rgba(255,255,255,0.12)' : theme.tableBorder}`,
      'background-color': codeTheme.bg
    })

    const header = document.createElement('section')
    header.dataset.wxCodeHeader = '1'
    applyStyles(header, {
      display: 'flex',
      'align-items': 'center',
      gap: '6px',
      padding: '8px 12px',
      'background-color': codeTheme.headerBg,
      'border-bottom': `1px solid ${codeTheme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
      color: codeTheme.dark ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.5)',
      'font-family': monoFont,
      'font-size': '12px',
      'line-height': '1'
    })
    for (const color of ['#ff5f57', '#febc2e', '#28c840']) {
      const dot = document.createElement('span')
      applyStyles(dot, {
        display: 'inline-block',
        width: '10px',
        height: '10px',
        'border-radius': '50%',
        'background-color': color
      })
      header.appendChild(dot)
    }
    const label = document.createElement('span')
    label.textContent = language ? language.toUpperCase() : 'CODE'
    applyStyles(label, { 'margin-left': '8px' })
    header.appendChild(label)

    pre.parentNode.insertBefore(outer, pre)
    outer.appendChild(header)
    outer.appendChild(pre)
    applyStyles(pre, {
      margin: '0',
      border: 'none',
      'border-radius': '0'
    })
  }

  styleCodeTokens(pre, codeTheme.tokens)
}

function applyLegends(container, prefs, theme) {
  if (prefs.legend === 'none') return
  for (const image of container.querySelectorAll('img')) {
    const title = image.getAttribute('title') || ''
    const alt = image.getAttribute('alt') || ''
    const source = image.getAttribute('src') || ''
    let caption = ''
    if (prefs.legend === 'title') caption = title
    else if (prefs.legend === 'alt') caption = alt
    else if (prefs.legend === 'title-alt') caption = title || alt
    else if (prefs.legend === 'alt-title') caption = alt || title
    else if (prefs.legend === 'filename') {
      const clean = source.split('?')[0].split('#')[0]
      caption = clean.slice(clean.lastIndexOf('/') + 1)
    }
    if (!caption) continue
    const legend = document.createElement('span')
    legend.dataset.wxLegend = '1'
    legend.textContent = caption
    applyStyles(legend, {
      display: 'block',
      'text-align': 'center',
      color: theme.muted,
      'font-size': '0.88em',
      'margin-top': '8px',
      'line-height': '1.5'
    })
    image.insertAdjacentElement('afterend', legend)
  }
}

export function renderWechatArticle(markdown, rawPrefs) {
  const prefs = normalizeWechatPrefs(rawPrefs)
  const theme = resolveWechatTheme(prefs)
  const codeTheme = getCodeTheme(prefs.codeTheme)
  const font = getWechatFont(prefs.font)
  const size = prefs.fontSize
  const spacing = prefs.blockSpacing
  const m = (value) => scaleSpacing(value, spacing)
  const linkColor = resolveLinkColor(prefs, theme)
  const dark = isDarkWechatTheme(theme)

  const { html, state } = renderWechatMarkdown(markdown)
  const container = document.createElement('div')
  container.innerHTML = html
  decorateMarkdownPreview(container)
  replaceTaskCheckboxes(container, theme)

  expandAlerts(container, theme)
  expandMath(container, state, theme)
  expandDiagrams(container, state, dark)
  expandPlantUml(container, state, prefs.plantUmlServer)
  expandToc(container)
  appendFootnotes(container, state)

  const headingBase = {
    color: theme.heading,
    'font-weight': '700',
    'line-height': '1.5',
    'letter-spacing': '0.5px',
    'text-align': 'left'
  }

  const headingStyle = prefs.headingStyle
  if (headingStyle === 'color') {
    applyAll(container.querySelectorAll('h1'), {
      ...headingBase,
      margin: m('10px 0 28px'),
      'font-size': `${size + 9}px`,
      'text-align': 'center',
      'letter-spacing': '1px'
    })
    applyAll(container.querySelectorAll('h2'), {
      ...headingBase,
      margin: m('34px 0 16px'),
      'font-size': `${size + 5}px`,
      color: theme.accent
    })
    applyAll(container.querySelectorAll('h3'), {
      ...headingBase,
      margin: m('28px 0 14px'),
      'font-size': `${size + 2}px`,
      color: theme.accent
    })
  } else if (headingStyle === 'border-left') {
    applyAll(container.querySelectorAll('h1'), {
      ...headingBase,
      margin: m('10px 0 28px'),
      'font-size': `${size + 9}px`,
      'text-align': 'center',
      'letter-spacing': '1px'
    })
    applyAll(container.querySelectorAll('h2'), {
      ...headingBase,
      margin: m('34px 0 16px'),
      padding: '2px 0 2px 12px',
      'border-left': `4px solid ${theme.accent}`,
      'font-size': `${size + 5}px`
    })
    applyAll(container.querySelectorAll('h3'), {
      ...headingBase,
      margin: m('28px 0 14px'),
      padding: '0 0 4px',
      'border-bottom': `1px solid ${theme.hr}`,
      'font-size': `${size + 2}px`,
      color: theme.accent
    })
  } else if (headingStyle === 'border-bottom') {
    applyAll(container.querySelectorAll('h1'), {
      ...headingBase,
      margin: m('10px 0 28px'),
      'font-size': `${size + 9}px`,
      'text-align': 'center',
      'letter-spacing': '1px'
    })
    applyAll(container.querySelectorAll('h2'), {
      ...headingBase,
      margin: m('34px 0 16px'),
      padding: '0 0 8px',
      'border-bottom': `2px solid ${theme.accent}`,
      'font-size': `${size + 5}px`
    })
    applyAll(container.querySelectorAll('h3'), {
      ...headingBase,
      margin: m('28px 0 14px'),
      padding: '0 0 4px',
      'border-bottom': `1px solid ${theme.hr}`,
      'font-size': `${size + 2}px`,
      color: theme.accent
    })
  } else {
    applyAll(container.querySelectorAll('h1'), {
      ...headingBase,
      margin: m('10px 0 28px'),
      'font-size': `${size + 9}px`,
      'text-align': 'center',
      'letter-spacing': '1px'
    })
    applyAll(container.querySelectorAll('h2'), {
      ...headingBase,
      margin: m('34px 0 16px'),
      padding: '2px 0 2px 12px',
      'border-left': `4px solid ${theme.accent}`,
      'font-size': `${size + 5}px`
    })
    applyAll(container.querySelectorAll('h3'), {
      ...headingBase,
      margin: m('28px 0 14px'),
      'font-size': `${size + 2}px`,
      color: theme.accent
    })
  }

  applyAll(container.querySelectorAll('h4'), {
    ...headingBase,
    margin: m('24px 0 12px'),
    'font-size': `${size}px`
  })
  applyAll(container.querySelectorAll('h5, h6'), {
    ...headingBase,
    margin: m('20px 0 10px'),
    'font-size': `${size - 1}px`,
    color: theme.muted
  })

  applyAll(container.querySelectorAll('p'), {
    margin: m('16px 0'),
    'line-height': String(prefs.lineHeight),
    'text-align': prefs.justify ? 'justify' : 'left'
  })
  if (prefs.indent) {
    applyAll(container.querySelectorAll('p'), { 'text-indent': '2em' })
  }
  applyAll(container.querySelectorAll('li > p, td p, th p, blockquote p, [data-wx-alert] p, [data-wx-footnotes] p'), {
    margin: '6px 0',
    'text-indent': '0'
  })
  applyAll(container.querySelectorAll('td p, th p'), { margin: '0' })

  applyAll(container.querySelectorAll('strong'), { 'font-weight': '700', color: theme.heading })
  applyAll(container.querySelectorAll('em'), { 'font-style': 'italic' })
  applyAll(container.querySelectorAll('del'), { color: theme.muted, 'text-decoration': 'line-through' })
  applyAll(container.querySelectorAll('mark'), {
    'background-color': withAlpha(theme.accent, 0.18),
    color: theme.heading,
    padding: '0 2px'
  })
  applyAll(container.querySelectorAll('u'), { 'text-decoration': 'underline' })
  applyAll(container.querySelectorAll('[data-wx-wavy]'), {
    'text-decoration': 'underline wavy',
    'text-decoration-skip-ink': 'none'
  })
  applyAll(container.querySelectorAll('sup'), { 'font-size': '0.75em', 'vertical-align': 'super' })

  applyAll(container.querySelectorAll('a'), {
    color: linkColor,
    'text-decoration': 'none',
    'border-bottom': `1px solid ${linkColor}`,
    'word-break': 'break-all'
  })

  applyAll(container.querySelectorAll('ul, ol'), {
    margin: m('16px 0'),
    'padding-left': '26px'
  })
  applyAll(container.querySelectorAll('li'), {
    margin: m('8px 0'),
    'line-height': String(prefs.lineHeight)
  })
  applyAll(container.querySelectorAll('li > ul, li > ol'), { margin: m('6px 0') })
  applyAll(container.querySelectorAll('li.task-list-item'), { 'list-style': 'none' })

  const quoteBackground =
    prefs.quoteBg === 'none' ? 'transparent' : prefs.quoteBg === 'tint' ? withAlpha(theme.accent, 0.08) : theme.quoteBg
  applyAll(container.querySelectorAll('blockquote'), {
    margin: m('22px 0'),
    padding: '14px 18px',
    'background-color': quoteBackground,
    'border-left': `4px solid ${theme.quoteBorder}`,
    'border-radius': '0 6px 6px 0',
    color: theme.quoteText
  })
  applyAll(container.querySelectorAll('blockquote p'), {
    margin: '4px 0',
    color: theme.quoteText,
    'text-align': 'left',
    'text-indent': '0'
  })

  applyAll(container.querySelectorAll('hr'), {
    margin: m('30px 0'),
    border: 'none',
    'border-top': `1px solid ${theme.hr}`
  })

  const monoFont = getWechatFont('mono').stack
  applyAll(container.querySelectorAll('code'), {
    'font-family': monoFont,
    'font-size': '0.9em',
    'background-color': theme.inlineBg,
    color: theme.inlineText,
    padding: '2px 5px',
    'border-radius': '4px',
    'word-break': 'break-word'
  })

  for (const pre of Array.from(container.querySelectorAll('pre'))) {
    restructureCodeBlock(pre, prefs, codeTheme, theme, monoFont, spacing)
  }

  applyAll(container.querySelectorAll('table'), {
    width: '100%',
    'border-collapse': 'collapse',
    margin: m('20px 0'),
    'font-size': '0.95em'
  })
  applyAll(container.querySelectorAll('th, td'), {
    border: `1px solid ${theme.tableBorder}`,
    padding: '8px 10px',
    'text-align': 'left',
    'line-height': '1.6',
    'vertical-align': 'top'
  })
  applyAll(container.querySelectorAll('th'), {
    'background-color': theme.tableHeadBg,
    color: theme.heading,
    'font-weight': '600'
  })
  container.querySelectorAll('tbody tr').forEach((row, index) => {
    if (index % 2 === 1) applyAll(row.querySelectorAll('td'), { 'background-color': theme.rowBg })
  })

  applyAll(container.querySelectorAll('img'), {
    display: 'block',
    'max-width': '100%',
    height: 'auto',
    margin: m('22px auto'),
    'border-radius': '6px'
  })
  applyAll(container.querySelectorAll('p > img'), { margin: m('12px auto') })
  applyAll(container.querySelectorAll('figcaption'), {
    'text-align': 'center',
    color: theme.muted,
    'font-size': '0.9em',
    'margin-top': '8px'
  })
  applyLegends(container, prefs, theme)

  applyAll(container.querySelectorAll('kbd'), {
    'font-family': monoFont,
    'font-size': '0.85em',
    'background-color': theme.inlineBg,
    border: `1px solid ${theme.tableBorder}`,
    'border-bottom-width': '2px',
    'border-radius': '4px',
    padding: '1px 5px'
  })
  applyAll(container.querySelectorAll('summary'), {
    color: theme.accent,
    'font-weight': '600',
    cursor: 'pointer'
  })

  applyAll(container.querySelectorAll('ruby'), {
    'ruby-position': 'over'
  })
  applyAll(container.querySelectorAll('rt'), {
    'font-size': '0.5em',
    color: theme.muted,
    'letter-spacing': '0'
  })
  applyAll(container.querySelectorAll('rp'), { display: 'none' })

  applyAll(container.querySelectorAll('[data-wx-fn]'), {
    color: theme.accent,
    'font-size': '0.72em',
    'line-height': '1'
  })
  applyAll(container.querySelectorAll('[data-wx-footnotes]'), {
    'margin-top': m('32px'),
    'padding-top': '12px',
    'border-top': `1px dashed ${theme.hr}`,
    color: theme.muted,
    'font-size': '0.86em'
  })
  applyAll(container.querySelectorAll('[data-wx-footnotes] p'), {
    margin: m('6px 0'),
    'line-height': '1.65',
    'text-align': 'left',
    'text-indent': '0'
  })
  applyAll(container.querySelectorAll('[data-wx-fn-index]'), {
    color: theme.accent,
    'margin-right': '4px'
  })

  applyAll(container.querySelectorAll('[data-wx-toc-nav]'), {
    margin: m('20px 0'),
    padding: '12px 16px',
    'background-color': theme.quoteBg,
    'border-radius': '8px',
    'border-left': `3px solid ${theme.accent}`
  })
  applyAll(container.querySelectorAll('[data-wx-toc-nav] ul'), {
    margin: '0',
    padding: '0',
    'list-style': 'none'
  })
  applyAll(container.querySelectorAll('[data-wx-toc-nav] li'), {
    margin: m('6px 0'),
    'line-height': '1.65',
    'list-style': 'none'
  })
  for (const item of container.querySelectorAll('[data-wx-toc-nav] li')) {
    const depth = Number(item.dataset.wxTocLevel || 0)
    applyStyles(item, { 'padding-left': `${depth * 16}px` })
  }
  applyAll(container.querySelectorAll('[data-wx-toc-nav] a'), {
    color: linkColor,
    'text-decoration': 'none',
    'border-bottom': 'none'
  })
  applyAll(container.querySelectorAll('[data-wx-toc-empty]'), {
    color: theme.muted,
    'text-align': 'center'
  })

  const section = document.createElement('section')
  section.dataset.wechatTheme = theme.id
  applyStyles(section, {
    'box-sizing': 'border-box',
    'max-width': '677px',
    margin: '0 auto',
    padding: '28px 22px',
    'background-color': theme.pageBg,
    color: theme.text,
    'font-size': `${size}px`,
    'line-height': String(prefs.lineHeight),
    'font-family': font.stack,
    'letter-spacing': '0.4px',
    'word-break': 'break-word',
    'overflow-wrap': 'break-word',
    'text-align': 'left'
  })

  while (container.firstChild) section.appendChild(container.firstChild)

  const headings = extractHeadings(section)

  if (prefs.customCss.trim()) applyCustomCss(section, prefs.customCss)

  const text = section.textContent
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    html: section.outerHTML,
    text,
    theme,
    dark,
    headings,
    diagrams: state.diagrams
  }
}
