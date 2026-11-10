<template>
  <div v-if="structureDialog.show" class="dialog-overlay" @click.self="closeStructureDialog">
    <div class="dialog dialog-structure">
      <div class="dialog-header">
        <h3>表结构 · {{ structureDialog.tab?.tableName }}</h3>
        <div class="structure-header-actions">
          <button v-if="!structureDialog.meta?.isView" class="btn btn-sm btn-secondary" @click="renameTable">
            重命名表
          </button>
          <button class="btn-icon btn-sm" title="关闭" @click="closeStructureDialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="dialog-tabs">
        <div
          v-for="section in sections"
          :key="section.key"
          :class="['dialog-tab', { active: structureDialog.section === section.key }]"
          @click="structureDialog.section = section.key"
        >
          {{ section.label }}
        </div>
      </div>
      <div class="dialog-content structure-content">
        <div v-if="structureDialog.loading" class="structure-loading">加载中...</div>
        <template v-else-if="structureDialog.meta">
          <template v-if="structureDialog.section === 'columns'">
            <div class="structure-scroll">
              <table class="result-table structure-table">
                <thead>
                  <tr>
                    <th>字段</th>
                    <th>类型</th>
                    <th>允许空</th>
                    <th>键</th>
                    <th>默认值</th>
                    <th>额外</th>
                    <th>注释</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="column in structureDialog.meta.columns" :key="column.name">
                    <td>{{ column.name }}</td>
                    <td>{{ column.columnType || column.dataType }}</td>
                    <td>{{ column.nullable ? 'YES' : 'NO' }}</td>
                    <td>{{ column.columnKey || '-' }}</td>
                    <td>{{ column.defaultValue ?? '-' }}</td>
                    <td>{{ column.extra || '-' }}</td>
                    <td>{{ column.comment || '-' }}</td>
                    <td class="structure-actions">
                      <template v-if="!structureDialog.meta.isView">
                        <button class="btn btn-xs btn-secondary" @click="startEditColumn(column)">修改</button>
                        <button class="btn btn-xs btn-secondary danger" @click="dropColumn(column)">删除</button>
                      </template>
                      <span v-else class="structure-muted">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="!structureDialog.meta.isView && editingColumn" class="structure-form">
              <div class="structure-form-title">修改字段 {{ editingColumn.name }}</div>
              <div class="structure-form-grid">
                <label class="structure-field">
                  <span>类型</span>
                  <input v-model="editingColumn.type" class="input-field" placeholder="如 VARCHAR(255)" />
                </label>
                <label class="structure-field">
                  <span>默认值</span>
                  <input v-model="editingColumn.defaultValue" class="input-field" placeholder="留空表示不设置" />
                </label>
                <label class="structure-field">
                  <span>注释</span>
                  <input v-model="editingColumn.comment" class="input-field" />
                </label>
                <div class="structure-checkboxes">
                  <label class="checkbox-label-inline">
                    <input v-model="editingColumn.nullable" type="checkbox" />
                    <span>允许空</span>
                  </label>
                  <label class="checkbox-label-inline">
                    <input v-model="editingColumn.autoIncrement" type="checkbox" />
                    <span>自增</span>
                  </label>
                </div>
              </div>
              <div class="structure-form-actions">
                <button class="btn btn-sm btn-secondary" @click="editingColumn = null">取消</button>
                <button class="btn btn-sm btn-primary" @click="submitEditColumn">保存修改</button>
              </div>
            </div>

            <div v-else-if="!structureDialog.meta.isView" class="structure-form">
              <div class="structure-form-title">新增字段</div>
              <div class="structure-form-grid">
                <label class="structure-field">
                  <span>字段名</span>
                  <input v-model="newColumn.name" class="input-field" placeholder="字段名" />
                </label>
                <label class="structure-field">
                  <span>类型</span>
                  <input v-model="newColumn.type" class="input-field" placeholder="如 INT / VARCHAR(255)" />
                </label>
                <label class="structure-field">
                  <span>默认值</span>
                  <input v-model="newColumn.defaultValue" class="input-field" placeholder="留空表示不设置" />
                </label>
                <label class="structure-field">
                  <span>注释</span>
                  <input v-model="newColumn.comment" class="input-field" />
                </label>
                <label class="structure-field">
                  <span>位于字段之后</span>
                  <select v-model="newColumn.after" class="filter-select">
                    <option value="">末尾</option>
                    <option v-for="column in structureDialog.meta.columns" :key="column.name" :value="column.name">
                      {{ column.name }}
                    </option>
                  </select>
                </label>
                <div class="structure-checkboxes">
                  <label class="checkbox-label-inline">
                    <input v-model="newColumn.nullable" type="checkbox" />
                    <span>允许空</span>
                  </label>
                  <label class="checkbox-label-inline">
                    <input v-model="newColumn.autoIncrement" type="checkbox" />
                    <span>自增</span>
                  </label>
                </div>
              </div>
              <div class="structure-form-actions">
                <button class="btn btn-sm btn-primary" @click="submitAddColumn">添加字段</button>
              </div>
            </div>
          </template>

          <template v-else-if="structureDialog.section === 'indexes'">
            <div class="structure-scroll">
              <table class="result-table structure-table">
                <thead>
                  <tr>
                    <th>索引名</th>
                    <th>类型</th>
                    <th>唯一</th>
                    <th>字段</th>
                    <th>基数</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="index in structureDialog.meta.indexes" :key="index.name">
                    <td>{{ index.name }}</td>
                    <td>{{ index.primary ? 'PRIMARY' : index.type }}</td>
                    <td>{{ index.unique ? 'YES' : 'NO' }}</td>
                    <td>{{ index.columns.join(', ') }}</td>
                    <td>{{ index.cardinality ?? '-' }}</td>
                    <td class="structure-actions">
                      <button v-if="!index.primary" class="btn btn-xs btn-secondary danger" @click="dropIndex(index)">
                        删除
                      </button>
                      <span v-else class="structure-muted">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!structureDialog.meta.isView" class="structure-form">
              <div class="structure-form-title">新增索引</div>
              <div class="structure-form-grid">
                <label class="structure-field">
                  <span>索引名</span>
                  <input v-model="newIndex.name" class="input-field" placeholder="留空自动生成" />
                </label>
                <div class="structure-checkboxes">
                  <label class="checkbox-label-inline">
                    <input v-model="newIndex.unique" type="checkbox" />
                    <span>唯一索引</span>
                  </label>
                </div>
              </div>
              <div class="structure-column-picker">
                <label v-for="column in structureDialog.meta.columns" :key="column.name" class="checkbox-label-inline">
                  <input
                    type="checkbox"
                    :checked="newIndex.columns.includes(column.name)"
                    @change="toggleIndexColumn(column.name)"
                  />
                  <span>{{ column.name }}</span>
                </label>
              </div>
              <div class="structure-form-actions">
                <button
                  class="btn btn-sm btn-primary"
                  :disabled="newIndex.columns.length === 0"
                  @click="submitAddIndex"
                >
                  添加索引
                </button>
              </div>
            </div>
          </template>

          <template v-else-if="structureDialog.section === 'foreignKeys'">
            <div class="structure-scroll">
              <table class="result-table structure-table">
                <thead>
                  <tr>
                    <th>约束名</th>
                    <th>字段</th>
                    <th>引用表</th>
                    <th>引用字段</th>
                    <th>更新规则</th>
                    <th>删除规则</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="foreignKey in structureDialog.meta.foreignKeys" :key="foreignKey.name">
                    <td>{{ foreignKey.name }}</td>
                    <td>{{ foreignKey.columns.map((item) => item.column).join(', ') }}</td>
                    <td>{{ foreignKey.refTable }}</td>
                    <td>{{ foreignKey.columns.map((item) => item.refColumn).join(', ') }}</td>
                    <td>{{ foreignKey.updateRule || '-' }}</td>
                    <td>{{ foreignKey.deleteRule || '-' }}</td>
                  </tr>
                  <tr v-if="structureDialog.meta.foreignKeys.length === 0">
                    <td colspan="6" class="structure-muted">没有外键</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-else-if="structureDialog.section === 'triggers'">
            <div class="structure-scroll">
              <table class="result-table structure-table">
                <thead>
                  <tr>
                    <th>触发器</th>
                    <th>时机</th>
                    <th>事件</th>
                    <th>语句</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="trigger in structureDialog.meta.triggers" :key="trigger.name">
                    <td>{{ trigger.name }}</td>
                    <td>{{ trigger.timing }}</td>
                    <td>{{ trigger.event }}</td>
                    <td class="structure-statement" :title="trigger.statement">{{ trigger.statement }}</td>
                  </tr>
                  <tr v-if="structureDialog.meta.triggers.length === 0">
                    <td colspan="4" class="structure-muted">没有触发器</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-else>
            <div class="structure-ddl-actions">
              <button class="btn btn-sm btn-secondary" @click="copySql(structureDialog.meta.ddl)">复制 DDL</button>
            </div>
            <pre class="sql-preview-block">{{ structureDialog.meta.ddl || '无法获取 DDL' }}</pre>
          </template>
        </template>
      </div>
      <div class="dialog-footer">
        <div class="dialog-footer-left">
          <button class="btn btn-secondary" @click="refreshMeta">刷新</button>
        </div>
        <button class="btn btn-primary" @click="closeStructureDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, ref, watch } from 'vue'

