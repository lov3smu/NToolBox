<template>
  <PageLayout tool-path="/market">
    <template #header-extra>
      <div class="ext-header-actions">
        <button type="button" class="btn btn-secondary" @click="openExtensionsManager">扩展管理</button>
        <button
          v-if="activeEntry === 'skills'"
          type="button"
          class="btn btn-secondary"
          :disabled="loading"
          @click="refresh"
        >
          刷新
        </button>
      </div>
    </template>

    <div class="extensions-page">
      <nav class="ext-tabs market-entries" aria-label="扩展分类">
        <button
          v-for="entry in entries"
          :key="entry.key"
          type="button"
          class="ext-tab"
          :class="{ active: activeEntry === entry.key }"
          @click="activeEntry = entry.key"
        >
          {{ entry.label }}
        </button>
      </nav>

      <template v-if="activeEntry === 'skills'">
        <section class="market-hero">
          <span class="market-hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9h18l-1.5 11.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5z" />
              <path d="M3 9l2-5h14l2 5" />
              <path d="M9 13a3 3 0 0 0 6 0" />
            </svg>
          </span>
          <div class="market-hero-text">
            <h2>扩展</h2>
            <p>精选技能扩展，安装后由 AI 助手按需调用。扩展保存在本机用户目录，可在设置中随时卸载。</p>
          </div>
          <div class="ext-summary">
            <span class="ext-summary-item">
              可安装 <strong>{{ stats.available }}</strong>
            </span>
            <span class="ext-summary-item">
              已安装 <strong>{{ stats.installed }}</strong>
            </span>
            <span class="ext-summary-item" :class="{ 'is-active': stats.updates > 0 }">
              可更新 <strong>{{ stats.updates }}</strong>
            </span>
          </div>
        </section>

        <section class="ext-toolbar">
          <div class="ext-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input v-model="search" type="text" placeholder="搜索扩展" />
          </div>
          <div class="ext-tabs market-categories">
            <button
              v-for="category in categories"
              :key="category.key"
              type="button"
              class="ext-tab"
              :class="{ active: activeCategory === category.key }"
              @click="activeCategory = category.key"
            >
              {{ category.label }}
              <span>{{ category.count }}</span>
            </button>
          </div>
        </section>

        <div v-if="remote && !remote.ok" class="market-remote-warning">
          <span>无法连接 ClawHub 技能市场：{{ remote.error }}。当前仅展示内置扩展。</span>
          <button type="button" class="btn btn-ghost" @click="refresh">重试</button>
        </div>

        <div v-if="loading" class="ext-state">
          <span class="ext-spinner" />
          正在加载扩展…
        </div>
        <div v-else-if="!filteredSkills.length" class="ext-state">
          <span class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <span class="empty-state-title">没有找到匹配的扩展</span>
          <span class="empty-state-hint">试试更换分类或搜索关键词</span>
        </div>
        <section v-else class="ext-grid" :class="{ 'stagger-in': enteringGrid }">
          <article v-for="skill in filteredSkills" :key="skill.name" class="ext-card market-card">
            <div class="ext-card-head">
              <span class="ext-icon" v-html="getSkillIcon(skill.icon, skill.category)" />
              <div class="ext-card-title">
                <h3>{{ skill.name }}</h3>
                <span v-if="skill.version" class="ext-version">v{{ skill.version }}</span>
              </div>
              <span v-if="skill.featured" class="market-featured">精选</span>
            </div>

            <p v-if="skill.installPath" class="ext-card-path" :title="skill.installPath">
              安装位置：{{ skill.installPath }}
            </p>

            <p class="ext-desc">{{ skill.description }}</p>

            <div v-if="skill.tags?.length" class="ext-tags">
              <span v-for="tag in skill.tags.slice(0, 4)" :key="tag" class="ext-tag">{{ tag }}</span>
            </div>

            <div class="ext-meta">
              <span>{{ skill.author || '未知作者' }}</span>
              <span>{{ getCategoryLabel(skill.category) }}</span>
              <span class="market-source" :class="{ remote: skill.source === 'clawhub' }">
                {{ skill.source === 'clawhub' ? 'ClawHub' : '内置' }}
              </span>
              <span class="market-downloads">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                {{ formatDownloads(skill.downloads) }}
              </span>
            </div>

            <div class="ext-actions">
              <button type="button" class="btn btn-ghost" @click="showDetails(skill)">详情</button>
              <button
                v-if="skill.status === 'available' || skill.status === 'update'"
                type="button"
                class="btn btn-primary"
                :disabled="installingName === skill.name"
                @click="install(skill)"
              >
                {{ installLabel(skill) }}
              </button>
              <span v-else class="market-state">
                {{ skill.status === 'builtin' ? '内置技能' : '已安装' }}
              </span>
            </div>
          </article>
        </section>

        <footer class="market-note">
          <span>内置扩展可离线使用；在线技能来自开源技能市场 ClawHub（MIT）。</span>
        </footer>
      </template>

      <template v-else-if="activeEntry === 'plugins'">
        <section class="market-hero">
          <span class="market-hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
              <path d="m3 8 9 5 9-5" />
              <path d="M12 13v8" />
            </svg>
          </span>
          <div class="market-hero-text">
            <h2>插件</h2>
            <p>插件是技能与连接器的集合打包，一次安装同时获得多个组件。已安装插件在 设置 → 扩展管理 中更新与卸载。</p>
          </div>
          <div class="ext-summary">
            <span class="ext-summary-item">
              安装渠道 <strong>{{ pluginChannels.length }}</strong>
            </span>
            <span class="ext-summary-item">
              已安装 <strong>{{ installedPlugins }}</strong>
            </span>
          </div>
        </section>

        <section class="ext-toolbar">
          <div class="ext-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input v-model="pluginSearch" type="text" placeholder="搜索安装渠道" />
          </div>
          <div class="ext-tabs market-categories">
            <button
              v-for="category in pluginCategories"
              :key="category.key"
              type="button"
              class="ext-tab"
              :class="{ active: activePluginCategory === category.key }"
              @click="activePluginCategory = category.key"
            >
              {{ category.label }}
              <span>{{ category.count }}</span>
            </button>
          </div>
        </section>

        <div v-if="!filteredChannels.length" class="ext-state">
          <span class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <span class="empty-state-title">没有找到匹配的渠道</span>
          <span class="empty-state-hint">试试更换分类或搜索关键词</span>
        </div>
        <section v-else class="ext-grid">
          <article v-for="channel in filteredChannels" :key="channel.key" class="ext-card market-card">
            <div class="ext-card-head">
              <span class="ext-icon" v-html="channel.icon" />
              <div class="ext-card-title">
                <h3>{{ channel.name }}</h3>
              </div>
            </div>

            <p class="ext-desc">{{ channel.description }}</p>

            <div class="ext-tags">
              <span v-for="tag in channel.tags" :key="tag" class="ext-tag">{{ tag }}</span>
            </div>

            <div class="ext-meta">
              <span>{{ channel.meta }}</span>
              <span class="market-source">{{ channel.source }}</span>
            </div>

            <div class="ext-actions">
              <button
                v-if="channel.action === 'folder'"
                type="button"
                class="btn btn-secondary"
                :disabled="pluginFolderBusy"
                @click="installPluginFromFolder"
              >
                {{ pluginFolderBusy ? '安装中…' : '选择目录' }}
              </button>
              <button v-else type="button" class="btn btn-primary" @click="pluginDialogVisible = true">
                打开安装对话框
              </button>
            </div>
          </article>
        </section>

        <footer class="market-note">
          <span>已安装插件可在 设置 → 扩展管理 中查看组件、更新与卸载。</span>
        </footer>
      </template>

      <template v-else>
        <section class="market-hero">
          <span class="market-hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22v-5" />
              <path d="M9 8V2" />
              <path d="M15 8V2" />
              <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
            </svg>
          </span>
          <div class="market-hero-text">
            <h2>连接器</h2>
            <p>
              连接器基于 MCP 协议把外部工具与数据接入 AI 助手，调用需审批、返回按不可信数据隔离。在 设置 → 扩展管理
              中添加与启停。
            </p>
          </div>
          <div class="ext-summary">
            <span class="ext-summary-item">
              示例 <strong>{{ connectorExamples.length }}</strong>
            </span>
            <span class="ext-summary-item">
              在线 <strong>{{ registryConnectors.length }}</strong>
            </span>
            <span class="ext-summary-item">
              已配置 <strong>{{ configuredConnectors }}</strong>
            </span>
          </div>
        </section>

        <section class="ext-toolbar">
          <div class="ext-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input v-model="connectorSearch" type="text" placeholder="搜索连接器" />
          </div>
          <div class="ext-tabs market-categories">
            <button
              v-for="category in connectorCategories"
              :key="category.key"
              type="button"
              class="ext-tab"
              :class="{ active: activeConnectorCategory === category.key }"
              @click="activeConnectorCategory = category.key"
            >
              {{ category.label }}
              <span>{{ category.count }}</span>
            </button>
          </div>
        </section>

        <div v-if="registryError" class="market-remote-warning">
          <span>无法连接 MCP 官方注册表：{{ registryError }}。当前仅展示内置示例。</span>
          <button type="button" class="btn btn-ghost" :disabled="registryLoading" @click="loadRegistryConnectors">
            重试
          </button>
        </div>

        <div v-if="!filteredConnectors.length" class="ext-state">
          <span class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <span class="empty-state-title">没有找到匹配的连接器</span>
          <span class="empty-state-hint">试试更换分类或搜索关键词</span>
        </div>
        <section v-else class="ext-grid">
          <article
            v-for="example in filteredConnectors"
            :key="example.key || example.name"
            class="ext-card market-card"
          >
            <div class="ext-card-head">
              <span class="ext-icon" v-html="example.icon" />
              <div class="ext-card-title">
                <h3>{{ example.name }}</h3>
                <span v-if="example.version" class="ext-version">v{{ example.version }}</span>
              </div>
              <span v-if="example.note" class="market-featured">{{ example.note }}</span>
            </div>

            <p class="ext-card-path" :title="example.command">{{ example.command }}</p>

            <p class="ext-desc">{{ example.description }}</p>

            <div v-if="example.tags?.length" class="ext-tags">
              <span v-for="tag in example.tags" :key="tag" class="ext-tag">{{ tag }}</span>
            </div>

            <div class="ext-meta">
              <span>{{ example.runtime }}</span>
              <span class="market-source remote">{{ example.sourceLabel || '官方' }}</span>
            </div>

            <div class="ext-actions">
              <button type="button" class="btn btn-ghost" @click="copyCommand(example.command)">复制命令</button>
            </div>
          </article>
        </section>

        <div class="market-cta">
          <span>添加连接器需要名称与启动命令，可先测试连通性再保存重载。</span>
          <button type="button" class="btn btn-secondary" @click="openExtensionsManager">前往扩展管理</button>
        </div>
      </template>
    </div>

    <SkillDetailDialog
      :visible="detailVisible"
      :skill="detailSkill"
      :badge-text="detailSkill ? statusLabel(detailSkill.status) : ''"
      :badge-tone="detailSkill ? statusTone(detailSkill.status) : 'info'"
      @close="detailVisible = false"
    >
      <template #actions>
        <button
          v-if="detailSkill && (detailSkill.status === 'available' || detailSkill.status === 'update')"
          type="button"
          class="btn btn-primary"
          :disabled="installingName === detailSkill.name"
          @click="install(detailSkill)"
        >
          {{ installLabel(detailSkill) }}
        </button>
      </template>
    </SkillDetailDialog>

    <PluginInstallDialog
      :visible="pluginDialogVisible"
      kind="plugin"
      @close="pluginDialogVisible = false"
      @installed="onPluginInstalled"
    />

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  extensionsInstall,
  extensionsMarket,
  getConfig,
  mcpRegistryServers,
  openSettings,
  pluginsInstallFromFolder,
  pluginsList
} from '@/api'
import { useToast } from '@/composables'
import { getSkillIcon } from '@/utils/skillIcons'
import { copyToClipboard } from '@/utils/clipboard'
import { formatDownloads, getCategoryLabel, SKILL_CATEGORY_LABELS, SKILL_STATUS_LABELS } from '@/utils/skillMeta'
import PageLayout from '@/layouts/PageLayout.vue'
import SkillDetailDialog from '@/components/SkillDetailDialog.vue'
import PluginInstallDialog from '@/components/PluginInstallDialog.vue'
import Toast from '@/components/Toast.vue'
import '@/styles/extensions.css'

