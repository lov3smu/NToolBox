<template>
  <div class="dashboard-container" :style="{ width: windowWidth + 'px' }">
    <header class="dashboard-header">
      <div class="logo-section">
        <div class="logo">
          <img :src="iconUrl" alt="NToolBox Logo" />
        </div>
        <div class="title-section">
          <h1>NToolBox</h1>
          <p class="subtitle">多端工具集合平台 · 启动快 · 功能全 · 更智能</p>
        </div>
      </div>
      <div class="search-trigger" @click="$emit('openSearch')">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span>搜索工具...</span>
        <span class="shortcut">Ctrl K</span>
      </div>
    </header>

    <main class="dashboard-main">
      <section class="intro-section">
        <h2>工具介绍</h2>
        <div class="intro-content">
          <p>NToolBox 是一款面向开发人员的多端工具集合平台，集成丰富工具 + AI 大模型能力，启动快、功能全、更智能。</p>
          <p>
            内置 SQL 脚本生成、AI 聊天助手、数据库管理、密码生成、时间戳转换、JSON 格式化、Cron 表达式、YAML
            编辑器等多种实用工具，集成多款主流 AI 大模型，助力提升开发效率。
          </p>
        </div>
      </section>

      <section class="tools-section">
        <h2>工具快捷入口</h2>
        <div class="tools-grid">
          <div v-for="tool in tools" :key="tool.path" class="tool-card" @click="navigateTo(tool.path)">
            <div class="tool-icon" v-html="tool.icon" />
            <div class="tool-info">
              <div class="tool-name">
                {{ tool.name }}
              </div>
              <div class="tool-desc">
                {{ tool.description }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="shortcuts-section">
        <h2>快捷键说明</h2>
        <div class="shortcuts-list">
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>K</kbd>
            </div>
            <div class="shortcut-desc">打开全局搜索</div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>L</kbd>
            </div>
            <div class="shortcut-desc">打开AI聊天助手</div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>P</kbd>
            </div>
            <div class="shortcut-desc">打开密码生成器</div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>,</kbd>
            </div>
            <div class="shortcut-desc">打开设置</div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Esc</kbd>
            </div>
            <div class="shortcut-desc">关闭弹窗/搜索</div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>↑</kbd>
              <span>/</span>
              <kbd>↓</kbd>
            </div>
            <div class="shortcut-desc">在搜索结果中导航</div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Enter</kbd>
            </div>
            <div class="shortcut-desc">选择当前工具</div>
          </div>
        </div>
      </section>
    </main>

    <footer class="dashboard-footer">
      <p>NToolBox v{{ version }}</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { openSettings, getPackageInfo } from '@/api'
import { dashboardTools, SETTINGS_PATH } from '@shared/tools'
import iconUrl from '@assets/icon.png'

defineEmits(['openSearch'])
const router = useRouter()

const windowWidth = ref(window.innerWidth)
const version = ref('1.0.0')

function updateWidth() {
  windowWidth.value = window.innerWidth
}

async function loadVersion() {
  const info = await getPackageInfo()
  if (info.version) {
    version.value = info.version
  }
}

onMounted(() => {
  updateWidth()
  loadVersion()
  window.addEventListener('resize', updateWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth)
})

const tools = dashboardTools

function navigateTo(path) {
  if (path === SETTINGS_PATH) {
    openSettings()
  } else {
    router.push(path)
  }
}
</script>

<style scoped>
.dashboard-container {
  width: 100%;
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.dashboard-header {
  background: var(--primary-gradient);
  color: white;
  padding: 30px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}

.dashboard-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.15) 0%, transparent 20%),
    radial-gradient(circle at 90% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 20%);
  pointer-events: none;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.logo {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.title-section h1 {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin-bottom: 4px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.title-section .subtitle {
  font-size: var(--font-size-sm);
  opacity: 1;
}

.search-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-normal);
  position: relative;
  z-index: 1;
}

.search-trigger:hover {
  background: rgba(255, 255, 255, 0.25);
}

.search-trigger .search-icon {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  opacity: 0.8;
}

.search-trigger span:first-of-type {
  font-size: var(--font-size-base);
}

.search-trigger .shortcut {
  font-size: var(--font-size-sm);
  background: rgba(0, 0, 0, 0.15);
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.dashboard-main {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
}

.dashboard-main section {
  margin-bottom: 40px;
}

.dashboard-main h2 {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard-main h2::before {
  content: '';
  width: 4px;
  height: 20px;
  background: var(--primary-gradient);
  border-radius: 2px;
}

.intro-content {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 24px;
  line-height: 1.8;
  font-size: var(--font-size-base);
  color: var(--text-secondary);
}

.intro-content p {
  margin-bottom: 8px;
}

.intro-content p:last-child {
  margin-bottom: 0;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-normal);
}

.tool-card:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.tool-icon {
  width: var(--icon-size-xl);
  height: var(--icon-size-xl);
  background: var(--primary-gradient);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tool-icon svg {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  color: white;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.tool-desc {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.shortcuts-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 6px;
}

.shortcut-keys kbd {
  display: inline-block;
  padding: 5px 10px;
  font-size: var(--font-size-sm);
  font-family: 'Consolas', 'Monaco', monospace;
  background: var(--primary-gradient);
  color: white;
  border-radius: var(--radius-sm);
  font-weight: 500;
  min-width: 28px;
  text-align: center;
}

.shortcut-keys span {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.shortcut-desc {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
}

.dashboard-footer {
  padding: 20px 40px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  border-top: 1px solid var(--border-color);
}
</style>
