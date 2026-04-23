<template>
  <div
    class="cron-container"
    :style="{ width: windowWidth + 'px' }"
  >
    <header>
      <h1>
        <svg
          class="header-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
          />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Cron 表达式生成器
      </h1>
      <div class="subtitle">
        可视化生成定时任务表达式
      </div>
      
      <div class="field-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          class="field-tab"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="tab-text">{{ tab.text }}</span>
        </div>
      </div>
    </header>

    <div class="cron-content">
      <div class="field-panel">
        <div class="field-title">
          {{ getFieldTitle(activeTab) }}
        </div>
        <div class="field-hint">
          {{ getFieldHint(activeTab) }}
        </div>
        
        <div class="type-options">
          <label
            v-if="activeTab !== 'week' && activeTab !== 'day'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="every"
            >
            <span>每{{ getFieldTitle(activeTab) }}</span>
          </label>
          <label
            v-if="activeTab === 'week' || activeTab === 'year' || activeTab === 'day'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="notSpecify"
            >
            <span>不指定</span>
          </label>
          <label
            v-if="activeTab === 'day'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="every"
            >
            <span>每日</span>
          </label>
          <label
            v-if="activeTab !== 'year'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="range"
            >
            <span>周期</span>
          </label>
          <label
            v-if="activeTab !== 'week' && activeTab !== 'year'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="interval"
            >
            <span>循环</span>
          </label>
          <label class="type-option">
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="specific"
            >
            <span>指定</span>
          </label>
          <label
            v-if="activeTab === 'day'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="workDay"
            >
            <span>工作日</span>
          </label>
          <label
            v-if="activeTab === 'day'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="lastDay"
            >
            <span>最后一天</span>
          </label>
          <label
            v-if="activeTab === 'week'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="nth"
            >
            <span>第几个星期几</span>
          </label>
          <label
            v-if="activeTab === 'week'"
            class="type-option"
          >
            <input
              v-model="currentFieldType"
              type="radio"
              :name="activeTab + 'Type'"
              value="last"
            >
            <span>最后一个星期几</span>
          </label>
        </div>

        <div class="value-config">
          <template v-if="currentFieldType === 'range'">
            <template v-if="activeTab === 'week'">
              <select
                v-model="weekRangeFrom"
                class="select-field"
                @change="generateExpression"
              >
                <option
                  v-for="day in weekDays"
                  :key="day.value"
                  :value="day.value"
                >
                  {{ day.label }}
                </option>
              </select>
              <span class="range-separator">至</span>
              <select
                v-model="weekRangeTo"
                class="select-field"
                @change="generateExpression"
              >
                <option
                  v-for="day in weekDays"
                  :key="day.value"
                  :value="day.value"
                >
                  {{ day.label }}
                </option>
              </select>
            </template>
            <template v-else>
              <input
                v-model.number="rangeValues[activeTab].from"
                type="number"
                class="input-field"
                :min="FIELD_CONFIG[activeTab]?.min"
                :max="FIELD_CONFIG[activeTab]?.max"
                @input="generateExpression"
              >
              <span class="range-separator">至</span>
              <input
                v-model.number="rangeValues[activeTab].to"
                type="number"
                class="input-field"
                :min="FIELD_CONFIG[activeTab]?.min"
                :max="FIELD_CONFIG[activeTab]?.max"
                @input="generateExpression"
              >
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
            >
            <span class="interval-label">开始，每</span>
            <input
              v-model.number="intervalValues[activeTab].step"
              type="number"
              class="input-field"
              :min="1"
              :max="FIELD_CONFIG[activeTab]?.max"
              @input="generateExpression"
            >
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
              >
            </template>
            <template v-else-if="activeTab === 'hour'">
              <div class="hour-grid-container">
                <div class="time-section">
                  <div class="time-section-title">
                    上午
                  </div>
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
                  <div class="time-section-title">
                    下午
                  </div>
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
                :class="{ 'month-grid': activeTab === 'month', 'day-grid': activeTab === 'day', 'week-grid': activeTab === 'week' }"
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
                    v-for="n in (FIELD_CONFIG[activeTab]?.max - FIELD_CONFIG[activeTab]?.min + 1)"
                    :key="n"
                    class="specific-item"
                    :class="{ active: specificValues[activeTab]?.includes(n - 1 + FIELD_CONFIG[activeTab]?.min) }"
                    @click="toggleSpecific(activeTab, n - 1 + FIELD_CONFIG[activeTab]?.min)"
                  >
                    {{ activeTab === 'month' ? MONTH_NAMES[n] : (n - 1 + FIELD_CONFIG[activeTab]?.min) }}
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
            >
            <span class="interval-label">号最近的工作日</span>
          </template>

          <template v-else-if="currentFieldType === 'nth'">
            <span class="interval-label">每月第</span>
            <select
              v-model="weekNth"
              class="select-field"
              @change="generateExpression"
            >
              <option value="1">
                1
              </option>
              <option value="2">
                2
              </option>
              <option value="3">
                3
              </option>
              <option value="4">
                4
              </option>
              <option value="5">
                5
              </option>
            </select>
            <span class="interval-label">个</span>
            <select
              v-model="weekNthDay"
              class="select-field"
              @change="generateExpression"
            >
              <option
                v-for="day in weekDays"
                :key="day.value"
                :value="day.value"
              >
                {{ day.label }}
              </option>
            </select>
          </template>

          <template v-else-if="currentFieldType === 'last'">
            <span class="interval-label">每月最后一个</span>
            <select
              v-model="weekLastDay"
              class="select-field"
              @change="generateExpression"
            >
              <option
                v-for="day in weekDays"
                :key="day.value"
                :value="day.value"
              >
                {{ day.label }}
              </option>
            </select>
          </template>
        </div>
      </div>

      <div class="expression-box">
        <div class="expression-row">
          <label class="field-label">表达式字段</label>
          <div class="field-tags">
            <span class="field-tag">{{ fieldTags.second }}</span>
            <span class="field-tag">{{ fieldTags.minute }}</span>
            <span class="field-tag">{{ fieldTags.hour }}</span>
            <span class="field-tag">{{ fieldTags.day }}</span>
            <span class="field-tag">{{ fieldTags.month }}</span>
            <span class="field-tag">{{ fieldTags.week }}</span>
            <span class="field-tag">{{ fieldTags.year }}</span>
          </div>
        </div>
        <div class="expression-row">
          <label class="field-label">Cron表达式</label>
          <div class="expression-input-wrapper">
            <input
              v-model="cronExpression"
              type="text"
              class="expression-input"
              @blur="onExpressionBlur"
            >
            <button
              class="btn btn-sm"
              @click="parseExpression"
            >
              反解析
            </button>
            <button
              class="btn btn-sm btn-primary"
              @click="copyExpression"
            >
              复制
            </button>
          </div>
        </div>
        <div class="expression-row">
          <div class="expression-desc">
            {{ expressionDesc }}
          </div>
        </div>
      </div>

      <div class="schedule-box">
        <div class="schedule-title">
          最近5次运行时间
        </div>
        <div class="schedule-list">
          <div
            v-if="scheduleList.length === 0"
            class="schedule-empty"
          >
            请输入表达式查看执行计划
          </div>
          <div
            v-for="(item, index) in scheduleList"
            :key="index"
            class="schedule-item"
          >
            <span class="index">{{ index + 1 }}</span>
            <span class="time">{{ item.time }}</span>
            <span class="remaining">{{ item.remaining }}</span>
          </div>
        </div>
      </div>

      <div class="help-section">
        <div class="help-title">
          说明
        </div>
        <div class="help-content">
          <p>Cron 表达式是一种用于指定定时任务执行时间的字符串表达式。它由 6-7 个字段组成，分别表示秒、分钟、小时、天数、月份、星期几和年份（可选）。</p>
          <div class="cron-structure">
            <pre>
