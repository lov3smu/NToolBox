<template>
  <div v-if="dataTransferDialog.show" class="dialog-overlay" @click.self="closeDataTransferDialog">
    <div class="dialog data-transfer-dialog">
      <div class="dialog-header">
        <h3 class="transfer-heading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h13l-3-3" />
            <path d="M20 17H7l3 3" />
          </svg>
          {{ t('数据传输') }}
        </h3>
        <button
          class="btn-icon btn-sm"
          :title="t('关闭')"
          :disabled="dataTransferDialog.transferring"
          @click="closeDataTransferDialog"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="transfer-shell">
        <aside class="transfer-tasks">
          <div class="transfer-tasks-head">
            <span>{{ t('传输任务') }}</span>
            <div class="transfer-tasks-actions">
              <button
                class="btn-icon btn-sm"
                :title="t('新建任务')"
                :disabled="dataTransferDialog.transferring"
                @click="openDataTransferDialog"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button
                class="btn-icon btn-sm"
                :title="t('从配置重新加载任务')"
                :disabled="dataTransferDialog.transferring"
                @click="refreshTransferTasks"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </button>
            </div>
          </div>

          <input
            v-model="dataTransferDialog.taskKeyword"
            class="input-field transfer-task-search"
            :placeholder="t('搜索任务...')"
          />

          <div class="transfer-task-list">
            <div v-if="!filteredTasks.length" class="transfer-task-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 7h13l-3-3" />
                <path d="M20 17H7l3 3" />
              </svg>
              <span>{{ dataTransferDialog.tasks.length ? t('没有匹配的任务') : t('暂无已保存的传输任务') }}</span>
            </div>
            <template v-else>
              <div
                v-for="task in filteredTasks"
                :key="task.name"
                class="transfer-task-item"
                :class="{ disabled: dataTransferDialog.transferring }"
                @click="applyTransferTask(task)"
              >
                <div class="transfer-task-info">
                  <span class="transfer-task-name" :title="task.name">{{ task.name }}</span>
                  <span class="transfer-task-meta"> {{ task.sourceDatabase }} → {{ task.targetDatabase }} </span>
                </div>
                <button
                  class="btn-icon btn-sm transfer-task-delete"
                  :title="t('删除任务')"
                  :disabled="dataTransferDialog.transferring"
                  @click.stop="deleteTransferTask(task)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            </template>
          </div>
        </aside>

        <div class="transfer-main">
          <div class="transfer-sides">
            <section class="transfer-side">
              <div class="transfer-side-title transfer-side-title-source">{{ t('源') }}</div>
              <label class="transfer-field">
                <span>{{ t('源连接') }}</span>
                <select
                  v-model="dataTransferDialog.sourceConnection"
                  class="input-field"
                  :disabled="dataTransferDialog.transferring"
                  @change="loadTransferDatabases('source')"
                >
                  <option value="">{{ t('选择连接') }}</option>
                  <option v-for="conn in activeConnections" :key="conn.name" :value="conn.name">
                    {{ conn.name }}
                  </option>
                </select>
              </label>
              <label class="transfer-field">
                <span>{{ t('源数据库') }}</span>
                <select
                  v-model="dataTransferDialog.sourceDatabase"
                  class="input-field"
                  :disabled="
                    dataTransferDialog.transferring ||
                    !dataTransferDialog.sourceConnection ||
                    dataTransferDialog.loadingDatabases
                  "
                  @change="loadTransferObjects"
                >
                  <option value="">{{ t('选择数据库') }}</option>
                  <option v-for="db in dataTransferDialog.sourceDatabases" :key="db" :value="db">
                    {{ db }}
                  </option>
                </select>
              </label>
            </section>

            <button
              class="btn-icon transfer-swap"
              :title="t('交换源和目标')"
              :disabled="dataTransferDialog.transferring"
              @click="swapTransferSides"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 4L3 8l4 4" />
                <path d="M3 8h14" />
                <path d="M17 20l4-4-4-4" />
                <path d="M21 16H7" />
              </svg>
            </button>

            <section class="transfer-side">
              <div class="transfer-side-title transfer-side-title-target">{{ t('目标') }}</div>
              <label class="transfer-field">
                <span>{{ t('目标连接') }}</span>
                <select
                  v-model="dataTransferDialog.targetConnection"
                  class="input-field"
                  :disabled="dataTransferDialog.transferring"
                  @change="loadTransferDatabases('target')"
                >
                  <option value="">{{ t('选择连接') }}</option>
                  <option v-for="conn in activeConnections" :key="conn.name" :value="conn.name">
                    {{ conn.name }}
                  </option>
                </select>
              </label>
              <label class="transfer-field">
                <span>{{ t('目标数据库') }}</span>
                <select
                  v-model="dataTransferDialog.targetDatabase"
                  class="input-field"
                  :disabled="
                    dataTransferDialog.transferring ||
                    !dataTransferDialog.targetConnection ||
                    dataTransferDialog.loadingDatabases
                  "
                >
                  <option value="">{{ t('选择数据库') }}</option>
                  <option v-for="db in dataTransferDialog.targetDatabases" :key="db" :value="db">
                    {{ db }}
                  </option>
                </select>
              </label>
            </section>
          </div>

          <section class="transfer-objects">
            <div class="transfer-section-head">
              <span>{{ t('传输对象') }}</span>
              <span v-if="dataTransferDialog.objects.length" class="transfer-count">
                {{ selectedCount }}/{{ dataTransferDialog.objects.length }}
              </span>
            </div>

            <div
              v-if="!dataTransferDialog.sourceConnection || !dataTransferDialog.sourceDatabase"
              class="transfer-object-hint"
            >
              {{ t('请先选择源连接和数据库') }}
            </div>
            <template v-else>
              <div class="transfer-object-toolbar">
                <input
                  v-model="dataTransferDialog.objectKeyword"
                  class="input-field"
                  :placeholder="t('搜索对象名...')"
                  :disabled="dataTransferDialog.transferring"
                />
                <button
                  class="transfer-link"
                  :disabled="dataTransferDialog.transferring"
                  @click="dataTransferDialog.bulkOpen = !dataTransferDialog.bulkOpen"
                >
                  {{ t('批量录入') }}
                </button>
                <button
                  class="transfer-link"
                  :disabled="dataTransferDialog.transferring || !dataTransferDialog.objects.length"
                  @click="toggleAllTransferObjects"
                >
                  {{ allSelected ? t('取消全选') : t('全选') }}
                </button>
              </div>

              <div v-if="dataTransferDialog.bulkOpen" class="transfer-bulk">
                <textarea
                  v-model="dataTransferDialog.bulkText"
                  class="transfer-bulk-input"
                  :placeholder="t('输入对象名称，每行一个；可用 table:orders 指定类型')"
                  :disabled="dataTransferDialog.transferring"
                />
                <div class="transfer-bulk-actions">
                  <button
                    class="btn btn-sm btn-secondary"
                    :disabled="dataTransferDialog.transferring"
                    @click="dataTransferDialog.bulkOpen = false"
                  >
                    {{ t('取消') }}
                  </button>
                  <button
                    class="btn btn-sm btn-primary"
                    :disabled="dataTransferDialog.transferring"
                    @click="applyBulkTransferObjects"
                  >
                    {{ t('应用') }}
                  </button>
                </div>
              </div>

              <div v-if="dataTransferDialog.loadingObjects" class="transfer-object-empty">
                {{ t('正在读取对象...') }}
              </div>
              <div v-else-if="!filteredObjects.length" class="transfer-object-empty">
                {{ dataTransferDialog.objects.length ? t('没有匹配的对象') : t('暂无对象') }}
              </div>
              <div v-else class="transfer-object-list">
                <div v-for="group in objectGroups" :key="group.type" class="transfer-object-group">
                  <label class="transfer-group-head">
                    <input
                      type="checkbox"
                      :checked="groupState(group.type).all"
                      :indeterminate.prop="groupState(group.type).some && !groupState(group.type).all"
                      :disabled="dataTransferDialog.transferring"
                      @change="toggleTransferGroup(group.type)"
                    />
                    <span>{{ group.label }}</span>
                    <span class="transfer-group-count">{{ groupSelectedCount(group) }}/{{ group.items.length }}</span>
                  </label>
                  <div class="transfer-object-items">
                    <label
                      v-for="item in group.items"
                      :key="transferObjectKey(item)"
                      class="transfer-object-item"
                      :title="item.detail || item.name"
                    >
                      <input
                        type="checkbox"
                        :checked="isSelected(item)"
                        :disabled="dataTransferDialog.transferring"
                        @change="toggleTransferObject(transferObjectKey(item))"
                      />
                      <span class="transfer-object-name">{{ item.name }}</span>
                      <span v-if="item.detail" class="transfer-object-detail">{{ item.detail }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </template>
          </section>

          <div class="transfer-options">
            <div class="transfer-option-block">
              <div class="transfer-option-title">{{ t('传输内容') }}</div>
              <RadioOption
                v-for="mode in contentModes"
                :key="mode.value"
                v-model="dataTransferDialog.contentMode"
                class="transfer-radio"
                name="transfer-content"
                :value="mode.value"
                :disabled="dataTransferDialog.transferring"
              >
                <span class="transfer-radio-label">{{ mode.label }}</span>
                <span v-if="mode.hint" class="transfer-radio-hint">{{ mode.hint }}</span>
              </RadioOption>
            </div>

            <div class="transfer-option-grid">
              <label class="transfer-field">
                <span>{{ t('目标表处理方式') }}</span>
                <select
                  v-model="dataTransferDialog.targetMode"
                  class="input-field"
                  :disabled="dataTransferDialog.transferring"
                >
                  <option value="append">{{ t('追加（INSERT）') }}</option>
                  <option value="truncate">{{ t('清空后写入（TRUNCATE）') }}</option>
                  <option value="skip">{{ t('跳过已存在') }}</option>
                </select>
              </label>
              <p class="transfer-option-hint transfer-option-full">
                {{ t('目标对象不存在时自动创建；已存在的视图、存储过程等对象在非跳过模式下会重建。') }}
              </p>

              <label class="transfer-field">
                <span>{{ t('目标表名大小写') }}</span>
                <select
                  v-model="dataTransferDialog.tableNameCase"
                  class="input-field"
                  :disabled="dataTransferDialog.transferring"
                >
                  <option value="keep">{{ t('保持原样') }}</option>
                  <option value="lower">{{ t('转为小写') }}</option>
                  <option value="upper">{{ t('转为大写') }}</option>
                </select>
              </label>
              <label class="transfer-field">
                <span>{{ t('目标字段名大小写') }}</span>
                <select
                  v-model="dataTransferDialog.columnNameCase"
                  class="input-field"
                  :disabled="dataTransferDialog.transferring"
                >
                  <option value="keep">{{ t('保持原样') }}</option>
                  <option value="lower">{{ t('转为小写') }}</option>
                  <option value="upper">{{ t('转为大写') }}</option>
                </select>
              </label>

              <label class="transfer-field">
                <span>{{ t('每批行数') }}</span>
                <input
                  v-model.number="dataTransferDialog.batchSize"
                  class="input-field"
                  type="number"
                  min="1"
                  max="10000"
                  :disabled="dataTransferDialog.transferring"
                />
              </label>
              <label class="transfer-field">
                <span>{{ t('操作超时（秒）') }}</span>
                <select
                  v-model="dataTransferDialog.timeoutMode"
                  class="input-field"
                  :disabled="dataTransferDialog.transferring"
                >
                  <option value="inherit">{{ t('继承连接') }}</option>
                  <option value="30">{{ t('30 秒') }}</option>
                  <option value="60">{{ t('60 秒') }}</option>
                  <option value="120">{{ t('120 秒') }}</option>
                  <option value="300">{{ t('300 秒') }}</option>
                </select>
              </label>
              <p class="transfer-option-hint transfer-option-full">{{ timeoutHint }}</p>
            </div>
          </div>

          <div v-if="dataTransferDialog.error" class="dialog-alert error">{{ dataTransferDialog.error }}</div>
          <div v-if="dataTransferDialog.progress" class="transfer-hint">{{ dataTransferDialog.progress }}</div>

          <div v-if="dataTransferDialog.summary" class="data-transfer-summary">
            <p>
              {{ t('成功') }} {{ summary.transferred.length }} {{ t('个对象，跳过') }} {{ summary.skipped.length
              }}{{ t('，失败') }}
              {{ summary.failed.length }}
            </p>
            <p v-for="item in summary.failed" :key="'failed-' + summaryKey(item)" class="data-transfer-failure">
              {{ summaryLabel(item) }}：{{ item.error
              }}<template v-if="item.rows">{{ t('（已写入') }} {{ item.rows }} {{ t('行）') }}</template>
            </p>
            <p v-for="item in summary.skipped" :key="'skipped-' + summaryKey(item)">
              {{ summaryLabel(item) }}：{{ item.reason }}
            </p>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn btn-secondary" :disabled="dataTransferDialog.transferring" @click="closeDataTransferDialog">
          {{ t('取消') }}
        </button>
        <button
          class="btn btn-secondary"
          :disabled="!canSaveTask || dataTransferDialog.transferring"
          @click="saveTransferTask"
        >
          {{ t('保存为任务') }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="!canTransfer || dataTransferDialog.transferring"
          @click="executeDataTransfer"
        >
          {{ dataTransferDialog.transferring ? t('传输中...') : t('开始传输') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'
import RadioOption from '@/components/RadioOption.vue'
import { filterTransferObjects, getTransferTypeLabel, groupTransferObjects, transferObjectKey } from '../transferPlan'

const databaseStore = inject('database')
const {
  activeConnections,
  applyBulkTransferObjects,
  applyTransferTask,
  closeDataTransferDialog,
  connections,
  dataTransferDialog,
  deleteTransferTask,
  executeDataTransfer,
  loadTransferDatabases,
  loadTransferObjects,
  openDataTransferDialog,
  refreshTransferTasks,
  saveTransferTask,
  swapTransferSides,
  toggleAllTransferObjects,
  toggleTransferGroup,
  toggleTransferObject
} = databaseStore

const contentModes = [
  { value: 'all', label: t('结构和数据') },
  { value: 'structure', label: t('仅结构'), hint: t('仅创建表和对象结构，不复制数据') },
  { value: 'data', label: t('仅数据'), hint: t('仅复制数据到已存在的目标表') }
]

const filteredTasks = computed(() => {
  const keyword = String(dataTransferDialog.value.taskKeyword || '')
    .trim()
    .toLowerCase()
  const tasks = dataTransferDialog.value.tasks || []
  if (!keyword) return tasks
  return tasks.filter(
    (task) =>
      String(task.name || '')
        .toLowerCase()
        .includes(keyword) || `${task.sourceDatabase} ${task.targetDatabase}`.toLowerCase().includes(keyword)
  )
})

const filteredObjects = computed(() =>
  filterTransferObjects(dataTransferDialog.value.objects || [], dataTransferDialog.value.objectKeyword)
)

const objectGroups = computed(() => groupTransferObjects(filteredObjects.value))
const selectedKeys = computed(() => new Set(dataTransferDialog.value.selectedObjects || []))
const selectedCount = computed(() => selectedKeys.value.size)
const allSelected = computed(
  () => dataTransferDialog.value.objects.length > 0 && selectedCount.value === dataTransferDialog.value.objects.length
)
const summary = computed(() => dataTransferDialog.value.summary || { transferred: [], skipped: [], failed: [] })

const canTransfer = computed(() => {
  const dialog = dataTransferDialog.value
  return Boolean(
    dialog.sourceConnection &&
    dialog.sourceDatabase &&
    dialog.targetConnection &&
    dialog.targetDatabase &&
    dialog.selectedObjects.length &&
    !(dialog.sourceConnection === dialog.targetConnection && dialog.sourceDatabase === dialog.targetDatabase)
  )
})

const canSaveTask = computed(() => {
  const dialog = dataTransferDialog.value
  return Boolean(dialog.sourceConnection && dialog.sourceDatabase && dialog.targetConnection && dialog.targetDatabase)
})

const timeoutHint = computed(() => {
  const dialog = dataTransferDialog.value
  if (dialog.timeoutMode !== 'inherit') {
    return t('本次任务单条语句超时 {p0} 秒，整个传输任务不限制总时长。', { p0: dialog.timeoutMode })
  }

  const source = connections.value.find((conn) => conn.name === dialog.sourceConnection)
  const target = connections.value.find((conn) => conn.name === dialog.targetConnection)
  const read = source?.enableReadTimeout === false ? t('不限制') : t('{p0} 秒', { p0: source?.readTimeout || 30 })
  const write = target?.enableWriteTimeout === false ? t('不限制') : t('{p0} 秒', { p0: target?.writeTimeout || 30 })
  return t('源连接：{p0}；目标连接：{p1}。整个传输任务不限制总时长。', { p0: read, p1: write })
})

function isSelected(item) {
  return selectedKeys.value.has(transferObjectKey(item))
}

function groupState(type) {
  const group = dataTransferDialog.value.objects.filter((item) => item.type === type)
  const selected = group.filter((item) => selectedKeys.value.has(transferObjectKey(item))).length
  return { all: group.length > 0 && selected === group.length, some: selected > 0 }
}

function groupSelectedCount(group) {
  return group.items.filter((item) => selectedKeys.value.has(transferObjectKey(item))).length
}

function summaryKey(item) {
  return `${item.type}:${item.name}`
}

function summaryLabel(item) {
  return `${getTransferTypeLabel(item.type)} ${item.name}`
}
</script>
