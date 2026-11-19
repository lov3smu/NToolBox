<template>
  <PageLayout tool-path="/cron" page-class="cron-page">
    <template #actions>
      <TabBar v-model="activeTab" :tabs="tabs" :aria-label="t('Cron 字段')" />
    </template>

    <div class="page-body">
      <div class="cron-grid">
        <section class="panel field-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('字段设置') }}</span>
            <span class="field-hint">{{ getFieldHint(activeTab) }}</span>
          </div>
          <div class="panel-body">
            <div class="type-options">
              <RadioOption
                v-for="option in typeOptions"
                :key="option.key"
                v-model="currentFieldType"
                :name="activeTab + 'Type'"
                :value="option.value"
                variant="pill"
              >
                {{ option.label }}
              </RadioOption>
            </div>

            <div v-if="needsConfig" class="value-config">
              <template v-if="currentFieldType === 'range'">
                <template v-if="activeTab === 'week'">
                  <div class="inline-row">
                    <select v-model="weekRangeFrom" class="select-field" @change="generateExpression">
                      <option v-for="day in weekDays" :key="day.value" :value="day.value">
                        {{ t(day.label) }}
                      </option>
                    </select>
                    <span class="range-separator">{{ t('至') }}</span>
                    <select v-model="weekRangeTo" class="select-field" @change="generateExpression">
                      <option v-for="day in weekDays" :key="day.value" :value="day.value">
                        {{ t(day.label) }}
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
                  <span class="range-separator">{{ t('至') }}</span>
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
                <span class="interval-label">{{ t('从') }}</span>
                <input
                  v-model.number="intervalValues[activeTab].start"
                  type="number"
                  class="input-field"
                  :min="FIELD_CONFIG[activeTab]?.min"
                  :max="FIELD_CONFIG[activeTab]?.max"
                  @input="generateExpression"
                />
                <span class="interval-label">{{ t('开始，每') }}</span>
                <input
                  v-model.number="intervalValues[activeTab].step"
                  type="number"
                  class="input-field"
                  :min="1"
                  :max="FIELD_CONFIG[activeTab]?.max"
                  @input="generateExpression"
                />
                <span class="interval-label">{{ t('{unit}执行一次', { unit: getFieldTitle(activeTab) }) }}</span>
              </template>

              <template v-else-if="currentFieldType === 'specific'">
                <template v-if="activeTab === 'year'">
                  <input
                    v-model="yearSpecificInput"
                    type="text"
                    class="input-field specific-input"
                    :placeholder="t('例如: 2024,2025,2026')"
                    @input="generateExpression"
                  />
                </template>
                <template v-else-if="activeTab === 'hour'">
                  <div class="hour-grid-container">
                    <div class="time-section">
                      <div class="time-section-title">{{ t('上午') }}</div>
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
                      <div class="time-section-title">{{ t('下午') }}</div>
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
                        {{ t(day.label) }}
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
                        {{ activeTab === 'month' ? t(MONTH_NAMES[n]) : n - 1 + FIELD_CONFIG[activeTab]?.min }}
                      </div>
                    </template>
                  </div>
                </template>
              </template>

              <template v-else-if="currentFieldType === 'workDay'">
                <span class="interval-label">{{ t('每月') }}</span>
                <input
                  v-model.number="workDayValue"
                  type="number"
                  class="input-field"
                  min="1"
                  max="31"
                  @input="generateExpression"
                />
                <span class="interval-label">{{ t('号最近的工作日') }}</span>
              </template>

              <template v-else-if="currentFieldType === 'nth'">
                <div class="inline-row">
                  <span class="interval-label">{{ t('每月第') }}</span>
                  <select v-model="weekNth" class="select-field" @change="generateExpression">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                  <span class="interval-label">{{ t('个') }}</span>
                  <select v-model="weekNthDay" class="select-field" @change="generateExpression">
                    <option v-for="day in weekDays" :key="day.value" :value="day.value">
                      {{ t(day.label) }}
                    </option>
                  </select>
                </div>
              </template>

              <template v-else-if="currentFieldType === 'last'">
                <div class="inline-row">
                  <span class="interval-label">{{ t('每月最后一个') }}</span>
                  <select v-model="weekLastDay" class="select-field" @change="generateExpression">
                    <option v-for="day in weekDays" :key="day.value" :value="day.value">
                      {{ t(day.label) }}
                    </option>
                  </select>
                </div>
              </template>
            </div>
            <div v-else class="panel-empty config-empty">{{ t('当前规则无需额外参数，表达式已应用通配符') }}</div>
          </div>
        </section>

        <section class="panel expression-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('Cron 表达式') }}</span>
            <span class="panel-hint">{{ t('输入后失焦自动解析') }}</span>
          </div>
          <div class="panel-body">
            <div class="expression-row">
              <label class="field-label">{{ t('表达式字段') }}</label>
              <div class="field-tags">
                <span class="field-tag"
                  ><span class="tag-label">{{ t('秒') }}</span
                  >{{ fieldTags.second }}</span
                >
                <span class="field-tag"
                  ><span class="tag-label">{{ t('分') }}</span
                  >{{ fieldTags.minute }}</span
                >
                <span class="field-tag"
                  ><span class="tag-label">{{ t('时') }}</span
                  >{{ fieldTags.hour }}</span
                >
                <span class="field-tag"
                  ><span class="tag-label">{{ t('日') }}</span
                  >{{ fieldTags.day }}</span
                >
                <span class="field-tag"
                  ><span class="tag-label">{{ t('月') }}</span
                  >{{ fieldTags.month }}</span
                >
                <span class="field-tag"
                  ><span class="tag-label">{{ t('周') }}</span
                  >{{ fieldTags.week }}</span
                >
                <span v-if="fieldTags.year" class="field-tag">
                  <span class="tag-label">{{ t('年') }}</span
                  >{{ fieldTags.year }}
                </span>
              </div>
            </div>
            <div class="expression-row">
              <label class="field-label">{{ t('Cron 表达式') }}</label>
              <div class="expression-input-wrapper">
                <input v-model="cronExpression" type="text" class="expression-input" @blur="onExpressionBlur" />
                <button class="btn btn-secondary" @click="parseExpression">{{ t('反解析') }}</button>
                <button class="btn btn-primary" @click="copyExpression">{{ t('复制') }}</button>
              </div>
            </div>
            <div class="expression-desc">{{ expressionDesc }}</div>
          </div>
        </section>

        <section class="panel schedule-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('最近 5 次运行时间') }}</span>
            <span class="panel-hint">{{ t('按当前表达式推算') }}</span>
          </div>
          <div class="panel-body">
            <div class="schedule-list">
              <div v-if="scheduleList.length === 0" class="panel-empty schedule-empty">
                {{ t('请输入表达式查看执行计划') }}
              </div>
              <div v-for="(item, index) in scheduleList" :key="index" class="schedule-item">
                <span class="index">{{ index + 1 }}</span>
                <span class="time">{{ item.time }}</span>
                <span class="remaining">{{ item.remaining }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="panel help-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('说明') }}</span>
            <span class="panel-hint">{{ t('Cron 语法速查') }}</span>
          </div>
          <div class="panel-body help-content">
            <p class="help-intro">
              {{ t('Cron 表达式由 6-7 个字段组成，依次表示秒、分钟、小时、天数、月份、星期几和年份（可选）。') }}
            </p>
            <div class="help-grid">
              <div class="help-section">
                <h4>{{ t('字段结构') }}</h4>
                <div class="cron-structure">
                  <pre>{{ cronStructure }}</pre>
                </div>
              </div>
              <div class="help-section">
                <h4>{{ t('特殊字符') }}</h4>
                <ul>
                  <li><code>*</code>{{ t('. 匹配任意值，如分钟字段的 * 表示每分钟执行') }}</li>
                  <li><code>,</code>{{ t('. 分隔多个值，如 1,3,5 表示第 1、3、5 点执行') }}</li>
                  <li><code>-</code>{{ t('. 指定范围，如 10-20 表示从 10 到 20') }}</li>
                  <li><code>/</code>{{ t('. 指定间隔，如 */5 表示每 5 分钟执行一次') }}</li>
                  <li><code>?</code>{{ t('. 仅用于日和周字段，表示不指定（避免冲突）') }}</li>
                  <li><code>L</code>{{ t('. 表示最后，如 L 表示每月最后一天') }}</li>
                  <li><code>W</code>{{ t('. 最近工作日，如 15W 表示每月 15 日最近的工作日') }}</li>
                  <li><code>#</code>{{ t('. 第几个星期几，如 1#3 表示每月第 3 个星期一') }}</li>
                </ul>
              </div>
              <div class="help-section">
                <h4>{{ t('常用示例') }}</h4>
                <ul class="example-list">
                  <li>
                    <code>0 0 12 * * ?</code><span>{{ t('每天中午 12 点执行') }}</span>
                  </li>
                  <li>
                    <code>0 */5 * * * ?</code><span>{{ t('每 5 分钟执行一次') }}</span>
                  </li>
                  <li>
                    <code>0 0 8-18 ? * MON-FRI</code><span>{{ t('周一至周五 8 点到 18 点每小时执行') }}</span>
                  </li>
                  <li>
                    <code>0 0 0 L * ?</code><span>{{ t('每月最后一天执行') }}</span>
                  </li>
                  <li>
                    <code>0 0 0 ? * 1#1</code><span>{{ t('每月第一个星期一执行') }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
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
import RadioOption from '@/components/RadioOption.vue'
import { t } from '@/i18n'

const { toastVisible, toastMessage, toastType, showSuccess, showError, showWarning } = useToast()

const FIELD_CONFIG = {
  second: {
    min: 0,
    max: 59,
    get name() {
      return t('秒')
    }
  },
  minute: {
    min: 0,
    max: 59,
    get name() {
      return t('分')
    }
  },
  hour: {
    min: 0,
    max: 23,
    get name() {
      return t('时')
    }
  },
  day: {
    min: 1,
    max: 31,
    get name() {
      return t('日')
    }
  },
  month: {
    min: 1,
    max: 12,
    get name() {
      return t('月')
    }
  },
  week: {
    min: 0,
    max: 6,
    get name() {
      return t('周')
    },
    names: [t('周日'), t('周一'), t('周二'), t('周三'), t('周四'), t('周五'), t('周六')]
  },
  year: {
    min: 2024,
    max: 2100,
    get name() {
      return t('年')
    }
  }
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
  get second() {
    return t('秒')
  },
  get minute() {
    return t('分钟')
  },
  get hour() {
    return t('小时')
  },
  get day() {
    return t('日')
  },
  get month() {
    return t('月')
  },
  get week() {
    return t('周')
  },
  get year() {
    return t('年')
  }
}

const MONTH_NAMES = [
  '',
  t('一月'),
  t('二月'),
  t('三月'),
  t('四月'),
  t('五月'),
  t('六月'),
  t('七月'),
  t('八月'),
  t('九月'),
  t('十月'),
  t('十一月'),
  t('十二月')
]

const weekDays = [
  {
    value: '1',
    get label() {
      return t('周一')
    }
  },
  {
    value: '2',
    get label() {
      return t('周二')
    }
  },
  {
    value: '3',
    get label() {
      return t('周三')
    }
  },
  {
    value: '4',
    get label() {
      return t('周四')
    }
  },
  {
    value: '5',
    get label() {
      return t('周五')
    }
  },
  {
    value: '6',
    get label() {
      return t('周六')
    }
  },
  {
    value: '0',
    get label() {
      return t('周日')
    }
  }
]

const tabs = [
  {
    key: 'second',
    get label() {
      return t('秒')
    }
  },
  {
    key: 'minute',
    get label() {
      return t('分钟')
    }
  },
  {
    key: 'hour',
    get label() {
      return t('小时')
    }
  },
  {
    key: 'day',
    get label() {
      return t('日')
    }
  },
  {
    key: 'month',
    get label() {
      return t('月')
    }
  },
  {
    key: 'week',
    get label() {
      return t('周')
    }
  },
  {
    key: 'year',
    get label() {
      return t('年')
    }
  }
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

const cronStructure = computed(() =>
  [
    t('┌──────────── [可选] 秒 (0 - 59)'),
    t('│ ┌────────── 分钟 (0 - 59)'),
    t('│ │ ┌──────── 小时 (0 - 23)'),
    t('│ │ │ ┌────── 天数 (1 - 31)'),
    t('│ │ │ │ ┌──── 月份 (1 - 12)'),
    t('│ │ │ │ │ ┌── 星期 (0 - 6, 星期天=0)'),
    '│ │ │ │ │ │',
    t('* * * * * * *  命令')
  ].join('\n')
)

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

const typeOptions = computed(() => {
  const tab = activeTab.value
  const options = []

  if (tab !== 'week' && tab !== 'day') {
    options.push({ key: 'every', value: 'every', label: t('每{unit}', { unit: getFieldTitle(tab) }) })
  }
  if (tab === 'week' || tab === 'year' || tab === 'day') {
    options.push({ key: 'notSpecify', value: 'notSpecify', label: t('不指定') })
  }
  if (tab === 'day') {
    options.push({ key: 'every-day', value: 'every', label: t('每日') })
  }
  if (tab !== 'year') {
    options.push({ key: 'range', value: 'range', label: t('周期') })
  }
  if (tab !== 'week' && tab !== 'year') {
    options.push({ key: 'interval', value: 'interval', label: t('循环') })
  }

  options.push({ key: 'specific', value: 'specific', label: t('指定') })

  if (tab === 'day') {
    options.push({ key: 'workDay', value: 'workDay', label: t('工作日') })
    options.push({ key: 'lastDay', value: 'lastDay', label: t('最后一天') })
  }
  if (tab === 'week') {
    options.push({ key: 'nth', value: 'nth', label: t('第几个星期几') })
    options.push({ key: 'last', value: 'last', label: t('最后一个星期几') })
  }

  return options
})

const needsConfig = computed(() =>
  ['range', 'interval', 'specific', 'workDay', 'nth', 'last'].includes(currentFieldType.value)
)

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
const expressionDesc = ref('')
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
    get second() {
      return t('秒')
    },
    get minute() {
      return t('分钟')
    },
    get hour() {
      return t('小时')
    },
    get day() {
      return t('日')
    },
    get month() {
      return t('月')
    },
    get week() {
      return t('周')
    },
    get year() {
      return t('年')
    }
  }
  return titles[field] ? t(titles[field]) : ''
}