┌──────────── [可选] 秒 (0 - 59)
│ ┌────────── 分钟 (0 - 59)
│ │ ┌──────── 小时 (0 - 23)
│ │ │ ┌────── 天数 (1 - 31)
│ │ │ │ ┌──── 月份 (1 - 12)
│ │ │ │ │ ┌── 星期 (0 - 6, 星期天=0)
│ │ │ │ │ │
* * * * * * *  命令</pre>
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
            <li><code>#</code>：用于指定第几个星期几，如 2#3 表示每月第3个星期一</li>
          </ul>
          <p><strong>常用示例：</strong></p>
          <ul>
            <li><code>0 0 12 * * ?</code>：每天中午12点执行</li>
            <li><code>0 */5 * * * ?</code>：每5分钟执行一次</li>
            <li><code>0 0 8-18 ? * MON-FRI</code>：周一至周五8点到18点每小时执行</li>
            <li><code>0 0 0 L * ?</code>：每月最后一天执行</li>
            <li><code>0 0 0 ? * 2#1</code>：每月第一个星期一执行</li>
          </ul>
        </div>
      </div>
    </div>

    <div
      class="toast"
      :class="{ show: toastVisible }"
    >
      <span class="toast-icon">✓</span>
      <span class="toast-message">{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useWindowWidth } from '@/composables'

