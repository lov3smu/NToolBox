const LIGHT_TOKENS = Object.freeze({
  keyword: '#d73a49',
  built_in: '#005cc5',
  type: '#005cc5',
  literal: '#005cc5',
  number: '#005cc5',
  string: '#032f62',
  comment: '#6a737d',
  doctag: '#d73a49',
  meta: '#6a737d',
  title: '#6f42c1',
  attr: '#005cc5',
  variable: '#e36209',
  symbol: '#e36209',
  operator: '#d73a49',
  property: '#005cc5',
  tag: '#22863a',
  name: '#22863a',
  selector: '#22863a',
  params: '#24292f',
  punctuation: '#24292f',
  addition: '#22863a',
  deletion: '#b31d28'
})

const DARK_TOKENS = Object.freeze({
  keyword: '#ff7b72',
  built_in: '#79c0ff',
  type: '#79c0ff',
  literal: '#79c0ff',
  number: '#79c0ff',
  string: '#a5d6ff',
  comment: '#8b949e',
  doctag: '#ff7b72',
  meta: '#8b949e',
  title: '#d2a8ff',
  attr: '#79c0ff',
  variable: '#ffa657',
  symbol: '#ffa657',
  operator: '#ff7b72',
  property: '#79c0ff',
  tag: '#7ee787',
  name: '#7ee787',
  selector: '#7ee787',
  params: '#c9d1d9',
  punctuation: '#c9d1d9',
  addition: '#aff5b4',
  deletion: '#ffdcd7'
})

function tokens(overrides) {
  return Object.freeze({ ...LIGHT_TOKENS, ...overrides })
}

function darkTokens(overrides) {
  return Object.freeze({ ...DARK_TOKENS, ...overrides })
}

export const WECHAT_THEMES = Object.freeze([
  {
    id: 'classic',
    name: '经典蓝',
    accent: '#3b6cf6',
    pageBg: '#ffffff',
    text: '#3f3f3f',
    heading: '#1f2328',
    muted: '#6b7280',
    link: '#3b6cf6',
    quoteBg: '#f4f7ff',
    quoteBorder: '#3b6cf6',
    quoteText: '#4b5563',
    codeBg: '#f7f8fa',
    codeText: '#24292f',
    codeHeaderBg: '#eef1f5',
    inlineBg: '#f1f3f5',
    inlineText: '#c7254e',
    tableHeadBg: '#f6f8fb',
    tableBorder: '#e4e8ee',
    rowBg: '#fbfcfd',
    hr: '#e5e7eb',
    tokens: LIGHT_TOKENS
  },
  {
    id: 'warm',
    name: '暖橙',
    accent: '#ef6c3e',
    pageBg: '#fffdf9',
    text: '#403b36',
    heading: '#2b211b',
    muted: '#8a7a6d',
    link: '#ef6c3e',
    quoteBg: '#fff3eb',
    quoteBorder: '#ef6c3e',
    quoteText: '#6b5648',
    codeBg: '#fbf6f1',
    codeText: '#3d3229',
    codeHeaderBg: '#f3e9e1',
    inlineBg: '#fbeee5',
    inlineText: '#c2410c',
    tableHeadBg: '#fff4ec',
    tableBorder: '#f0dfd1',
    rowBg: '#fffaf5',
    hr: '#eedfd2',
    tokens: LIGHT_TOKENS
  },
  {
    id: 'forest',
    name: '青野',
    accent: '#2f855a',
    pageBg: '#fbfdfb',
    text: '#34423a',
    heading: '#1d2c23',
    muted: '#6b7f72',
    link: '#2f855a',
    quoteBg: '#eef7f1',
    quoteBorder: '#2f855a',
    quoteText: '#476052',
    codeBg: '#f3f8f4',
    codeText: '#24352a',
    codeHeaderBg: '#e8f1eb',
    inlineBg: '#eaf3ed',
    inlineText: '#b45309',
    tableHeadBg: '#eff7f2',
    tableBorder: '#dcebe1',
    rowBg: '#f8fcf9',
    hr: '#dfeae2',
    tokens: LIGHT_TOKENS
  },
  {
    id: 'violet',
    name: '暮紫',
    accent: '#7c5cd6',
    pageBg: '#fdfcff',
    text: '#3f3a4d',
    heading: '#241f33',
    muted: '#7a728c',
    link: '#7c5cd6',
    quoteBg: '#f5f1ff',
    quoteBorder: '#7c5cd6',
    quoteText: '#594e75',
    codeBg: '#f8f6fd',
    codeText: '#2f2842',
    codeHeaderBg: '#efeaf9',
    inlineBg: '#f1edfb',
    inlineText: '#a21caf',
    tableHeadBg: '#f6f3ff',
    tableBorder: '#e7e1f4',
    rowBg: '#fbf9ff',
    hr: '#e8e2f2',
    tokens: LIGHT_TOKENS
  },
  {
    id: 'ink',
    name: '墨韵',
    accent: '#303846',
    pageBg: '#ffffff',
    text: '#3a3a3a',
    heading: '#17181a',
    muted: '#6f6f6f',
    link: '#303846',
    quoteBg: '#f6f5f1',
    quoteBorder: '#8c7a5b',
    quoteText: '#5c564c',
    codeBg: '#f6f6f4',
    codeText: '#2b2b2b',
    codeHeaderBg: '#eceae4',
    inlineBg: '#efefec',
    inlineText: '#9a3412',
    tableHeadBg: '#f5f4f0',
    tableBorder: '#e3e0d8',
    rowBg: '#fbfaf7',
    hr: '#e3e0d8',
    tokens: LIGHT_TOKENS
  },
  {
    id: 'night',
    name: '夜读',
    accent: '#66b3ff',
    pageBg: '#1b1d22',
    text: '#d7dce5',
    heading: '#f3f6fb',
    muted: '#9aa3b2',
    link: '#7cc4ff',
    quoteBg: '#23262d',
    quoteBorder: '#66b3ff',
    quoteText: '#c3cad6',
    codeBg: '#14161a',
    codeText: '#e6edf3',
    codeHeaderBg: '#101216',
    inlineBg: '#2a2e36',
    inlineText: '#ffb4a8',
    tableHeadBg: '#23262d',
    tableBorder: '#343943',
    rowBg: '#20232a',
    hr: '#343943',
    tokens: DARK_TOKENS
  }
])