function getFieldHint(field) {
  const hints = {
    get second() {
      return t('允许的通配符 [, - * /]')
    },
    get minute() {
      return t('允许的通配符 [, - * /]')
    },
    get hour() {
      return t('允许的通配符 [, - * /]')
    },
    get day() {
      return t('允许的通配符 [, - * / L W]')
    },
    get month() {
      return t('允许的通配符 [, - * /]')
    },
    get week() {
      return t('允许的通配符 [, - * / L #]')
    },
    get year() {
      return t('允许的通配符 [, - * /]')
    }
  }
  return hints[field] ? t(hints[field]) : ''
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
  expressionDesc.value = getExpressionDescription(cronExpression.value)
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
  if (field === 'week') return t(FIELD_CONFIG.week.names[value]) || String(value)
  if (field === 'month') return t(MONTH_NAMES[value]) || String(value)
  return String(value)
}

function describeField(field, expr) {
  const config = FIELD_CONFIG[field]

  if (expr === '*') return field === 'week' ? t('每天') : t('每{unit}', { unit: t(FIELD_UNITS[field]) })
  if (expr === '?') return ''
  if (field === 'day' && expr === 'L') return t('最后一天')
  if (field === 'day' && /^\d{1,2}W$/i.test(expr)) return t('{day} 号最近的工作日', { day: expr.slice(0, -1) })
  if (field === 'week') {
    const nthMatch = /^([A-Z]{3}|\d)#([1-5])$/i.exec(expr)
    if (nthMatch) {
      const day = parseValueToken(nthMatch[1], WEEK_ALIASES)
      if (day != null) return t('第 {nth} 个{weekday}', { nth: nthMatch[2], weekday: t(FIELD_CONFIG.week.names[day]) })
    }
    const lastMatch = /^([A-Z]{3}|\d)L$/i.exec(expr)
    if (lastMatch) {
      const day = parseValueToken(lastMatch[1], WEEK_ALIASES)
      if (day != null) return t('最后一个{weekday}', { weekday: t(FIELD_CONFIG.week.names[day]) })
    }
  }

  if (expr.includes('/')) {
    const [start, step] = expr.split('/')
    return t('从 {start} 开始每 {step} {unit}执行一次', {
      start: start === '*' ? config.min : start,
      step,
      unit: t(FIELD_UNITS[field])
    })
  }

  const aliases = field === 'week' ? WEEK_ALIASES : field === 'month' ? MONTH_ALIASES : null
  if (expr.includes('-')) {
    const [fromToken, toToken] = expr.split('-')
    const from = parseValueToken(fromToken, aliases)
    const to = parseValueToken(toToken, aliases)
    if (from == null || to == null) return expr
    return t('{from} 至 {to}', { from: describeValue(field, from), to: describeValue(field, to) })
  }

  if (expr.includes(',')) {
    const values = expr
      .split(',')
      .map((token) => parseValueToken(token, aliases))
      .filter((value) => value != null)
    return values.map((value) => describeValue(field, value)).join(t('、'))
  }

  const value = parseValueToken(expr, aliases)
  return value == null ? expr : describeValue(field, value)
}

