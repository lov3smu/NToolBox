<template>
  <div class="query-chart">
    <div class="chart-toolbar">
      <div class="chart-type-group">
        <button
          v-for="type in CHART_TYPES"
          :key="type.value"
          type="button"
          :class="['chart-type-btn', { active: chartType === type.value }]"
          @click="chartType = type.value"
        >
          {{ t(type.label) }}
        </button>
      </div>
      <label class="chart-field">
        <span>{{ t('分类字段') }}</span>
        <select v-model="labelField" class="chart-select">
          <option v-for="name in fieldNames" :key="'label-' + name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label class="chart-field">
        <span>{{ t('数值字段') }}</span>
        <select v-model="valueField" class="chart-select">
          <option v-for="name in numericFields" :key="'value-' + name" :value="name">{{ name }}</option>
        </select>
      </label>
      <span v-if="truncated" class="chart-hint">
        {{ t('图表基于当前页数据，最多展示前 {p0} 行', { p0: MAX_POINTS }) }}
      </span>
    </div>

    <div v-if="!points.length" class="chart-empty">{{ t('当前结果没有可绘制的数值列') }}</div>
    <div v-else-if="chartType === 'pie'" class="chart-pie-layout">
      <svg class="chart-canvas" viewBox="0 0 440 300" preserveAspectRatio="xMidYMid meet">
        <circle v-if="pieSingle" cx="220" cy="150" r="110" :fill="pieSlices[0].color">
          <title>{{ pieSlices[0].label }}：{{ formatNumber(pieSlices[0].value) }}</title>
        </circle>
        <path
          v-for="(slice, index) in pieSlices"
          v-show="!pieSingle"
          :key="'slice-' + index"
          :d="slice.path"
          :fill="slice.color"
          stroke="var(--surface)"
          stroke-width="1.5"
        >
          <title>{{ slice.label }}：{{ formatNumber(slice.value) }}</title>
        </path>
      </svg>
      <ul class="chart-legend">
        <li v-for="(slice, index) in pieSlices" :key="'legend-' + index">
          <span class="legend-swatch" :style="{ background: slice.color }" />
          <span class="legend-label" :title="slice.label">{{ slice.label || t('（空值）') }}</span>
          <span class="legend-value">{{ formatNumber(slice.value) }} · {{ slice.percent }}%</span>
        </li>
      </ul>
    </div>
    <svg v-else class="chart-canvas" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="xMidYMid meet">
      <g>
        <line
          v-for="tick in yTicks"
          :key="'tick-' + tick.value"
          :x1="PADDING.left"
          :x2="WIDTH - PADDING.right"
          :y1="tick.y"
          :y2="tick.y"
          stroke="var(--border-color)"
          stroke-width="1"
        />
        <text
          v-for="tick in yTicks"
          :key="'tick-label-' + tick.value"
          :x="PADDING.left - 8"
          :y="tick.y + 4"
          text-anchor="end"
          fill="var(--text-tertiary)"
          font-size="12"
        >
          {{ formatNumber(tick.value) }}
        </text>
      </g>
      <template v-if="chartType === 'bar'">
        <rect
          v-for="(bar, index) in bars"
          :key="'bar-' + index"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          rx="2"
          fill="var(--accent-color)"
        >
          <title>{{ bar.label }}：{{ formatNumber(bar.value) }}</title>
        </rect>
      </template>
      <template v-else>
        <polyline :points="linePoints" fill="none" stroke="var(--accent-color)" stroke-width="2" />
        <circle
          v-for="(point, index) in linePointsList"
          :key="'dot-' + index"
          :cx="point.x"
          :cy="point.y"
          r="3"
          fill="var(--accent-color)"
        >
          <title>{{ point.label }}：{{ formatNumber(point.value) }}</title>
        </circle>
      </template>
      <text
        v-for="label in xLabels"
        :key="'x-' + label.x"
        :x="label.x"
        :y="HEIGHT - 14"
        text-anchor="middle"
        fill="var(--text-tertiary)"
        font-size="12"
      >
        {{ label.text }}
      </text>
    </svg>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] }
})

const MAX_POINTS = 100
const WIDTH = 1000
const HEIGHT = 300
const PADDING = { left: 56, right: 20, top: 16, bottom: 52 }
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom
const PIE_CENTER = { x: 220, y: 150 }
const PIE_RADIUS = 110
const PIE_COLORS = Array.from(
  { length: 8 },
  (_, index) => `color-mix(in srgb, var(--accent-color) ${100 - index * 9}%, var(--text-secondary))`
)

const CHART_TYPES = [
  { value: 'bar', label: '柱状图' },
  { value: 'line', label: '折线图' },
  { value: 'pie', label: '饼图' }
]

const chartType = ref('bar')
const labelField = ref('')
const valueField = ref('')

const fieldNames = computed(() => props.fields.map((field) => field.name).filter(Boolean))

function isNumericValue(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return false
  if (typeof value === 'number') return Number.isFinite(value)
  const text = String(value).trim()
  if (!text) return false
  return Number.isFinite(Number(text))
}

function toNumber(value) {
  if (!isNumericValue(value)) return null
  return Number(value)
}

const numericFields = computed(() =>
  fieldNames.value.filter((name) => props.rows.slice(0, 30).some((row) => isNumericValue(row?.[name])))
)

watch(
  fieldNames,
  (list) => {
    if (!list.includes(labelField.value)) {
      labelField.value = list.find((name) => !numericFields.value.includes(name)) || list[0] || ''
    }
  },
  { immediate: true }
)