export const CODE_THEMES = Object.freeze([
  {
    id: 'github',
    name: 'GitHub Light',
    dark: false,
    bg: '#f7f8fa',
    text: '#24292f',
    headerBg: '#eef1f5',
    lineNumber: '#afb8c1',
    tokens: LIGHT_TOKENS
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    dark: true,
    bg: '#0d1117',
    text: '#c9d1d9',
    headerBg: '#161b22',
    lineNumber: '#484f58',
    tokens: DARK_TOKENS
  },
  {
    id: 'atom-one-light',
    name: 'Atom One Light',
    dark: false,
    bg: '#fafafa',
    text: '#383a42',
    headerBg: '#f0f0f1',
    lineNumber: '#9d9d9f',
    tokens: tokens({
      keyword: '#a626a4',
      built_in: '#c18401',
      string: '#50a14f',
      number: '#986801',
      comment: '#a0a1a7',
      title: '#4078f2',
      attr: '#986801',
      variable: '#e45649',
      symbol: '#4078f2',
      tag: '#e45649',
      name: '#4078f2',
      selector: '#e45649',
      addition: '#50a14f',
      deletion: '#e45649'
    })
  },
  {
    id: 'atom-one-dark',
    name: 'Atom One Dark',
    dark: true,
    bg: '#282c34',
    text: '#abb2bf',
    headerBg: '#21252b',
    lineNumber: '#5c6370',
    tokens: darkTokens({
      keyword: '#c678dd',
      built_in: '#e5c07b',
      string: '#98c379',
      number: '#d19a66',
      comment: '#5c6370',
      title: '#61afef',
      attr: '#d19a66',
      variable: '#e06c75',
      symbol: '#61afef',
      tag: '#e06c75',
      name: '#61afef',
      selector: '#e06c75',
      addition: '#98c379',
      deletion: '#e06c75'
    })
  },
  {
    id: 'monokai',
    name: 'Monokai',
    dark: true,
    bg: '#272822',
    text: '#f8f8f2',
    headerBg: '#1e1f1a',
    lineNumber: '#75715e',
    tokens: darkTokens({
      keyword: '#f92672',
      built_in: '#66d9ef',
      type: '#66d9ef',
      literal: '#ae81ff',
      number: '#ae81ff',
      string: '#e6db74',
      comment: '#75715e',
      doctag: '#f92672',
      meta: '#75715e',
      title: '#a6e22e',
      attr: '#a6e22e',
      variable: '#fd971f',
      symbol: '#ae81ff',
      operator: '#f92672',
      property: '#a6e22e',
      tag: '#f92672',
      name: '#a6e22e',
      selector: '#a6e22e',
      params: '#f8f8f2',
      punctuation: '#f8f8f2',
      addition: '#a6e22e',
      deletion: '#f92672'
    })
  },
  {
    id: 'dracula',
    name: 'Dracula',
    dark: true,
    bg: '#282a36',
    text: '#f8f8f2',
    headerBg: '#21222c',
    lineNumber: '#6272a4',
    tokens: darkTokens({
      keyword: '#ff79c6',
      built_in: '#8be9fd',
      type: '#8be9fd',
      literal: '#bd93f9',
      number: '#bd93f9',
      string: '#f1fa8c',
      comment: '#6272a4',
      doctag: '#ff79c6',
      meta: '#6272a4',
      title: '#50fa7b',
      attr: '#50fa7b',
      variable: '#ffb86c',
      symbol: '#bd93f9',
      operator: '#ff79c6',
      property: '#8be9fd',
      tag: '#ff79c6',
      name: '#50fa7b',
      selector: '#50fa7b',
      params: '#f8f8f2',
      punctuation: '#f8f8f2',
      addition: '#50fa7b',
      deletion: '#ff5555'
    })
  },
  {
    id: 'nord',
    name: 'Nord',
    dark: true,
    bg: '#2e3440',
    text: '#d8dee9',
    headerBg: '#272c36',
    lineNumber: '#616e88',
    tokens: darkTokens({
      keyword: '#81a1c1',
      built_in: '#88c0d0',
      type: '#8fbcbb',
      literal: '#b48ead',
      number: '#b48ead',
      string: '#a3be8c',
      comment: '#616e88',
      doctag: '#81a1c1',
      meta: '#616e88',
      title: '#88c0d0',
      attr: '#8fbcbb',
      variable: '#d08770',
      symbol: '#b48ead',
      operator: '#81a1c1',
      property: '#88c0d0',
      tag: '#81a1c1',
      name: '#8fbcbb',
      selector: '#8fbcbb',
      params: '#d8dee9',
      punctuation: '#d8dee9',
      addition: '#a3be8c',
      deletion: '#bf616a'
    })
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    dark: false,
    bg: '#fdf6e3',
    text: '#657b83',
    headerBg: '#f5edda',
    lineNumber: '#93a1a1',
    tokens: tokens({
      keyword: '#859900',
      built_in: '#268bd2',
      string: '#2aa198',
      number: '#d33682',
      comment: '#93a1a1',
      title: '#268bd2',
      attr: '#b58900',
      variable: '#cb4b16',
      symbol: '#6c71c4',
      tag: '#268bd2',
      name: '#268bd2',
      selector: '#859900',
      addition: '#2aa198',
      deletion: '#dc322f'
    })
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    dark: true,
    bg: '#002b36',
    text: '#93a1a1',
    headerBg: '#00252e',
    lineNumber: '#586e75',
    tokens: darkTokens({
      keyword: '#859900',
      built_in: '#268bd2',
      string: '#2aa198',
      number: '#d33682',
      comment: '#586e75',
      title: '#268bd2',
      attr: '#b58900',
      variable: '#cb4b16',
      symbol: '#6c71c4',
      tag: '#268bd2',
      name: '#268bd2',
      selector: '#859900',
      addition: '#2aa198',
      deletion: '#dc322f'
    })
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    dark: true,
    bg: '#1a1b26',
    text: '#c0caf5',
    headerBg: '#16161e',
    lineNumber: '#565f89',
    tokens: darkTokens({
      keyword: '#bb9af7',
      built_in: '#7dcfff',
      string: '#9ece6a',
      number: '#ff9e64',
      comment: '#565f89',
      title: '#7aa2f7',
      attr: '#e0af68',
      variable: '#c0caf5',
      symbol: '#bb9af7',
      tag: '#f7768e',
      name: '#7aa2f7',
      selector: '#9ece6a',
      addition: '#9ece6a',
      deletion: '#f7768e'
    })
  },
  {
    id: 'xcode',
    name: 'Xcode',
    dark: false,
    bg: '#ffffff',
    text: '#000000',
    headerBg: '#f2f2f7',
    lineNumber: '#a0a0a0',
    tokens: tokens({
      keyword: '#aa0d91',
      built_in: '#3f6e74',
      string: '#c41a16',
      number: '#1c00cf',
      comment: '#007400',
      title: '#3f6e74',
      attr: '#c41a16',
      variable: '#3f6e74',
      symbol: '#1c00cf',
      tag: '#aa0d91',
      name: '#3f6e74',
      selector: '#aa0d91',
      addition: '#007400',
      deletion: '#c41a16'
    })
  },
  {
    id: 'vs',
    name: 'Visual Studio',
    dark: false,
    bg: '#ffffff',
    text: '#000000',
    headerBg: '#f3f3f3',
    lineNumber: '#2b91af',
    tokens: tokens({
      keyword: '#0000ff',
      built_in: '#2b91af',
      string: '#a31515',
      number: '#098658',
      comment: '#008000',
      title: '#795e26',
      attr: '#ff0000',
      variable: '#001080',
      symbol: '#098658',
      tag: '#800000',
      name: '#795e26',
      selector: '#800000',
      addition: '#098658',
      deletion: '#a31515'
    })
  }
])

