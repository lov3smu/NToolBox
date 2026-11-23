<template>
  <div v-if="kind" class="result-card" :class="`is-${kind}`">
    <div class="result-card-head">
      <span class="result-card-title">{{ title }}</span>
      <span class="result-card-meta">
        <span v-for="(chip, chipIndex) in chips" :key="chipIndex">{{ chip }}</span>
      </span>
    </div>
    <div v-if="kind === 'table'" class="result-card-table-wrap">
      <table class="result-card-table">
        <thead>
          <tr>
            <th v-for="field in columns" :key="field">{{ field }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in visibleRows" :key="rowIndex">
            <td v-for="field in columns" :key="field" :title="cellText(row, field)">{{ cellText(row, field) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="hasMoreRows" class="result-card-foot">
        {{ t('共 {total} 行，显示前 {shown} 行', { total: rows.length, shown: MAX_ROWS }) }}
      </p>
    </div>
    <div v-else-if="kind === 'links'" class="result-card-links">
      <button
        v-for="(item, itemIndex) in links"
        :key="`${itemIndex}-${item.url}`"
        type="button"
        class="result-link"
        @click="openLink(item.url)"
      >
        <span class="result-link-title">{{ item.title || item.url }}</span>
        <span class="result-link-url">{{ item.url }}</span>
        <span v-if="item.snippet" class="result-link-snippet">{{ item.snippet }}</span>
      </button>
    </div>
    <ul v-else class="result-card-files">
      <li v-for="file in files" :key="file">{{ file }}</li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { openExternal } from '@/api'
import { t } from '@/i18n'

const props = defineProps({
  metadata: { type: Object, default: null }
})

const MAX_ROWS = 8
const MAX_CELL_CHARS = 80

const rows = computed(() => (Array.isArray(props.metadata?.rows) ? props.metadata.rows : []))
const links = computed(() =>
  (Array.isArray(props.metadata?.results) ? props.metadata.results : []).filter(
    (item) => item && typeof item.url === 'string' && item.url
  )
)
const files = computed(() =>
  (Array.isArray(props.metadata?.files) ? props.metadata.files : [])
    .map((item) => (typeof item === 'string' ? item : item?.name || item?.path || ''))
    .filter(Boolean)
)

const columns = computed(() => {
  const fields = Array.isArray(props.metadata?.fields) ? props.metadata.fields : []
  const declared = fields.map((field) => (typeof field === 'string' ? field : field?.name)).filter(Boolean)
  if (declared.length) return declared
  const first = rows.value.find((row) => row && typeof row === 'object')
  return first ? Object.keys(first) : []
})

const kind = computed(() => {
  if (rows.value.length && columns.value.length) return 'table'
  if (links.value.length) return 'links'
  if (files.value.length) return 'files'
  return ''
})

const title = computed(() => {
  if (kind.value === 'table') return t('查询结果')
  if (kind.value === 'links') return t('搜索结果')
  return t('产出文件')
})

const chips = computed(() => {
  const list = []
  if (kind.value === 'table') {
    list.push(t('{count} 行', { count: props.metadata?.rowCount ?? rows.value.length }))
    if (props.metadata?.duration) list.push(t('耗时 {value}', { value: formatDuration(props.metadata.duration) }))
  } else if (kind.value === 'links') {
    list.push(t('{count} 条结果', { count: links.value.length }))
    if (props.metadata?.engine) list.push(String(props.metadata.engine))
  } else if (kind.value === 'files') {
    list.push(t('{count} 个文件', { count: files.value.length }))
    if (typeof props.metadata?.exitCode === 'number') {
      list.push(t('退出码 {value}', { value: props.metadata.exitCode }))
    }
  }
  return list
})

const visibleRows = computed(() => rows.value.slice(0, MAX_ROWS))
const hasMoreRows = computed(() => rows.value.length > MAX_ROWS)

function cellText(row, field) {
  const value = row?.[field]
  if (value === null || value === undefined) return '—'
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}…` : text
}

function formatDuration(ms) {
  if (!ms) return ''
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function openLink(url) {
  if (/^https?:\/\//i.test(url || '')) openExternal(url)
}
</script>