const windowWidth = useWindowWidth()

const FIELD_CONFIG = {
  second: { min: 0, max: 59, name: '秒' },
  minute: { min: 0, max: 59, name: '分' },
  hour: { min: 0, max: 23, name: '时' },
  day: { min: 1, max: 31, name: '日' },
  month: { min: 1, max: 12, name: '月' },
  week: { min: 0, max: 6, name: '周', names: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] },
  year: { min: 2024, max: 2100, name: '年' }
}

const MONTH_NAMES = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const tabs = [
  { key: 'second', text: '秒' },
  { key: 'minute', text: '分钟' },
  { key: 'hour', text: '小时' },
  { key: 'day', text: '日' },
  { key: 'month', text: '月' },
  { key: 'week', text: '周' },
  { key: 'year', text: '年' }
]

const fields = ['second', 'minute', 'hour', 'day', 'month', 'week', 'year']

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
    const oldType = fieldTypes[activeTab.value]
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
const weekRangeTo = ref('0')
const weekNth = ref('1')
const weekNthDay = ref('1')
const weekLastDay = ref('1')
const yearSpecificInput = ref('')

const cronExpression = ref('* * * * * ?')
const expressionDesc = ref('每秒执行')
const scheduleList = ref([])
const toastVisible = ref(false)
const toastMessage = ref('')

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

function setFieldType(field, type) {
  fieldTypes[field] = type
  generateExpression()
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

function generateExpression() {
  const parts = []

  parts.push(generateFieldExpr('second'))
  parts.push(generateFieldExpr('minute'))
  parts.push(generateFieldExpr('hour'))
  parts.push(generateFieldExpr('day'))
  parts.push(generateFieldExpr('month'))
  parts.push(generateFieldExpr('week'))

  const yearExpr = generateFieldExpr('year')
  if (yearExpr && yearExpr !== '') {
    parts.push(yearExpr)
  }

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
      return '?'
    case 'range':
      if (field === 'week') {
        return `${weekRangeFrom.value}-${weekRangeTo.value}`
      }
      return `${rangeValues[field].from}-${rangeValues[field].to}`
    case 'interval':
      return `${intervalValues[field].start}/${intervalValues[field].step}`
    case 'specific': {
      if (field === 'year') {
        return yearSpecificInput.value.trim()
      }
      if (specificValues[field].length === 0) return '*'
      const max = config.max
      const min = config.min
      if (specificValues[field].length === (max - min + 1)) return '*'
      return specificValues[field].sort((a, b) => a - b).join(',')
    }
    case 'workDay':
      return `${workDayValue.value}W`
    case 'lastDay':
      return 'L'
    case 'nth':
      return `${weekNthDay.value}#${weekNth.value}`
    case 'last':
      return `${weekLastDay.value}L`
    default:
      return field === 'year' ? '' : '*'
  }
}

function getExpressionDescription(expression) {
  const parts = expression.split(/\s+/)
  if (parts.length < 6) return '格式错误'

  const [second, minute, hour, day, month, week, year] = parts
  const descs = []

  if (second === '*') {
    descs.push('每秒')
  } else {
    descs.push(`在 ${getFieldDesc('second', second)} 秒`)
  }

  if (minute === '*') {
    descs.push('每分钟')
  } else {
    descs.push(`在 ${getFieldDesc('minute', minute)} 分`)
  }

  if (hour === '*') {
    descs.push('每小时')
  } else {
    descs.push(`在 ${getFieldDesc('hour', hour)} 时`)
  }

  if (day === '?' || day === '*') {
    if (week !== '*' && week !== '?') {
      descs.push(`在 ${getFieldDesc('week', week)}`)
    }
  } else if (week === '?' || week === '*') {
    if (day !== '*') {
      descs.push(`在 ${getFieldDesc('day', day)} 日`)
    }
  }

  if (month !== '*') {
    descs.push(`在 ${getFieldDesc('month', month)} 月`)
  }

  if (year && year !== '*') {
    descs.push(`在 ${year} 年`)
  }

  return descs.join('，') + ' 执行'
}

