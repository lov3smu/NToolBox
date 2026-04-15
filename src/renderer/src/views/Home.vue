<template>
  <div class="home-container" :style="{ width: windowWidth + 'px' }">
    <header>
      <h1>SQL Script Generator</h1>
      <div class="subtitle">SQL脚本生成工具</div>
    </header>

    <div class="main-content">
      <div class="section">
        <label class="section-label">操作类型</label>
        <div class="button-group">
          <button 
            class="type-btn" 
            :class="{ active: operateType === 'FIX' }"
            @click="setOperateType('FIX')"
          >FIX</button>
          <button 
            class="type-btn" 
            :class="{ active: operateType === 'PUBLISH' }"
            @click="setOperateType('PUBLISH')"
          >PUBLISH</button>
          <button 
            class="type-btn" 
            :class="{ active: operateType === 'QUERY' }"
            @click="setOperateType('QUERY')"
          >QUERY</button>
        </div>
      </div>

      <div class="section">
        <label class="section-label">脚本用途</label>
        <input type="text" v-model="usage" placeholder="请输入脚本用途" class="input-field" @input="updateDirName">
      </div>

      <div class="section">
        <label class="section-label">数据库</label>
        <select v-model="database" class="select-field">
          <option value="">请选择数据库</option>
          <option v-for="db in databases" :key="db" :value="db">{{ db }}</option>
        </select>
      </div>

      <div class="section script-type-section" :class="{ hidden: operateType === 'QUERY' }">
        <label class="section-label">脚本类型</label>
        <select v-model="scriptType" class="select-field">
          <option value="">请选择脚本类型</option>
          <option v-for="type in scriptTypes" :key="type.name" :value="type.name">{{ type.name }} - {{ type.description }}</option>
        </select>
      </div>

      <div class="section">
        <label class="section-label">目录名</label>
        <input type="text" v-model="dirName" placeholder="目录名（留空自动生成）" class="input-field">
      </div>

      <div class="action-buttons">
        <button class="btn btn-primary" :disabled="loading" @click="generate">
          {{ loading ? '生成中...' : '生成脚本' }}
        </button>
        <button class="btn btn-default" @click="openSettings">设置</button>
      </div>

      <div class="result-section" v-if="result" :class="{ 'result-success': result.success, 'result-error': !result.success }">
        <h3>生成结果</h3>
        <div class="result-content" :class="{ 'success': result.success, 'error': !result.success }">
          <template v-if="result.success">
            <div class="success-message">脚本生成成功！</div>
            <div><strong>文件名：</strong> {{ result.filename }}</div>
            <div class="file-path"><strong>文件路径：</strong><br>{{ result.filePath }}</div>
            <div class="result-actions">
              <button class="btn-small" @click="openFile">打开文件</button>
              <button class="btn-small" @click="openFolder">打开文件夹</button>
            </div>
          </template>
          <template v-else>
            <div class="error-message">{{ result.error }}</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWindowWidth, useAutoDirName, useConfig } from '@/composables'
import { generateScript, openFile as apiOpenFile, openFolder as apiOpenFolder, openSettings as apiOpenSettings, onConfigChanged } from '@/api'

const { config } = useConfig()
const windowWidth = useWindowWidth()
const usage = ref('')
const { dirName, updateDirName } = useAutoDirName(usage)

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

function openSettings() {
  apiOpenSettings()
}

onMounted(() => {
  updateDirName(true)
  onConfigChanged(() => updateDirName(true))
})
</script>

<style scoped>
.home-container {
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
}

.home-container header {
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.95) 0%, 
    rgba(118, 75, 162, 0.95) 100%
  );
  color: white;
  padding: 30px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.home-container header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 10% 20%, rgba(255,255,255,0.15) 0%, transparent 20%),
    radial-gradient(circle at 90% 80%, rgba(255,255,255,0.1) 0%, transparent 20%);
  pointer-events: none;
}

.home-container header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 28px;
  margin-bottom: 10px;
  position: relative;
  z-index: 1;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.home-container header .subtitle {
  position: relative;
  z-index: 1;
}

.main-content {
  padding: 30px;
  flex: 1;
  overflow-y: auto;
}

.section {
  margin-bottom: 25px;
}

.script-type-section {
  height: 80px;
  overflow: hidden;
  transition: height 0.3s ease, opacity 0.3s ease;
}

.script-type-section.hidden {
  height: 0;
  margin-bottom: 0;
  opacity: 0;
}

.section-label {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  font-size: 14px;
}

.button-group {
  display: flex;
  gap: 12px;
}

.type-btn {
  flex: 1;
  padding: 14px 16px;
  border: 2px solid var(--border-color);
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: var(--transition-normal);
  outline: none;
}

.type-btn:focus {
  outline: none;
}

.type-btn:hover {
  border-color: var(--primary-color);
  background: var(--glass-bg-hover);
}

.type-btn.active {
  background: var(--primary-gradient);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.input-field, .select-field {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: var(--glass-bg);
  color: var(--text-primary);
}

.input-field:focus, .select-field:focus {
  outline: none;
  border-color: var(--primary-color);
}

.action-buttons {
  display: flex;
  gap: 15px;
  margin-top: 30px;
}

.action-buttons .btn {
  flex: 1;
}

.result-section {
  margin-top: 30px;
  padding: 24px;
  background: rgba(248, 249, 250, 0.6);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.result-section h3 {
  margin-bottom: 15px;
  font-size: 16px;
}

.result-content {
  font-size: 14px;
  line-height: 1.8;
}

.result-success {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.1);
}

.success-message {
  color: #15803d;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 15px;
}

.file-path {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.05);
  padding: 10px;
  border-radius: var(--radius-sm);
  margin-top: 10px;
  color: var(--text-secondary);
  word-break: break-all;
}

.result-error {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
}

.error-message {
  color: #dc2626;
  font-size: 16px;
  font-weight: 600;
}

.result-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

.btn-small {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary-gradient);
  color: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>