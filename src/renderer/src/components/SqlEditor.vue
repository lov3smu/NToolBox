<template>
  <div
    ref="editorContainer"
    class="sql-editor-container"
  />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, Decoration } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { sql, MySQL } from '@codemirror/lang-sql'
import { autocompletion } from '@codemirror/autocomplete'
import { defaultHighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from '@codemirror/language'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  tables: {
    type: Array,
    default: () => []
  },
  databases: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'execute'])

const editorContainer = ref(null)
let editorView = null

const sqlKeywords = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'DROP',
  'ALTER', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'TRIGGER', 'PROCEDURE',
  'FUNCTION', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'AS',
  'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'NULL', 'IS', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT',
  'AUTO_INCREMENT', 'DEFAULT', 'CURRENT_TIMESTAMP', 'VARCHAR', 'INT',
  'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'FLOAT', 'DOUBLE', 'DECIMAL',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'CHAR', 'TEXT',
  'BLOB', 'BOOLEAN', 'BOOL', 'ENUM', 'SET', 'IF', 'THEN', 'ELSE', 'END',
  'CASE', 'WHEN', 'BEGIN', 'COMMIT', 'ROLLBACK', 'START', 'TRANSACTION',
  'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'USE', 'GRANT', 'REVOKE',
  'FLUSH', 'TRUNCATE', 'REPLACE', 'CALL', 'EXECUTE', 'LOCK', 'UNLOCK',
  'TABLES', 'STATUS', 'VARIABLES', 'PROCESSLIST', 'KILL', 'ENGINE',
  'ENGINES', 'LOAD', 'DATA', 'RENAME', 'COLUMN', 'ADD', 'MODIFY',
  'CHANGE', 'CASCADE', 'RESTRICT', 'FIRST', 'AFTER', 'COMMENT',
  'PARTITION', 'PARTITIONS', 'MAXVALUE', 'TEMPORARY', 'CONCURRENT',
  'IDENTIFIED', 'PASSWORD', 'OPTION', 'REQUIRE', 'SSL', 'SUPER',
  'PROCESS', 'FILE', 'RELOAD', 'SHUTDOWN', 'USER', 'USAGE', 'WITH'
]

const customFunctions = [
  'NOW()', 'CURDATE()', 'CURTIME()', 'DATE()', 'YEAR()', 'MONTH()', 'DAY()',
  'HOUR()', 'MINUTE()', 'SECOND()', 'DATEDIFF()', 'TIMESTAMPDIFF()',
  'DATE_ADD()', 'DATE_SUB()', 'DATE_FORMAT()', 'CONCAT()', 'CONCAT_WS()',
  'SUBSTRING()', 'LEFT()', 'RIGHT()', 'LENGTH()', 'UPPER()', 'LOWER()',
  'TRIM()', 'REPLACE()', 'CAST()', 'CONVERT()', 'COALESCE()', 'IFNULL()',
  'NULLIF()', 'GREATEST()', 'LEAST()', 'MD5()', 'SHA1()', 'RAND()', 'UUID()',
  'ABS()', 'CEIL()', 'FLOOR()', 'ROUND()', 'MOD()', 'SQRT()', 'POWER()',
  'BIN()', 'HEX()', 'ASCII()', 'LAST_INSERT_ID()', 'VERSION()', 'DATABASE()',
  'USER()', 'CURRENT_USER()', 'INET_ATON()', 'INET_NTOA()', 'ISNULL()',
  'FORMAT()', 'SUBSTR()', 'CHAR_LENGTH()', 'INSTR()', 'LOCATE()',
  'REVERSE()', 'LPAD()', 'RPAD()', 'ELT()', 'FIELD()', 'INSERT()',
  'PI()', 'SIN()', 'COS()', 'TAN()', 'EXP()', 'LOG()', 'LOG10()'
]

const completionOptions = computed(() => {
  const options = [
    ...sqlKeywords.map(k => ({ label: k, type: 'keyword', boost: 99 })),
    ...customFunctions.map(f => ({ label: f, type: 'function', boost: 80 })),
    ...props.databases.map(d => ({ label: d, type: 'constant', boost: 70 })),
    ...props.tables.map(t => ({ label: t, type: 'class', boost: 60 }))
  ]
  return options
})

const myCompletions = (context) => {
  const word = context.matchBefore(/\w*/)
  if (!word || (word.from == word.to && !context.explicit)) return null
  
  const options = completionOptions.value.filter(opt => 
    opt.label.toLowerCase().startsWith(word.text.toLowerCase())
  )
  
  return {
    from: word.from,
    options: options.length > 0 ? options : completionOptions.value.slice(0, 20),
    validFor: /^\w*$/
  }
}

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    backgroundColor: '#ffffff'
  },
  '.cm-content': {
    padding: '10px 0',
    caretColor: '#0e639c',
    minHeight: '100px',
    backgroundColor: '#ffffff'
  },
  '.cm-gutters': {
    backgroundColor: '#f8f9fa',
    borderRight: '1px solid #e1e4e8'
  },
  '.cm-line': {
    padding: '0 10px'
  },
  '.cm-selectionBackground': {
    backgroundColor: '#add6ff66'
  },
  '.cm-cursor': {
    borderLeftColor: '#0e639c'
  },
  '.cm-tooltip-autocomplete': {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(102, 126, 234, 0.3)',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    fontFamily: "'Consolas', 'Monaco', monospace",
    fontSize: '13px'
  },
  '.cm-tooltip-autocomplete ul': {
    maxHeight: '200px'
  },
  '.cm-tooltip-autocomplete li': {
    padding: '4px 8px'
  },
  '.cm-tooltip-autocomplete li[aria-selected]': {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    color: '#333'
  },
  '.cm-completionLabel': {
    fontFamily: "'Consolas', 'Monaco', monospace"
  }
})

const createEditor = () => {
  if (!editorContainer.value) return

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const content = update.state.doc.toString()
      emit('update:modelValue', content)
    }
  })

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      indentOnInput(),
      sql({
        dialect: MySQL,
        upperCaseKeywords: true
      }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      autocompletion({
        override: [myCompletions],
        activateOnTyping: true,
        maxRenderedCompletions: 50
      }),
      theme,
      EditorView.lineWrapping,
      updateListener,
      EditorState.allowMultipleSelections.of(false)
    ]
  })

  editorView = new EditorView({
    state,
    parent: editorContainer.value
  })
}

const setContent = (content) => {
  if (!editorView) return
  const currentContent = editorView.state.doc.toString()
  if (content !== currentContent) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: content
      }
    })
  }
}

watch(() => props.modelValue, (newVal) => {
  setContent(newVal)
})

onMounted(() => {
  createEditor()
})

onUnmounted(() => {
  if (editorView) {
    editorView.destroy()
  }
})

defineExpose({
  getContent: () => editorView?.state.doc.toString() || '',
  getSelection: () => {
    if (!editorView) return ''
    const selection = editorView.state.selection.main
    if (selection.from === selection.to) {
      return ''
    }
    return editorView.state.doc.sliceString(selection.from, selection.to)
  },
  getSelectionOrAll: () => {
    if (!editorView) return ''
    const selection = editorView.state.selection.main
    if (selection.from === selection.to) {
      return editorView.state.doc.toString()
    }
    return editorView.state.doc.sliceString(selection.from, selection.to)
  },
  setContent,
  focus: () => editorView?.focus(),
  clear: () => setContent('')
})
</script>

<style scoped>
.sql-editor-container {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 0;
  background: #ffffff;
  overflow: hidden;
}

.sql-editor-container:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.sql-editor-container .cm-editor {
  height: 100%;
}
</style>