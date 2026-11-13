<template>
  <PageLayout tool-path="/cron" page-class="cron-page">
    <template #actions>
      <TabBar v-model="activeTab" :tabs="tabs" aria-label="Cron 字段" />
    </template>

    <div class="page-body">
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ getFieldTitle(activeTab) }}</span>
          <span class="field-hint">{{ getFieldHint(activeTab) }}</span>
        </div>
        <div class="panel-body">
          <div class="type-options">
            <label v-if="activeTab !== 'week' && activeTab !== 'day'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="every" />
              <span>每{{ getFieldTitle(activeTab) }}</span>
            </label>
            <label v-if="activeTab === 'week' || activeTab === 'year' || activeTab === 'day'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="notSpecify" />
              <span>不指定</span>
            </label>
            <label v-if="activeTab === 'day'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="every" />
              <span>每日</span>
            </label>
            <label v-if="activeTab !== 'year'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="range" />
              <span>周期</span>
            </label>
            <label v-if="activeTab !== 'week' && activeTab !== 'year'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="interval" />
              <span>循环</span>
            </label>
            <label class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="specific" />
              <span>指定</span>
            </label>
            <label v-if="activeTab === 'day'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="workDay" />
              <span>工作日</span>
            </label>
            <label v-if="activeTab === 'day'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="lastDay" />
              <span>最后一天</span>
            </label>
            <label v-if="activeTab === 'week'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="nth" />
              <span>第几个星期几</span>
            </label>
            <label v-if="activeTab === 'week'" class="type-option">
              <input v-model="currentFieldType" type="radio" :name="activeTab + 'Type'" value="last" />
              <span>最后一个星期几</span>
            </label>
          </div>

          <div class="value-config">
            <template v-if="currentFieldType === 'range'">
              <template v-if="activeTab === 'week'">
                <div class="inline-row">
                  <select v-model="weekRangeFrom" class="select-field" @change="generateExpression">
                    <option v-for="day in weekDays" :key="day.value" :value="day.value">
                      {{ day.label }}
                    </option>
                  </select>
                  <span class="range-separator">至</span>
                  <select v-model="weekRangeTo" class="select-field" @change="generateExpression">
                    <option v-for="day in weekDays" :key="day.value" :value="day.value">
                      {{ day.label }}
                    </option>
                  </select>
                </div>
              </template>
              <template v-else>
                <input
                  v-model.number="rangeValues[activeTab].from"
                  type="number"
                  class="input-field"
                  :min="FIELD_CONFIG[activeTab]?.min"
                  :max="FIELD_CONFIG[activeTab]?.max"
                  @input="generateExpression"
                />
                <span class="range-separator">至</span>
                <input
                  v-model.number="rangeValues[activeTab].to"
                  type="number"
                  class="input-field"
                  :min="FIELD_CONFIG[activeTab]?.min"
                  :max="FIELD_CONFIG[activeTab]?.max"
                  @input="generateExpression"
                />
              </template>
            </template>

            <template v-else-if="currentFieldType === 'interval'">
              <span class="interval-label">从</span>
              <input
                v-model.number="intervalValues[activeTab].start"
                type="number"
                class="input-field"
                :min="FIELD_CONFIG[activeTab]?.min"
                :max="FIELD_CONFIG[activeTab]?.max"
                @input="generateExpression"
              />
              <span class="interval-label">开始，每</span>
              <input
                v-model.number="intervalValues[activeTab].step"
                type="number"
                class="input-field"
                :min="1"
                :max="FIELD_CONFIG[activeTab]?.max"
                @input="generateExpression"
              />
              <span class="interval-label">{{ getFieldTitle(activeTab) }}执行一次</span>
            </template>

            <template v-else-if="currentFieldType === 'specific'">
              <template v-if="activeTab === 'year'">
                <input
                  v-model="yearSpecificInput"
                  type="text"
                  class="input-field specific-input"
                  placeholder="例如: 2024,2025,2026"
                  @input="generateExpression"
                />
              </template>
              <template v-else-if="activeTab === 'hour'">
                <div class="hour-grid-container">
                  <div class="time-section">
                    <div class="time-section-title">上午</div>
                    <div class="specific-grid hour-grid">
                      <div
                        v-for="n in 12"
                        :key="'am-' + n"
                        class="specific-item"
                        :class="{ active: specificValues.hour?.includes(n - 1) }"
                        @click="toggleSpecific('hour', n - 1)"
                      >
                        {{ (n - 1).toString().padStart(2, '0') }}
                      </div>
                    </div>
                  </div>
                  <div class="time-section">
                    <div class="time-section-title">下午</div>
                    <div class="specific-grid hour-grid">
                      <div
                        v-for="n in 12"
                        :key="'pm-' + n"
                        class="specific-item"
                        :class="{ active: specificValues.hour?.includes(n + 11) }"
                        @click="toggleSpecific('hour', n + 11)"
                      >
                        {{ (n + 11).toString().padStart(2, '0') }}
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div
                  class="specific-grid"
                  :class="{
                    'month-grid': activeTab === 'month',
                    'day-grid': activeTab === 'day',
                    'week-grid': activeTab === 'week'
                  }"
                >
                  <template v-if="activeTab === 'week'">
                    <div
                      v-for="day in weekDays"
                      :key="day.value"
                      class="specific-item"
                      :class="{ active: specificValues.week?.includes(parseInt(day.value)) }"
                      @click="toggleSpecific('week', parseInt(day.value))"
                    >
                      {{ day.label }}
                    </div>
                  </template>
                  <template v-else>
                    <div
                      v-for="n in FIELD_CONFIG[activeTab]?.max - FIELD_CONFIG[activeTab]?.min + 1"
                      :key="n"
                      class="specific-item"
                      :class="{
                        active: specificValues[activeTab]?.includes(n - 1 + FIELD_CONFIG[activeTab]?.min)
                      }"
                      @click="toggleSpecific(activeTab, n - 1 + FIELD_CONFIG[activeTab]?.min)"
                    >
                      {{ activeTab === 'month' ? MONTH_NAMES[n] : n - 1 + FIELD_CONFIG[activeTab]?.min }}
                    </div>
                  </template>
                </div>
              </template>
            </template>

            <template v-else-if="currentFieldType === 'workDay'">
              <span class="interval-label">每月</span>
              <input
                v-model.number="workDayValue"
                type="number"
                class="input-field"
                min="1"
                max="31"
                @input="generateExpression"
              />
              <span class="interval-label">号最近的工作日</span>
            </template>

            <template v-else-if="currentFieldType === 'nth'">
              <div class="inline-row">
                <span class="interval-label">每月第</span>
                <select v-model="weekNth" class="select-field" @change="generateExpression">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
                <span class="interval-label">个</span>
                <select v-model="weekNthDay" class="select-field" @change="generateExpression">
                  <option v-for="day in weekDays" :key="day.value" :value="day.value">
                    {{ day.label }}
                  </option>
                </select>
              </div>
            </template>

            <template v-else-if="currentFieldType === 'last'">
              <div class="inline-row">
                <span class="interval-label">每月最后一个</span>
                <select v-model="weekLastDay" class="select-field" @change="generateExpression">
                  <option v-for="day in weekDays" :key="day.value" :value="day.value">
                    {{ day.label }}
                  </option>
                </select>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">表达式</span>
        </div>
        <div class="panel-body">
          <div class="expression-row">
            <label class="field-label">表达式字段</label>
            <div class="field-tags">
              <span class="field-tag">{{ fieldTags.second }}</span>
              <span class="field-tag">{{ fieldTags.minute }}</span>
              <span class="field-tag">{{ fieldTags.hour }}</span>
              <span class="field-tag">{{ fieldTags.day }}</span>
              <span class="field-tag">{{ fieldTags.month }}</span>
              <span class="field-tag">{{ fieldTags.week }}</span>
              <span v-if="fieldTags.year" class="field-tag">{{ fieldTags.year }}</span>
            </div>
          </div>
          <div class="expression-row">
            <label class="field-label">Cron表达式</label>
            <div class="expression-input-wrapper">
              <input v-model="cronExpression" type="text" class="expression-input" @blur="onExpressionBlur" />
              <button class="btn btn-secondary" @click="parseExpression">反解析</button>
              <button class="btn btn-primary" @click="copyExpression">复制</button>
            </div>
          </div>
          <div class="expression-row">
            <div class="expression-desc">
              {{ expressionDesc }}
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">最近 5 次运行时间</span>
        </div>
        <div class="panel-body">
          <div class="schedule-list">
            <div v-if="scheduleList.length === 0" class="schedule-empty">请输入表达式查看执行计划</div>
            <div v-for="(item, index) in scheduleList" :key="index" class="schedule-item">
              <span class="index">{{ index + 1 }}</span>
              <span class="time">{{ item.time }}</span>
              <span class="remaining">{{ item.remaining }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">说明</span>
        </div>
        <div class="panel-body help-content">
          <p>
            Cron 表达式是一种用于指定定时任务执行时间的字符串表达式。它由 6-7
            个字段组成，分别表示秒、分钟、小时、天数、月份、星期几和年份（可选）。
          </p>
          <div class="cron-structure">
            <pre>
┌──────────── [可选] 秒 (0 - 59)
│ ┌────────── 分钟 (0 - 59)
│ │ ┌──────── 小时 (0 - 23)
│ │ │ ┌────── 天数 (1 - 31)
│ │ │ │ ┌──── 月份 (1 - 12)
│ │ │ │ │ ┌── 星期 (0 - 6, 星期天=0)
│ │ │ │ │ │
* * * * * * *  命令</pre
            >
          </div>
          <p><strong>特殊字符说明：</strong></p>
          <ul>
            <li><code>*</code>：表示匹配任意值，如分钟字段的 * 表示每分钟都执行</li>
            <li><code>,</code>：用于分隔多个值，如 1,3,5 表示第1、3、5点执行</li>
            <li><code>-</code>：用于指定范围，如 10-20 表示从10到20</li>
            <li><code>/</code>：用于指定间隔，如 */5 表示每5分钟执行一次</li>
            <li><code>?</code>：仅用于日和周字段，表示不指定具体值（避免冲突）</li>
            <li><code>L</code>：表示最后，如 L 表示每月最后一天</li>
            <li><code>W</code>：表示最近工作日，如 15W 表示每月15日最近的工作日</li>
            <li><code>#</code>：用于指定第几个星期几，如 1#3 表示每月第3个星期一</li>
          </ul>
          <p><strong>常用示例：</strong></p>
          <ul>
            <li><code>0 0 12 * * ?</code>：每天中午12点执行</li>
            <li><code>0 */5 * * * ?</code>：每5分钟执行一次</li>
            <li><code>0 0 8-18 ? * MON-FRI</code>：周一至周五8点到18点每小时执行</li>
            <li><code>0 0 0 L * ?</code>：每月最后一天执行</li>
            <li><code>0 0 0 ? * 1#1</code>：每月第一个星期一执行</li>
          </ul>
        </div>
      </div>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </PageLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useToast } from '@/composables'