const toast = useToast()
const { toastVisible, toastMessage, toastType } = toast

const skills = ref([])
const remote = ref(null)
const loading = ref(true)
const search = ref('')
const activeCategory = ref('all')
const activeEntry = ref('plugins')
const entries = [
  { key: 'plugins', label: '插件' },
  { key: 'skills', label: '技能' },
  { key: 'connectors', label: '连接器' }
]
const installingName = ref('')
const detailVisible = ref(false)
const detailSkill = ref(null)
const enteringGrid = ref(false)
const pluginDialogVisible = ref(false)
const pluginFolderBusy = ref(false)
const installedPlugins = ref(0)
const configuredConnectors = ref(0)
const pluginSearch = ref('')
const activePluginCategory = ref('all')
const connectorSearch = ref('')
const activeConnectorCategory = ref('all')
const registryConnectors = ref([])
const registryLoading = ref(false)
const registryError = ref('')
let enteringTimer = null

const ICONS = {
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
  package: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.29 7 12 12l8.71-5"/><path d="M12 22V12"/></svg>`,
  branch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
  network: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="M15.4 6.5l-6.8 4"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 13v8"/><path d="m8 17 4 4 4-4"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  bulb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>`
}

const pluginChannels = [
  {
    key: 'folder',
    category: 'local',
    name: '从本地目录安装',
    description: '选择包含 plugin.json 的文件夹，适合自研或离线分发的插件包。',
    tags: ['本地', 'plugin.json'],
    meta: '适合自研与离线分发',
    source: '本地',
    action: 'folder',
    icon: ICONS.folder
  },
  {
    key: 'npm',
    category: 'online',
    name: '从 npm 安装',
    description: '输入 npm 包名（可含 @scope 与版本标签），从公共 registry 拉取插件。',
    tags: ['npm', 'registry'],
    meta: 'registry.npmjs.org',
    source: 'npm',
    action: 'dialog',
    icon: ICONS.package
  },
  {
    key: 'github',
    category: 'online',
    name: '从 GitHub 安装',
    description: '输入 GitHub 仓库地址，拉取包含 plugin.json 的插件仓库。',
    tags: ['GitHub', '仓库'],
    meta: 'github.com',
    source: 'GitHub',
    action: 'dialog',
    icon: ICONS.branch
  }
]