const databaseStore = inject('database')
const {
  applyStructureChanges,
  closeStructureDialog,
  copySql,
  loadStructureMeta,
  showConfirm,
  showMessage,
  showPrompt,
  structureDialog
} = databaseStore

const sections = [
  { key: 'columns', label: '字段' },
  { key: 'indexes', label: '索引' },
  { key: 'foreignKeys', label: '外键' },
  { key: 'triggers', label: '触发器' },
  { key: 'ddl', label: 'DDL' }
]

function defaultColumn() {
  return {
    name: '',
    type: 'VARCHAR(255)',
    nullable: true,
    autoIncrement: false,
    defaultValue: '',
    comment: '',
    after: ''
  }
}

const newColumn = ref(defaultColumn())
const editingColumn = ref(null)
const newIndex = ref({ name: '', unique: false, columns: [] })

watch(
  () => structureDialog.value.show,
  (show) => {
    if (!show) return
    newColumn.value = defaultColumn()
    editingColumn.value = null
    newIndex.value = { name: '', unique: false, columns: [] }
    structureDialog.value.section = 'columns'
  }
)

function buildColumnPayload(column) {
  const payload = {
    name: column.name,
    type: column.type,
    nullable: Boolean(column.nullable),
    autoIncrement: Boolean(column.autoIncrement)
  }
  if (column.defaultValue !== '') payload.defaultValue = column.defaultValue
  if (column.comment) payload.comment = column.comment
  if (column.after) payload.after = column.after
  return payload
}

