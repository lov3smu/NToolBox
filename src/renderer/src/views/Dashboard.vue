<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div class="dashboard-heading">
        <span class="dashboard-eyebrow">{{ t('NToolBox 工作台') }}</span>
        <h1>{{ greeting }}</h1>
        <p>{{ t('{date} · {count} 个工具随时可用', { date: dateText, count: tools.length }) }}</p>
      </div>
      <div class="dashboard-header-actions">
        <button type="button" class="dash-search" @click="emit('open-search')">
          <span class="dash-search-icon" v-html="SEARCH_ICON" />
          <span>{{ t('搜索工具') }}</span>
          <kbd>{{ searchShortcut }}</kbd>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" @click="navigateTo(MARKET_PATH)">
          <span class="btn-inline-icon" v-html="marketTool.icon" />
          {{ t('扩展') }}
        </button>
        <button type="button" class="btn btn-secondary btn-sm" @click="navigateTo(SETTINGS_PATH)">
          <span class="btn-inline-icon" v-html="SETTINGS_ICON" />
          {{ t('设置') }}
        </button>
      </div>
    </header>

    <main class="dashboard-main">
      <section class="hero-panel">
        <span class="hero-glow" aria-hidden="true" />
        <div class="hero-copy">
          <span class="hero-badge">{{ t('一站式开发工具箱') }}</span>
          <h2>{{ t('常用工具，一个入口就够了') }}</h2>
          <p>{{ t('AI 助手、数据库客户端、图床与内容排版，开发日常在一个窗口完成。') }}</p>
          <div class="hero-tags">
            <span class="hero-tag">{{ t('Agent 闭环') }}</span>
            <span class="hero-tag">{{ t('多模型 AI') }}</span>
            <span class="hero-tag">{{ t('MCP 连接器') }}</span>
            <span class="hero-tag">{{ t('中英双语') }}</span>
          </div>
          <div class="hero-actions">
            <button type="button" class="btn btn-primary" @click="navigateTo('/chat')">{{ t('打开 AI 助手') }}</button>
            <button type="button" class="btn btn-secondary" @click="navigateTo('/database')">
              {{ t('数据库客户端') }}
            </button>
            <button type="button" class="btn btn-secondary" @click="navigateTo('/wechat-formatter')">
              {{ t('开始文章排版') }}
            </button>
          </div>
        </div>
        <button type="button" class="hero-continue" @click="navigateTo(heroTool.path)">
          <span class="hero-continue-label">{{ recentTools.length ? t('继续上次使用') : t('推荐上手') }}</span>
          <span class="hero-continue-main">
            <span class="hero-continue-icon" v-html="heroTool.icon" />
            <span class="hero-continue-info">
              <strong>{{ t(heroTool.name) }}</strong>
              <span>{{ t(heroTool.description) }}</span>
            </span>
            <span class="hero-continue-arrow" v-html="ARROW_ICON" />
          </span>
        </button>
      </section>

      <section class="stats-section">
        <div class="stats-grid">
          <button
            v-for="stat in stats"
            :key="stat.key"
            type="button"
            class="stat-card"
            :class="stat.tone"
            :title="stat.actionLabel"
            @click="stat.action()"
          >
            <span class="stat-icon" v-html="stat.icon" />
            <div class="stat-info">
              <span class="stat-label">{{ stat.label }}</span>
              <span class="stat-value">{{ stat.value }}</span>
              <span class="stat-hint">{{ stat.hint }}</span>
            </div>
          </button>
        </div>
      </section>

      <section class="picks-section">
        <div class="section-head">
          <h2>{{ t('精选工具') }}</h2>
          <span class="section-meta">{{ t('创作、调试与素材管理，一步直达') }}</span>
        </div>
        <div class="picks-grid">
          <button v-for="tool in picks" :key="tool.path" type="button" class="pick-card" @click="navigateTo(tool.path)">
            <span class="pick-icon" v-html="tool.icon" />
            <span class="pick-body">
              <span class="pick-name">{{ t(tool.name) }}</span>
              <span class="pick-desc">{{ t(tool.description) }}</span>
            </span>
            <span class="pick-arrow" v-html="ARROW_ICON" />
          </button>
        </div>
      </section>

      <section class="recent-section">
        <div class="section-head">
          <h2>{{ t('最近使用') }}</h2>
          <span class="section-count">{{ recentTools.length }}</span>
          <span class="section-meta">{{ t('最多保留 {count} 个', { count: recentLimit }) }}</span>
        </div>
        <div v-if="recentTools.length" class="recent-grid">
          <button
            v-for="tool in recentTools"
            :key="tool.path"
            type="button"
            class="recent-card"
            @click="navigateTo(tool.path)"
          >
            <span class="recent-icon" v-html="tool.icon" />
            <span class="recent-info">
              <span class="recent-name">{{ t(tool.name) }}</span>
              <span class="recent-desc">{{ t(tool.description) }}</span>
            </span>
            <kbd v-if="toolShortcut(tool)" class="tool-kbd">{{ toolShortcut(tool) }}</kbd>
          </button>
        </div>
        <div v-else class="recent-empty">
          <span>{{ t('暂无最近使用记录') }}</span>
          <span>{{ t('从下方选择一个工具开始使用吧') }}</span>
          <button type="button" class="btn btn-secondary btn-sm recent-empty-action" @click="emit('open-search')">
            {{ t('搜索工具') }}
          </button>
        </div>
      </section>

      <section v-for="group in toolGroups" :key="group.key" class="tools-section">
        <div class="section-head">
          <h2>{{ group.title }}</h2>
          <span class="section-count">{{ group.tools.length }}</span>
          <span class="section-meta">{{ group.description }}</span>
        </div>
        <div class="tools-grid">
          <button
            v-for="tool in group.tools"
            :key="tool.path"
            type="button"
            class="tool-card"
            @click="navigateTo(tool.path)"
          >
            <div class="tool-icon" v-html="tool.icon" />
            <div class="tool-info">
              <div class="tool-name">
                {{ t(tool.name) }}
              </div>
              <div class="tool-desc">
                {{ t(tool.description) }}
              </div>
            </div>
            <kbd v-if="toolShortcut(tool)" class="tool-kbd">{{ toolShortcut(tool) }}</kbd>
          </button>
        </div>
      </section>
    </main>

    <footer class="dashboard-footer">
      <span class="footer-brand">
        <span class="footer-dot" />
        NToolBox v{{ version }} · {{ platformLabel }}
      </span>
      <span class="footer-meta">{{
        t('{count} 个工具 · {shortcut} 搜索 · Esc 关闭弹窗', { count: tools.length, shortcut: searchShortcut })
      }}</span>
      <span class="footer-meta">{{ new Date().getFullYear() }}</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getConfig, getPackageInfo, onConfigChanged, openSettings, platform, skillsList } from '@/api'
