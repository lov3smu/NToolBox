<template>
  <div class="settings-layout">
    <div class="settings-sidebar">
      <div
        v-for="item in menuItems"
        :key="item.id"
        :class="['settings-menu-item', { active: activeTab === item.id }]"
        @click="activeTab = item.id"
      >
        <span class="menu-icon">{{ item.icon }}</span>
        <span class="menu-text">{{ item.text }}</span>
      </div>
    </div>

    <div class="settings-main">
      <div class="settings-content">
        <div v-show="activeTab === 'general'" class="settings-tab">
          <div class="form-group">
            <label>脚本位置</label>
            <div class="path-input-group">
              <input type="text" v-model="basePath" class="input-field" placeholder="脚本存储根目录">
              <button class="btn-small" @click="selectDir">浏览</button>
            </div>
          </div>
          <div class="form-group">
            <label>开发者中文名</label>
            <input type="text" v-model="developerChName" class="input-field" placeholder="用于脚本作者署名">
          </div>
          <div class="form-group">
            <label>开发者英文名</label>
            <input type="text" v-model="developerEnName" class="input-field" placeholder="用于脚本历史记录标识">
          </div>
          <div class="form-group">
            <label>文本编辑器</label>
            <div class="path-input-group">
              <input type="text" v-model="textEditApp" class="input-field" placeholder="编辑器可执行文件路径">
              <button class="btn-small" @click="selectEditor">浏览</button>
            </div>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="autoUpdate"> 有更新时自动更新
            </label>
            <div class="setting-hint">开启后，应用会自动下载并安装新版本</div>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="autoStart"> 开机自动启动
            </label>
            <div class="setting-hint">开启后，系统启动时会自动运行本应用</div>
          </div>
          <div class="form-group">
            <label>关闭行为</label>
            <select v-model="closeAction" class="select-field">
              <option value="ask">每次询问</option>
              <option value="hide">隐藏到托盘</option>
              <option value="quit">直接退出</option>
            </select>
            <div class="setting-hint">选择点击关闭按钮时的默认行为</div>
          </div>
        </div>

        <div v-show="activeTab === 'database'" class="settings-tab">
          <div class="form-group">
            <label>数据库</label>
            <div class="config-list" ref="databaseListRef">
              <div v-for="(db, index) in databases" :key="index" class="config-item">
                <div class="config-item-info">
                  <input
                    type="text"
                    v-model="db.name"
                    class="input-field"
                    placeholder="数据库名"
                    :class="{ error: db.error }"
                  >
                </div>
                <div class="config-item-actions">
                  <button class="btn-small btn-danger" @click="removeDatabase(index)">删除</button>
                </div>
              </div>
            </div>
            <button class="btn-small" @click="addDatabase">+ 添加数据库</button>
          </div>
        </div>

        <div v-show="activeTab === 'scripttype'" class="settings-tab">
          <div class="form-group">
            <label>脚本类型</label>
            <div class="config-list" ref="scriptTypeListRef">
              <div v-for="(st, index) in scriptTypes" :key="index" class="config-item">
                <div class="config-item-info">
                  <input
                    type="text"
                    v-model="st.name"
                    class="input-field"
                    placeholder="名称"
                    style="width: 120px; margin-right: 10px;"
                    :class="{ error: st.error }"
                  >
                  <input
                    type="text"
                    v-model="st.description"
                    class="input-field"
                    placeholder="描述"
                    style="flex: 1;"
                  >
                </div>
                <div class="config-item-actions">
                  <button class="btn-small btn-danger" @click="removeScriptType(index)">删除</button>
                </div>
              </div>
            </div>
            <button class="btn-small" @click="addScriptType">+ 添加脚本类型</button>
          </div>
        </div>

        <div v-show="activeTab === 'shortcuts'" class="settings-tab">
          <div class="form-group">
            <label>快捷键配置</label>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <span class="shortcut-name">密码生成器</span>
                <input type="text" v-model="shortcuts.password" class="input-field shortcut-input" placeholder="快捷键">
              </div>
              <div class="shortcut-item">
                <span class="shortcut-name">Cron表达式生成器</span>
                <input type="text" v-model="shortcuts.cron" class="input-field shortcut-input" placeholder="快捷键">
              </div>
              <div class="shortcut-item">
                <span class="shortcut-name">Unix时间戳互转</span>
                <input type="text" v-model="shortcuts.unixtimestamp" class="input-field shortcut-input" placeholder="快捷键">
              </div>
              <div class="shortcut-item">
                <span class="shortcut-name">YAML编辑(验证)器</span>
                <input type="text" v-model="shortcuts.yamlEditor" class="input-field shortcut-input" placeholder="快捷键">
              </div>
              <div class="shortcut-item">
                <span class="shortcut-name">文件管理器</span>
                <input type="text" v-model="shortcuts.fileManager" class="input-field shortcut-input" placeholder="快捷键">
              </div>
              <div class="shortcut-item">
                <span class="shortcut-name">设置</span>
                <input type="text" v-model="shortcuts.settings" class="input-field shortcut-input" placeholder="快捷键">
              </div>
            </div>
            <div class="setting-hint">格式示例: CmdOrCtrl+P, CmdOrCtrl+Shift+C（留空则不设置快捷键）</div>
          </div>
        </div>

        <div v-show="activeTab === 'about'" class="settings-tab">
          <div class="about-section">
            <div class="about-icon">SQL</div>
            <div class="about-name">SQL Script Generator</div>
            <div class="about-version">版本: {{ version }}</div>
            <div class="about-description">SQL脚本生成工具，用于快速生成符合规范的SQL脚本文件。</div>
            <div class="about-author">作者: {{ author }}</div>
            <div class="about-copyright">{{ year }} {{ author }}. All rights reserved.</div>
            <div class="about-buttons">
              <button class="btn btn-secondary" @click="checkUpdate">检查更新</button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <button class="btn btn-primary" @click="save">保存</button>
        <button class="btn btn-default" @click="closeWindow">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import {
  getConfig,
  getPackageInfo,
  saveConfig,
  selectDirectory,
  selectFile,
  reloadConfig,
  reloadMenu,
  setAutoStart,
  checkForUpdates,
  closeSettingsWindow,
} from '@/api'

