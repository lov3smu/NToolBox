import { MySQL, sql } from '@codemirror/lang-sql'
import { highlightCode, tagHighlighter, tags } from '@lezer/highlight'

const sqlLanguage = sql({ dialect: MySQL }).language

const sqlHighlighter = tagHighlighter([
  { tag: tags.keyword, class: 'tok-keyword' },
  { tag: tags.typeName, class: 'tok-type' },
  { tag: tags.special(tags.string), class: 'tok-identifier' },
  { tag: tags.string, class: 'tok-string' },
  { tag: [tags.number, tags.bool, tags.null], class: 'tok-number' },
  { tag: tags.comment, class: 'tok-comment' },
  { tag: tags.function(tags.variableName), class: 'tok-function' },
  { tag: [tags.variableName, tags.propertyName, tags.className], class: 'tok-identifier' },
  { tag: [tags.operator, tags.punctuation], class: 'tok-operator' }
])

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (char) => (char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&gt;'))
}

export function highlightSqlToHtml(code) {
  if (!code) return ''
  let html = ''
  const tree = sqlLanguage.parser.parse(code)
  highlightCode(
    code,
    tree,
    sqlHighlighter,
    (text, classes) => {
      const escaped = escapeHtml(text)
      html += classes ? `<span class="${classes}">${escaped}</span>` : escaped
    },
    () => {
      html += '\n'
    }
  )
  return html
}
