<template>
  <div v-if="schemaDiffDialog.show" class="dialog-overlay" @click.self="closeSchemaDiffDialog">
    <div class="dialog dialog-wide schema-diff-dialog">
      <div class="dialog-header">
        <h3>结构对比</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeSchemaDiffDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content schema-diff-body">
        <div class="schema-diff-form">
          <div class="schema-diff-side">
            <div class="form-group">
              <label>源连接</label>
              <select v-model="schemaDiffDialog.connectionName" class="select-field" @change="onSourceConnectionChange">
                <option value="">请选择</option>
                <option v-for="conn in connections" :key="conn.name" :value="conn.name">{{ conn.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>源数据库（以此为准）</label>
              <select v-model="schemaDiffDialog.database" class="select-field">
                <option value="">请选择</option>
                <option v-for="db in sourceDatabases" :key="db" :value="db">{{ db }}</option>
              </select>
            </div>
          </div>
          <div class="schema-diff-arrow">→</div>
          <div class="schema-diff-side">
            <div class="form-group">
              <label>目标连接</label>
              <select
                v-model="schemaDiffDialog.targetConnectionName"
                class="select-field"
                @change="onTargetConnectionChange"
              >
                <option value="">请选择</option>
                <option v-for="conn in connections" :key="conn.name" :value="conn.name">{{ conn.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>目标数据库（待同步）</label>
              <select v-model="schemaDiffDialog.targetDatabase" class="select-field">
                <option value="">请选择</option>
                <option v-for="db in targetDatabases" :key="db" :value="db">{{ db }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="schema-diff-actions">
          <button class="btn btn-primary" :disabled="schemaDiffDialog.loading" @click="compareSchemaDiff">
            {{ schemaDiffDialog.loading ? '对比中...' : '开始对比' }}
          </button>
          <span v-if="schemaDiffDialog.result" class="schema-diff-hint">
            对比完成，生成 {{ schemaDiffDialog.result.statements.length }} 条同步语句
          </span>
        </div>

        <p v-if="schemaDiffDialog.error" class="schema-diff-error">{{ schemaDiffDialog.error }}</p>

        <template v-if="schemaDiffDialog.result">
          <div class="schema-diff-summary">
            <span class="schema-diff-chip">源表 {{ schemaDiffDialog.result.summary.baseTables }}</span>
            <span class="schema-diff-chip">目标表 {{ schemaDiffDialog.result.summary.targetTables }}</span>
            <span class="schema-diff-chip danger">缺表 {{ schemaDiffDialog.result.summary.missingTables }}</span>
            <span class="schema-diff-chip warning">表差异 {{ schemaDiffDialog.result.summary.changedTables }}</span>
            <span class="schema-diff-chip warning">
              字段差异
              {{
                schemaDiffDialog.result.summary.missingColumns +
                schemaDiffDialog.result.summary.changedColumns +
                schemaDiffDialog.result.summary.extraColumns
              }}
            </span>
            <span class="schema-diff-chip warning">
              索引差异
              {{
                schemaDiffDialog.result.summary.missingIndexes +
                schemaDiffDialog.result.summary.changedIndexes +
                schemaDiffDialog.result.summary.extraIndexes
              }}
            </span>
          </div>

          <div v-if="schemaDiffDialog.result.warnings.length" class="schema-diff-warnings">
            <p v-for="(warning, index) in schemaDiffDialog.result.warnings" :key="index">· {{ warning }}</p>
          </div>

          <div class="schema-diff-tables">
            <div
              v-for="table in schemaDiffDialog.result.tables"
              :key="table.name"
              :class="['schema-diff-table', `status-${table.status}`]"
            >
              <div class="schema-diff-table-head">
                <span class="schema-diff-table-name">{{ table.name }}</span>
                <span class="schema-diff-table-status">{{ statusLabel(table.status) }}</span>
              </div>
              <div v-if="table.columns.length" class="schema-diff-details">
                <span v-for="column in table.columns" :key="`c-${column.name}`" class="schema-diff-detail">
                  字段 {{ column.name }} · {{ statusLabel(column.status) }}
                </span>
              </div>
              <div v-if="table.indexes.length" class="schema-diff-details">
                <span v-for="index in table.indexes" :key="`i-${index.name}`" class="schema-diff-detail">
                  索引 {{ index.name }} · {{ statusLabel(index.status) }}
                </span>
              </div>
            </div>
            <div v-if="!schemaDiffDialog.result.tables.length" class="schema-diff-empty">两个数据库结构一致</div>
          </div>

          <div v-if="schemaDiffDialog.result.statements.length" class="form-group">
            <label>同步 SQL（在目标库执行）</label>
            <pre class="schema-diff-sql">{{ statementsText }}</pre>
          </div>
        </template>
      </div>
      <div class="dialog-footer">
        <button
          class="btn btn-secondary"
          :disabled="!schemaDiffDialog.result?.statements.length"
          @click="copySchemaDiffSql"
        >
          复制 SQL
        </button>
        <button class="btn btn-primary" @click="closeSchemaDiffDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, watch } from 'vue'

const databaseStore = inject('database')
const {
  closeSchemaDiffDialog,
  compareSchemaDiff,
  connectionDatabases,
  connections,
  copySchemaDiffSql,
  loadDiffDatabases,
  schemaDiffDialog
} = databaseStore

const sourceDatabases = computed(() => connectionDatabases.value[schemaDiffDialog.value.connectionName] || [])
const targetDatabases = computed(() => connectionDatabases.value[schemaDiffDialog.value.targetConnectionName] || [])
const statementsText = computed(() =>
  (schemaDiffDialog.value.result?.statements || []).map((sql) => `${sql};`).join('\n\n')
)

const STATUS_LABELS = {
  missing: '缺失',
  extra: '多余',
  changed: '有差异',
  different: '有差异',
  same: '一致'
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status
}

async function onSourceConnectionChange() {
  schemaDiffDialog.value.database = ''
  schemaDiffDialog.value.result = null
  await loadDiffDatabases(schemaDiffDialog.value.connectionName)
}

async function onTargetConnectionChange() {
  schemaDiffDialog.value.targetDatabase = ''
  schemaDiffDialog.value.result = null
  await loadDiffDatabases(schemaDiffDialog.value.targetConnectionName)
}

watch(
  () => schemaDiffDialog.value.show,
  async (show) => {
    if (show && schemaDiffDialog.value.targetConnectionName) {
      await loadDiffDatabases(schemaDiffDialog.value.targetConnectionName)
    }
  }
)
</script>
