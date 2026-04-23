<template>
  <div
    class="dashboard-container"
    :style="{ width: windowWidth + 'px' }"
  >
    <header class="dashboard-header">
      <div class="logo-section">
        <div class="logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <ellipse
              cx="12"
              cy="5"
              rx="9"
              ry="3"
            />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        </div>
        <div class="title-section">
          <h1>SQL Script Generator</h1>
          <p class="subtitle">
            开发工具集 - 提升开发效率的实用工具箱
          </p>
        </div>
      </div>
      <div
        class="search-trigger"
        @click="$emit('openSearch')"
      >
        <svg
          class="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle
            cx="11"
            cy="11"
            r="8"
          />
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
          <p>SQL Script Generator 是一款专为开发者设计的实用工具集，旨在提升日常开发效率。</p>
          <p>集成了 SQL 脚本生成、AI 聊天助手、密码生成、时间戳转换、JSON 格式化等常用工具，帮助您快速完成重复性工作。</p>
        </div>
      </section>

      <section class="tools-section">
        <h2>工具快捷入口</h2>
        <div class="tools-grid">
          <div
            v-for="tool in tools"
            :key="tool.path"
            class="tool-card"
            @click="navigateTo(tool.path)"
          >
            <div
              class="tool-icon"
              v-html="tool.icon"
            />
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
            <div class="shortcut-desc">
              打开全局搜索
            </div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>L</kbd>
            </div>
            <div class="shortcut-desc">
              打开AI聊天助手
            </div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>P</kbd>
            </div>
            <div class="shortcut-desc">
              打开密码生成器
            </div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>,</kbd>
            </div>
            <div class="shortcut-desc">
              打开设置
            </div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Esc</kbd>
            </div>
            <div class="shortcut-desc">
              关闭弹窗/搜索
            </div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>↑</kbd>
              <span>/</span>
              <kbd>↓</kbd>
            </div>
            <div class="shortcut-desc">
              在搜索结果中导航
            </div>
          </div>
          <div class="shortcut-item">
            <div class="shortcut-keys">
              <kbd>Enter</kbd>
            </div>
            <div class="shortcut-desc">
              选择当前工具
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="dashboard-footer">
      <p>SQL Script Generator v1.0.7</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { openSettings } from '@/api'

const emit = defineEmits(['openSearch'])
const router = useRouter()

const windowWidth = ref(window.innerWidth)

function updateWidth() {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  updateWidth()
  window.addEventListener('resize', updateWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth)
})

const tools = [
  {
    name: 'SQL脚本生成',
    description: '快速生成规范化的SQL脚本文件',
    path: '/sql-generator',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`
  },
  {
    name: 'AI聊天助手',
    description: '智能对话，解答编程问题',
    path: '/chat',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>`
  },
  {
    name: '密码生成',
    description: '生成安全的随机密码',
    path: '/password',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`
  },
  {
    name: 'Cron表达式',
    description: '可视化的Cron表达式生成器',
    path: '/cron',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`
  },
  {
    name: '时间戳转换',
    description: 'Unix时间戳与日期互转',
    path: '/unixtimestamp',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`
  },
  {
    name: 'YAML编辑器',
    description: 'YAML格式编辑与校验',
    path: '/yaml-editor',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>`
  },
  {
    name: '文件管理',
    description: '便捷的文件管理工具',
    path: '/file-manager',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>`
  },
  {
    name: 'JSON解析',
    description: 'JSON格式化与校验工具',
    path: '/json-parser',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <polyline points="4 17 4 20 20 20 20 17"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>`
  },
  {
    name: 'HTML预览',
    description: 'HTML代码实时预览',
    path: '/html-viewer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>`
  },
  {
    name: '数据库管理',
    description: 'MySQL数据库连接与管理',
    path: '/database',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`
  },
  {
    name: '设置',
    description: '应用程序配置',
    path: 'settings',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`
  }
]

function navigateTo(path) {
  if (path === 'settings') {
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
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.95) 0%, 
    rgba(118, 75, 162, 0.95) 100%
  );
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
    radial-gradient(circle at 10% 20%, rgba(255,255,255,0.15) 0%, transparent 20%),
    radial-gradient(circle at 90% 80%, rgba(255,255,255,0.1) 0%, transparent 20%);
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
}

.logo svg {
  width: 28px;
  height: 28px;
}

.title-section h1 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.title-section .subtitle {
  font-size: 13px;
  opacity: 0.9;
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
  width: 18px;
  height: 18px;
  opacity: 0.8;
}

.search-trigger span:first-of-type {
  font-size: 14px;
  opacity: 0.9;
}

.search-trigger .shortcut {
  font-size: 12px;
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
  font-size: 18px;
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
  width: 48px;
  height: 48px;
  background: var(--primary-gradient);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tool-icon svg {
  width: 24px;
  height: 24px;
  color: white;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.tool-desc {
  font-size: 13px;
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
  font-size: 12px;
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
  font-size: 12px;
}

.shortcut-desc {
  font-size: 14px;
  color: var(--text-secondary);
}

.dashboard-footer {
  padding: 20px 40px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 12px;
  border-top: 1px solid var(--border-color);
}
</style>