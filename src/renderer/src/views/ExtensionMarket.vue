<template>
  <PageLayout tool-path="/market">
    <template #header-extra>
      <div class="ext-header-actions">
        <button type="button" class="btn btn-secondary" @click="openExtensionsManager">
          {{ t('扩展管理') }}
        </button>
        <button
          v-if="activeEntry === 'skills'"
          type="button"
          class="btn btn-secondary"
          :disabled="loading"
          @click="refresh"
        >
          {{ t('刷新') }}
        </button>
      </div>
    </template>

    <div class="extensions-page">
      <nav class="ext-tabs market-entries" :aria-label="t('扩展分类')">
        <button
          v-for="entry in entries"
          :key="entry.key"
          type="button"
          class="ext-tab"
          :class="{ active: activeEntry === entry.key }"
          @click="activeEntry = entry.key"
        >
          {{ t(entry.label) }}
        </button>
      </nav>

      <template v-if="activeEntry === 'skills'">
        <section class="market-hero">
          <span class="market-hero-icon">
            <AppIcon name="package" />
          </span>
          <div class="market-hero-text">
            <h2>{{ t('扩展') }}</h2>
            <p>{{ t('精选技能扩展，安装后由 AI 助手按需调用。扩展保存在本机用户目录，可在设置中随时卸载。') }}</p>
          </div>
          <div class="ext-summary">
            <span class="ext-summary-item">
              {{ t('可安装') }} <strong>{{ stats.available }}</strong>
            </span>
            <span class="ext-summary-item">
              {{ t('已安装') }} <strong>{{ stats.installed }}</strong>
            </span>
            <span class="ext-summary-item" :class="{ 'is-active': stats.updates > 0 }">
              {{ t('可更新') }} <strong>{{ stats.updates }}</strong>
            </span>
          </div>
        </section>

        <section class="ext-toolbar">
          <div class="ext-search">
            <AppIcon name="search" />
            <input v-model="search" type="text" :placeholder="t('搜索扩展')" />
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
              {{ t(category.label) }}
              <span>{{ category.count }}</span>
            </button>
          </div>
        </section>

        <div v-if="remote && !remote.ok" class="market-remote-warning">
          <span>{{ t('无法连接 ClawHub 技能市场：{error}。当前仅展示内置扩展。', { error: remote.error }) }}</span>
          <button type="button" class="btn btn-ghost" @click="refresh">{{ t('重试') }}</button>
        </div>

        <div v-if="loading" class="ext-state">
          <span class="ext-spinner" />
          {{ t('正在加载扩展…') }}
        </div>
        <EmptyState
          v-else-if="!filteredSkills.length"
          class="ext-empty"
          icon="search"
          :title="t('没有找到匹配的扩展')"
          :description="t('试试更换分类或搜索关键词')"
        />
        <section v-else class="ext-grid" :class="{ 'stagger-in': enteringGrid }">
          <article v-for="skill in filteredSkills" :key="skill.name" class="ext-card market-card">
            <div class="ext-card-head">
              <span class="ext-icon" v-html="getSkillIcon(skill.icon, skill.category)" />
              <div class="ext-card-title">
                <h3>{{ skill.name }}</h3>
                <span v-if="skill.version" class="ext-version">v{{ skill.version }}</span>
              </div>
              <span v-if="skill.featured" class="market-featured">{{ t('精选') }}</span>
            </div>

            <p v-if="skill.installPath" class="ext-card-path" :title="skill.installPath">
              {{ t('安装位置：{path}', { path: skill.installPath }) }}
            </p>

            <p class="ext-desc">{{ skill.description }}</p>

            <div v-if="skill.tags?.length" class="ext-tags">
              <span v-for="tag in skill.tags.slice(0, 4)" :key="tag" class="ext-tag">{{ tag }}</span>
            </div>

            <div class="ext-meta">
              <span>{{ skill.author || t('未知作者') }}</span>
              <span>{{ t(getCategoryLabel(skill.category)) }}</span>
              <span class="market-source" :class="{ remote: skill.source === 'clawhub' }">
                {{ skill.source === 'clawhub' ? 'ClawHub' : t('内置') }}
              </span>
              <span class="market-downloads">
                <AppIcon name="download" />
                {{ formatDownloads(skill.downloads) }}
              </span>
            </div>

            <div class="ext-actions">
              <button type="button" class="btn btn-ghost" @click="showDetails(skill)">
                {{ t('详情') }}
              </button>
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
                {{ skill.status === 'builtin' ? t('内置技能') : t('已安装') }}
              </span>
            </div>
          </article>
        </section>

        <footer class="market-note">
          <span>{{ t('内置扩展可离线使用；在线技能来自开源技能市场 ClawHub（MIT）。') }}</span>
        </footer>
      </template>

      <template v-else-if="activeEntry === 'plugins'">
        <section class="market-hero">
          <span class="market-hero-icon">
            <AppIcon name="layers" />
          </span>
          <div class="market-hero-text">
            <h2>{{ t('插件') }}</h2>
            <p>
              {{
                t('插件是技能与连接器的集合打包，一次安装同时获得多个组件。已安装插件在 设置 → 扩展管理 中更新与卸载。')
              }}
            </p>
          </div>
          <div class="ext-summary">
            <span class="ext-summary-item">
              {{ t('安装渠道') }} <strong>{{ pluginChannels.length }}</strong>
            </span>
            <span class="ext-summary-item">
              {{ t('已安装') }} <strong>{{ installedPlugins }}</strong>
            </span>
          </div>
        </section>

        <section class="ext-toolbar">
          <div class="ext-search">
            <AppIcon name="search" />
            <input v-model="pluginSearch" type="text" :placeholder="t('搜索安装渠道')" />
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
              {{ t(category.label) }}
              <span>{{ category.count }}</span>
            </button>
          </div>
        </section>

        <EmptyState
          v-if="!filteredChannels.length"
          class="ext-empty"
          icon="search"
          :title="t('没有找到匹配的渠道')"
          :description="t('试试更换分类或搜索关键词')"
        />
        <section v-else class="ext-grid">
          <article v-for="channel in filteredChannels" :key="channel.key" class="ext-card market-card">
            <div class="ext-card-head">
              <span class="ext-icon" v-html="channel.icon" />
              <div class="ext-card-title">
                <h3>{{ t(channel.name) }}</h3>
              </div>
            </div>

            <p class="ext-desc">{{ t(channel.description) }}</p>

            <div class="ext-tags">
              <span v-for="tag in channel.tags" :key="tag" class="ext-tag">{{ t(tag) }}</span>
            </div>

            <div class="ext-meta">
              <span>{{ t(channel.meta) }}</span>
              <span class="market-source">{{ t(channel.source) }}</span>
            </div>

            <div class="ext-actions">
              <button
                v-if="channel.action === 'folder'"
                type="button"
                class="btn btn-secondary"
                :disabled="pluginFolderBusy"
                @click="installPluginFromFolder"
              >
                {{ pluginFolderBusy ? t('安装中…') : t('选择目录') }}
              </button>
              <button v-else type="button" class="btn btn-primary" @click="pluginDialogVisible = true">
                {{ t('打开安装对话框') }}
              </button>
            </div>
          </article>
        </section>

        <footer class="market-note">
          <span>{{ t('已安装插件可在 设置 → 扩展管理 中查看组件、更新与卸载。') }}</span>
        </footer>
      </template>

      <template v-else>
        <section class="market-hero">
          <span class="market-hero-icon">
            <AppIcon name="plug" />
          </span>
          <div class="market-hero-text">
            <h2>{{ t('连接器') }}</h2>
            <p>
              {{
                t(
                  '连接器基于 MCP 协议把外部工具与数据接入 AI 助手，调用需审批、返回按不可信数据隔离。在 设置 → 扩展管理 中添加与启停。'
                )
              }}
            </p>
          </div>
          <div class="ext-summary">
            <span class="ext-summary-item">
              {{ t('示例') }} <strong>{{ connectorExamples.length }}</strong>
            </span>
            <span class="ext-summary-item">
              {{ t('在线') }} <strong>{{ registryConnectors.length }}</strong>
            </span>
            <span class="ext-summary-item">
              {{ t('已配置') }} <strong>{{ configuredConnectors }}</strong>
            </span>
          </div>
        </section>

        <section class="ext-toolbar">
          <div class="ext-search">
            <AppIcon name="search" />
            <input v-model="connectorSearch" type="text" :placeholder="t('搜索连接器')" />
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
              {{ t(category.label) }}
              <span>{{ category.count }}</span>
            </button>
          </div>
        </section>

        <div v-if="registryError" class="market-remote-warning">
          <span>{{ t('无法连接 MCP 官方注册表：{error}。当前仅展示内置示例。', { error: registryError }) }}</span>
          <button type="button" class="btn btn-ghost" :disabled="registryLoading" @click="loadRegistryConnectors">
            {{ t('重试') }}
          </button>
        </div>

        <EmptyState
          v-if="!filteredConnectors.length"
          class="ext-empty"
          icon="search"
          :title="t('没有找到匹配的连接器')"
          :description="t('试试更换分类或搜索关键词')"
        />
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
              <span v-if="example.note" class="market-featured">{{ t(example.note) }}</span>
            </div>

            <p class="ext-card-path" :title="example.command">{{ example.command }}</p>

            <p class="ext-desc">{{ t(example.description) }}</p>

            <div v-if="example.tags?.length" class="ext-tags">
              <span v-for="tag in example.tags" :key="tag" class="ext-tag">{{ t(tag) }}</span>
            </div>

            <div class="ext-meta">
              <span>{{ t(example.runtime) }}</span>
              <span class="market-source remote">{{ example.sourceLabel || t('官方') }}</span>
            </div>

            <div class="ext-actions">
              <CopyButton
                :text="example.command"
                :label="t('复制命令')"
                :success-message="t('命令已复制到剪贴板')"
                variant="ghost"
              />
            </div>
          </article>
        </section>

        <div class="market-cta">
          <span>{{ t('添加连接器需要名称与启动命令，可先测试连通性再保存重载。') }}</span>
          <button type="button" class="btn btn-secondary" @click="openExtensionsManager">
            {{ t('前往扩展管理') }}
          </button>
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
import { formatDownloads, getCategoryLabel, SKILL_CATEGORY_LABELS, SKILL_STATUS_LABELS } from '@/utils/skillMeta'
import PageLayout from '@/layouts/PageLayout.vue'
import SkillDetailDialog from '@/components/SkillDetailDialog.vue'
import PluginInstallDialog from '@/components/PluginInstallDialog.vue'
import { t } from '@/i18n'
import { iconSvg } from '@/icons'
import AppIcon from '@/components/AppIcon.vue'
import CopyButton from '@/components/CopyButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import '@/styles/extensions.css'

