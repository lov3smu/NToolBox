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
          <div class="hero-heading">
            <span class="hero-badge">{{ t('一站式开发工具箱') }}</span>
            <h2>{{ t('常用工具，一个入口就够了') }}</h2>
          </div>
          <p>{{ t('AI 助手、数据库客户端、图床与内容排版，开发日常在一个窗口完成。') }}</p>
          <div class="hero-actions">
            <button type="button" class="btn btn-primary btn-sm" @click="navigateTo('/chat')">
              {{ t('打开 AI 助手') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="navigateTo('/database')">
              {{ t('数据库客户端') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="navigateTo('/wechat-formatter')">
              {{ t('开始文章排版') }}
            </button>
            <button
              type="button"
              class="hero-continue"
              :title="t(heroTool.description)"
              @click="navigateTo(heroTool.path)"
            >
              <span class="hero-continue-label">{{ recentTools.length ? t('继续上次使用') : t('推荐上手') }}</span>
              <span class="hero-continue-icon" v-html="heroTool.icon" />
              <span class="hero-continue-name">{{ t(heroTool.name) }}</span>
              <span class="hero-continue-arrow" v-html="ARROW_ICON" />
            </button>
          </div>
        </div>
        <div class="hero-stats">
          <button
            v-for="stat in stats"
            :key="stat.key"
            type="button"
            class="hero-stat"
            :class="stat.tone"
            :title="`${stat.actionLabel} · ${stat.hint}`"
            :aria-label="stat.actionLabel"
            @click="stat.action()"
          >
            <span class="hero-stat-icon" v-html="stat.icon" />
            <span class="hero-stat-value">{{ stat.value }}</span>
            <span class="hero-stat-label">{{ stat.label }}</span>
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
          <span class="recent-empty-hint">{{ t('从下方选择一个工具开始使用吧') }}</span>
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
import { iconSvg } from '@/icons'
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
} from '@shared/navTools'
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
    key: 'dev',
    get title() {
      return t('开发工具')
    },
    get description() {
      return t('格式转换、解析与请求调试')
    }
  },
  {
    key: 'content',
    get title() {
      return t('文本与内容')
    },
    get description() {
      return t('写作、排版与模板复用')
    }
  },
  {
    key: 'system',
    get title() {
      return t('系统与资源')
    },
    get description() {
      return t('剪贴板、密码与系统诊断')
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

const SEARCH_ICON = iconSvg('search')

const SETTINGS_ICON = iconSvg('settings')

const ARROW_ICON = iconSvg('arrow-right')

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
    icon: iconSvg('layout-grid')
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
    icon: iconSvg('layers')
  },
  {
    key: 'connectors',
    label: t('MCP 连接器'),
    value: connectorCount.value,
    hint: connectorCount.value ? t('已启用的连接器') : t('前往扩展管理添加'),
    tone: 'success',
    actionLabel: t('管理连接器'),
    action: () => openSettings('extensions'),
    icon: iconSvg('connector')
  },
  {
    key: 'database',
    label: t('数据库连接'),
    value: connectionCount.value,
    hint: connectionCount.value ? t('已保存的连接') : t('尚未添加连接'),
    tone: 'warning',
    actionLabel: t('打开数据库客户端'),
    action: () => router.push('/database'),
    icon: iconSvg('database')
  },
  {
    key: 'ai',
    label: t('模型服务商'),
    value: aiProviderCount.value,
    hint: aiProviderCount.value ? t('已配置服务商') : t('前往设置配置'),
    tone: 'neutral',
    actionLabel: t('配置模型服务商'),
    action: () => openSettings('api'),
    icon: iconSvg('sparkles')
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
  font-family: var(--font-mono);
  font-size: calc(10px * var(--font-scale));
  color: var(--text-tertiary);
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
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
.hero-stat:focus-visible,
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
  margin-bottom: 20px;
}

.dashboard-main section:last-child {
  margin-bottom: 0;
}

.hero-panel {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 20px;
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
  flex: 1 1 0;
  min-width: 0;
}

.hero-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

.hero-copy h2 {
  margin: 0;
  font-size: calc(20px * var(--font-scale));
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-primary);
}

.hero-copy p {
  max-width: 520px;
  margin-top: 6px;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--text-secondary);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.hero-continue {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  height: var(--control-height-sm);
  padding: 0 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-pill);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: var(--transition-fast);
}

.hero-continue:hover {
  background: var(--glass-bg-hover);
  border-color: rgba(var(--accent-rgb), 0.45);
}

.hero-continue-label {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.hero-continue-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--primary-gradient);
  color: var(--text-inverse);
}