import { copyToClipboard, formatDateTime } from '@/utils'
import Toast from '@/components/Toast.vue'
import PageLayout from '@/layouts/PageLayout.vue'
import TabBar from '@/components/TabBar.vue'

const { toastVisible, toastMessage, toastType, showSuccess, showError, showWarning } = useToast()

const FIELD_CONFIG = {
  second: { min: 0, max: 59, name: '秒' },
  minute: { min: 0, max: 59, name: '分' },
  hour: { min: 0, max: 23, name: '时' },
  day: { min: 1, max: 31, name: '日' },
  month: { min: 1, max: 12, name: '月' },
  week: {
    min: 0,
    max: 6,
    name: '周',
    names: ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  },
  year: { min: 2024, max: 2100, name: '年' }
}

const WEEK_ALIASES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
const MONTH_ALIASES = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12
}

const FIELD_UNITS = {
  second: '秒',
  minute: '分钟',
  hour: '小时',
  day: '日',
  month: '月',
  week: '周',
  year: '年'
}

const MONTH_NAMES = [
  '',
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月'
]

const weekDays = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '0', label: '周日' }
]

const tabs = [
  { key: 'second', label: '秒' },
  { key: 'minute', label: '分钟' },
  { key: 'hour', label: '小时' },
  { key: 'day', label: '日' },
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'year', label: '年' }
]