function getFieldDesc(field, expr) {
  if (expr === '*') return '每' + FIELD_CONFIG[field].name

  if (expr.includes('-')) {
    const [from, to] = expr.split('-')
    if (field === 'week') {
      const names = FIELD_CONFIG.week.names
      return `${names[parseInt(from)]} 到 ${names[parseInt(to)]}`
    }
    return `${from} 到 ${to}`
  }

  if (expr.includes('/')) {
    const [start, step] = expr.split('/')
    return `${start === '*' ? '0' : start} 开始每隔 ${step}`
  }

  if (expr.includes(',')) {
    const values = expr.split(',')
    if (field === 'week') {
      const names = FIELD_CONFIG.week.names
      return values.map(v => names[parseInt(v)]).join('、')
    }
    if (field === 'month') {
      return values.map(v => MONTH_NAMES[parseInt(v)]).join('、')
    }
    return values.join('、')
  }

  if (expr.endsWith('W')) {
    return `${expr.slice(0, -1)} 号最近工作日`
  }

  if (expr === 'L') {
    return '最后一天'
  }

  if (expr.includes('#')) {
    const [day, nth] = expr.split('#')
    const names = FIELD_CONFIG.week.names
    return `第${nth}个${names[parseInt(day)]}`
  }

  if (expr.endsWith('L') && field === 'week') {
    const day = expr.slice(0, -1)
    const names = FIELD_CONFIG.week.names
    return `最后一个${names[parseInt(day)]}`
  }

  if (field === 'week') {
    return FIELD_CONFIG.week.names[parseInt(expr)]
  }
  if (field === 'month') {
    return MONTH_NAMES[parseInt(expr)]
  }

  return expr
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
    scheduleList.value = schedules.map(time => ({
      time: formatDateTime(time),
      remaining: getTimeRemaining(now, time)
    }))
  } catch (err) {
    scheduleList.value = []
  }
}

function getNextExecutionTimes(expression, count) {
  const parts = expression.split(/\s+/)
  if (parts.length < 6) return []

  const [secondExpr, minuteExpr, hourExpr, dayExpr, monthExpr, weekExpr, yearExpr] = parts

  const results = []
  const current = new Date()
  current.setMilliseconds(0)

  const secondSet = parseCronField(secondExpr, 0, 59)
  const minuteSet = parseCronField(minuteExpr, 0, 59)
  const hourSet = parseCronField(hourExpr, 0, 23)
  const daySet = dayExpr === '?' ? null : parseCronField(dayExpr, 1, 31)
  const monthSet = parseCronField(monthExpr, 1, 12)
  const weekSet = weekExpr === '?' ? null : parseCronField(weekExpr, 0, 6)
  const yearSet = yearExpr ? parseCronField(yearExpr, 2024, 2100) : null

  const maxDate = new Date(current.getFullYear() + 3, 11, 31, 23, 59, 59)

  while (results.length < count && current <= maxDate) {
    if (yearSet && !yearSet.includes(current.getFullYear())) {
      current.setFullYear(current.getFullYear() + 1)
      current.setMonth(0, 1)
      current.setHours(0, 0, 0)
      continue
    }

    if (!monthSet.includes(current.getMonth() + 1)) {
      current.setMonth(current.getMonth() + 1)
      current.setDate(1)
      current.setHours(0, 0, 0)
      continue
    }

    let dateMatch
    if (daySet && weekSet) {
      dateMatch = daySet.includes(current.getDate()) || weekSet.includes(current.getDay())
    } else if (weekSet) {
      dateMatch = weekSet.includes(current.getDay())
    } else if (daySet) {
      dateMatch = daySet.includes(current.getDate())
    } else {
      dateMatch = true
    }

    if (!dateMatch) {
      current.setDate(current.getDate() + 1)
      current.setHours(0, 0, 0)
      continue
    }

    if (!hourSet.includes(current.getHours())) {
      current.setHours(current.getHours() + 1)
      current.setMinutes(0, 0)
      continue
    }

    if (!minuteSet.includes(current.getMinutes())) {
      current.setMinutes(current.getMinutes() + 1)
      current.setSeconds(0)
      continue
    }

    if (!secondSet.includes(current.getSeconds())) {
      current.setSeconds(current.getSeconds() + 1)
      continue
    }

    results.push(new Date(current))
    current.setSeconds(current.getSeconds() + 1)
  }

  return results
}