function timePhrase(field, expr, suffix) {
  if (expr.includes('/')) return describeField(field, expr)
  return t('在 {value} {suffix}', { value: describeField(field, expr), suffix: t(suffix) })
}

function dayPhrase(expr) {
  const desc = describeField('day', expr)
  if (expr === 'L' || /W$/i.test(expr) || desc.endsWith(t('日'))) return desc
  return t('{day} 日', { day: desc })
}

function getExpressionDescription(expression) {
  const analysis = analyzeExpression(expression)
  if (!analysis.valid) return t('表达式错误：{error}', { error: analysis.error })

  const [second, minute, hour, day, month, week, year] = analysis.parts
  const descs = []

  if (hour !== '*') {
    descs.push(timePhrase('hour', hour, t('点')))
  } else if (minute === '*' && second === '*') {
    descs.push(t('每秒'))
  } else if (minute === '*') {
    descs.push(t('每分钟'))
  } else {
    descs.push(t('每小时'))
  }
  if (minute !== '*') descs.push(timePhrase('minute', minute, t('分')))
  if (second !== '*') descs.push(timePhrase('second', second, t('秒')))

  const dayActive = day !== '*' && day !== '?'
  const weekActive = week !== '*' && week !== '?'
  if (month !== '*') descs.push(t('在{month}', { month: describeField('month', month) }))
  if (year && year !== '*') {
    const yearDesc = describeField('year', year)
    descs.push(year.includes('/') ? t('在 {value}', { value: yearDesc }) : t('在 {year} 年', { year: yearDesc }))
  }
  if (dayActive) descs.push(t('在每月{day}', { day: dayPhrase(day) }))
  if (weekActive) descs.push(t('在每月{weekday}', { weekday: describeField('week', week) }))

  return t('{parts}执行', { parts: descs.join(t('，')) })
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
  if (parts.length < 6 || parts.length > 7) return { valid: false, error: t('应为 6 或 7 个字段') }

  const [second, minute, hour, day, month, week, year] = parts
  const secondSet = parseValueList(second, 0, 59)
  if (!secondSet) return { valid: false, error: t('秒字段无效') }
  const minuteSet = parseValueList(minute, 0, 59)
  if (!minuteSet) return { valid: false, error: t('分钟字段无效') }
  const hourSet = parseValueList(hour, 0, 23)
  if (!hourSet) return { valid: false, error: t('小时字段无效') }

  const dayMatcher = compileDayMatcher(day)
  if (!dayMatcher) return { valid: false, error: t('日字段无效') }
  const monthSet = parseValueList(month, 1, 12, MONTH_ALIASES)
  if (!monthSet) return { valid: false, error: t('月字段无效') }
  const weekMatcher = compileWeekMatcher(week)
  if (!weekMatcher) return { valid: false, error: t('周字段无效') }
  const yearSet = year ? parseValueList(year, 1970, 9999) : null
  if (year && !yearSet) return { valid: false, error: t('年字段无效') }

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
  if (diff < 0) return t('已过期')

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  const parts = []
  if (days > 0) parts.push(t('{count}天', { count: days }))
  if (hours > 0) parts.push(t('{count}时', { count: hours }))
  if (minutes > 0) parts.push(t('{count}分', { count: minutes }))
  if (seconds > 0 && parts.length < 2) parts.push(t('{count}秒', { count: seconds }))

  if (parts.length === 0) return t('即将执行')
  return t('{duration}后', { duration: parts.join('') })
}