.hero-continue-icon :deep(svg) {
  width: 12px;
  height: 12px;
}

.hero-continue-name {
  min-width: 0;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-primary);
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

.hero-stats {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  flex: 0 0 540px;
}

.hero-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.hero-stat:hover {
  background: var(--glass-bg-hover);
  border-color: rgba(var(--accent-rgb), 0.32);
}

.hero-stat-icon {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-stat-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.hero-stat.accent .hero-stat-icon {
  color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.12);
}

.hero-stat.success .hero-stat-icon {
  color: var(--success-color);
  background: rgba(var(--success-rgb), 0.12);
}

.hero-stat.warning .hero-stat-icon {
  color: var(--warning-color);
  background: rgba(var(--warning-rgb), 0.14);
}

.hero-stat.neutral .hero-stat-icon {
  color: var(--neutral-color);
  background: rgba(var(--neutral-rgb), 0.14);
}

.hero-stat.info .hero-stat-icon {
  color: var(--info-color);
  background: rgba(var(--info-rgb), 0.12);
}

.hero-stat-value {
  font-size: var(--font-size-base);
  font-weight: 650;
  line-height: 1.2;
  color: var(--text-primary);
}

.hero-stat-label {
  min-width: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
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
  border-radius: var(--radius-pill);
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
  gap: 10px;
}

@container (min-width: 996px) {
  .picks-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.pick-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
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
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
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
  margin-bottom: 2px;
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
  gap: 10px;
}

.recent-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
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
  border-radius: var(--radius-md);
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
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  background: var(--content-bg);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
}

.recent-empty-hint {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-xs);
}

.recent-empty-action {
  flex-shrink: 0;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.tool-card {
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

.tool-card:hover {
  background: var(--surface);
  border-color: rgba(var(--accent-rgb), 0.4);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.tool-icon {
  width: 36px;
  height: 36px;
  background: var(--primary-gradient);
  border-radius: var(--radius-md);
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
  margin-bottom: 2px;
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
  font-family: var(--font-mono);
  font-size: calc(10px * var(--font-scale));
  color: var(--text-tertiary);
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
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

@media (max-width: 1280px) {
  .hero-panel {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .hero-stats {
    flex: none;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:is(.hero-stats, .picks-grid, .recent-grid) > * {
  animation: card-in var(--motion-base) var(--motion-ease) backwards;
}

:is(.hero-stats, .picks-grid, .recent-grid) > :nth-child(1) {
  animation-delay: 0ms;
}

:is(.hero-stats, .picks-grid, .recent-grid) > :nth-child(2) {
  animation-delay: 20ms;
}

:is(.hero-stats, .picks-grid, .recent-grid) > :nth-child(3) {
  animation-delay: 40ms;
}

:is(.hero-stats, .picks-grid, .recent-grid) > :nth-child(4) {
  animation-delay: 60ms;
}

:is(.hero-stats, .picks-grid, .recent-grid) > :nth-child(5) {
  animation-delay: 80ms;
}

:is(.hero-stats, .picks-grid, .recent-grid) > :nth-child(6) {
  animation-delay: 100ms;
}

:is(.hero-stats, .picks-grid, .recent-grid) > :nth-child(n + 7) {
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
    padding: 16px;
  }

  .hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recent-empty {
    flex-wrap: wrap;
    row-gap: 6px;
  }

  .recent-empty-action {
    margin-left: auto;
  }

  .dashboard-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 9px 16px;
  }
}
</style>