function parseCronField(expr, min, max) {
  const result = []

  if (!expr || expr === '*' || expr === '?') {
    for (let i = min; i <= max; i++) {
      result.push(i)
    }
    return result
  }

  if (expr === 'L') {
    return [31]
  }

  if (expr.endsWith('W')) {
    return [parseInt(expr)]
  }

  const parts = expr.split(',')

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let i = start; i <= end; i++) {
        result.push(i)
      }
    } else if (part.includes('/')) {
      const [startStep, step] = part.split('/')
      let start = parseInt(startStep)
      if (part.startsWith('*/')) {
        start = min
      }
      for (let i = start; i <= max; i += parseInt(step)) {
        result.push(i)
      }
    } else if (part.includes('#')) {
      result.push(Number(part.split('#')[0]))
    } else if (part.endsWith('L')) {
      result.push(Number(part.slice(0, -1)))
    } else {
      result.push(Number(part))
    }
  }

  return result.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
}

function formatDateTime(date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  const second = date.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
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
    showToast('请输入表达式')
    return
  }

  const parts = expression.split(/\s+/)
  if (parts.length < 6 || parts.length > 7) {
    showToast('表达式格式错误，应为 6-7 个字段')
    return
  }

  const fieldsToParse = ['second', 'minute', 'hour', 'day', 'month', 'week']
  if (parts.length === 7) {
    fieldsToParse.push('year')
  }

  fieldsToParse.forEach((field, index) => {
    if (index < parts.length) {
      parseFieldExpression(field, parts[index])
    }
  })

  expressionDesc.value = getExpressionDescription(cronExpression.value)
  updateScheduleList()
  showToast('表达式已反解析')
}

function parseFieldExpression(field, expr) {
  if (expr === '*' || expr === '') {
    setFieldTypeValue(field, 'every')
    return
  }

  if (expr === '?') {
    setFieldTypeValue(field, 'notSpecify')
    return
  }

  if (expr === 'L') {
    setFieldTypeValue(field, 'lastDay')
    return
  }

  if (expr.endsWith('W')) {
    setFieldTypeValue(field, 'workDay')
    workDayValue.value = parseInt(expr.slice(0, -1))
    return
  }

  if (expr.endsWith('L') && field === 'week') {
    setFieldTypeValue(field, 'last')
    weekLastDay.value = expr.slice(0, -1)
    return
  }

  if (expr.includes('#') && field === 'week') {
    setFieldTypeValue(field, 'nth')
    const [day, nth] = expr.split('#')
    weekNth.value = nth
    weekNthDay.value = day
    return
  }

  if (expr.includes('-')) {
    setFieldTypeValue(field, 'range')
    const [from, to] = expr.split('-')
    if (field === 'week') {
      weekRangeFrom.value = from
      weekRangeTo.value = to
    } else {
      rangeValues[field].from = parseInt(from)
      rangeValues[field].to = parseInt(to)
    }
    return
  }

  if (expr.includes('/')) {
    setFieldTypeValue(field, 'interval')
    const [start, step] = expr.split('/')
    intervalValues[field].start = start === '*' ? 0 : parseInt(start)
    intervalValues[field].step = parseInt(step)
    return
  }

  setFieldTypeValue(field, 'specific')
  if (field === 'year') {
    yearSpecificInput.value = expr
  } else {
    const values = expr.split(',').map(Number)
    specificValues[field] = values
  }
}

function setFieldTypeValue(field, type) {
  fieldTypes[field] = type
}

function onExpressionBlur() {
  expressionDesc.value = getExpressionDescription(cronExpression.value)
  updateScheduleList()
}