const activeTab = ref('second')

const fieldTypes = reactive({
  second: 'every',
  minute: 'every',
  hour: 'every',
  day: 'every',
  month: 'every',
  week: 'notSpecify',
  year: 'notSpecify'
})

const currentFieldType = computed({
  get: () => fieldTypes[activeTab.value],
  set: (val) => {
    fieldTypes[activeTab.value] = val
    if (activeTab.value === 'day' && val !== 'notSpecify' && val !== 'every') {
      fieldTypes.week = 'notSpecify'
    }
    if (activeTab.value === 'week' && val !== 'notSpecify' && val !== 'every') {
      fieldTypes.day = 'notSpecify'
    }
    generateExpression()
  }
})

const rangeValues = reactive({
  second: { from: 1, to: 2 },
  minute: { from: 1, to: 2 },
  hour: { from: 0, to: 2 },
  day: { from: 1, to: 2 },
  month: { from: 1, to: 2 },
  year: { from: 2024, to: 2030 }
})

const intervalValues = reactive({
  second: { start: 0, step: 1 },
  minute: { start: 0, step: 1 },
  hour: { start: 0, step: 1 },
  day: { start: 1, step: 1 },
  month: { start: 1, step: 1 }
})

const specificValues = reactive({
  second: [],
  minute: [],
  hour: [],
  day: [],
  month: [],
  week: []
})

const workDayValue = ref(1)
const weekRangeFrom = ref('1')
const weekRangeTo = ref('5')
const weekNth = ref('1')
const weekNthDay = ref('1')
const weekLastDay = ref('1')
const yearSpecificInput = ref('')