const toast = useToast()

const skills = ref([])
const remote = ref(null)
const loading = ref(true)
const search = ref('')
const activeCategory = ref('all')
const activeEntry = ref('plugins')
const entries = computed(() => [
  {
    key: 'plugins',
    get label() {
      return t('插件')
    }
  },
  {
    key: 'skills',
    get label() {
      return t('技能')
    }
  },
  {
    key: 'connectors',
    get label() {
      return t('连接器')
    }
  }
])
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
  folder: iconSvg('folder'),
  package: iconSvg('package'),
  branch: iconSvg('branch'),
  network: iconSvg('network'),
  cloud: iconSvg('cloud'),
  grid: iconSvg('layout-grid'),
  bulb: iconSvg('bulb'),
  clock: iconSvg('clock'),
  database: iconSvg('database')
}

const pluginChannels = [
  {
    key: 'folder',
    category: 'local',
    get name() {
      return t('从本地目录安装')
    },
    get description() {
      return t('选择包含 plugin.json 的文件夹，适合自研或离线分发的插件包。')
    },
    tags: [t('本地'), 'plugin.json'],
    get meta() {
      return t('适合自研与离线分发')
    },
    get source() {
      return t('本地')
    },
    action: 'folder',
    icon: ICONS.folder
  },
  {
    key: 'npm',
    category: 'online',
    get name() {
      return t('从 npm 安装')
    },
    get description() {
      return t('输入 npm 包名（可含 @scope 与版本标签），从公共 registry 拉取插件。')
    },
    tags: ['npm', 'registry'],
    meta: 'registry.npmjs.org',
    source: 'npm',
    action: 'dialog',
    icon: ICONS.package
  },
  {
    key: 'github',
    category: 'online',
    get name() {
      return t('从 GitHub 安装')
    },
    get description() {
      return t('输入 GitHub 仓库地址，拉取包含 plugin.json 的插件仓库。')
    },
    tags: ['GitHub', t('仓库')],
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
    get description() {
      return t('本机文件读写，启动参数限定允许访问的目录。')
    },
    command: 'npx -y @modelcontextprotocol/server-filesystem ~/Documents',
    runtime: 'npx · Node',
    tags: [t('文件'), t('本地')],
    icon: ICONS.folder
  },
  {
    name: 'Memory',
    category: 'knowledge',
    get description() {
      return t('知识图谱式长期记忆，跨会话保存实体与关系。')
    },
    command: 'npx -y @modelcontextprotocol/server-memory',
    runtime: 'npx · Node',
    tags: [t('记忆'), t('知识图谱')],
    icon: ICONS.network
  },
  {
    name: 'Fetch',
    category: 'web',
    get description() {
      return t('抓取网页并转为 Markdown 供 AI 助手查阅。')
    },
    command: 'uvx mcp-server-fetch',
    runtime: 'uvx · Python',
    tags: [t('网页'), 'Markdown'],
    get note() {
      return t('需 uv')
    },
    icon: ICONS.cloud
  },
  {
    name: 'Everything',
    category: 'tool',
    get description() {
      return t('官方示例服务器，覆盖回显、工具、资源等常见能力。')
    },
    command: 'npx -y @modelcontextprotocol/server-everything',
    runtime: 'npx · Node',
    tags: [t('示例'), t('测试')],
    icon: ICONS.grid
  },
  {
    name: 'Sequential Thinking',
    category: 'tool',
    get description() {
      return t('动态分步推理工具，支持中途修正与分支思考。')
    },
    command: 'npx -y @modelcontextprotocol/server-sequential-thinking',
    runtime: 'npx · Node',
    tags: [t('推理'), t('分步')],
    icon: ICONS.bulb
  },
  {
    name: 'Git',
    category: 'dev',
    get description() {
      return t('读取与分析本地 Git 仓库的提交、分支与状态。')
    },
    command: 'uvx mcp-server-git --repository <path>',
    runtime: 'uvx · Python',
    tags: ['Git', t('仓库')],
    get note() {
      return t('需 uv')
    },
    icon: ICONS.branch
  },
  {
    name: 'Time',
    category: 'tool',
    get description() {
      return t('时区查询与时间转换，获取指定时区的当前时间。')
    },
    command: 'uvx mcp-server-time',
    runtime: 'uvx · Python',
    tags: [t('时区'), t('时间')],
    get note() {
      return t('需 uv')
    },
    icon: ICONS.clock
  },
  {
    name: 'PostgreSQL',
    category: 'data',
    get description() {
      return t('只读查询 PostgreSQL 数据库的表结构与数据。')
    },
    command: 'npx -y @modelcontextprotocol/server-postgres postgres://localhost:5432/dbname',
    runtime: 'npx · Node',
    tags: [t('数据库'), 'SQL'],
    icon: ICONS.database
  }
]

