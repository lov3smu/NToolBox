<template>
  <div class="extensions-manager">
    <header v-if="showHeader" class="ext-manager-head">
      <div class="ext-manager-title">
        <h3>{{ title || t('扩展管理') }}</h3>
        <p>{{ categoryHint }}</p>
      </div>
      <div class="ext-header-actions">
        <button type="button" class="btn btn-secondary" :disabled="loading || Boolean(busyName)" @click="refresh">
          {{ t('刷新') }}
        </button>

        <template v-if="category === 'plugins'">
          <button type="button" class="btn btn-secondary" :disabled="Boolean(busyName)" @click="openPluginDirectory">
            {{ t('打开插件目录') }}
          </button>
          <div ref="installMenuRef" class="ext-install">
            <button
              ref="installTriggerRef"
              type="button"
              class="btn btn-primary"
              :disabled="Boolean(busyName)"
              aria-haspopup="menu"
              :aria-expanded="installMenuOpen"
              @click="toggleInstallMenu"
            >
              {{ t('安装插件') }}
              <svg
                class="ext-install-caret"
                :class="{ open: installMenuOpen }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <Transition name="ext-install-pop">
              <div v-if="installMenuOpen" v-clamp-viewport class="ext-install-menu" role="menu">
                <button
                  type="button"
                  class="ext-install-option"
                  role="menuitem"
                  @click="chooseInstall('plugin-folder')"
                >
                  <span class="ext-install-option-label">{{ t('从本地目录添加') }}</span>
                  <span class="ext-install-option-hint">{{ t('选择包含 plugin.json 的文件夹') }}</span>
                </button>
                <button
                  type="button"
                  class="ext-install-option"
                  role="menuitem"
                  @click="chooseInstall('plugin-source')"
                >
                  <span class="ext-install-option-label">{{ t('安装第三方插件') }}</span>
                  <span class="ext-install-option-hint">{{ t('从 npm、GitHub 或本地目录安装') }}</span>
                </button>
              </div>
            </Transition>
          </div>
        </template>

        <template v-else-if="category === 'skills'">
          <button type="button" class="btn btn-secondary" :disabled="Boolean(busyName)" @click="importSkillPackage">
            {{ t('导入技能') }}
          </button>
          <div ref="installMenuRef" class="ext-install">
            <button
              ref="installTriggerRef"
              type="button"
              class="btn btn-primary"
              :disabled="Boolean(busyName)"
              aria-haspopup="menu"
              :aria-expanded="installMenuOpen"
              @click="toggleInstallMenu"
            >
              {{ t('安装技能') }}
              <svg
                class="ext-install-caret"
                :class="{ open: installMenuOpen }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <Transition name="ext-install-pop">
              <div v-if="installMenuOpen" v-clamp-viewport class="ext-install-menu" role="menu">
                <button type="button" class="ext-install-option" role="menuitem" @click="chooseInstall('folder')">
                  <span class="ext-install-option-label">{{ t('从本地目录添加') }}</span>
                  <span class="ext-install-option-hint">{{ t('选择包含 skill.json 的文件夹') }}</span>
                </button>
                <button type="button" class="ext-install-option" role="menuitem" @click="chooseInstall('source')">
                  <span class="ext-install-option-label">{{ t('安装第三方技能') }}</span>
                  <span class="ext-install-option-hint">{{ t('从 npm、GitHub 或本地目录安装') }}</span>
                </button>
                <button type="button" class="ext-install-option" role="menuitem" @click="chooseInstall('agent')">
                  <span class="ext-install-option-label">{{ t('让 Agent 创建技能') }}</span>
                  <span class="ext-install-option-hint">{{ t('在 AI 助手中生成技能包') }}</span>
                </button>
              </div>
            </Transition>
          </div>
        </template>
      </div>
    </header>

    <nav v-if="showTabs" class="ext-tabs ext-categories" :aria-label="t('扩展分类')">
      <button
        v-for="item in categories"
        :key="item.key"
        type="button"
        class="ext-tab"
        :class="{ active: category === item.key }"
        @click="switchCategory(item.key)"
      >
        {{ t(item.label) }}
        <span>{{ item.count }}</span>
      </button>
    </nav>

    <section v-if="category === 'connectors'" class="ext-connectors">
      <McpSettingsPanel />
    </section>

    <template v-else>
      <section class="ext-summary">
        <span class="ext-summary-item">
          {{ t('插件') }} <strong>{{ counts.plugins }}</strong>
        </span>
        <span class="ext-summary-item">
          {{ t('技能') }} <strong>{{ counts.total }}</strong>
          <span class="ext-summary-note">{{
            t('内置 {builtin} · 已安装 {installed}', { builtin: counts.builtin, installed: counts.installed })
          }}</span>
        </span>
        <span class="ext-summary-item">
          {{ t('连接器') }} <strong>{{ connectorCount }}</strong>
        </span>
        <span class="ext-summary-item" :class="{ 'is-active': counts.updates > 0 }">
          {{ t('可更新') }} <strong>{{ counts.updates }}</strong>
        </span>
      </section>

      <section class="ext-toolbar">
        <div class="ext-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input v-model="search" type="text" :placeholder="searchPlaceholder" />
        </div>
        <div v-if="category === 'skills'" class="ext-tabs">
          <button
            v-for="tab in filterTabs"
            :key="tab.key"
            type="button"
            class="ext-tab"
            :class="{ active: filter === tab.key }"
            @click="filter = tab.key"
          >
            {{ t(tab.label) }}
            <span>{{ tab.count }}</span>
          </button>
        </div>
      </section>

      <div v-if="loading" class="ext-state">
        <span class="ext-spinner" />
        {{ t('正在加载扩展…') }}
      </div>
      <div v-else-if="category === 'plugins' && !filteredPlugins.length" class="ext-state">
        <p>{{ emptyTitle }}</p>
        <span>{{ emptyHint }}</span>
      </div>
      <section v-else-if="category === 'plugins'" class="ext-grid">
        <article v-for="plugin in filteredPlugins" :key="plugin.name" class="ext-card">
          <div class="ext-card-head">
            <span class="ext-icon" v-html="getSkillIcon('plugin', 'general')" />
            <div class="ext-card-title">
              <h3>{{ plugin.name }}</h3>
              <span v-if="plugin.version" class="ext-version">v{{ plugin.version }}</span>
            </div>
            <span class="ext-badge success">{{ t('已安装') }}</span>
          </div>

          <p class="ext-card-path ext-card-path-split" :title="plugin.path">
            <span class="ext-card-path-label">{{ t('安装位置') }}</span>
            <span class="ext-card-path-value">{{ plugin.path }}</span>
          </p>

          <p class="ext-desc">
            {{ plugin.description || t('插件包，包含随包安装的技能与连接器。') }}
          </p>

          <div class="ext-plugin-parts">
            <div class="ext-plugin-part">
              <span class="ext-plugin-part-label">{{ t('技能') }}</span>
              <span v-if="!plugin.skills.length" class="ext-plugin-part-empty">{{ t('无') }}</span>
              <span
                v-for="name in plugin.skills"
                :key="name"
                class="ext-tag"
                :class="{ 'is-missing': plugin.missingSkills.includes(name) }"
                :title="plugin.missingSkills.includes(name) ? t('技能已被单独卸载') : name"
              >
                {{ name }}
              </span>
            </div>
            <div class="ext-plugin-part">
              <span class="ext-plugin-part-label">{{ t('连接器') }}</span>
              <span v-if="!plugin.connectors.length" class="ext-plugin-part-empty">{{ t('无') }}</span>
              <span
                v-for="name in plugin.connectors"
                :key="name"
                class="ext-tag"
                :class="{ 'is-missing': plugin.missingConnectors.includes(name) }"
                :title="plugin.missingConnectors.includes(name) ? t('连接器已在配置中移除') : name"
              >
                {{ name }}
              </span>
            </div>
          </div>

          <div class="ext-meta">
            <span>{{ plugin.author || t('未知作者') }}</span>
            <span>{{ plugin.source }}</span>
          </div>

          <div class="ext-actions">
            <button type="button" class="btn btn-ghost" :disabled="loading" @click="refresh">
              {{ t('刷新状态') }}
            </button>
            <button
              type="button"
              class="btn btn-danger"
              :disabled="Boolean(busyName)"
              @click="requestPluginUninstall(plugin)"
            >
              {{ t('卸载插件') }}
            </button>
          </div>
        </article>
      </section>
      <div v-else-if="!filteredSkills.length" class="ext-state">
        <p>{{ emptyTitle }}</p>
        <span>{{ emptyHint }}</span>
      </div>
      <section v-else class="ext-grid">
        <article
          v-for="skill in filteredSkills"
          :key="skill.name"
          class="ext-card"
          :class="{ 'is-disabled': !isSkillEnabled(skill) }"
        >
          <div class="ext-card-head">
            <span class="ext-icon" v-html="getSkillIcon(skill.icon, skill.category)" />
            <div class="ext-card-title">
              <h3>{{ skill.name }}</h3>
              <span class="ext-version">v{{ skill.version }}</span>
            </div>
            <span class="ext-badge" :class="badgeTone(skill)">{{ badgeText(skill) }}</span>
            <input
              type="checkbox"
              class="switch"
              :checked="isSkillEnabled(skill)"
              :disabled="Boolean(busyName)"
              :aria-label="(isSkillEnabled(skill) ? t('停用') : t('启用')) + ' ' + skill.name"
              @change="toggleEnabled(skill)"
            />
          </div>

          <p v-if="skill.path" class="ext-card-path ext-card-path-split" :title="skill.path">
            <span class="ext-card-path-label">{{ t('安装位置') }}</span>
            <span class="ext-card-path-value">{{ skill.path }}</span>
          </p>

          <template v-if="editingName === skill.name">
            <div class="ext-desc-editor">
              <textarea
                v-model="descriptionDraft"
                rows="3"
                spellcheck="false"
                :placeholder="t('输入技能描述')"
                :disabled="busyName === `desc:${skill.name}`"
              ></textarea>
              <div class="ext-desc-actions">
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="busyName === `desc:${skill.name}`"
                  @click="saveDescription(skill)"
                >
                  {{ t('保存描述') }}
                </button>
                <button type="button" class="btn btn-secondary" @click="cancelEditDescription">
                  {{ t('取消') }}
                </button>
                <button
                  v-if="overrides[skill.name]?.description"
                  type="button"
                  class="btn btn-ghost"
                  :disabled="busyName === `desc:${skill.name}`"
                  @click="resetDescription(skill)"
                >
                  {{ t('恢复原始描述') }}
                </button>
              </div>
            </div>
          </template>
          <p v-else class="ext-desc">{{ skill.description }}</p>

          <div v-if="skill.tags?.length" class="ext-tags">
            <span v-for="tag in skill.tags.slice(0, 4)" :key="tag" class="ext-tag">{{ tag }}</span>
          </div>

          <div class="ext-meta">
            <span>{{ skill.author || t('未知作者') }}</span>
            <span>{{ t(getCategoryLabel(skill.category)) }}</span>
            <span v-if="skill.source === 'clawhub'" class="market-source remote">ClawHub</span>
            <span>{{ skill.hasHandler ? t('脚本执行') : t('Prompt 技能') }}</span>
          </div>

          <div class="ext-actions">
            <button type="button" class="btn btn-ghost" @click="showDetails(skill)">
              {{ t('详情') }}
            </button>
            <template v-if="category === 'skills'">
              <button type="button" class="btn btn-ghost" @click="startEditDescription(skill)">
                {{ t('编辑描述') }}
              </button>
              <button type="button" class="btn btn-secondary" :disabled="Boolean(busyName)" @click="exportSkill(skill)">
                {{ t('导出技能') }}
              </button>
            </template>
            <button
              v-if="marketUpdate(skill)"
              type="button"
              class="btn btn-primary"
              :disabled="Boolean(busyName)"
              @click="updateExtension(skill)"
            >
              {{
                busyName === skill.name ? t('更新中…') : t('更新 v{version}', { version: marketUpdate(skill).version })
              }}
            </button>
            <button
              v-if="skill.canUninstall"
              type="button"
              class="btn btn-danger"
              :disabled="Boolean(busyName)"
              @click="requestUninstall(skill)"
            >
              {{ t('卸载') }}
            </button>
            <span v-else class="ext-lock">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              {{ t('不可卸载') }}
            </span>
          </div>
        </article>
      </section>
    </template>

    <SkillDetailDialog
      :visible="detailVisible"
      :skill="detailSkill"
      :badge-text="detailSkill ? badgeText(detailSkill) : ''"
      :badge-tone="detailSkill ? badgeTone(detailSkill) : 'info'"
      @close="detailVisible = false"
    >
      <template #actions>
        <button
          v-if="detailSkill?.canUninstall"
          type="button"
          class="btn btn-danger"
          :disabled="Boolean(busyName)"
          @click="requestUninstall(detailSkill)"
        >
          {{ t('卸载扩展') }}
        </button>
      </template>
    </SkillDetailDialog>

    <MessageDialog
      :visible="confirmVisible"
      type="confirm"
      :title="t('卸载扩展')"
      :message="confirmMessage"
      @confirm="confirmUninstall"
      @cancel="cancelUninstall"
    />

    <MessageDialog
      :visible="pluginConfirmVisible"
      type="confirm"
      :title="t('卸载插件')"
      :message="pluginConfirmMessage"
      @confirm="confirmPluginUninstall"
      @cancel="cancelPluginUninstall"
    />

    <PluginInstallDialog
      :visible="installDialogVisible"
      :kind="installDialogKind"
      @close="installDialogVisible = false"
      @installed="onBundleInstalled"
    />

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  extensionsInstall,
  extensionsInstallFromFolder,
  extensionsMarket,
  getConfig,
  mcpStatus,
  navigateMainWindow,
  pluginsInstallFromFolder,
  pluginsList,
  pluginsOpenDirectory,
  pluginsUninstall,
  patchConfig,
  skillsExport,
  skillsImport,
  skillsList,
  skillsUninstall
} from '@/api'
import { useToast } from '@/composables'
import { getSkillIcon } from '@/utils/skillIcons'
import { getCategoryLabel } from '@/utils/skillMeta'
import { normalizeDisabledSkills, normalizeSkillOverrides } from '@shared/skillOverrides'
import { t } from '@/i18n'
import MessageDialog from '@/components/MessageDialog.vue'
import PluginInstallDialog from '@/components/PluginInstallDialog.vue'
import SkillDetailDialog from '@/components/SkillDetailDialog.vue'
import McpSettingsPanel from '@/components/settings/McpSettingsPanel.vue'
import Toast from '@/components/Toast.vue'
import '@/styles/extensions.css'