watch(
  numericFields,
  (list) => {
    if (!list.includes(valueField.value)) {
      valueField.value = list.find((name) => name !== labelField.value) || list[0] || ''
    }
  },
  { immediate: true }
)

const points = computed(() => {
  if (!labelField.value || !valueField.value) return []
  const list = []
  for (const row of props.rows.slice(0, MAX_POINTS)) {
    const value = toNumber(row?.[valueField.value])
    if (value === null) continue
    const rawLabel = row?.[labelField.value]
    list.push({ label: rawLabel === null || rawLabel === undefined ? '' : String(rawLabel), value })
  }
  return list
})

const truncated = computed(() => props.rows.length > MAX_POINTS)

const scale = computed(() => {
  const values = points.value.map((point) => point.value).concat(0)
  if (!values.length) return null
  let max = Math.max(...values)
  let min = Math.min(...values)
  if (max === min) {
    max += 1
    min -= 1
  }
  return { min, max, span: max - min }
})

function yOf(value) {
  const current = scale.value
  if (!current) return PADDING.top
  return PADDING.top + ((current.max - value) / current.span) * PLOT_HEIGHT
}

function xOf(index, count) {
  return PADDING.left + (PLOT_WIDTH / Math.max(count, 1)) * (index + 0.5)
}

const yTicks = computed(() => {
  const current = scale.value
  if (!current) return []
  return Array.from({ length: 5 }, (_, index) => {
    const value = current.max - (current.span * index) / 4
    return { value, y: yOf(value) }
  })
})

const bars = computed(() => {
  const list = points.value
  if (!list.length) return []
  const step = PLOT_WIDTH / list.length
  const width = Math.max(2, Math.min(step * 0.68, 48))
  const baseline = yOf(0)
  return list.map((point, index) => {
    const valueY = yOf(point.value)
    return {
      ...point,
      x: PADDING.left + step * index + (step - width) / 2,
      y: Math.min(valueY, baseline),
      width,
      height: Math.max(Math.abs(valueY - baseline), 1)
    }
  })
})

const linePointsList = computed(() =>
  points.value.map((point, index) => ({
    ...point,
    x: xOf(index, points.value.length),
    y: yOf(point.value)
  }))
)

const linePoints = computed(() => linePointsList.value.map((point) => `${point.x},${point.y}`).join(' '))

const xLabels = computed(() => {
  const list = points.value
  if (!list.length) return []
  const step = Math.max(1, Math.ceil(list.length / 8))
  const labels = []
  for (let index = 0; index < list.length; index += step) {
    const label = list[index].label
    labels.push({
      x: xOf(index, list.length),
      text: label.length > 10 ? `${label.slice(0, 9)}…` : label || '—'
    })
  }
  return labels
})

function polar(angle) {
  return {
    x: PIE_CENTER.x + PIE_RADIUS * Math.cos(angle),
    y: PIE_CENTER.y + PIE_RADIUS * Math.sin(angle)
  }
}

function arcPath(startAngle, endAngle) {
  const start = polar(startAngle)
  const end = polar(endAngle)
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${PIE_CENTER.x} ${PIE_CENTER.y} L ${start.x} ${start.y} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${large} 1 ${end.x} ${end.y} Z`
}

const pieSlices = computed(() => {
  const positives = points.value.filter((point) => point.value > 0)
  if (!positives.length) return []

  const totals = new Map()
  for (const point of positives) {
    totals.set(point.label, (totals.get(point.label) || 0) + point.value)
  }
  const grouped = Array.from(totals, ([label, value]) => ({ label, value })).sort(
    (left, right) => right.value - left.value
  )
  const top = grouped.slice(0, 7)
  const rest = grouped.slice(7)
  if (rest.length) {
    top.push({ label: t('其他'), value: rest.reduce((sum, item) => sum + item.value, 0) })
  }

  const total = top.reduce((sum, item) => sum + item.value, 0)
  let angle = -Math.PI / 2
  return top.map((item, index) => {
    const sweep = (item.value / total) * Math.PI * 2
    const slice = {
      ...item,
      color: PIE_COLORS[index % PIE_COLORS.length],
      path: arcPath(angle, angle + sweep),
      percent: total ? Math.round((item.value / total) * 1000) / 10 : 0
    }
    angle += sweep
    return slice
  })
})

const pieSingle = computed(() => pieSlices.value.length === 1)

function formatNumber(value) {
  const abs = Math.abs(value)
  if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (abs >= 10000) return `${(value / 1000).toFixed(1)}k`
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 100) / 100)
}
</script>

<style scoped>
.query-chart {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  padding: 10px 12px 6px;
}

.chart-toolbar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.chart-type-group {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.chart-type-btn {
  padding: 2px 10px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  cursor: pointer;
}

.chart-type-btn.active {
  background: var(--surface);
  color: var(--accent-color);
  box-shadow: var(--shadow-sm);
}

.chart-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.chart-select {
  height: var(--control-height-sm);
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  background: var(--surface);
  font-size: var(--font-size-xs);
  color: var(--text-primary);
  appearance: none;
}

.chart-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.chart-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.chart-canvas {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.chart-pie-layout {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 20px;
  min-height: 0;
  overflow: hidden;
}

.chart-pie-layout .chart-canvas {
  flex: 0 1 56%;
  width: 56%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.chart-legend {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-xs);
  overflow-y: auto;
}

.chart-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.legend-swatch {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-value {
  color: var(--text-tertiary);
  white-space: nowrap;
}
</style>