const CONNECTOR_CATEGORY_LABELS = {
  get file() {
    return t('文件')
  },
  get knowledge() {
    return t('知识')
  },
  get web() {
    return t('网络')
  },
  get tool() {
    return t('工具')
  },
  get dev() {
    return t('开发')
  },
  get data() {
    return t('数据')
  }
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
    {
      key: 'all',
      get label() {
        return t('全部')
      },
      count: skills.value.length
    },
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
    {
      key: 'all',
      get label() {
        return t('全部')
      },
      count: pluginChannels.length
    },
    ...Array.from(counts.entries()).map(([key, count]) => ({
      key,
      label: t(key === 'local' ? '本地' : '在线'),
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
    {
      key: 'all',
      get label() {
        return t('全部')
      },
      count: allConnectors.value.length
    },
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
  return t(SKILL_STATUS_LABELS[status] || t('可安装'))
}

function statusTone(status) {
  if (status === 'update') return 'warning'
  if (status === 'installed') return 'success'
  if (status === 'builtin') return 'neutral'
  return 'info'
}

function installLabel(skill) {
  if (installingName.value === skill.name) return t(skill.status === 'update' ? '更新中…' : '安装中…')
  return t(skill.status === 'update' ? '更新' : '安装')
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
    configuredConnectors.value = Array.isArray(config?.extensions.mcp_servers)
      ? config.extensions.mcp_servers.length
      : 0
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
    registryError.value = status?.ok === false ? status.error || t('网络错误') : ''
  } finally {
    registryLoading.value = false
  }
}

async function refresh() {
  await load({ silent: true, refresh: true })
  toast.showSuccess(t('扩展列表已刷新'))
}

async function install(skill) {
  installingName.value = skill.name
  try {
    const result = await extensionsInstall(skill.name)
    if (result?.success) {
      toast.showSuccess(
        result.updated ? t('已更新扩展 {name}', { name: skill.name }) : t('已安装扩展 {name}', { name: skill.name })
      )
      await load({ silent: true })
      const updated = skills.value.find((item) => item.name === skill.name)
      if (updated && detailSkill.value?.name === skill.name) detailSkill.value = updated
    } else {
      toast.showError(result?.error || t('安装扩展失败'))
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
    else toast.showError(result?.error || t('安装插件失败'))
  } finally {
    pluginFolderBusy.value = false
  }
}

function onPluginInstalled(result) {
  const skillCount = Array.isArray(result?.skills) ? result.skills.length : 0
  const connectorCount = Array.isArray(result?.connectors) ? result.connectors.length : 0
  toast.showSuccess(
    t('已安装插件 {name}（技能 {skills} · 连接器 {connectors}）', {
      name: result?.name || '',
      skills: skillCount,
      connectors: connectorCount
    })
  )
  loadLocalCounts()
}

onMounted(() => {
  load()
  loadLocalCounts()
  loadRegistryConnectors()
})
</script>