import { t, getLocale } from '@/i18n'
import {
  MARKET_PATH,
  SETTINGS_PATH,
  addToRecent,
  dashboardTools,
  getRecentTools,
  getToolAccelerator,
  normalizeRecentToolsLimit,
  setRecentToolsLimit,
  tools as allTools
} from '@shared/tools'
import { DEFAULT_SHORTCUT_ACTIONS } from '@shared/shortcutActions'

const emit = defineEmits(['open-search'])

const TOOL_GROUPS = [
  {
    key: 'primary',
    get title() {
      return t('核心工具')
    },
    get description() {
      return t('高频使用的开发与 AI 工具')
    }
  },
  {
    key: 'utilities',
    get title() {
      return t('日常工具')
    },
    get description() {
      return t('转换、生成与内容处理')
    }
  },
  {
    key: ['file', 'settings'],
    get title() {
      return t('文件与系统')
    },
    get description() {
      return t('文件管理与应用设置')
    }
  }
]
const PICK_TOOL_PATHS = ['/image-hosting', '/markdown-editor', '/json-parser', '/clipboard']

const SEARCH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="11" cy="11" r="7"/>
  <line x1="20" y1="20" x2="16.65" y2="16.65"/>
</svg>`

const SETTINGS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>`

const ARROW_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M5 12h14M13 6l6 6-6 6"/>
</svg>`

const router = useRouter()
const isMac = platform === 'darwin'

const version = ref('1.0.0')
const config = ref({})
const recentTools = ref([])
const skills = ref([])

const tools = dashboardTools
const marketTool = allTools.find((tool) => tool.path === MARKET_PATH)
const picks = computed(() => PICK_TOOL_PATHS.map((path) => tools.find((tool) => tool.path === path)).filter(Boolean))
const recentLimit = computed(() => normalizeRecentToolsLimit(config.value?.app?.recent_tools_limit))

const toolGroups = computed(() =>
  TOOL_GROUPS.map((group) => {
    const keys = Array.isArray(group.key) ? group.key : [group.key]
    return {
      ...group,
      title: t(group.title),
      description: t(group.description),
      tools: tools.filter((tool) => keys.includes(tool.menuGroup))
    }
  }).filter((group) => group.tools.length > 0)
)

const connectionCount = computed(() => (config.value?.database?.connections || []).length)
const connectorCount = computed(
  () => (config.value?.extensions?.mcp_servers || []).filter((server) => server && server.enabled !== false).length
)
const aiProviderCount = computed(
  () => Object.values(config.value?.ai?.keys || {}).filter((key) => typeof key === 'string' && key.trim()).length
)

const skillSummary = computed(() => {
  const builtin = skills.value.filter((skill) => skill.builtin).length
  return { total: skills.value.length, builtin, installed: skills.value.length - builtin }
})

const heroTool = computed(
  () => recentTools.value[0] || tools.find((tool) => tool.path === '/wechat-formatter') || tools[0]
)

const stats = computed(() => [
  {
    key: 'tools',
    label: t('可用工具'),
    value: tools.length,
    hint: t('{count} 个分类', { count: toolGroups.value.length }),
    tone: 'accent',
    actionLabel: t('搜索工具'),
    action: () => emit('open-search'),
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>`
  },
  {
    key: 'skills',
    label: t('可用技能'),
    value: skillSummary.value.total,
    hint: skillSummary.value.total
      ? t('内置 {builtin} · 已安装 {installed}', {
          builtin: skillSummary.value.builtin,
          installed: skillSummary.value.installed
        })
      : t('前往扩展市场安装'),
    tone: 'info',
    actionLabel: t('管理技能'),
    action: () => openSettings('extensions'),
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m12 2 9 5-9 5-9-5 9-5z"/>
      <path d="m3 12 9 5 9-5"/>
      <path d="m3 17 9 5 9-5"/>
    </svg>`
  },
  {
    key: 'connectors',
    label: t('MCP 连接器'),
    value: connectorCount.value,
    hint: connectorCount.value ? t('已启用的连接器') : t('前往扩展管理添加'),
    tone: 'success',
    actionLabel: t('管理连接器'),
    action: () => openSettings('extensions'),
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 7V3M15 7V3"/>
      <path d="M7 7h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5z"/>
      <path d="M12 16v5"/>
    </svg>`
  },
  {
    key: 'database',
    label: t('数据库连接'),
    value: connectionCount.value,
    hint: connectionCount.value ? t('已保存的连接') : t('尚未添加连接'),
    tone: 'warning',
    actionLabel: t('打开数据库客户端'),
    action: () => router.push('/database'),
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`
  },
  {
    key: 'ai',
    label: t('模型服务商'),
    value: aiProviderCount.value,
    hint: aiProviderCount.value ? t('已配置服务商') : t('前往设置配置'),
    tone: 'neutral',
    actionLabel: t('配置模型服务商'),
    action: () => openSettings('api'),
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>
    </svg>`
  }
])