const menuItems = [
  { id: 'general', icon: '⚙', text: '通用' },
  { id: 'database', icon: '🗄', text: '数据库' },
  { id: 'scripttype', icon: '📝', text: '脚本类型' },
  { id: 'shortcuts', icon: '⌨', text: '快捷键' },
  { id: 'about', icon: 'ℹ', text: '关于软件' },
]

const activeTab = ref('general')
const basePath = ref('')
const developerChName = ref('')
const developerEnName = ref('')
const textEditApp = ref('')
const autoUpdate = ref(true)
const autoStart = ref(false)
const closeAction = ref('ask')
const databases = ref([])
const scriptTypes = ref([])
const shortcuts = ref({
  password: 'CmdOrCtrl+P',
  cron: 'CmdOrCtrl+Shift+C',
  unixtimestamp: 'CmdOrCtrl+Shift+T',
  yamlEditor: 'CmdOrCtrl+Shift+Y',
  fileManager: 'CmdOrCtrl+Shift+F',
  settings: 'CmdOrCtrl+,'
})
const version = ref('1.0.0')
const author = ref('lov3smu')
const databaseListRef = ref(null)
const scriptTypeListRef = ref(null)

const year = computed(() => new Date().getFullYear())

onMounted(async () => {
  const config = await getConfig()
  basePath.value = config.base_path || ''
  developerChName.value = config.developer_ch_name || ''
  developerEnName.value = config.developer_en_name || ''
  textEditApp.value = config.text_edit_app || ''
  autoUpdate.value = config.auto_update !== false
  autoStart.value = config.auto_start === true
  closeAction.value = config.close_action || 'ask'
  databases.value = (config.databases || []).map(name => ({ name, error: false }))
  scriptTypes.value = (config.script_types || []).map(st => ({ name: st.name, description: st.description || '', error: false }))
  
  if (config.shortcuts) {
    shortcuts.value = { ...shortcuts.value, ...config.shortcuts }
  }

  const packageJson = await getPackageInfo()
  if (packageJson.version) version.value = packageJson.version
  if (packageJson.author) {
    let a = packageJson.author
    a = a.replace(/<[^>]*>/g, '').trim()
    author.value = a
  }
})

async function addDatabase() {
  databases.value.push({ name: '', error: false })
  await nextTick()
  if (databaseListRef.value) {
    const items = databaseListRef.value.querySelectorAll('.config-item')
    const lastItem = items[items.length - 1]
    if (lastItem) {
      lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const input = lastItem.querySelector('input')
      if (input) input.focus()
    }
  }
}

function removeDatabase(index) {
  databases.value.splice(index, 1)
}

async function addScriptType() {
  scriptTypes.value.push({ name: '', description: '', error: false })
  await nextTick()
  if (scriptTypeListRef.value) {
    const items = scriptTypeListRef.value.querySelectorAll('.config-item')
    const lastItem = items[items.length - 1]
    if (lastItem) {
      lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const input = lastItem.querySelector('input')
      if (input) input.focus()
    }
  }
}

function removeScriptType(index) {
  scriptTypes.value.splice(index, 1)
}

async function selectDir() {
  const path = await selectDirectory()
  if (path) basePath.value = path
}

async function selectEditor() {
  const path = await selectFile()
  if (path) textEditApp.value = path
}

