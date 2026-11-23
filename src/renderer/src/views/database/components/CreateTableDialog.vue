<template>
  <div v-if="createTableDialog.show" class="dialog-overlay">
    <div class="dialog dialog-wide create-table-dialog">
      <div class="dialog-header">
        <h3>{{ t('新建表 ·') }} {{ createTableDialog.database }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeCreateTableDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content create-table-body">
        <div class="create-table-meta">
          <div class="form-group">
            <label>{{ t('表名') }}</label>
            <input
              v-model="form.tableName"
              type="text"
              class="input-field"
              maxlength="64"
              :placeholder="t('例如 user_profile')"
            />
          </div>
          <div class="form-group">
            <label>{{ t('字符集') }}</label>
            <select v-model="form.charset" class="select-field">
              <option v-for="charset in charsets" :key="charset" :value="charset">{{ charset }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>{{ t('表注释') }}</label>
          <input v-model="form.comment" type="text" class="input-field" maxlength="120" :placeholder="t('可选')" />
        </div>

        <div class="create-table-section">
          <div class="create-table-section-head">
            <span class="create-table-section-title">{{ t('字段') }}</span>
            <button class="btn btn-sm btn-secondary" @click="addColumn">{{ t('+ 添加字段') }}</button>
          </div>
          <div class="create-column-grid create-column-head">
            <span>{{ t('字段名') }}</span>
            <span>{{ t('类型') }}</span>
            <span :title="t('非空')">{{ t('非空') }}</span>
            <span :title="t('主键')">{{ t('主键') }}</span>
            <span :title="t('自增')">{{ t('自增') }}</span>
            <span>{{ t('默认值') }}</span>
            <span>{{ t('注释') }}</span>
            <span />
          </div>
          <div v-for="(column, index) in form.columns" :key="index" class="create-column-grid">
            <input v-model="column.name" type="text" class="input-field" :placeholder="t('字段名')" />
            <input v-model="column.type" type="text" class="input-field" list="create-table-types" placeholder="INT" />
            <label class="create-column-check">
              <input v-model="column.nullable" type="checkbox" :disabled="column.primaryKey" />
            </label>
            <label class="create-column-check">
              <input v-model="column.primaryKey" type="checkbox" @change="onPrimaryKeyChange(column)" />
            </label>
            <label class="create-column-check">
              <input v-model="column.autoIncrement" type="checkbox" @change="onAutoIncrementChange(column)" />
            </label>
            <input v-model="column.defaultValue" type="text" class="input-field" :placeholder="t('无')" />
            <input v-model="column.comment" type="text" class="input-field" :placeholder="t('可选')" />
            <button class="btn-icon btn-sm" :title="t('删除字段')" @click="removeColumn(index)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <datalist id="create-table-types">
            <option v-for="type in columnTypes" :key="type" :value="type" />
          </datalist>
        </div>

        <div class="create-table-section">
          <div class="create-table-section-head">
            <span class="create-table-section-title">{{ t('索引') }}</span>
            <button class="btn btn-sm btn-secondary" @click="addIndex">{{ t('+ 添加索引') }}</button>
          </div>
          <div v-if="!form.indexes.length" class="create-table-empty">{{ t('可选，主键无需重复添加') }}</div>
          <div v-for="(index, indexPosition) in form.indexes" :key="indexPosition" class="create-index-row">
            <input v-model="index.name" type="text" class="input-field" :placeholder="t('索引名（留空自动生成）')" />
            <input v-model="index.columns" type="text" class="input-field" :placeholder="t('字段，逗号分隔')" />
            <label class="create-column-check create-index-unique">
              <input v-model="index.unique" type="checkbox" />
              <span>{{ t('唯一') }}</span>
            </label>
            <button class="btn-icon btn-sm" :title="t('删除索引')" @click="form.indexes.splice(indexPosition, 1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <p v-if="error" class="create-table-error">{{ error }}</p>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" :disabled="creating" @click="closeCreateTableDialog">{{ t('取消') }}</button>
        <button class="btn btn-primary" :disabled="creating" @click="submit">
          {{ creating ? t('创建中...') : t('创建表') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject, ref, watch } from 'vue'

const databaseStore = inject('database')
const { closeCreateTableDialog, createTableDialog, submitCreateTable } = databaseStore

const charsets = ['utf8mb4', 'utf8mb3', 'gbk', 'big5', 'latin1', 'ascii']
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

const form = ref(createInitialForm())
const error = ref('')
const creating = ref(false)

function createInitialForm() {
  return {
    tableName: '',
    comment: '',
    charset: 'utf8mb4',
    columns: [
      {
        name: 'id',
        type: 'BIGINT',
        primaryKey: true,
        autoIncrement: true,
        nullable: false,
        defaultValue: '',
        comment: ''
      }
    ],
    indexes: []
  }
}

watch(
  () => createTableDialog.value.show,
  (show) => {
    if (show) {
      form.value = createInitialForm()
      error.value = ''
      creating.value = false
    }
  }
)

function addColumn() {
  form.value.columns.push({
    name: '',
    type: 'VARCHAR(255)',
    primaryKey: false,
    autoIncrement: false,
    nullable: true,
    defaultValue: '',
    comment: ''
  })
}

function removeColumn(index) {
  form.value.columns.splice(index, 1)
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

function addIndex() {
  form.value.indexes.push({ name: '', columns: '', unique: false })
}

function buildPayload() {
  const columns = form.value.columns.map((column) => ({
    name: column.name.trim(),
    type: column.type.trim(),
    nullable: column.primaryKey ? false : column.nullable,
    primaryKey: column.primaryKey,
    autoIncrement: column.autoIncrement,
    defaultValue: column.defaultValue === '' ? undefined : column.defaultValue,
    comment: column.comment.trim()
  }))
  const indexes = form.value.indexes
    .map((index) => ({
      name: index.name.trim(),
      columns: index.columns
        .split(',')
        .map((column) => column.trim())
        .filter(Boolean),
      unique: index.unique
    }))
    .filter((index) => index.columns.length)
  return {
    tableName: form.value.tableName.trim(),
    comment: form.value.comment.trim(),
    charset: form.value.charset,
    columns,
    indexes
  }
}

async function submit() {
  error.value = ''
  const payload = buildPayload()
  if (!payload.tableName) {
    error.value = t('请填写表名')
    return
  }
  if (!payload.columns.length) {
    error.value = t('至少需要一个字段')
    return
  }
  if (payload.columns.some((column) => !column.name)) {
    error.value = t('字段名不能为空')
    return
  }
  if (payload.columns.some((column) => !column.type)) {
    error.value = t('字段类型不能为空')
    return
  }

  creating.value = true
  try {
    const result = await submitCreateTable(payload)
    if (!result.success) error.value = result.error || t('创建表失败')
  } finally {
    creating.value = false
  }
}
</script>
