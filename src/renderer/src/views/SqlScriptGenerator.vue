<template>
  <PageLayout tool-path="/sql-generator">
    <template #actions>
      <TabBar
        :model-value="operateType"
        :tabs="operateTabs"
        aria-label="脚本操作类型"
        @update:model-value="setOperateType"
      />
      <span class="toolbar-sep" />
      <button class="btn btn-primary btn-sm" :disabled="loading" @click="generate">
        {{ loading ? '生成中...' : '生成脚本' }}
      </button>
    </template>

    <div class="page-body">
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">脚本信息</span>
        </div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field">
              <label>脚本用途</label>
              <input
                v-model="usage"
                type="text"
                placeholder="请输入脚本用途"
                class="input-field"
                @input="updateDirName"
              />
            </div>
            <div class="field">
              <label>数据库</label>
              <select v-model="database" class="select-field">
                <option value="">请选择数据库</option>
                <option v-for="db in databases" :key="db" :value="db">
                  {{ db }}
                </option>
              </select>
            </div>
            <div v-if="operateType !== 'QUERY'" class="field">
              <label>脚本类型</label>
              <select v-model="scriptType" class="select-field">
                <option value="">请选择脚本类型</option>
                <option v-for="type in scriptTypes" :key="type.name" :value="type.name">
                  {{ type.name }} - {{ type.description }}
                </option>
              </select>
            </div>
            <div class="field">
              <label>目录名</label>
              <input v-model="dirName" type="text" placeholder="留空自动生成" class="input-field" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="result" class="panel result-panel" :class="result.success ? 'is-success' : 'is-error'">
        <div class="panel-header">
          <span class="panel-title">生成结果</span>
        </div>
        <div class="panel-body">
          <template v-if="result.success">
            <div class="result-message success">脚本生成成功</div>
            <div class="result-row"><span class="result-label">文件名</span>{{ result.filename }}</div>
            <div class="result-row">
              <span class="result-label">文件路径</span><code>{{ result.filePath }}</code>
            </div>
            <div class="result-actions">
              <button class="btn btn-secondary btn-sm" @click="openFile">打开文件</button>
              <button class="btn btn-secondary btn-sm" @click="openFolder">打开文件夹</button>
            </div>
          </template>
          <div v-else class="result-message error">{{ result.error }}</div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAutoDirName, useConfig } from '@/composables'
import PageLayout from '@/layouts/PageLayout.vue'
import TabBar from '@/components/TabBar.vue'
import { generateScript, openFile as apiOpenFile, openFolder as apiOpenFolder } from '@/api'

const { config } = useConfig()
const usage = ref('')
const { dirName, updateDirName } = useAutoDirName(usage)

const operateTabs = [
  { key: 'FIX', label: 'FIX' },
  { key: 'PUBLISH', label: 'PUBLISH' },
  { key: 'QUERY', label: 'QUERY' }
]

const operateType = ref('PUBLISH')
const database = ref('')
const scriptType = ref('')
const loading = ref(false)
const result = ref(null)

const databases = computed(() => config.value?.databases || [])
const scriptTypes = computed(() => config.value?.script_types || [])

function setOperateType(type) {
  operateType.value = type
  updateDirName(true)
}

async function generate() {
  if (!usage.value.trim()) {
    result.value = { success: false, error: '请输入脚本用途' }
    return
  }
  if (!database.value) {
    result.value = { success: false, error: '请选择数据库' }
    return
  }
  if (operateType.value !== 'QUERY' && !scriptType.value) {
    result.value = { success: false, error: '请选择脚本类型' }
    return
  }

  let finalDirName = dirName.value.trim()
  if (!finalDirName) {
    const now = new Date()
    const monthDay = now.toISOString().slice(5, 10).replace(/-/g, '')
    finalDirName = usage.value.trim() ? `${monthDay}-${usage.value.trim()}` : `${monthDay}-脚本`
    dirName.value = finalDirName
  }

  loading.value = true
  result.value = null

  try {
    const res = await generateScript({
      operateType: operateType.value,
      usage: usage.value.trim(),
      database: database.value,
      scriptType: scriptType.value,
      dirName: finalDirName
    })
    result.value = res
  } catch (e) {
    result.value = { success: false, error: e.message }
  } finally {
    loading.value = false
  }
}

async function openFile() {
  if (result.value?.filePath) {
    await apiOpenFile(result.value.filePath)
  }
}

async function openFolder() {
  if (result.value?.targetPath) {
    await apiOpenFolder(result.value.targetPath)
  }
}

onMounted(() => {
  updateDirName(true)
})

watch(config, () => updateDirName(true))
</script>

<style scoped>
.page-body {
  padding: 12px 16px 16px;
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
}

.result-panel {
  margin-top: 12px;
}

.result-panel.is-success .panel-header {
  color: var(--success-dark);
}

.result-panel.is-error .panel-header {
  color: var(--error-dark);
}

.result-message {
  font-size: var(--font-size-sm);
  font-weight: 600;
  margin-bottom: 10px;
}

.result-message.success {
  color: var(--success-dark);
}

.result-message.error {
  color: var(--error-dark);
}

.result-row {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.result-label {
  width: 64px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.result-row code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  word-break: break-all;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

@media (max-width: 860px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