function validate() {
  let isValid = true
  let errorMessage = ''

  databases.value.forEach(db => db.error = false)
  scriptTypes.value.forEach(st => st.error = false)

  const dbNames = []
  for (const db of databases.value) {
    const name = db.name.trim()
    if (!name) {
      db.error = true
      isValid = false
      errorMessage = '数据库名称不能为空'
      break
    }
    if (dbNames.includes(name)) {
      db.error = true
      isValid = false
      errorMessage = `数据库名称 "${name}" 重复`
      break
    }
    dbNames.push(name)
  }

  if (!isValid) {
    showError(errorMessage)
    return false
  }

  const typeNames = []
  for (const st of scriptTypes.value) {
    const name = st.name.trim()
    if (!name) {
      st.error = true
      isValid = false
      errorMessage = '脚本类型名称不能为空'
      break
    }
    if (typeNames.includes(name)) {
      st.error = true
      isValid = false
      errorMessage = `脚本类型名称 "${name}" 重复`
      break
    }
    typeNames.push(name)
  }

  if (!isValid) {
    showError(errorMessage)
    return false
  }

  return true
}

function showError(message) {
  const existing = document.querySelector('.error-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = 'error-toast'
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

async function save() {
  if (!validate()) return

  const config = {
    base_path: basePath.value,
    developer_ch_name: developerChName.value,
    developer_en_name: developerEnName.value,
    text_edit_app: textEditApp.value,
    auto_update: autoUpdate.value,
    auto_start: autoStart.value,
    close_action: closeAction.value,
    databases: databases.value.map(db => db.name.trim()).filter(Boolean),
    script_types: scriptTypes.value.map(st => ({
      name: st.name.trim(),
      description: st.description.trim()
    })).filter(st => st.name),
    shortcuts: { ...shortcuts.value },
  }

  try {
    const success = await saveConfig(config)
    if (success) {
      await setAutoStart(autoStart.value)
      await reloadConfig()
      await reloadMenu()
      closeSettingsWindow()
    } else {
      showError('保存失败，请检查配置')
    }
  } catch (e) {
    showError('保存失败: ' + e.message)
  }
}

function closeWindow() {
  closeSettingsWindow()
}

async function checkUpdate() {
  await checkForUpdates(true)
}
</script>

<style scoped>
.settings-layout {
  display: flex;
  width: 900px;
  height: 100vh;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
}

.settings-sidebar {
  width: 160px;
  background: rgba(248, 249, 250, 0.6);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border-right: 1px solid var(--border-color);
  padding: 10px 0;
  flex-shrink: 0;
}

.settings-menu-item {
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  border-left: 3px solid transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 6px;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  transition: all 0.2s;
}

.menu-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.menu-text {
  flex: 1;
  font-weight: 500;
}

.settings-menu-item:hover {
  background: rgba(102, 126, 234, 0.08);
  color: var(--primary-color);
}

.settings-menu-item.active {
  background: rgba(102, 126, 234, 0.12);
  color: var(--primary-color);
  border-left-color: var(--primary-color);
  font-weight: 600;
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.4);
}

.settings-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
}

.settings-tab {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.form-group {
  margin-bottom: 16px;
}

.form-group > label {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  font-size: 14px;
}

.form-group > label input[type="checkbox"] {
  margin-right: 8px;
}

.input-field {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary-color);
}

.input-field.error {
  border-color: #e74c3c;
}

.path-input-group {
  display: flex;
  gap: 10px;
}

.path-input-group .input-field {
  flex: 1;
}

.select-field {
  width: 100%;
  max-width: 300px;
  padding: 10px 14px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  cursor: pointer;
}

.setting-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.config-list {
  margin-bottom: 15px;
  max-height: 350px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.config-item {
  background: rgba(255, 255, 255, 0.7);
  padding: 14px;
  margin-bottom: 10px;
  border-radius: var(--radius-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid rgba(224, 224, 224, 0.5);
  transition: all 0.2s;
  gap: 10px;
}

.config-item:hover {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(102, 126, 234, 0.3);
}

.config-item:last-child {
  margin-bottom: 0;
}

.config-item-info {
  flex: 1;
  display: flex;
  gap: 10px;
  flex-wrap: nowrap;
  align-items: center;
  min-width: 0;
}

.config-item-actions {
  flex-shrink: 0;
}

.settings-footer {
  padding: 15px 20px;
  display: flex;
  gap: 15px;
  border-top: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}

.settings-footer .btn {
  min-width: 100px;
  padding: 12px 24px;
}

.about-section {
  text-align: center;
  padding: 40px 20px;
}

.about-icon {
  font-size: 72px;
  margin-bottom: 20px;
  font-weight: bold;
  color: var(--primary-color);
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
}

.about-name {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.about-version {
  font-size: 14px;
  color: var(--text-tertiary);
  margin-bottom: 20px;
  font-weight: 500;
}

.about-description {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 20px;
  line-height: 1.6;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.about-author {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.about-copyright {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 30px;
}

.about-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.shortcut-list {
  margin-bottom: 15px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.shortcut-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(224, 224, 224, 0.5);
}

.shortcut-item:last-child {
  border-bottom: none;
}

.shortcut-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.shortcut-input {
  width: 180px;
  padding: 8px 12px;
  font-size: 13px;
  text-align: center;
}
</style>