function parseExpression() {
  const expression = cronExpression.value.trim()
  if (!expression) {
    showWarning(t('请输入表达式'))
    return
  }

  const analysis = analyzeExpression(expression)
  if (!analysis.valid) {
    expressionDesc.value = t('表达式错误：{error}', { error: analysis.error })
    scheduleList.value = []
    showError(t('表达式格式错误：{error}', { error: analysis.error }))
    return
  }

  const fieldsToParse = ['second', 'minute', 'hour', 'day', 'month', 'week']
  if (analysis.parts.length === 7) fieldsToParse.push('year')

  const fullyParsed = fieldsToParse.every((field, index) => parseFieldExpression(field, analysis.parts[index]))

  expressionDesc.value = getExpressionDescription(cronExpression.value)
  updateScheduleList()
  if (fullyParsed) {
    showSuccess(t('表达式已反解析'))
  } else {
    showWarning(t('部分字段无法完整映射到表单，请以表达式为准'))
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
    showSuccess(t('已复制到剪贴板'))
  } else {
    showError(t('复制失败，请手动复制'))
  }
}

onMounted(() => {
  generateExpression()
})
</script>

<style scoped>
.page-body {
  width: 100%;
}

.cron-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr);
  grid-template-areas:
    'field expression'
    'help schedule';
  gap: 14px;
  align-items: stretch;
}