const toast = useToast()
const { toastVisible, toastMessage, toastType } = toast

const props = defineProps({
  initialCategory: { type: String, default: 'plugins' },
  showHeader: { type: Boolean, default: true },
  showTabs: { type: Boolean, default: true },
  title: { type: String, default: '' }
})

const category = ref(props.initialCategory)
const skills = ref([])
const plugins = ref([])
const marketSkills = ref([])
const disabledSkills = ref([])
const overrides = ref({})
const connectorCount = ref(0)
const loading = ref(true)
const search = ref('')
const filter = ref('all')
const busyName = ref('')
const detailVisible = ref(false)
const detailSkill = ref(null)
const pendingUninstall = ref(null)
const pendingPlugin = ref(null)
const confirmVisible = ref(false)
const pluginConfirmVisible = ref(false)
const installMenuOpen = ref(false)
const installMenuRef = ref(null)
const installTriggerRef = ref(null)
const installDialogVisible = ref(false)
const installDialogKind = ref('skill')
const editingName = ref('')
const descriptionDraft = ref('')

const AGENT_SKILL_PROMPT =
  '请帮我创建一个 NToolBox 技能（Skill）。开始前先向我确认技能名称、用途、输入参数和期望输出，然后生成完整的 skill.json 与 handler.js，并说明安装到用户技能目录的步骤。'