const platformLabel = computed(() => {
  return { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[platform] || 'Web'
})

const searchShortcut = computed(() =>
  formatAccelerator(config.value?.app?.shortcuts?.global_search || DEFAULT_SHORTCUT_ACTIONS.global_search)
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 5) return t('夜深了')
  if (hour < 9) return t('早上好')
  if (hour < 12) return t('上午好')
  if (hour < 14) return t('中午好')
  if (hour < 18) return t('下午好')
  return t('晚上好')
})

const dateText = computed(() =>
  new Intl.DateTimeFormat(getLocale() === 'en-US' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date())
)

function toolAccelerator(tool) {
  return getToolAccelerator(tool, config.value?.app?.shortcuts || {})
}

function toolShortcut(tool) {
  return formatAccelerator(toolAccelerator(tool))
}

function acceleratorTokens(accelerator) {
  if (!accelerator) return []
  return accelerator
    .split('+')
    .map((token) => {
      if (!isMac) return token === 'CmdOrCtrl' ? 'Ctrl' : token
      return token
        .replace('CmdOrCtrl', '⌘')
        .replace('Command', '⌘')
        .replace('Alt', '⌥')
        .replace('Shift', '⇧')
        .replace('Ctrl', '⌃')
    })
    .filter(Boolean)
}