const cronExpression = ref('* * * * * ?')
const expressionDesc = ref('每秒执行')
const scheduleList = ref([])

const fieldTags = computed(() => {
  const parts = cronExpression.value.trim().split(/\s+/)
  return {
    second: parts[0] || '*',
    minute: parts[1] || '*',
    hour: parts[2] || '*',
    day: parts[3] || '*',
    month: parts[4] || '*',
    week: parts[5] || '?',
    year: parts[6] || ''
  }
})

function getFieldTitle(field) {
  const titles = {
    second: '秒',
    minute: '分钟',
    hour: '小时',
    day: '日',
    month: '月',
    week: '周',
    year: '年'
  }
  return titles[field]
}

function getFieldHint(field) {
  const hints = {
    second: '允许的通配符 [, - * /]',
    minute: '允许的通配符 [, - * /]',
    hour: '允许的通配符 [, - * /]',
    day: '允许的通配符 [, - * / L W]',
    month: '允许的通配符 [, - * /]',
    week: '允许的通配符 [, - * / L #]',
    year: '允许的通配符 [, - * /]'
  }
  return hints[field]
}

function toggleSpecific(field, value) {
  const index = specificValues[field].indexOf(value)
  if (index > -1) {
    specificValues[field].splice(index, 1)
  } else {
    specificValues[field].push(value)
  }
  generateExpression()
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.trunc(number), min), max)
}

function generateDayWeekParts() {
  const dayFree = fieldTypes.day === 'every' || fieldTypes.day === 'notSpecify'
  const weekFree = fieldTypes.week === 'notSpecify' || fieldTypes.week === 'every'

  if (!dayFree) return { day: generateFieldExpr('day'), week: '?' }
  if (!weekFree) return { day: '?', week: generateFieldExpr('week') }
  return { day: '*', week: '?' }
}

function generateExpression() {
  const dayWeek = generateDayWeekParts()
  const parts = [
    generateFieldExpr('second'),
    generateFieldExpr('minute'),
    generateFieldExpr('hour'),
    dayWeek.day,
    generateFieldExpr('month'),
    dayWeek.week
  ]

  const yearExpr = generateFieldExpr('year')
  if (yearExpr) parts.push(yearExpr)

  cronExpression.value = parts.join(' ')
  expressionDesc.value = getExpressionDescription(cronExpression.value)
  updateScheduleList()
}

function generateFieldExpr(field) {
  const config = FIELD_CONFIG[field]
  const type = fieldTypes[field]

  switch (type) {
    case 'every':
      return field === 'year' ? '' : '*'
    case 'notSpecify':
      return field === 'year' ? '' : '?'
    case 'range': {
      if (field === 'week') {
        const from = clampNumber(Number(weekRangeFrom.value), 0, 6, 1)
        const to = clampNumber(Number(weekRangeTo.value), 0, 6, 5)
        return from <= to ? `${from}-${to}` : `${to}-${from}`
      }
      const from = clampNumber(rangeValues[field].from, config.min, config.max, config.min)
      const to = clampNumber(rangeValues[field].to, config.min, config.max, config.max)
      return from <= to ? `${from}-${to}` : `${to}-${from}`
    }
    case 'interval': {
      if (field === 'year' || !intervalValues[field]) return '*'
      const start = clampNumber(intervalValues[field].start, config.min, config.max, config.min)
      const step = clampNumber(intervalValues[field].step, 1, config.max, 1)
      return `${start}/${step}`
    }
    case 'specific': {
      if (field === 'year') return yearSpecificInput.value.trim()
      const values = [...new Set(specificValues[field])].filter(
        (value) => Number.isFinite(value) && value >= config.min && value <= config.max
      )
      if (values.length === 0) return '*'
      if (values.length === config.max - config.min + 1) return '*'
      return values.sort((a, b) => a - b).join(',')
    }
    case 'workDay':
      return `${clampNumber(workDayValue.value, 1, 31, 1)}W`
    case 'lastDay':
      return 'L'
    case 'nth':
      return `${clampNumber(weekNthDay.value, 0, 6, 1)}#${clampNumber(weekNth.value, 1, 5, 1)}`
    case 'last':
      return `${clampNumber(weekLastDay.value, 0, 6, 1)}L`
    default:
      return field === 'year' ? '' : '*'
  }
}

function parseValueToken(token, aliases) {
  if (token == null) return null
  const value = String(token).trim().toUpperCase()
  if (/^\d+$/.test(value)) return Number(value)
  if (aliases && Object.prototype.hasOwnProperty.call(aliases, value)) return aliases[value]
  return null
}

function describeValue(field, value) {
  if (field === 'week') return FIELD_CONFIG.week.names[value] || String(value)
  if (field === 'month') return MONTH_NAMES[value] || String(value)
  return String(value)
}