const marketMap = computed(() => new Map(marketSkills.value.map((skill) => [skill.name, skill])))

const counts = computed(() => {
  const total = skills.value.length
  const builtin = skills.value.filter((skill) => skill.builtin).length
  const installed = total - builtin
  const updates = skills.value.filter((skill) => marketUpdate(skill)).length
  return { total, builtin, installed, updates, plugins: plugins.value.length }
})

const categories = computed(() => [
  {
    key: 'plugins',
    get label() {
      return t('插件')
    },
    count: counts.value.plugins
  },
  {
    key: 'skills',
    get label() {
      return t('技能')
    },
    count: counts.value.total
  },
  {
    key: 'connectors',
    get label() {
      return t('连接器')
    },
    count: connectorCount.value
  }
])

const CATEGORY_HINTS = {
  get plugins() {
    return t('插件把技能与连接器打包在一起，一次安装即可使用全部组件。')
  },
  get skills() {
    return t('技能是 AI 助手可调用的指令与脚本，安装后按需触发。')
  },
  get connectors() {
    return t('连接器通过 MCP 协议把外部工具与数据接入 AI 助手。')
  }
}

const categoryHint = computed(() => t(CATEGORY_HINTS[category.value] || ''))

const filterTabs = computed(() => [
  {
    key: 'all',
    get label() {
      return t('全部')
    },
    count: counts.value.total
  },
  {
    key: 'builtin',
    get label() {
      return t('内置')
    },
    count: counts.value.builtin
  },
  {
    key: 'installed',
    get label() {
      return t('已安装')
    },
    count: counts.value.installed
  }
])