function formatAccelerator(accelerator) {
  const tokens = acceleratorTokens(accelerator)
  return tokens.join(isMac ? '' : '+')
}

function navigateTo(path) {
  const tool = tools.find((item) => item.path === path)
  if (tool) addToRecent(tool)

  if (path === SETTINGS_PATH) {
    openSettings()
  } else {
    router.push(path)
  }
}

let removeConfigListener = null

onMounted(async () => {
  recentTools.value = getRecentTools()

  const [info, savedConfig, skillList] = await Promise.all([
    getPackageInfo(),
    getConfig(),
    skillsList().catch(() => [])
  ])
  if (info?.version) {
    version.value = info.version
  }
  if (savedConfig) {
    config.value = savedConfig
  }
  if (Array.isArray(skillList)) {
    skills.value = skillList
  }

  removeConfigListener = onConfigChanged(async () => {
    const nextConfig = await getConfig()
    if (nextConfig) config.value = nextConfig
    setRecentToolsLimit(nextConfig?.app.recent_tools_limit)
    recentTools.value = getRecentTools()
  })
})

onUnmounted(() => {
  removeConfigListener?.()
})
</script>

<style scoped>
.dashboard-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dashboard-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 20px;
  background: var(--app-header-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
}

.dashboard-heading {
  flex: 1;
  min-width: 0;
}

.dashboard-eyebrow {
  display: inline-block;
  margin-bottom: 4px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--accent-color);
  text-transform: uppercase;
}

.dashboard-heading h1 {
  margin: 0 0 3px;
  font-size: var(--font-size-xl);
  font-weight: 650;
  line-height: 1.2;
  color: var(--text-primary);
}

.dashboard-heading p {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.dashboard-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dash-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--control-height);
  padding: 0 8px 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.dash-search:hover {
  color: var(--text-primary);
  border-color: rgba(var(--accent-rgb), 0.4);
  background: var(--surface-hover);
}

.dash-search-icon {
  display: flex;
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  color: var(--text-tertiary);
}

.dash-search kbd {
  padding: 2px 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: calc(10px * var(--font-scale));
  color: var(--text-tertiary);
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.btn-inline-icon {
  display: inline-flex;
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
  margin-right: 5px;
  vertical-align: -2px;
}

.tool-card:focus-visible,
.recent-card:focus-visible,
.stat-card:focus-visible,
.pick-card:focus-visible,
.hero-continue:focus-visible,
.dash-search:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.dashboard-main {
  flex: 1;
  min-height: 0;
  padding: 16px 20px 20px;
  overflow-y: auto;
}

.dashboard-main section {
  margin-bottom: 26px;
}

.dashboard-main section:last-child {
  margin-bottom: 0;
}

.hero-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 8% 12%, rgba(var(--accent-rgb), 0.24), transparent 46%),
    linear-gradient(135deg, rgba(var(--accent-rgb), 0.14), rgba(var(--accent-rgb), 0.03));
  border: 1px solid rgba(var(--accent-rgb), 0.24);
  border-radius: var(--radius-lg);
}

.hero-glow {
  position: absolute;
  right: -60px;
  bottom: -90px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--accent-rgb), 0.22), transparent 70%);
  pointer-events: none;
}

.hero-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.hero-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.hero-copy h2 {
  margin: 10px 0 6px;
  font-size: calc(22px * var(--font-scale));
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-primary);
}

.hero-copy p {
  max-width: 480px;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--text-secondary);
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.hero-tag {
  padding: 2px 8px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 999px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.hero-continue {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  width: 278px;
  padding: 12px 14px;
  text-align: left;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-md);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: var(--transition-fast);
}

.hero-continue:hover {
  background: var(--glass-bg-hover);
  border-color: rgba(var(--accent-rgb), 0.45);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.hero-continue-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.hero-continue-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.hero-continue-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--primary-gradient);
  color: var(--text-inverse);
}