function describeField(field, expr) {
  const config = FIELD_CONFIG[field]

  if (expr === '*') return field === 'week' ? '每天' : `每${FIELD_UNITS[field]}`
  if (expr === '?') return ''
  if (field === 'day' && expr === 'L') return '最后一天'
  if (field === 'day' && /^\d{1,2}W$/i.test(expr)) return `${expr.slice(0, -1)} 号最近的工作日`
  if (field === 'week') {
    const nthMatch = /^([A-Z]{3}|\d)#([1-5])$/i.exec(expr)
    if (nthMatch) {
      const day = parseValueToken(nthMatch[1], WEEK_ALIASES)
      if (day != null) return `第 ${nthMatch[2]} 个${FIELD_CONFIG.week.names[day]}`
    }
    const lastMatch = /^([A-Z]{3}|\d)L$/i.exec(expr)
    if (lastMatch) {
      const day = parseValueToken(lastMatch[1], WEEK_ALIASES)
      if (day != null) return `最后一个${FIELD_CONFIG.week.names[day]}`
    }
  }

  if (expr.includes('/')) {
    const [start, step] = expr.split('/')
    return `${start === '*' ? config.min : start} 起每 ${step} ${FIELD_UNITS[field]}`
  }

  const aliases = field === 'week' ? WEEK_ALIASES : field === 'month' ? MONTH_ALIASES : null
  if (expr.includes('-')) {
    const [fromToken, toToken] = expr.split('-')
    const from = parseValueToken(fromToken, aliases)
    const to = parseValueToken(toToken, aliases)
    if (from == null || to == null) return expr
    return `${describeValue(field, from)} 至 ${describeValue(field, to)}`
  }

  if (expr.includes(',')) {
    const values = expr
      .split(',')
      .map((token) => parseValueToken(token, aliases))
      .filter((value) => value != null)
    return values.map((value) => describeValue(field, value)).join('、')
  }

  const value = parseValueToken(expr, aliases)
  return value == null ? expr : describeValue(field, value)
}

function timePhrase(field, expr, suffix) {
  if (expr.includes('/')) return describeField(field, expr)
  return `在 ${describeField(field, expr)} ${suffix}`
}

function dayPhrase(expr) {
  const desc = describeField('day', expr)
  if (expr === 'L' || /W$/i.test(expr) || desc.endsWith('日')) return desc
  return `${desc} 日`
}

function getExpressionDescription(expression) {
  const analysis = analyzeExpression(expression)
  if (!analysis.valid) return `表达式错误：${analysis.error}`

  const [second, minute, hour, day, month, week, year] = analysis.parts
  const descs = []

  if (hour !== '*') {
    descs.push(timePhrase('hour', hour, '点'))
  } else if (minute === '*' && second === '*') {
    descs.push('每秒')
  } else if (minute === '*') {
    descs.push('每分钟')
  } else {
    descs.push('每小时')
  }
  if (minute !== '*') descs.push(timePhrase('minute', minute, '分'))
  if (second !== '*') descs.push(timePhrase('second', second, '秒'))

  const dayActive = day !== '*' && day !== '?'
  const weekActive = week !== '*' && week !== '?'
  if (month !== '*') descs.push(`在${describeField('month', month)}`)
  if (year && year !== '*') {
    const yearDesc = describeField('year', year)
    descs.push(year.includes('/') ? `在 ${yearDesc}` : `在 ${yearDesc} 年`)
  }
  if (dayActive) descs.push(`在每月 ${dayPhrase(day)}`)
  if (weekActive) descs.push(`在每月 ${describeField('week', week)}`)

  return descs.join('，') + '执行'
}

function updateScheduleList() {
  const expression = cronExpression.value.trim()
  if (!expression) {
    scheduleList.value = []
    return
  }

  try {
    const schedules = getNextExecutionTimes(expression, 5)
    const now = new Date()
    scheduleList.value = schedules.map((time) => ({
      time: formatDateTime(time),
      remaining: getTimeRemaining(now, time)
    }))
  } catch {
    scheduleList.value = []
  }
}

function parseNumericPart(part, min, max, aliases) {
  if (!part) return null

  const segments = part.split('/')
  if (segments.length > 2) return null

  let step = 1
  const base = segments[0]
  if (segments.length === 2) {
    if (!/^\d+$/.test(segments[1])) return null
    step = Number(segments[1])
    if (step < 1) return null
  }

  let start
  let end
  if (base === '*') {
    start = min
    end = max
  } else if (base.includes('-')) {
    const [fromToken, toToken, ...rest] = base.split('-')
    if (rest.length > 0) return null
    start = parseValueToken(fromToken, aliases)
    end = parseValueToken(toToken, aliases)
    if (start == null || end == null) return null
  } else {
    start = parseValueToken(base, aliases)
    if (start == null) return null
    end = step > 1 ? max : start
  }

  if (start < min || end > max || start > end) return null

  const values = []
  for (let value = start; value <= end; value += step) values.push(value)
  return values
}