const searchPlaceholder = computed(() =>
  t(category.value === 'plugins' ? '搜索插件名称、描述或组件' : '搜索技能名称、描述或标签')
)

const filteredPlugins = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return plugins.value
  return plugins.value.filter((plugin) =>
    [plugin.name, plugin.description, plugin.author, ...(plugin.skills || []), ...(plugin.connectors || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  )
})

const filteredSkills = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return skills.value
    .filter((skill) => {
      if (filter.value === 'builtin' && !skill.builtin) return false
      if (filter.value === 'installed' && skill.builtin) return false
      if (!keyword) return true
      return [skill.name, skill.description, skill.baseDescription, skill.author, ...(skill.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .sort((a, b) => {
      if (Boolean(a.builtin) !== Boolean(b.builtin)) return a.builtin ? 1 : -1
      return a.name.localeCompare(b.name)
    })
})

const emptyTitle = computed(() => {
  if (search.value.trim()) return t('没有找到匹配的扩展')
  return t(category.value === 'plugins' ? '还没有安装插件' : '还没有可用的技能')
})

const emptyHint = computed(() => {
  if (search.value.trim()) return t('试试更换关键词或清空搜索')
  return t(
    category.value === 'plugins'
      ? t('点击「安装插件」从本地目录或 npm、GitHub 添加')
      : t('点击「安装技能」添加，或让 Agent 为你创建')
  )
})

function isSkillEnabled(skill) {
  return skill.enabled !== false
}

function marketUpdate(skill) {
  const entry = marketMap.value.get(skill.name)
  return entry?.status === 'update' ? entry : null
}

function badgeText(skill) {
  if (!isSkillEnabled(skill)) return t('已停用')
  if (skill.builtin) return t('内置')
  if (marketUpdate(skill)) return t('可更新')
  return t('已安装')
}

function badgeTone(skill) {
  if (!isSkillEnabled(skill)) return 'warning'
  if (skill.builtin) return 'neutral'
  if (marketUpdate(skill)) return 'warning'
  return 'success'
}

function switchCategory(next) {
  if (category.value === next) return
  category.value = next
  filter.value = 'all'
  editingName.value = ''
  descriptionDraft.value = ''
}

async function load({ silent = false, refresh: forceRefresh = false } = {}) {
  if (!silent) loading.value = true
  try {
    const [skillsResult, marketResult, pluginsResult, config, statuses] = await Promise.all([
      skillsList(),
      extensionsMarket({ refresh: forceRefresh }),
      pluginsList(),
      getConfig(),
      mcpStatus()
    ])
    skills.value = Array.isArray(skillsResult) ? skillsResult : []
    marketSkills.value = Array.isArray(marketResult) ? marketResult : marketResult?.items || []
    plugins.value = Array.isArray(pluginsResult) ? pluginsResult : []
    disabledSkills.value = normalizeDisabledSkills(config?.extensions.disabled_skills)
    overrides.value = normalizeSkillOverrides(config?.extensions.skill_overrides)
    const configured = Array.isArray(config?.extensions.mcp_servers) ? config.extensions.mcp_servers.length : 0
    connectorCount.value = Math.max(Array.isArray(statuses) ? statuses.length : 0, configured)
  } catch (error) {
    toast.showError(t('加载扩展失败：{error}', { error: error?.message || t('未知错误') }))
  } finally {
    loading.value = false
  }
}

async function refresh() {
  await load({ silent: true, refresh: true })
  toast.showSuccess(t('扩展列表已刷新'))
}

function toggleInstallMenu() {
  installMenuOpen.value = !installMenuOpen.value
  if (installMenuOpen.value) {
    nextTick(() => installMenuRef.value?.querySelector('.ext-install-option')?.focus())
  }
}

function closeInstallMenu({ restoreFocus = false } = {}) {
  if (!installMenuOpen.value) return
  installMenuOpen.value = false
  if (restoreFocus) installTriggerRef.value?.focus()
}

function onDocumentPointerDown(event) {
  if (!installMenuOpen.value) return
  if (installMenuRef.value?.contains(event.target)) return
  closeInstallMenu()
}

function onDocumentKeyDown(event) {
  if (!installMenuOpen.value || event.key !== 'Escape') return
  event.preventDefault()
  closeInstallMenu({ restoreFocus: true })
}

async function chooseInstall(action) {
  closeInstallMenu()

  if (action === 'plugin-folder') {
    await installPluginFromFolder()
    return
  }

  if (action === 'plugin-source') {
    installDialogKind.value = 'plugin'
    installDialogVisible.value = true
    return
  }

  if (action === 'folder') {
    await installFromFolder()
    return
  }

  if (action === 'source') {
    installDialogKind.value = 'skill'
    installDialogVisible.value = true
    return
  }

  const success = await navigateMainWindow({ path: '/chat', prompt: AGENT_SKILL_PROMPT })
  if (!success) {
    toast.showError(t('无法打开 AI 助手'))
  }
}

async function onBundleInstalled(result) {
  if (Array.isArray(result?.skills)) {
    const connectorCount = Array.isArray(result.connectors) ? result.connectors.length : 0
    toast.showSuccess(
      t('已安装插件 {name}（技能 {skills} · 连接器 {connectors}）', {
        name: result.name,
        skills: result.skills.length,
        connectors: connectorCount
      })
    )
  } else {
    toast.showSuccess(t('已安装技能 {name}', { name: result.name }))
  }
  await load({ silent: true })
}

async function installPluginFromFolder() {
  busyName.value = 'plugin-install'
  try {
    const result = await pluginsInstallFromFolder()
    if (result?.canceled) return
    if (result?.success) {
      await onBundleInstalled(result)
    } else {
      toast.showError(result?.error || t('安装插件失败'))
    }
  } finally {
    busyName.value = ''
  }
}

async function openPluginDirectory() {
  const result = await pluginsOpenDirectory()
  if (result?.success === false) {
    toast.showError(result.error || t('打开插件目录失败'))
  }
}

async function installFromFolder() {
  busyName.value = 'local-install'
  try {
    const result = await extensionsInstallFromFolder()
    if (result?.canceled) return
    if (result?.success) {
      toast.showSuccess(t('已安装技能 {name}', { name: result.name }))
      await load({ silent: true })
    } else {
      toast.showError(result?.error || t('安装技能失败'))
    }
  } finally {
    busyName.value = ''
  }
}

async function importSkillPackage() {
  if (busyName.value) return
  busyName.value = 'import'
  try {
    const result = await skillsImport()
    if (result?.canceled) return
    if (result?.success) {
      toast.showSuccess(
        result.updated ? t('已更新技能 {name}', { name: result.name }) : t('已导入技能 {name}', { name: result.name })
      )
      await load({ silent: true })
    } else {
      toast.showError(result?.error || t('导入技能失败'))
    }
  } finally {
    busyName.value = ''
  }
}

async function exportSkill(skill) {
  if (busyName.value) return
  busyName.value = `export:${skill.name}`
  try {
    const result = await skillsExport(skill.name)
    if (result?.canceled) return
    if (result?.success) toast.showSuccess(t('已导出技能 {name}', { name: result.name }))
    else toast.showError(result?.error || t('导出技能失败'))
  } finally {
    busyName.value = ''
  }
}

async function toggleEnabled(skill) {
  if (busyName.value) return
  busyName.value = `toggle:${skill.name}`
  const next = new Set(disabledSkills.value)
  if (isSkillEnabled(skill)) next.add(skill.name)
  else next.delete(skill.name)
  const disabled = Array.from(next)
  try {
    const ok = await patchConfig({ extensions: { disabled_skills: disabled } })
    if (!ok) {
      toast.showError(t('保存失败：{error}', { error: t('配置保存失败') }))
      return
    }
    disabledSkills.value = disabled
    skills.value = skills.value.map((item) =>
      item.name === skill.name ? { ...item, enabled: !isSkillEnabled(skill) } : item
    )
    toast.showSuccess(
      isSkillEnabled(skill) ? t('已启用 {name}', { name: skill.name }) : t('已停用 {name}', { name: skill.name })
    )
  } finally {
    busyName.value = ''
  }
}

function startEditDescription(skill) {
  editingName.value = skill.name
  descriptionDraft.value = overrides.value[skill.name]?.description || ''
}

function cancelEditDescription() {
  editingName.value = ''
  descriptionDraft.value = ''
}

async function persistDescription(skill, text) {
  busyName.value = `desc:${skill.name}`
  const next = { ...overrides.value }
  if (text) next[skill.name] = { ...(next[skill.name] || {}), description: text }
  else delete next[skill.name]
  try {
    const ok = await patchConfig({ extensions: { skill_overrides: next } })
    if (!ok) {
      toast.showError(t('保存失败：{error}', { error: t('配置保存失败') }))
      return
    }
    overrides.value = next
    skills.value = skills.value.map((item) =>
      item.name === skill.name ? { ...item, description: text || item.baseDescription || item.description } : item
    )
    toast.showSuccess(t('技能描述已更新'))
    cancelEditDescription()
  } finally {
    busyName.value = ''
  }
}

function saveDescription(skill) {
  if (busyName.value) return
  return persistDescription(skill, descriptionDraft.value.trim().slice(0, 500))
}

function resetDescription(skill) {
  if (busyName.value) return
  descriptionDraft.value = ''
  return persistDescription(skill, '')
}

async function updateExtension(skill) {
  busyName.value = skill.name
  try {
    const result = await extensionsInstall(skill.name)
    if (result?.success) {
      toast.showSuccess(t('已更新扩展 {name}', { name: skill.name }))
      await load({ silent: true })
    } else {
      toast.showError(result?.error || t('更新扩展失败'))
    }
  } finally {
    busyName.value = ''
  }
}

function showDetails(skill) {
  detailSkill.value = skill
  detailVisible.value = true
}

function requestUninstall(skill) {
  pendingUninstall.value = skill
  confirmVisible.value = true
}

function cancelUninstall() {
  pendingUninstall.value = null
  confirmVisible.value = false
}

const confirmMessage = computed(() =>
  pendingUninstall.value
    ? t('确定要卸载扩展 {name} 吗？本地安装的文件会被删除。', { name: pendingUninstall.value.name })
    : ''
)

async function confirmUninstall() {
  const skill = pendingUninstall.value
  if (!skill) return
  busyName.value = skill.name
  try {
    const result = await skillsUninstall(skill.name)
    if (result?.success) {
      toast.showSuccess(t('已卸载扩展 {name}', { name: skill.name }))
      if (detailSkill.value?.name === skill.name) detailVisible.value = false
      await load({ silent: true })
    } else {
      toast.showError(result?.error || t('卸载扩展失败'))
    }
  } finally {
    busyName.value = ''
    cancelUninstall()
  }
}

function requestPluginUninstall(plugin) {
  pendingPlugin.value = plugin
  pluginConfirmVisible.value = true
}

function cancelPluginUninstall() {
  pendingPlugin.value = null
  pluginConfirmVisible.value = false
}

const pluginConfirmMessage = computed(() => {
  if (!pendingPlugin.value) return ''
  const skillCount = pendingPlugin.value.skills?.length || 0
  const connectorCount = pendingPlugin.value.connectors?.length || 0
  return t('确定要卸载插件 {name} 吗？将同时移除随插件安装的 {skills} 个技能与 {connectors} 个连接器配置。', {
    name: pendingPlugin.value.name,
    skills: skillCount,
    connectors: connectorCount
  })
})

async function confirmPluginUninstall() {
  const plugin = pendingPlugin.value
  if (!plugin) return
  busyName.value = `plugin:${plugin.name}`
  try {
    const result = await pluginsUninstall(plugin.name)
    if (result?.success) {
      const failed = Array.isArray(result.failedSkills) ? result.failedSkills.length : 0
      toast.showSuccess(
        failed
          ? t('已卸载插件 {name}，{count} 个技能需手动处理', { name: plugin.name, count: failed })
          : t('已卸载插件 {name}', { name: plugin.name })
      )
      await load({ silent: true })
    } else {
      toast.showError(result?.error || t('卸载插件失败'))
    }
  } finally {
    busyName.value = ''
    cancelPluginUninstall()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
  load()
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
})
</script>