export const WECHAT_FONT_SIZES = Object.freeze([14, 15, 16, 17, 18])
export const WECHAT_LINE_HEIGHTS = Object.freeze([1.5, 1.6, 1.65, 1.7, 1.75, 1.8, 1.9, 2, 2.05])
export const WECHAT_FONTS = Object.freeze([
  {
    id: 'sans',
    name: '系统无衬线',
    stack:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
  },
  {
    id: 'serif',
    name: '宋体',
    stack: 'Georgia, "Songti SC", "Noto Serif SC", SimSun, serif'
  },
  {
    id: 'kai',
    name: '楷体',
    stack: '"Kaiti SC", KaiTi, STKaiti, "Noto Serif SC", serif'
  },
  {
    id: 'mono',
    name: '等宽',
    stack: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'
  }
])

export const WECHAT_BLOCK_SPACINGS = Object.freeze([0.75, 0.9, 1, 1.15, 1.35])
export const WECHAT_LINK_COLORS = Object.freeze([
  { id: 'theme', name: '跟随主题' },
  { id: 'wechat', name: '微信蓝' },
  { id: 'text', name: '正文色' }
])
export const WECHAT_QUOTE_BACKGROUNDS = Object.freeze([
  { id: 'theme', name: '跟随主题' },
  { id: 'none', name: '无背景' },
  { id: 'tint', name: '主题色浅底' }
])
export const WECHAT_HEADING_STYLES = Object.freeze([
  { id: 'default', name: '默认' },
  { id: 'color', name: '主题色文字' },
  { id: 'border-left', name: '左边框' },
  { id: 'border-bottom', name: '下边框' }
])
export const WECHAT_PREVIEW_WIDTHS = Object.freeze([
  { id: 'mobile', name: '移动端 375px' },
  { id: 'auto', name: '自适应' },
  { id: 'wide', name: '宽屏' }
])
export const WECHAT_LEGENDS = Object.freeze([
  { id: 'none', name: '不显示' },
  { id: 'title', name: '只显示 title' },
  { id: 'alt', name: '只显示 alt' },
  { id: 'title-alt', name: 'title 优先' },
  { id: 'alt-title', name: 'alt 优先' },
  { id: 'filename', name: '文件名' }
])