function parseValueList(expr, min, max, aliases) {
  if (!expr) return null
  if (expr === '*') {
    const values = []
    for (let value = min; value <= max; value++) values.push(value)
    return values
  }

  const values = new Set()
  for (const rawPart of expr.split(',')) {
    const part = rawPart.trim().toUpperCase()
    const parsed = parseNumericPart(part, min, max, aliases)
    if (!parsed) return null
    parsed.forEach((value) => values.add(value))
  }
  return [...values].sort((a, b) => a - b)
}

function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function nearestWeekday(target, date) {
  const lastDay = lastDayOfMonth(date)
  const day = Math.min(Math.max(target, 1), lastDay)
  const dayOfWeek = new Date(date.getFullYear(), date.getMonth(), day).getDay()
  if (dayOfWeek === 6) return day > 1 ? day - 1 : day + 2
  if (dayOfWeek === 0) return day < lastDay ? day + 1 : day - 2
  return day
}

function compileDayMatcher(expr) {
  if (!expr || expr === '*' || expr === '?') return { match: () => true }

  const matchers = []
  for (const rawPart of expr.split(',')) {
    const part = rawPart.trim().toUpperCase()
    if (!part) return null

    if (part === 'L') {
      matchers.push((date) => date.getDate() === lastDayOfMonth(date))
      continue
    }
    if (part === 'LW') {
      matchers.push((date) => date.getDate() === nearestWeekday(lastDayOfMonth(date), date))
      continue
    }
    const workday = /^(\d{1,2})W$/.exec(part)
    if (workday) {
      const target = Number(workday[1])
      if (target < 1 || target > 31) return null
      matchers.push((date) => date.getDate() === nearestWeekday(target, date))
      continue
    }
    if (part.includes('W')) return null

    const values = parseNumericPart(part, 1, 31)
    if (!values) return null
    matchers.push((date) => values.includes(date.getDate()))
  }

  return { match: (date) => matchers.some((fn) => fn(date)) }
}

function compileWeekMatcher(expr) {
  if (!expr || expr === '*' || expr === '?') return { match: () => true }

  const matchers = []
  for (const rawPart of expr.split(',')) {
    const part = rawPart.trim().toUpperCase()
    if (!part) return null

    const nthMatch = /^([A-Z]{3}|\d)#([1-5])$/.exec(part)
    if (nthMatch) {
      const day = parseValueToken(nthMatch[1], WEEK_ALIASES)
      if (day == null || day > 6) return null
      const nth = Number(nthMatch[2])
      matchers.push((date) => date.getDay() === day && Math.ceil(date.getDate() / 7) === nth)
      continue
    }
    const lastMatch = /^([A-Z]{3}|\d)L$/.exec(part)
    if (lastMatch) {
      const day = parseValueToken(lastMatch[1], WEEK_ALIASES)
      if (day == null || day > 6) return null
      matchers.push((date) => date.getDay() === day && date.getDate() + 7 > lastDayOfMonth(date))
      continue
    }

    const values = parseNumericPart(part, 0, 6, WEEK_ALIASES)
    if (!values) return null
    matchers.push((date) => values.includes(date.getDay()))
  }

  return { match: (date) => matchers.some((fn) => fn(date)) }
}

function analyzeExpression(expression) {
  const parts = String(expression || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length < 6 || parts.length > 7) return { valid: false, error: '应为 6 或 7 个字段' }

  const [second, minute, hour, day, month, week, year] = parts
  const secondSet = parseValueList(second, 0, 59)
  if (!secondSet) return { valid: false, error: '秒字段无效' }
  const minuteSet = parseValueList(minute, 0, 59)
  if (!minuteSet) return { valid: false, error: '分钟字段无效' }
  const hourSet = parseValueList(hour, 0, 23)
  if (!hourSet) return { valid: false, error: '小时字段无效' }

  const dayMatcher = compileDayMatcher(day)
  if (!dayMatcher) return { valid: false, error: '日字段无效' }
  const monthSet = parseValueList(month, 1, 12, MONTH_ALIASES)
  if (!monthSet) return { valid: false, error: '月字段无效' }
  const weekMatcher = compileWeekMatcher(week)
  if (!weekMatcher) return { valid: false, error: '周字段无效' }
  const yearSet = year ? parseValueList(year, 1970, 9999) : null
  if (year && !yearSet) return { valid: false, error: '年字段无效' }

  return {
    valid: true,
    parts,
    secondSet,
    minuteSet,
    hourSet,
    monthSet,
    yearSet,
    dayMatcher,
    weekMatcher
  }
}

