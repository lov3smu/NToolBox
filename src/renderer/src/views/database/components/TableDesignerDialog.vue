<template>
  <div
    v-if="tableDesignerDialog.show"
    v-modal-shell="{ onClose: closeTableDesigner, closeOnOutside: false }"
    class="dialog-overlay"
  >
    <div class="dialog dialog-wide table-designer-dialog">
      <div class="dialog-header">
        <h3>
          {{ t('表设计器 ·') }}
          <span class="table-designer-title-ref"
            >{{ tableDesignerDialog.tab?.database }}.{{ tableDesignerDialog.tab?.tableName }}</span
          >
        </h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeTableDesigner">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content create-table-body" @input="invalidatePreview" @change="invalidatePreview">
        <div v-if="tableDesignerDialog.loading" class="structure-loading">{{ t('正在读取表结构…') }}</div>
        <template v-else-if="draft">
          <div class="create-table-meta">
            <div class="form-group">
              <label>{{ t('表注释') }}</label>
              <AppInput v-model="draft.comment" type="text" maxlength="120" />
            </div>
            <div class="form-group">
              <label>{{ t('默认字符集') }}</label>
              <select v-model="draft.charset" class="select-field">
                <option v-for="charset in charsets" :key="charset" :value="charset">{{ charset }}</option>
              </select>
            </div>
          </div>

          <div class="create-table-section">
            <div class="create-table-section-head">
              <span class="create-table-section-title">{{ t('字段') }}</span>
              <div class="table-designer-section-actions">
                <span class="table-designer-hint">{{
                  t('重命名主键字段时主键会自动跟随；新字段不支持直接设为主键')
                }}</span>
                <button class="btn btn-sm btn-secondary" @click="addColumn">{{ t('+ 添加字段') }}</button>
              </div>
            </div>
            <div class="create-column-grid create-column-head">
              <span>{{ t('字段名') }}</span>
              <span>{{ t('类型') }}</span>
              <span :title="t('非空')">{{ t('非空') }}</span>
              <span :title="t('主键')">{{ t('主键') }}</span>
              <span :title="t('自增')">{{ t('自增') }}</span>
              <span>{{ t('默认值') }}</span>
              <span>{{ t('注释') }}</span>
              <span :title="t('删除')">{{ t('删除') }}</span>
            </div>
            <div
              v-for="(column, index) in draft.columns"
              :key="index"
              :class="['create-column-grid', { 'table-designer-row-deleted': column.deleted }]"
            >
              <AppInput v-model="column.name" type="text" :placeholder="t('字段名')" />
              <AppInput v-model="column.type" type="text" list="table-designer-types" placeholder="INT" />
              <label class="create-column-check">
                <input
                  v-model="column.nullable"
                  type="checkbox"
                  :disabled="column.primaryKey || column.autoIncrement"
                />
              </label>
              <label class="create-column-check">
                <input
                  v-model="column.primaryKey"
                  type="checkbox"
                  :disabled="!column.existed || column.deleted"
                  :title="column.existed ? '' : t('新字段不能直接设为主键')"
                  @change="onPrimaryKeyChange(column)"
                />
              </label>
              <label class="create-column-check">
                <input v-model="column.autoIncrement" type="checkbox" @change="onAutoIncrementChange(column)" />
              </label>
              <AppInput v-model="column.defaultValue" type="text" :placeholder="t('无')" />
              <AppInput v-model="column.comment" type="text" :placeholder="t('可选')" />
              <label class="create-column-check" :title="t('删除字段')">
                <input v-model="column.deleted" type="checkbox" />
              </label>
            </div>
            <datalist id="table-designer-types">
              <option v-for="type in columnTypes" :key="type" :value="type" />
            </datalist>
          </div>

          <div class="create-table-section">
            <div class="create-table-section-head">
              <span class="create-table-section-title">{{ t('索引') }}</span>
              <button class="btn btn-sm btn-secondary" @click="addIndex">{{ t('+ 添加索引') }}</button>
            </div>
            <div v-if="!draft.indexes.length" class="create-table-empty">{{ t('主键无需在此维护') }}</div>
            <div class="create-index-row create-column-head">
              <span>{{ t('索引名') }}</span>
              <span>{{ t('字段（逗号分隔）') }}</span>
              <span>{{ t('唯一') }}</span>
              <span />
            </div>
            <div
              v-for="(indexItem, index) in draft.indexes"
              :key="index"
              :class="['create-index-row', { 'table-designer-row-deleted': indexItem.deleted }]"
            >
              <AppInput v-model="indexItem.name" type="text" :placeholder="t('留空自动生成')" />
              <AppInput v-model="indexItem.columns" type="text" :placeholder="t('字段，逗号分隔')" />
              <label class="create-column-check create-index-unique">
                <input v-model="indexItem.unique" type="checkbox" />
                <span>{{ t('唯一') }}</span>
              </label>
              <label class="create-column-check" :title="t('删除索引')">
                <input v-model="indexItem.deleted" type="checkbox" />
              </label>
            </div>
          </div>

          <div class="create-table-section">
            <div class="create-table-section-head">
              <span class="create-table-section-title">{{ t('外键') }}</span>
              <div class="table-designer-section-actions">
                <span class="table-designer-hint">{{ t('已创建的外键可删除，新外键仅支持单字段引用') }}</span>
                <button class="btn btn-sm btn-secondary" @click="addForeignKey">{{ t('+ 添加外键') }}</button>
              </div>
            </div>
            <div v-if="!draft.foreignKeys.length" class="create-table-empty">{{ t('没有外键') }}</div>
            <div v-for="foreignKey in draft.foreignKeys" :key="foreignKey.name" class="table-designer-fk-existing">
              <span class="table-designer-fk-name">{{ foreignKey.name }}</span>
              <span class="table-designer-fk-detail">
                ({{ foreignKey.columns }}) → {{ foreignKey.refTable }}({{ foreignKey.refColumns }})
              </span>
              <span class="table-designer-fk-detail"
                >{{ foreignKey.deleteRule || '-' }} / {{ foreignKey.updateRule || '-' }}</span
              >
              <label class="create-column-check" :title="t('删除外键')">
                <input v-model="foreignKey.drop" type="checkbox" />
              </label>
            </div>
            <div
              v-for="(foreignKey, index) in draft.newForeignKeys"
              :key="`new-fk-${index}`"
              class="table-designer-fk-row"
            >
              <AppInput v-model="foreignKey.name" type="text" :placeholder="t('约束名（可留空）')" />
              <select v-model="foreignKey.column" class="select-field">
                <option value="">{{ t('本表字段') }}</option>
                <option v-for="column in activeColumnNames" :key="column" :value="column">{{ column }}</option>
              </select>
              <AppInput v-model="foreignKey.refTable" type="text" :placeholder="t('引用表 / 库.表')" />
              <AppInput v-model="foreignKey.refColumns" type="text" :placeholder="t('引用字段')" />
              <select v-model="foreignKey.onDelete" class="select-field">
                <option v-for="rule in fkRules" :key="rule" :value="rule">{{ rule }}</option>
              </select>
              <select v-model="foreignKey.onUpdate" class="select-field">
                <option v-for="rule in fkRules" :key="rule" :value="rule">{{ rule }}</option>
              </select>
              <button class="btn-icon btn-sm" :title="t('移除')" @click="draft.newForeignKeys.splice(index, 1)">
                <AppIcon name="close" />
              </button>
            </div>
          </div>

          <p v-if="tableDesignerDialog.error" class="create-table-error">{{ tableDesignerDialog.error }}</p>

          <div v-if="tableDesignerDialog.sql" class="table-designer-preview">
            <div class="table-designer-preview-head">
              <span class="create-table-section-title">{{ t('变更 SQL 预览') }}</span>
              <button class="btn btn-xs btn-secondary" @click="copyPreviewSql">{{ t('复制 SQL') }}</button>
            </div>
            <SqlHighlight class="sql-preview-block" :code="tableDesignerDialog.sql" />
          </div>
        </template>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" :disabled="tableDesignerDialog.applying" @click="closeTableDesigner">
          {{ t('关闭') }}
        </button>
        <button
          class="btn btn-secondary"
          :disabled="tableDesignerDialog.loading || tableDesignerDialog.previewing || tableDesignerDialog.applying"
          @click="handlePreview"
        >
          {{ tableDesignerDialog.previewing ? t('生成中...') : t('预览 SQL') }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="!tableDesignerDialog.sql || tableDesignerDialog.applying || tableDesignerDialog.previewing"
          @click="handleApply"
        >
          {{ tableDesignerDialog.applying ? t('执行中...') : t('执行变更') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject, ref, watch } from 'vue'
import SqlHighlight from '@/components/SqlHighlight.vue'

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
const databaseStore = inject('database')
const {
  applyTableDesigner,
  closeTableDesigner,
  copySql,
  previewTableDesigner,
  showConfirm,
  showMessage,
  tableDesignerDialog
} = databaseStore

const charsets = ['utf8mb4', 'utf8mb3', 'gbk', 'gb18030', 'big5', 'latin1', 'ascii']
const fkRules = ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION']
const columnTypes = [
  'INT',
  'BIGINT',
  'TINYINT',
  'SMALLINT',
  'VARCHAR(255)',
  'CHAR(32)',
  'TEXT',
  'LONGTEXT',
  'DECIMAL(10,2)',
  'DATETIME',
  'TIMESTAMP',
  'DATE',
  'TIME',
  'JSON',
  'BLOB'
]

const draft = ref(null)

const activeColumnNames = computed(() =>
  (draft.value?.columns || [])
    .filter((column) => !column.deleted)
    .map((column) => column.name.trim())
    .filter(Boolean)
)

watch(
  () => tableDesignerDialog.value.meta,
  (meta) => {
    if (meta) initDraft(meta)
  }
)

function initDraft(meta) {
  const primaryKeys = meta.primaryKeys || []
  draft.value = {
    columns: (meta.columns || []).map((column) => ({
      existed: true,
      originalName: column.name,
      name: column.name,
      type: column.columnType || column.dataType,
      originalType: column.columnType || column.dataType,
      nullable: Boolean(column.nullable),
      primaryKey: primaryKeys.includes(column.name),
      autoIncrement: Boolean(column.autoIncrement),
      defaultValue:
        column.defaultValue === null || column.defaultValue === undefined ? '' : String(column.defaultValue),
      originalDefault: column.defaultValue,
      comment: column.comment || '',
      originalComment: column.comment || '',
      originalNullable: Boolean(column.nullable),
      originalAutoIncrement: Boolean(column.autoIncrement),
      deleted: false
    })),
    indexes: (meta.indexes || [])
      .filter((index) => !index.primary)
      .map((index) => ({
        existed: true,
        originalName: index.name,
        name: index.name,
        columns: index.columns.join(', '),
        unique: Boolean(index.unique),
        originalColumns: index.columns.join(', '),
        originalUnique: Boolean(index.unique),
        deleted: false
      })),
    foreignKeys: (meta.foreignKeys || []).map((foreignKey) => ({
      name: foreignKey.name,
      columns: foreignKey.columns.map((item) => item.column).join(', '),
      refTable: foreignKey.refSchema ? `${foreignKey.refSchema}.${foreignKey.refTable}` : foreignKey.refTable,
      refColumns: foreignKey.columns.map((item) => item.refColumn).join(', '),
      updateRule: foreignKey.updateRule,
      deleteRule: foreignKey.deleteRule,
      drop: false
    })),
    newForeignKeys: [],
    comment: meta.info?.comment || '',
    originalComment: meta.info?.comment || '',
    charset: String(meta.info?.collation || '').split('_')[0] || 'utf8mb4',
    originalCharset: String(meta.info?.collation || '').split('_')[0] || 'utf8mb4'
  }
  tableDesignerDialog.value.sql = ''
  tableDesignerDialog.value.error = ''
}

function invalidatePreview() {
  tableDesignerDialog.value.sql = ''
}

function addColumn() {
  draft.value.columns.push({
    existed: false,
    originalName: '',
    name: '',
    type: 'VARCHAR(255)',
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    defaultValue: '',
    originalDefault: undefined,
    comment: '',
    originalComment: '',
    deleted: false
  })
}

function addIndex() {
  draft.value.indexes.push({
    existed: false,
    originalName: '',
    name: '',
    columns: '',
    unique: false,
    originalColumns: '',
    originalUnique: false,
    deleted: false
  })
}

function addForeignKey() {
  draft.value.newForeignKeys.push({
    name: '',
    column: '',
    refTable: '',
    refColumns: '',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT'
  })
}

function onPrimaryKeyChange(column) {
  if (column.primaryKey) column.nullable = false
}

function onAutoIncrementChange(column) {
  if (column.autoIncrement) {
    column.primaryKey = true
    column.nullable = false
  }
}

function columnDefinition(column) {
  const definition = {
    name: column.name.trim(),
    type: column.type.trim(),
    nullable: Boolean(column.nullable),
    autoIncrement: Boolean(column.autoIncrement),
    comment: column.comment.trim()
  }
  if (column.defaultValue !== '') {
    definition.defaultValue = column.defaultValue
  } else if (column.existed && column.originalDefault === null) {
    definition.defaultValue = null
  }
  return definition
}

function columnChanged(column) {
  return (
    column.type.trim() !== String(column.originalType || '').trim() ||
    Boolean(column.nullable) !== Boolean(column.originalNullable) ||
    Boolean(column.autoIncrement) !== Boolean(column.originalAutoIncrement) ||
    column.comment.trim() !== String(column.originalComment || '').trim() ||
    String(column.defaultValue) !== String(column.originalDefault ?? '')
  )
}

function indexColumnList(text, renameMap) {
  return String(text || '')
    .split(',')
    .map((item) => {
      const name = item.trim()
      return renameMap.get(name) || name
    })
    .filter(Boolean)
}

function buildOperations() {
  const kept = draft.value.columns.filter((column) => !column.deleted)
  if (!kept.length) {
    throw new Error(t('至少需要一个字段'))
  }
  const seen = new Set()
  for (const column of kept) {
    const name = column.name.trim()
    if (!name) throw new Error(t('字段名不能为空'))
    if (seen.has(name.toLowerCase())) throw new Error(t('字段名重复: {p0}', { p0: name }))
    seen.add(name)
    if (!column.type.trim()) throw new Error(t('字段 {p0} 缺少类型', { p0: name }))
  }
  const autoColumns = kept.filter((column) => column.autoIncrement)
  if (autoColumns.length > 1) throw new Error(t('只能设置一个自增字段'))
  if (autoColumns.length && !autoColumns[0].primaryKey) throw new Error(t('自增字段必须同时设为主键'))

  const renameMap = new Map()
  for (const column of kept) {
    if (column.existed && column.name.trim() !== column.originalName) {
      renameMap.set(column.originalName, column.name.trim())
    }
  }

  const operations = {}

  const addColumns = []
  kept.forEach((column, index) => {
    if (column.existed) return
    const definition = columnDefinition(column)
    if (index > 0) {
      definition.after = kept[index - 1].name.trim()
    } else {
      definition.first = true
    }
    addColumns.push(definition)
  })
  if (addColumns.length) operations.addColumns = addColumns

  const renameColumns = []
  const modifyColumns = []
  for (const column of kept) {
    if (!column.existed) continue
    if (column.name.trim() !== column.originalName) {
      renameColumns.push({ ...columnDefinition(column), name: column.originalName, to: column.name.trim() })
    } else if (columnChanged(column)) {
      modifyColumns.push(columnDefinition(column))
    }
  }
  if (renameColumns.length) operations.renameColumns = renameColumns
  if (modifyColumns.length) operations.modifyColumns = modifyColumns

  const dropColumns = draft.value.columns
    .filter((column) => column.existed && column.deleted)
    .map((column) => column.originalName)
  if (dropColumns.length) operations.dropColumns = dropColumns

  const currentKeys = tableDesignerDialog.value.meta?.primaryKeys || []
  const selectedOldKeys = kept
    .filter((column) => column.existed && column.primaryKey)
    .map((column) => column.originalName)
  const keysUnchanged =
    selectedOldKeys.length === currentKeys.length && selectedOldKeys.every((name, index) => currentKeys[index] === name)
  if (!keysUnchanged) {
    operations.primaryKeys = kept
      .filter((column) => column.existed && column.primaryKey)
      .map((column) => column.name.trim())
  }

  const indexColumns = new Set(activeColumnNames.value)
  const dropIndexes = []
  const addIndexes = []
  for (const indexItem of draft.value.indexes) {
    const columns = indexColumnList(indexItem.columns, renameMap)
    if (indexItem.deleted) {
      if (indexItem.existed) dropIndexes.push(indexItem.originalName)
      continue
    }
    if (!columns.length) {
      if (indexItem.existed) throw new Error(t('索引 {p0} 缺少字段', { p0: indexItem.originalName }))
      continue
    }
    const invalid = columns.filter((column) => !indexColumns.has(column))
    if (invalid.length) throw new Error(t('索引字段不存在: {p0}', { p0: invalid.join(', ') }))
    if (indexItem.existed) {
      const mappedOriginal = indexColumnList(indexItem.originalColumns, renameMap)
      const changed =
        indexItem.name.trim() !== indexItem.originalName ||
        Boolean(indexItem.unique) !== Boolean(indexItem.originalUnique) ||
        columns.join(',') !== mappedOriginal.join(',')
      if (!changed) continue
      dropIndexes.push(indexItem.originalName)
    }
    addIndexes.push({
      name: indexItem.name.trim(),
      unique: Boolean(indexItem.unique),
      columns
    })
  }
  if (dropIndexes.length) operations.dropIndexes = dropIndexes
  if (addIndexes.length) operations.addIndexes = addIndexes

  const dropForeignKeys = draft.value.foreignKeys
    .filter((foreignKey) => foreignKey.drop)
    .map((foreignKey) => foreignKey.name)
  if (dropForeignKeys.length) operations.dropForeignKeys = dropForeignKeys

  const addForeignKeys = []
  for (const foreignKey of draft.value.newForeignKeys) {
    const column = foreignKey.column.trim()
    const refTableText = foreignKey.refTable.trim()
    const refColumns = foreignKey.refColumns
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (!column && !refTableText && !refColumns.length) continue
    if (!column) throw new Error(t('外键需要选择本表字段'))
    if (!indexColumns.has(column)) throw new Error(t('外键字段不存在: {p0}', { p0: column }))
    if (!refTableText) throw new Error(t('外键需要填写引用表'))
    if (!refColumns.length) throw new Error(t('外键需要填写引用字段'))
    const [refSchema, refTable] = refTableText.includes('.')
      ? refTableText.split(/\.(.*)/s)
      : [tableDesignerDialog.value.tab?.database || '', refTableText]
    addForeignKeys.push({
      name: foreignKey.name.trim(),
      columns: [column],
      refSchema,
      refTable,
      refColumns,
      onDelete: foreignKey.onDelete,
      onUpdate: foreignKey.onUpdate
    })
  }
  if (addForeignKeys.length) operations.addForeignKeys = addForeignKeys

  const comment = draft.value.comment.trim()
  if (comment !== String(draft.value.originalComment || '').trim()) {
    operations.tableComment = comment
  }
  if (draft.value.charset !== draft.value.originalCharset) {
    operations.charset = draft.value.charset
  }

  if (!Object.keys(operations).length) {
    throw new Error(t('没有检测到结构变更'))
  }
  return operations
}

async function prepareOperations() {
  tableDesignerDialog.value.error = ''
  try {
    return buildOperations()
  } catch (error) {
    tableDesignerDialog.value.error = error.message
    await showMessage(error.message, 'warning')
    return null
  }
}

async function handlePreview() {
  const operations = await prepareOperations()
  if (!operations) return
  await previewTableDesigner(tableDesignerDialog.value.tab, operations)
}

async function handleApply() {
  const operations = await prepareOperations()
  if (!operations) return
  const confirmed = await showConfirm(t('将执行上述 ALTER TABLE 语句，确定继续吗？'))
  if (!confirmed) return
  await applyTableDesigner(tableDesignerDialog.value.tab, operations)
}

function copyPreviewSql() {
  copySql(tableDesignerDialog.value.sql)
}
</script>
