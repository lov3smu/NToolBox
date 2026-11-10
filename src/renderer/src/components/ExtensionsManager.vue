<template>
  <div class="extensions-manager">
    <header class="ext-manager-head">
      <div class="ext-manager-title">
        <h3>扩展管理</h3>
        <p>内置技能随应用提供且不可卸载，本地扩展安装在用户目录，可随时更新或卸载。</p>
      </div>
      <div class="ext-header-actions">
        <button type="button" class="btn btn-secondary btn-sm" :disabled="loading" @click="refresh">刷新</button>
        <button type="button" class="btn btn-secondary btn-sm" @click="openDirectory">打开目录</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="Boolean(busyName)" @click="installFromFolder">
          从文件夹安装
        </button>
      </div>
    </header>

    <section class="ext-stats">
      <article class="ext-stat">
        <span class="ext-stat-label">全部扩展</span>
        <strong>{{ counts.total }}</strong>
        <span class="ext-stat-hint">内置与本地扩展</span>
      </article>
      <article class="ext-stat">
        <span class="ext-stat-label">内置技能</span>
        <strong>{{ counts.builtin }}</strong>
        <span class="ext-stat-hint">随应用提供，不可卸载</span>
      </article>
      <article class="ext-stat">
        <span class="ext-stat-label">已安装扩展</span>
        <strong>{{ counts.installed }}</strong>
        <span class="ext-stat-hint">安装在本机用户目录</span>
      </article>
      <article class="ext-stat">
        <span class="ext-stat-label">可更新</span>
        <strong>{{ counts.updates }}</strong>
        <span class="ext-stat-hint">来自内置目录或 ClawHub</span>
      </article>
    </section>

    <section class="ext-toolbar">
      <div class="ext-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input v-model="search" type="text" placeholder="搜索技能名称、描述或标签" />
      </div>
      <div class="ext-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="ext-tab"
          :class="{ active: filter === tab.key }"
          @click="filter = tab.key"
        >
          {{ tab.label }}
          <span>{{ tab.count }}</span>
        </button>
      </div>
    </section>

    <div v-if="loading" class="ext-state">
      <span class="ext-spinner" />
      正在加载扩展…
    </div>
    <div v-else-if="!filteredSkills.length" class="ext-state">
      <p>没有匹配的扩展</p>
      <span>试试更换搜索词，或前往扩展页面安装新的技能</span>
    </div>
    <section v-else class="ext-grid">
      <article v-for="skill in filteredSkills" :key="skill.name" class="ext-card">
        <div class="ext-card-head">
          <span class="ext-icon" v-html="getSkillIcon(skill.icon, skill.category)" />
          <div class="ext-card-title">
            <h3>{{ skill.name }}</h3>
            <span class="ext-version">v{{ skill.version }}</span>
          </div>
          <span class="ext-badge" :class="badgeTone(skill)">{{ badgeText(skill) }}</span>
        </div>

        <p class="ext-desc">{{ skill.description }}</p>

        <div v-if="skill.tags?.length" class="ext-tags">
          <span v-for="tag in skill.tags.slice(0, 4)" :key="tag" class="ext-tag">{{ tag }}</span>
        </div>

        <div class="ext-meta">
          <span>{{ skill.author || '未知作者' }}</span>
          <span>{{ getCategoryLabel(skill.category) }}</span>
          <span v-if="skill.source === 'clawhub'" class="market-source remote">ClawHub</span>
          <span>{{ skill.hasHandler ? '脚本执行' : 'Prompt 技能' }}</span>
        </div>

        <div class="ext-actions">
          <button type="button" class="btn btn-ghost btn-sm" @click="showDetails(skill)">详情</button>
          <button
            v-if="marketUpdate(skill)"
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="busyName === skill.name"
            @click="updateExtension(skill)"
          >
            {{ busyName === skill.name ? '更新中…' : `更新 v${marketUpdate(skill).version}` }}
          </button>
          <button
            v-if="skill.canUninstall"
            type="button"
            class="btn btn-danger btn-sm"
            :disabled="busyName === skill.name"
            @click="requestUninstall(skill)"
          >
            卸载
          </button>
          <span v-else class="ext-lock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            不可卸载
          </span>
        </div>
      </article>
    </section>

    <footer class="ext-footer">
      <span>用户扩展安装目录：{{ installDirectoryHint }}</span>
      <button type="button" class="btn btn-ghost btn-sm" @click="openDirectory">打开目录</button>
    </footer>

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
          :disabled="busyName === detailSkill.name"
          @click="requestUninstall(detailSkill)"
        >
          卸载扩展
        </button>
      </template>
    </SkillDetailDialog>

    <MessageDialog
      :visible="confirmVisible"
      type="confirm"
      title="卸载扩展"
      :message="confirmMessage"
      @confirm="confirmUninstall"
      @cancel="cancelUninstall"
    />

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  extensionsDirectory,
  extensionsInstall,
  extensionsInstallFromFolder,
  extensionsMarket,
  extensionsOpenDirectory,
  skillsList,
  skillsUninstall
} from '@/api'
import { useToast } from '@/composables'
import { getSkillIcon } from '@/utils/skillIcons'
import { getCategoryLabel } from '@/utils/skillMeta'
import MessageDialog from '@/components/MessageDialog.vue'
import SkillDetailDialog from '@/components/SkillDetailDialog.vue'
import Toast from '@/components/Toast.vue'
import '@/styles/extensions.css'