function startEditColumn(column) {
  editingColumn.value = {
    name: column.name,
    type: column.columnType || column.dataType,
    nullable: Boolean(column.nullable),
    autoIncrement: /auto_increment/i.test(String(column.extra || '')),
    defaultValue: column.defaultValue === null || column.defaultValue === undefined ? '' : column.defaultValue,
    comment: column.comment || ''
  }
}

async function submitAddColumn() {
  const tab = structureDialog.value.tab
  if (!newColumn.value.name.trim()) {
    await showMessage('请输入字段名', 'warning')
    return
  }
  if (!newColumn.value.type.trim()) {
    await showMessage('请输入字段类型', 'warning')
    return
  }
  const ok = await applyStructureChanges(tab, { addColumns: [buildColumnPayload(newColumn.value)] })
  if (ok) newColumn.value = defaultColumn()
}

async function submitEditColumn() {
  const tab = structureDialog.value.tab
  const ok = await applyStructureChanges(tab, { modifyColumns: [buildColumnPayload(editingColumn.value)] })
  if (ok) editingColumn.value = null
}

async function dropColumn(column) {
  const confirmed = await showConfirm(`确定删除字段 "${column.name}" 吗？此操作可能丢失数据。`)
  if (!confirmed) return
  await applyStructureChanges(structureDialog.value.tab, { dropColumns: [column.name] })
}

function toggleIndexColumn(name) {
  const columns = newIndex.value.columns
  const index = columns.indexOf(name)
  if (index === -1) {
    columns.push(name)
  } else {
    columns.splice(index, 1)
  }
}

async function submitAddIndex() {
  if (newIndex.value.columns.length === 0) return
  const ok = await applyStructureChanges(structureDialog.value.tab, {
    addIndexes: [
      {
        name: newIndex.value.name.trim(),
        unique: newIndex.value.unique,
        columns: [...newIndex.value.columns]
      }
    ]
  })
  if (ok) newIndex.value = { name: '', unique: false, columns: [] }
}

async function dropIndex(index) {
  const confirmed = await showConfirm(`确定删除索引 "${index.name}" 吗？`)
  if (!confirmed) return
  await applyStructureChanges(structureDialog.value.tab, { dropIndexes: [index.name] })
}

async function renameTable() {
  const tab = structureDialog.value.tab
  if (!tab) return
  const name = await showPrompt('请输入新的表名：', tab.tableName)
  if (!name || name === tab.tableName) return
  await applyStructureChanges(tab, { renameTable: name })
}

function refreshMeta() {
  if (structureDialog.value.tab) {
    loadStructureMeta(structureDialog.value.tab)
  }
}
</script>