.cron-grid > .panel {
  margin-top: 0;
}

.field-panel {
  grid-area: field;
  display: flex;
  flex-direction: column;
}

.field-panel .panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.expression-panel {
  grid-area: expression;
}

.schedule-panel {
  grid-area: schedule;
}

.help-panel {
  grid-area: help;
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

/* ---------- 规则类型 ---------- */
.type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

/* ---------- 取值配置 ---------- */
.value-config {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.value-config .input-field {
  width: 76px;
  text-align: center;
}

.value-config .select-field {
  width: 92px;
}

.inline-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.range-separator,
.interval-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.specific-input {
  width: 240px;
}

.specific-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 6px;
  align-self: flex-start;
  margin-top: 0;
  padding: 0;
  background: none;
  border: 0;
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
  width: 34px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  transition: var(--transition-fast);
}

.specific-item:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.specific-item.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: var(--text-inverse);
}

/* ---------- 表达式 ---------- */
.expression-row {
  margin-bottom: 14px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
}

.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.field-tag {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 56px;
  padding: 6px 10px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: 1.4;
}

.tag-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--text-tertiary);
}

.expression-input-wrapper {
  display: flex;
  gap: 8px;
}

.expression-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-md);
  letter-spacing: 0.5px;
}

.expression-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.expression-desc {
  padding: 10px 12px;
  background: rgba(var(--accent-rgb), 0.06);
  border-left: 3px solid var(--accent-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

/* ---------- 执行计划 ---------- */
.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.schedule-empty {
  min-height: 120px;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.schedule-item .index {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 0;
  background: rgba(var(--accent-rgb), 0.12);
  border-radius: 50%;
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.schedule-item .time {
  flex: 1;
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.schedule-item .remaining {
  margin-left: 0;
  padding: 2px 8px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

/* ---------- 语法说明 ---------- */
.help-content {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.7;
}

.help-intro {
  margin: 0 0 14px;
}

.help-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.help-section h4 {
  margin: 0 0 8px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.help-content ul {
  margin: 0;
  padding-left: 18px;
}

.help-content li {
  margin-bottom: 5px;
}

.help-content code {
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--inset-bg);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
}

.cron-structure {
  padding: 12px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.cron-structure pre {
  margin: 0;
  color: var(--text-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
  line-height: 1.7;
}

.example-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 0;
  list-style: none;
}

.example-list li {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 0;
}

.example-list code {
  align-self: flex-start;
}

.example-list span {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

/* ---------- 响应式 ---------- */
@media (max-width: 1200px) {
  .help-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .help-section:first-child {
    grid-column: 1 / -1;
  }

  .help-section:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 1100px) {
  .cron-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'field'
      'expression'
      'schedule'
      'help';
  }
}

@media (max-width: 760px) {
  .help-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .help-section:first-child,
  .help-section:last-child {
    grid-column: auto;
  }

  .expression-input-wrapper {
    flex-wrap: wrap;
  }

  .expression-input {
    flex-basis: 100%;
  }
}
</style>