export const DEFAULT_WECHAT_PREFS = Object.freeze({
  theme: 'classic',
  fontSize: 16,
  lineHeight: 1.8,
  font: 'sans',
  accent: '',
  blockSpacing: 1,
  linkColor: 'theme',
  quoteBg: 'theme',
  codeTheme: 'github',
  macCode: true,
  lineNumbers: false,
  justify: true,
  indent: false,
  previewWidth: 'auto',
  headingStyle: 'default',
  legend: 'none',
  plantUmlServer: 'https://www.plantuml.com/plantuml/svg/',
  customCss: ''
})

const PREF_BOOLEANS = ['macCode', 'lineNumbers', 'justify', 'indent']

function normalizeHex(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : ''
}

function pickOption(options, value, fallback) {
  return options.some((option) => option.id === value) ? value : fallback
}

export function normalizeWechatPrefs(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const fontSize = Number(source.fontSize)
  const lineHeight = Number(source.lineHeight)
  const blockSpacing = Number(source.blockSpacing)

  const prefs = {
    theme: WECHAT_THEMES.some((theme) => theme.id === source.theme) ? source.theme : DEFAULT_WECHAT_PREFS.theme,
    fontSize: WECHAT_FONT_SIZES.includes(fontSize) ? fontSize : DEFAULT_WECHAT_PREFS.fontSize,
    lineHeight: WECHAT_LINE_HEIGHTS.includes(lineHeight) ? lineHeight : DEFAULT_WECHAT_PREFS.lineHeight,
    font: WECHAT_FONTS.some((font) => font.id === source.font) ? source.font : DEFAULT_WECHAT_PREFS.font,
    accent: normalizeHex(source.accent),
    blockSpacing: WECHAT_BLOCK_SPACINGS.includes(blockSpacing) ? blockSpacing : DEFAULT_WECHAT_PREFS.blockSpacing,
    linkColor: pickOption(WECHAT_LINK_COLORS, source.linkColor, DEFAULT_WECHAT_PREFS.linkColor),
    quoteBg: pickOption(WECHAT_QUOTE_BACKGROUNDS, source.quoteBg, DEFAULT_WECHAT_PREFS.quoteBg),
    codeTheme: CODE_THEMES.some((theme) => theme.id === source.codeTheme)
      ? source.codeTheme
      : DEFAULT_WECHAT_PREFS.codeTheme,
    previewWidth: pickOption(WECHAT_PREVIEW_WIDTHS, source.previewWidth, DEFAULT_WECHAT_PREFS.previewWidth),
    headingStyle: pickOption(WECHAT_HEADING_STYLES, source.headingStyle, DEFAULT_WECHAT_PREFS.headingStyle),
    legend: pickOption(WECHAT_LEGENDS, source.legend, DEFAULT_WECHAT_PREFS.legend),
    plantUmlServer:
      typeof source.plantUmlServer === 'string' && /^https?:\/\/[^\s]+$/i.test(source.plantUmlServer.trim())
        ? source.plantUmlServer.trim().slice(0, 500)
        : DEFAULT_WECHAT_PREFS.plantUmlServer,
    customCss: typeof source.customCss === 'string' ? source.customCss.slice(0, 20000) : DEFAULT_WECHAT_PREFS.customCss
  }

  for (const key of PREF_BOOLEANS) {
    prefs[key] = typeof source[key] === 'boolean' ? source[key] : DEFAULT_WECHAT_PREFS[key]
  }

  return prefs
}

export function resolveWechatTheme(rawPrefs) {
  const prefs = normalizeWechatPrefs(rawPrefs)
  const base = WECHAT_THEMES.find((theme) => theme.id === prefs.theme) || WECHAT_THEMES[0]
  if (!prefs.accent) return { ...base }
  return {
    ...base,
    accent: prefs.accent,
    link: prefs.accent,
    quoteBorder: prefs.accent
  }
}

export function getWechatFont(id) {
  return WECHAT_FONTS.find((font) => font.id === id) || WECHAT_FONTS[0]
}

export function getCodeTheme(id) {
  return CODE_THEMES.find((theme) => theme.id === id) || CODE_THEMES[0]
}

export function resolveLinkColor(prefs, theme) {
  if (prefs.linkColor === 'wechat') return '#576b95'
  if (prefs.linkColor === 'text') return theme.text
  return theme.link
}

export function isDarkWechatTheme(theme) {
  const value = String(theme.pageBg).replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return false
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 < 128
}