const connectorExamples = [
  {
    name: 'Filesystem',
    category: 'file',
    description: '本机文件读写，启动参数限定允许访问的目录。',
    command: 'npx -y @modelcontextprotocol/server-filesystem ~/Documents',
    runtime: 'npx · Node',
    tags: ['文件', '本地'],
    icon: ICONS.folder
  },
  {
    name: 'Memory',
    category: 'knowledge',
    description: '知识图谱式长期记忆，跨会话保存实体与关系。',
    command: 'npx -y @modelcontextprotocol/server-memory',
    runtime: 'npx · Node',
    tags: ['记忆', '知识图谱'],
    icon: ICONS.network
  },
  {
    name: 'Fetch',
    category: 'web',
    description: '抓取网页并转为 Markdown 供 AI 助手查阅。',
    command: 'uvx mcp-server-fetch',
    runtime: 'uvx · Python',
    tags: ['网页', 'Markdown'],
    note: '需 uv',
    icon: ICONS.cloud
  },
  {
    name: 'Everything',
    category: 'tool',
    description: '官方示例服务器，覆盖回显、工具、资源等常见能力。',
    command: 'npx -y @modelcontextprotocol/server-everything',
    runtime: 'npx · Node',
    tags: ['示例', '测试'],
    icon: ICONS.grid
  },
  {
    name: 'Sequential Thinking',
    category: 'tool',
    description: '动态分步推理工具，支持中途修正与分支思考。',
    command: 'npx -y @modelcontextprotocol/server-sequential-thinking',
    runtime: 'npx · Node',
    tags: ['推理', '分步'],
    icon: ICONS.bulb
  },
  {
    name: 'Git',
    category: 'dev',
    description: '读取与分析本地 Git 仓库的提交、分支与状态。',
    command: 'uvx mcp-server-git --repository <path>',
    runtime: 'uvx · Python',
    tags: ['Git', '仓库'],
    note: '需 uv',
    icon: ICONS.branch
  },
  {
    name: 'Time',
    category: 'tool',
    description: '时区查询与时间转换，获取指定时区的当前时间。',
    command: 'uvx mcp-server-time',
    runtime: 'uvx · Python',
    tags: ['时区', '时间'],
    note: '需 uv',
    icon: ICONS.clock
  },
  {
    name: 'PostgreSQL',
    category: 'data',
    description: '只读查询 PostgreSQL 数据库的表结构与数据。',
    command: 'npx -y @modelcontextprotocol/server-postgres postgres://localhost:5432/dbname',
    runtime: 'npx · Node',
    tags: ['数据库', 'SQL'],
    icon: ICONS.database
  }
]