.hero-continue-icon :deep(svg) {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.hero-continue-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.hero-continue-info strong {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-continue-info span {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-continue-arrow,
.pick-arrow {
  display: flex;
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: var(--transition-fast);
}

.hero-continue:hover .hero-continue-arrow,
.pick-card:hover .pick-arrow {
  color: var(--accent-color);
  transform: translateX(2px);
}

.stats-section {
  container-type: inline-size;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.stat-card:hover {
  border-color: rgba(var(--accent-rgb), 0.32);
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon :deep(svg) {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.stat-card.accent .stat-icon {
  color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.12);
}

.stat-card.success .stat-icon {
  color: var(--success-color);
  background: rgba(var(--success-rgb), 0.12);
}

.stat-card.warning .stat-icon {
  color: var(--warning-color);
  background: rgba(var(--warning-rgb), 0.14);
}

.stat-card.neutral .stat-icon {
  color: var(--neutral-color);
  background: rgba(var(--neutral-rgb), 0.14);
}

.stat-card.info .stat-icon {
  color: var(--info-color);
  background: rgba(var(--info-rgb), 0.12);
}

.stat-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.stat-value {
  font-size: var(--font-size-xl);
  font-weight: 650;
  line-height: 1.2;
  color: var(--text-primary);
}

.stat-hint {
  font-size: var(--font-size-xs);
  line-height: 1.35;
  color: var(--text-tertiary);
  word-break: keep-all;
}

/* 容器无法容纳五张等宽卡片时改为 3+2 两行，避免第五张卡片单独落单 */
@container (max-width: 852px) {
  .stats-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .stat-card {
    grid-column: span 2;
  }

  .stat-card:nth-child(4),
  .stat-card:nth-child(5) {
    grid-column: span 3;
  }
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}

.section-head h2 {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 1px 6px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
  border-radius: 999px;
}

.section-meta {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.picks-section {
  container-type: inline-size;
}

.picks-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@container (min-width: 996px) {
  .picks-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.pick-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.09), transparent 70%), var(--panel);
  border: 1px solid rgba(var(--accent-rgb), 0.22);
  border-radius: var(--radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.pick-card:hover {
  border-color: rgba(var(--accent-rgb), 0.48);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.pick-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--primary-gradient);
  color: var(--text-inverse);
}

.pick-icon :deep(svg) {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.pick-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.pick-name {
  margin-bottom: 3px;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pick-desc {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.recent-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.recent-card:hover {
  background: var(--surface);
  border-color: rgba(var(--accent-rgb), 0.4);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.recent-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-inverse);
}

.recent-icon :deep(svg) {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
}

.recent-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.recent-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-desc {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  background: var(--content-bg);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
}

.recent-empty-action {
  margin-top: 8px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: var(--panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.tool-card:hover {
  background: var(--surface);
  border-color: rgba(var(--accent-rgb), 0.4);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.tool-icon {
  width: 40px;
  height: 40px;
  background: var(--primary-gradient);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-inverse);
  transition: var(--transition-fast);
}

.tool-icon :deep(svg) {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-desc {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-kbd {
  flex-shrink: 0;
  padding: 2px 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: calc(10px * var(--font-scale));
  color: var(--text-tertiary);
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.tool-card:hover .tool-kbd,
.recent-card:hover .tool-kbd {
  color: var(--accent-color);
  border-color: rgba(var(--accent-rgb), 0.4);
}

.dashboard-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 20px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  border-top: 1px solid var(--border-color);
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.footer-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success-color);
}

@media (max-width: 900px) {
  .hero-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-continue {
    width: 100%;
  }
}

:is(.stats-grid, .picks-grid, .recent-grid) > * {
  animation: card-in var(--motion-base) var(--motion-ease) backwards;
}

:is(.stats-grid, .picks-grid, .recent-grid) > :nth-child(1) {
  animation-delay: 0ms;
}

:is(.stats-grid, .picks-grid, .recent-grid) > :nth-child(2) {
  animation-delay: 20ms;
}

:is(.stats-grid, .picks-grid, .recent-grid) > :nth-child(3) {
  animation-delay: 40ms;
}

:is(.stats-grid, .picks-grid, .recent-grid) > :nth-child(4) {
  animation-delay: 60ms;
}

:is(.stats-grid, .picks-grid, .recent-grid) > :nth-child(5) {
  animation-delay: 80ms;
}

:is(.stats-grid, .picks-grid, .recent-grid) > :nth-child(6) {
  animation-delay: 100ms;
}

:is(.stats-grid, .picks-grid, .recent-grid) > :nth-child(n + 7) {
  animation-delay: 120ms;
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 720px) {
  .dashboard-header {
    flex-wrap: wrap;
    row-gap: 10px;
    padding: 12px 16px;
  }

  .dashboard-main {
    padding: 16px;
  }

  .hero-panel {
    padding: 18px;
  }

  .dashboard-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 9px 16px;
  }
}
</style>
