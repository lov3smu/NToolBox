import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'

const CACHE_LIMIT = 300
const cache = new Map()

let documentRenderer = null
let initFailed = false

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getDocumentRenderer() {
  if (documentRenderer || initFailed) return documentRenderer
  try {
    const adaptor = liteAdaptor()
    RegisterHTMLHandler(adaptor)
    const tex = new TeX({ packages: AllPackages })
    const svg = new SVG({ fontCache: 'none' })
    documentRenderer = {
      adaptor,
      document: mathjax.document('', { InputJax: tex, OutputJax: svg })
    }
  } catch (error) {
    initFailed = true
    console.error('[wechat] MathJax 初始化失败:', error)
  }
  return documentRenderer
}

function decorateSvg(html) {
  return html.replace(/<svg([^>]*)>/, (match, attributes) => {
    const extra = 'max-width:100%;height:auto;'
    if (/\sstyle="/.test(attributes)) {
      return `<svg${attributes.replace(/\sstyle="([^"]*)"/, (styleMatch, style) => ` style="${extra}${style}"`)}>`
    }
    return `<svg style="${extra}"${attributes}>`
  })
}

export function renderMathToSvg(tex, display = false) {
  const source = String(tex || '').trim()
  if (!source) return ''
  const key = `${display ? '1' : '0'}\u0000${source}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const renderer = getDocumentRenderer()
  let html = ''
  if (renderer) {
    try {
      const node = renderer.document.convert(source, { display })
      html = decorateSvg(renderer.adaptor.outerHTML(node))
    } catch (error) {
      console.warn('[wechat] 公式渲染失败:', error)
    }
  }

  if (!html) {
    html = `<code style="font-family:monospace;background:#f3f4f6;padding:2px 5px;border-radius:4px;">${escapeHtml(source)}</code>`
  }

  if (cache.size >= CACHE_LIMIT) {
    const firstKey = cache.keys().next().value
    cache.delete(firstKey)
  }
  cache.set(key, html)
  return html
}

export function clearMathCache() {
  cache.clear()
}