const CONNECTOR_CATEGORY_LABELS = {
  file: '文件',
  knowledge: '知识',
  web: '网络',
  tool: '工具',
  dev: '开发',
  data: '数据'
}

const CONNECTOR_CATEGORY_ICONS = {
  file: ICONS.folder,
  knowledge: ICONS.network,
  web: ICONS.cloud,
  tool: ICONS.grid,
  dev: ICONS.branch,
  data: ICONS.database
}

const allConnectors = computed(() => [...connectorExamples, ...registryConnectors.value])

watch(loading, (isLoading, wasLoading) => {
  if (!wasLoading || isLoading) return
  enteringGrid.value = true
  clearTimeout(enteringTimer)
  enteringTimer = setTimeout(() => {
    enteringGrid.value = false
  }, 600)
})

onUnmounted(() => clearTimeout(enteringTimer))

const stats = computed(() => {
  const installed = skills.value.filter((skill) => skill.installed).length
  const updates = skills.value.filter((skill) => skill.status === 'update').length
  const available = skills.value.filter((skill) => skill.status === 'available').length
  return { installed, updates, available }
})

const categories = computed(() => {
  const counts = new Map()
  for (const skill of skills.value) {
    const key = skill.category || 'general'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [
    { key: 'all', label: '全部', count: skills.value.length },
    ...Array.from(counts.entries()).map(([key, count]) => ({
      key,
      label: SKILL_CATEGORY_LABELS[key] || key,
      count
    }))
  ]
})

const filteredSkills = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return skills.value
    .filter((skill) => {
      if (activeCategory.value !== 'all' && (skill.category || 'general') !== activeCategory.value) return false
      if (!keyword) return true
      return [skill.name, skill.description, skill.author, ...(skill.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      if (a.status === 'update' || b.status === 'update') return a.status === 'update' ? -1 : 1
      return (b.downloads || 0) - (a.downloads || 0)
    })
})

const pluginCategories = computed(() => {
  const counts = new Map()
  for (const channel of pluginChannels) {
    counts.set(channel.category, (counts.get(channel.category) || 0) + 1)
  }
  return [
    { key: 'all', label: '全部', count: pluginChannels.length },
    ...Array.from(counts.entries()).map(([key, count]) => ({
      key,
      label: key === 'local' ? '本地' : '在线',
      count
    }))
  ]
})

const filteredChannels = computed(() => {
  const keyword = pluginSearch.value.trim().toLowerCase()
  return pluginChannels.filter((channel) => {
    if (activePluginCategory.value !== 'all' && channel.category !== activePluginCategory.value) return false
    if (!keyword) return true
    return [channel.name, channel.description, channel.source, ...(channel.tags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  })
})

const connectorCategories = computed(() => {
  const counts = new Map()
  for (const example of allConnectors.value) {
    counts.set(example.category, (counts.get(example.category) || 0) + 1)
  }
  return [
    { key: 'all', label: '全部', count: allConnectors.value.length },
    ...Array.from(counts.entries()).map(([key, count]) => ({
      key,
      label: CONNECTOR_CATEGORY_LABELS[key] || key,
      count
    }))
  ]
})

const filteredConnectors = computed(() => {
  const keyword = connectorSearch.value.trim().toLowerCase()
  return allConnectors.value.filter((example) => {
    if (activeConnectorCategory.value !== 'all' && example.category !== activeConnectorCategory.value) return false
    if (!keyword) return true
    return [example.name, example.description, example.command, example.packageName, ...(example.tags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  })
})

function statusLabel(status) {
  return SKILL_STATUS_LABELS[status] || '可安装'
}

function statusTone(status) {
  if (status === 'update') return 'warning'
  if (status === 'installed') return 'success'
  if (status === 'builtin') return 'neutral'
  return 'info'
}

function installLabel(skill) {
  if (installingName.value === skill.name) return skill.status === 'update' ? '更新中…' : '安装中…'
  return skill.status === 'update' ? '更新' : '安装'
}

async function load({ silent = false, refresh: forceRefresh = false } = {}) {
  if (!silent) loading.value = true
  try {
    const result = await extensionsMarket({ refresh: forceRefresh })
    if (Array.isArray(result)) {
      skills.value = result
      remote.value = null
    } else {
      skills.value = Array.isArray(result?.items) ? result.items : []
      remote.value = result?.remote || null
    }
  } finally {
    loading.value = false
  }
}

async function loadLocalCounts() {
  try {
    const [plugins, config] = await Promise.all([pluginsList(), getConfig()])
    installedPlugins.value = Array.isArray(plugins) ? plugins.length : 0
    configuredConnectors.value = Array.isArray(config?.mcp_servers) ? config.mcp_servers.length : 0
  } catch {
    installedPlugins.value = 0
    configuredConnectors.value = 0
  }
}

async function loadRegistryConnectors() {
  if (registryLoading.value) return
  registryLoading.value = true
  try {
    const result = await mcpRegistryServers()
    const servers = Array.isArray(result) ? [] : Array.isArray(result?.servers) ? result.servers : []
    const status = Array.isArray(result) ? null : result?.remote || null
    registryConnectors.value = servers.map((server) => ({
      ...server,
      icon: CONNECTOR_CATEGORY_ICONS[server.category] || ICONS.grid
    }))
    registryError.value = status?.ok === false ? status.error || '网络错误' : ''
  } finally {
    registryLoading.value = false
  }
}

async function refresh() {
  await load({ silent: true, refresh: true })
  toast.showSuccess('扩展列表已刷新')
}

async function install(skill) {
  installingName.value = skill.name
  try {
    const result = await extensionsInstall(skill.name)
    if (result?.success) {
      toast.showSuccess(result.updated ? `已更新扩展 ${skill.name}` : `已安装扩展 ${skill.name}`)
      await load({ silent: true })
      const updated = skills.value.find((item) => item.name === skill.name)
      if (updated && detailSkill.value?.name === skill.name) detailSkill.value = updated
    } else {
      toast.showError(result?.error || '安装扩展失败')
    }
  } finally {
    installingName.value = ''
  }
}

function showDetails(skill) {
  detailSkill.value = skill
  detailVisible.value = true
}

function openExtensionsManager() {
  openSettings('extensions')
}

async function installPluginFromFolder() {
  if (pluginFolderBusy.value) return
  pluginFolderBusy.value = true
  try {
    const result = await pluginsInstallFromFolder()
    if (result?.canceled) return
    if (result?.success) onPluginInstalled(result)
    else toast.showError(result?.error || '安装插件失败')
  } finally {
    pluginFolderBusy.value = false
  }
}

function onPluginInstalled(result) {
  const skillCount = Array.isArray(result?.skills) ? result.skills.length : 0
  const connectorCount = Array.isArray(result?.connectors) ? result.connectors.length : 0
  toast.showSuccess(`已安装插件 ${result?.name || ''}（技能 ${skillCount} · 连接器 ${connectorCount}）`)
  loadLocalCounts()
}

async function copyCommand(command) {
  const ok = await copyToClipboard(command)
  if (ok) toast.showSuccess('命令已复制到剪贴板')
  else toast.showError('复制失败')
}

onMounted(() => {
  load()
  loadLocalCounts()
  loadRegistryConnectors()
})
</script>