function getNextExecutionTimes(expression, count) {
  const analysis = analyzeExpression(expression)
  if (!analysis.valid) return []

  const { secondSet, minuteSet, hourSet, monthSet, yearSet, dayMatcher, weekMatcher } = analysis
  const results = []
  const maxYear = yearSet ? Math.max(...yearSet) : new Date().getFullYear() + 5
  const maxDate = new Date(maxYear, 11, 31, 23, 59, 59)
  let current = new Date()
  current.setMilliseconds(0)
  current.setSeconds(current.getSeconds() + 1)

  let iterations = 0
  while (results.length < count && current <= maxDate && iterations < 200000) {
    iterations++

    const year = current.getFullYear()
    if (yearSet && !yearSet.includes(year)) {
      const nextYear = yearSet.find((value) => value > year)
      if (nextYear == null) break
      current = new Date(nextYear, 0, 1, 0, 0, 0)
      continue
    }

    const month = current.getMonth()
    if (!monthSet.includes(month + 1)) {
      current = new Date(year, month + 1, 1, 0, 0, 0)
      continue
    }

    if (!dayMatcher.match(current) || !weekMatcher.match(current)) {
      current = new Date(year, month, current.getDate() + 1, 0, 0, 0)
      continue
    }

    if (!hourSet.includes(current.getHours())) {
      current = new Date(year, month, current.getDate(), current.getHours() + 1, 0, 0)
      continue
    }

    if (!minuteSet.includes(current.getMinutes())) {
      current = new Date(year, month, current.getDate(), current.getHours(), current.getMinutes() + 1, 0)
      continue
    }

    if (!secondSet.includes(current.getSeconds())) {
      current = new Date(current.getTime() + 1000)
      continue
    }

    results.push(new Date(current))
    current = new Date(current.getTime() + 1000)
  }

  return results
}

