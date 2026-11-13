import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  renderMarkdown,
  escapeHtml,
  stripThinking,
  splitThinkingTags,
  trimPartialThinkingTag
} from '../src/renderer/src/utils/markdown.js'

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
    )
  })
})

describe('stripThinking', () => {
  it('removes complete and streaming thinking blocks', () => {
    expect(stripThinking('<thinking>secret</thinking>hello')).toBe('hello')
    expect(stripThinking('hello<thinking>partial')).toBe('hello')
  })
})

describe('splitThinkingTags', () => {
  it('separates complete thinking blocks from the reply', () => {
    expect(splitThinkingTags('甲<thinking>乙</thinking>丙')).toEqual({ thinking: '乙', content: '甲丙' })
  })

  it('keeps an unfinished thinking block out of the reply while streaming', () => {
    expect(splitThinkingTags('回答前缀<thinking>分析中')).toEqual({ thinking: '分析中', content: '回答前缀' })
  })

  it('drops stray closing tags left by a split stream', () => {
    expect(splitThinkingTags('</thinking>查询结果如下')).toEqual({ thinking: '', content: '查询结果如下' })
    expect(splitThinkingTags('第一步</thinking>第二步')).toEqual({ thinking: '', content: '第一步第二步' })
  })

  it('collects multiple thinking blocks', () => {
    expect(splitThinkingTags('<thinking>一</thinking>A<thinking>二</thinking>B')).toEqual({
      thinking: '一\n二',
      content: 'AB'
    })
  })
})

describe('trimPartialThinkingTag', () => {
  it('hides partial thinking tags at the end of a chunk', () => {
    expect(trimPartialThinkingTag('回答</thin')).toBe('回答')
    expect(trimPartialThinkingTag('回答<think')).toBe('回答')
    expect(trimPartialThinkingTag('回答<')).toBe('回答')
  })

  it('leaves normal text untouched', () => {
    expect(trimPartialThinkingTag('回答 a < b')).toBe('回答 a < b')
  })
})

describe('renderMarkdown', () => {
  it('renders common markdown constructs', () => {
    const html = renderMarkdown('## 标题\n\n**粗体** 和 `code`\n\n- 一\n- 二\n\n> 引用')
    expect(html).toContain('<h2>标题</h2>')
    expect(html).toContain('<strong>粗体</strong>')
    expect(html).toContain('<code class="inline-code">code</code>')
    expect(html).toContain('<ul><li>一</li><li>二</li></ul>')
    expect(html).toContain('<blockquote>引用</blockquote>')
  })

  it('renders fenced code blocks with escaped content', () => {
    const html = renderMarkdown('```js\nconst x = "<b>"\n```')
    expect(html).toContain('<pre class="code-block">')
    expect(html).toContain('const x = &quot;&lt;b&gt;&quot;')
    expect(html).not.toContain('<b>')
  })

  it('does not add an empty line after fenced code blocks', () => {
    const html = renderMarkdown('```sql\nSELECT 1;\n```\n\n之后')
    expect(html).not.toContain('</pre><br>')
    expect(html).toContain('</pre>之后<br>')
  })

  it('never leaks internal placeholders into the rendered html', () => {
    const html = renderMarkdown(
      '说明文字\n\n```sql\nSELECT * FROM 订单 WHERE 名称 = "中文"\n```\n\n行内 `code` 与 **粗体**'
    )
    expect(html).not.toMatch(/[\uE000\uE001]/)
  })

  it('allows safe links only', () => {
    expect(renderMarkdown('[文档](https://example.com/a?b=1&c=2)')).toContain(
      '<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">文档</a>'
    )
    const unsafe = renderMarkdown('[点我](javascript:alert(1))')
    expect(unsafe).not.toContain('href=')
    expect(unsafe).not.toContain('javascript:')
    expect(unsafe).toContain('点我')
  })

  it('neutralizes raw HTML and event handlers', () => {
    const html = renderMarkdown('<script>window.parent.electronAPI.getConfig()</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')

    const image = renderMarkdown('<img src=x onerror="window.electronAPI">')
    expect(image).not.toContain('<img')
    expect(image).toContain('&lt;img')
  })

  it('escapes quotes inside markdown link destinations', () => {
    const html = renderMarkdown('[x](https://example.com/"onmouseover="alert(1))')
    expect(html).not.toContain('onmouseover="alert(1)')
  })
})

describe('HtmlViewer preview isolation', () => {
  it('sandboxes the preview iframe without same-origin access', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/renderer/src/views/HtmlViewer.vue'), 'utf8')
    const iframe = source.match(/<iframe[^>]*class="preview-frame"[^>]*>/)
    expect(iframe).toBeTruthy()
    expect(iframe[0]).toContain('sandbox="allow-scripts"')
    expect(iframe[0]).not.toContain('allow-same-origin')
  })
})