function copyExpression() {
  const text = cronExpression.value
  if (!text) return

  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板')
  }).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      showToast('已复制到剪贴板')
    } catch (e) {
      showToast('复制失败，请手动复制')
    }
    document.body.removeChild(textarea)
  })
}

function showToast(message) {
  toastMessage.value = message
  toastVisible.value = true
  setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

onMounted(() => {
  generateExpression()
})
</script>

<style scoped>
.cron-container {
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  overflow: hidden;
}

.cron-container header {
  background: var(--primary-gradient);
  color: white;
  padding: 20px 24px 16px;
  text-align: center;
  flex-shrink: 0;
}

.cron-container header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 24px;
  margin-bottom: 6px;
}

.cron-container header h1 .header-icon {
  width: 28px;
  height: 28px;
}

.cron-container header .subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 16px;
}

.field-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.field-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: rgba(255, 255, 255, 0.9);
  min-width: 60px;
}

.field-tab:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
}

.field-tab.active {
  background: rgba(255, 255, 255, 0.95);
  color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-weight: 600;
}

.tab-text {
  font-size: 13px;
}

.cron-content {
  padding: 20px 24px;
  flex: 1;
  overflow-y: auto;
  background: rgba(248, 249, 250, 0.5);
}

.field-panel {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 16px;
  display: block;
}

.field-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.field-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
  background: rgba(248, 249, 250, 0.5);
  padding: 4px 10px;
  border-radius: 12px;
  display: inline-block;
}

.type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
}

.type-option:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.type-option input[type="radio"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary-color);
  cursor: pointer;
}

.type-option:has(input:checked) {
  background: rgba(102, 126, 234, 0.1);
  border-color: var(--primary-color);
}

.value-config {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.value-config .input-field {
  width: 70px;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  background: var(--glass-bg);
}

.value-config .input-field:focus {
  outline: none;
  border-color: var(--primary-color);
}

.value-config .select-field {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--glass-bg);
  cursor: pointer;
}

.value-config .select-field:focus {
  outline: none;
  border-color: var(--primary-color);
}

.range-separator,
.interval-label {
  color: var(--text-secondary);
  font-size: 14px;
}

.specific-input {
  width: 200px !important;
}

.specific-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 6px;
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
  gap: 10px;
}

.specific-grid.week-grid .specific-item {
  flex: 1;
  min-width: 80px;
}

.hour-grid-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.time-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.time-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
  padding-left: 4px;
}

.specific-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  transition: var(--transition-normal);
  background: var(--glass-bg);
}

.specific-item:hover {
  border-color: var(--primary-color);
}

.specific-item.active {
  background: var(--primary-gradient);
  color: white;
  border-color: transparent;
}

.expression-box {
  background: rgba(248, 249, 250, 0.5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 20px;
}

.expression-row {
  margin-bottom: 15px;
}

.expression-row:last-child {
  margin-bottom: 0;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.field-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.field-tag {
  padding: 6px 12px;
  background: var(--primary-gradient);
  color: white;
  border-radius: var(--radius-sm);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  font-weight: 600;
}

.expression-input-wrapper {
  display: flex;
  gap: 10px;
}

.expression-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 16px;
  background: var(--glass-bg);
}

.expression-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.expression-desc {
  color: var(--text-secondary);
  font-size: 14px;
  padding: 10px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: var(--radius-sm);
}

.schedule-box {
  background: rgba(248, 249, 250, 0.5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 20px;
}

.schedule-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 15px;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.schedule-empty {
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px 15px;
  background: var(--glass-bg);
  border-radius: var(--radius-sm);
}

.schedule-item .index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-gradient);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.schedule-item .time {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  color: var(--text-primary);
}

.schedule-item .remaining {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-tertiary);
}

.help-section {
  background: rgba(248, 249, 250, 0.5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
}

.help-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 15px;
}

.help-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.help-content p {
  margin-bottom: 10px;
}

.help-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.help-content li {
  margin-bottom: 5px;
}

.help-content code {
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.cron-structure {
  background: rgba(0, 0, 0, 0.05);
  padding: 15px;
  border-radius: var(--radius-sm);
  margin: 15px 0;
}

.cron-structure pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
}
</style>