const toast = useToast()
const { toastVisible, toastMessage, toastType } = toast

const skills = ref([])
const marketSkills = ref([])
const loading = ref(true)
const search = ref('')
const filter = ref('all')
const busyName = ref('')
const detailVisible = ref(false)
const detailSkill = ref(null)
const pendingUninstall = ref(null)
const confirmVisible = ref(false)
const installDirectoryHint = ref('用户数据目录 / skills')

const marketMap = computed(() => new Map(marketSkills.value.map((skill) => [skill.name, skill])))

const counts = computed(() => {
  const total = skills.value.length
  const builtin = skills.value.filter((skill) => skill.builtin).length
  const installed = total - builtin
  const updates = skills.value.filter((skill) => marketUpdate(skill)).length
  return { total, builtin, installed, updates }
})

const tabs = computed(() => [
  { key: 'all', label: '全部', count: counts.value.total },
  { key: 'builtin', label: '内置', count: counts.value.builtin },
  { key: 'installed', label: '已安装', count: counts.value.installed }
])

const filteredSkills = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return skills.value
    .filter((skill) => {
      if (filter.value === 'builtin' && !skill.builtin) return false
      if (filter.value === 'installed' && skill.builtin) return false
      if (!keyword) return true
      return [skill.name, skill.description, skill.author, ...(skill.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .sort((a, b) => {
      if (a.builtin !== b.builtin) return a.builtin ? 1 : -1
      return a.name.localeCompare(b.name)
    })
})

function marketUpdate(skill) {
  const entry = marketMap.value.get(skill.name)
  return entry?.status === 'update' ? entry : null
}

function badgeText(skill) {
  if (skill.builtin) return '内置'
  if (marketUpdate(skill)) return '可更新'
  return '已安装'
}

function badgeTone(skill) {
  if (skill.builtin) return 'neutral'
  if (marketUpdate(skill)) return 'warning'
  return 'success'
}

async function load({ silent = false, refresh: forceRefresh = false } = {}) {
  if (!silent) loading.value = true
  try {
    const [skillsResult, marketResult, directory] = await Promise.all([
      skillsList(),
      extensionsMarket({ refresh: forceRefresh }),
      extensionsDirectory()
    ])
    skills.value = Array.isArray(skillsResult) ? skillsResult : []
    marketSkills.value = Array.isArray(marketResult) ? marketResult : marketResult?.items || []
    if (typeof directory === 'string' && directory) installDirectoryHint.value = directory
  } finally {
    loading.value = false
  }
}

async function refresh() {
  await load({ silent: true, refresh: true })
  toast.showSuccess('扩展列表已刷新')
}

async function openDirectory() {
  const result = await extensionsOpenDirectory()
  if (!result?.success) toast.showError(result?.error || '无法打开扩展目录')
}

async function installFromFolder() {
  busyName.value = 'local-install'
  try {
    const result = await extensionsInstallFromFolder()
    if (result?.canceled) return
    if (result?.success) {
      toast.showSuccess(`已安装扩展 ${result.name}`)
      await load({ silent: true })
    } else {
      toast.showError(result?.error || '安装扩展失败')
    }
  } finally {
    busyName.value = ''
  }
}

async function updateExtension(skill) {
  busyName.value = skill.name
  try {
    const result = await extensionsInstall(skill.name)
    if (result?.success) {
      toast.showSuccess(`已更新扩展 ${skill.name}`)
      await load({ silent: true })
    } else {
      toast.showError(result?.error || '更新扩展失败')
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
  pendingUninstall.value ? `确定要卸载扩展 ${pendingUninstall.value.name} 吗？本地安装的文件会被删除。` : ''
)

async function confirmUninstall() {
  const skill = pendingUninstall.value
  if (!skill) return
  busyName.value = skill.name
  try {
    const result = await skillsUninstall(skill.name)
    if (result?.success) {
      toast.showSuccess(`已卸载扩展 ${skill.name}`)
      if (detailSkill.value?.name === skill.name) detailVisible.value = false
      await load({ silent: true })
    } else {
      toast.showError(result?.error || '卸载扩展失败')
    }
  } finally {
    busyName.value = ''
    cancelUninstall()
  }
}

onMounted(() => load())
</script>