function getTimeRemaining(from, to) {
  const diff = to - from
  if (diff < 0) return '已过期'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  const parts = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}时`)
  if (minutes > 0) parts.push(`${minutes}分`)
  if (seconds > 0 && parts.length < 2) parts.push(`${seconds}秒`)

  if (parts.length === 0) return '即将执行'
  return parts.join('') + '后'
}

function parseExpression() {
  const expression = cronExpression.value.trim()
  if (!expression) {
    showWarning('请输入表达式')
    return
  }

  const analysis = analyzeExpression(expression)
  if (!analysis.valid) {
    expressionDesc.value = `表达式错误：${analysis.error}`
    scheduleList.value = []
    showError(`表达式格式错误：${analysis.error}`)
    return
  }

  const fieldsToParse = ['second', 'minute', 'hour', 'day', 'month', 'week']
  if (analysis.parts.length === 7) fieldsToParse.push('year')

  const fullyParsed = fieldsToParse.every((field, index) => parseFieldExpression(field, analysis.parts[index]))

  expressionDesc.value = getExpressionDescription(cronExpression.value)
  updateScheduleList()
  if (fullyParsed) {
    showSuccess('表达式已反解析')
  } else {
    showWarning('部分字段无法完整映射到表单，请以表达式为准')
  }
}

function parseFieldExpression(field, expr) {
  const value = String(expr || '').trim()
  const upper = value.toUpperCase()

  if (upper === '*' || upper === '') {
    setFieldTypeValue(field, 'every')
    return true
  }

  if (upper === '?') {
    if (field !== 'day' && field !== 'week') return false
    setFieldTypeValue(field, 'notSpecify')
    return true
  }

  if (field === 'day') {
    if (upper === 'L') {
      setFieldTypeValue(field, 'lastDay')
      return true
    }
    const workday = /^(\d{1,2})W$/.exec(upper)
    if (workday) {
      setFieldTypeValue(field, 'workDay')
      workDayValue.value = Number(workday[1])
      return true
    }
  }

  if (field === 'week') {
    const nthMatch = /^([A-Z]{3}|\d)#([1-5])$/.exec(upper)
    if (nthMatch) {
      const day = parseValueToken(nthMatch[1], WEEK_ALIASES)
      if (day == null) return false
      setFieldTypeValue(field, 'nth')
      weekNthDay.value = String(day)
      weekNth.value = nthMatch[2]
      return true
    }
    const lastMatch = /^([A-Z]{3}|\d)L$/.exec(upper)
    if (lastMatch) {
      const day = parseValueToken(lastMatch[1], WEEK_ALIASES)
      if (day == null) return false
      setFieldTypeValue(field, 'last')
      weekLastDay.value = String(day)
      return true
    }
  }

  if (field === 'year') {
    setFieldTypeValue(field, 'specific')
    yearSpecificInput.value = value
    return true
  }

  if (upper.includes('/')) {
    const [startToken, stepToken] = upper.split('/')
    if (stepToken == null || !/^\d+$/.test(stepToken)) return false
    if (!intervalValues[field]) return false
    setFieldTypeValue(field, 'interval')
    intervalValues[field].start = startToken === '*' ? FIELD_CONFIG[field].min : Number(startToken)
    intervalValues[field].step = Number(stepToken)
    return true
  }

  if (upper.includes('-')) {
    const [fromToken, toToken] = upper.split('-')
    if (toToken == null) return false
    if (field === 'week') {
      const from = parseValueToken(fromToken, WEEK_ALIASES)
      const to = parseValueToken(toToken, WEEK_ALIASES)
      if (from == null || to == null) return false
      setFieldTypeValue(field, 'range')
      weekRangeFrom.value = String(from)
      weekRangeTo.value = String(to)
      return true
    }
    const aliases = field === 'month' ? MONTH_ALIASES : null
    const from = parseValueToken(fromToken, aliases)
    const to = parseValueToken(toToken, aliases)
    if (from == null || to == null || !rangeValues[field]) return false
    setFieldTypeValue(field, 'range')
    rangeValues[field].from = from
    rangeValues[field].to = to
    return true
  }

  const aliases = field === 'week' ? WEEK_ALIASES : field === 'month' ? MONTH_ALIASES : null
  const values = upper.split(',').map((token) => parseValueToken(token, aliases))
  if (values.some((item) => item == null)) return false

  setFieldTypeValue(field, 'specific')
  specificValues[field] = values
  return true
}

function setFieldTypeValue(field, type) {
  fieldTypes[field] = type
}

function onExpressionBlur() {
  expressionDesc.value = getExpressionDescription(cronExpression.value)
  updateScheduleList()
}

async function copyExpression() {
  const text = cronExpression.value
  if (!text) return

  const success = await copyToClipboard(text)
  if (success) {
    showSuccess('已复制到剪贴板')
  } else {
    showError('复制失败，请手动复制')
  }
}

onMounted(() => {
  generateExpression()
})
</script>

<style scoped>
.page-body {
  padding: 12px 16px 16px;
  width: 100%;
}

.panel-header .field-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.type-option:hover {
  border-color: var(--border-strong);
}

.type-option input[type='radio'] {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  accent-color: var(--accent-color);
  cursor: pointer;
}

.type-option:has(input:checked) {
  background: rgba(var(--accent-rgb), 0.06);
  border-color: rgba(var(--accent-rgb), 0.45);
  color: var(--text-primary);
}

.value-config {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.inline-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.value-config .input-field {
  width: 72px;
  text-align: center;
}

.value-config .select-field {
  width: 88px;
}

.range-separator,
.interval-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.specific-input {
  width: 220px !important;
}

.specific-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 6px;
  align-self: flex-start;
}

.specific-grid.hour-grid {
  grid-template-columns: repeat(6, 1fr);
}

.specific-grid.month-grid {
  grid-template-columns: repeat(4, 1fr);
}

.specific-grid.day-grid {
  grid-template-columns: repeat(7, 1fr);
}

.specific-grid.week-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.specific-grid.week-grid .specific-item {
  width: auto;
  min-width: 56px;
  padding: 0 10px;
}

.hour-grid-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.time-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.time-section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
}

.specific-item {
  width: 32px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  transition: var(--transition-fast);
  background: var(--surface);
  color: var(--text-secondary);
}

.specific-item:hover {
  border-color: var(--border-strong);
}

.specific-item.active {
  background: var(--primary-color);
  color: var(--text-inverse);
  border-color: var(--primary-color);
}

.expression-row {
  margin-bottom: 14px;
}

.expression-row:last-child {
  margin-bottom: 0;
}

.field-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.field-tag {
  padding: 4px 10px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.expression-input-wrapper {
  display: flex;
  gap: 8px;
}

.expression-input {
  flex: 1;
  height: var(--control-height);
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-base);
  background: var(--surface);
  color: var(--text-primary);
}

.expression-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.expression-desc {
  padding: 8px 10px;
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schedule-empty {
  padding: 16px;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

.schedule-item .index {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: var(--text-inverse);
  border-radius: 50%;
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.schedule-item .time {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.schedule-item .remaining {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.help-content {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.7;
}

.help-content p {
  margin-bottom: 10px;
}

.help-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.help-content li {
  margin-bottom: 4px;
}

.help-content code {
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
}

.cron-structure {
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  margin: 12px 0;
}

.cron-structure pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
  line-height: 1.6;
}
</style>
