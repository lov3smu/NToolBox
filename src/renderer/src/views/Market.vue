<template>
  <PageLayout tool-path="/market">
    <template #header-extra>
      <div class="ext-header-actions">
        <button type="button" class="btn btn-secondary btn-sm" @click="openExtensionsManager">扩展管理</button>
        <button type="button" class="btn btn-secondary btn-sm" :disabled="loading" @click="refresh">刷新</button>
      </div>
    </template>

    <div class="extensions-page">
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
        <div class="market-hero-stats">
          <div class="market-stat">
            <strong>{{ stats.available }}</strong>
            <span>可安装</span>
          </div>
          <div class="market-stat">
            <strong>{{ stats.installed }}</strong>
            <span>已安装</span>
          </div>
          <div class="market-stat">
            <strong>{{ stats.updates }}</strong>
            <span>可更新</span>
          </div>
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
        <button type="button" class="btn btn-ghost btn-sm" @click="refresh">重试</button>
      </div>

      <div v-if="loading" class="ext-state">
        <span class="ext-spinner" />
        正在加载扩展…
      </div>
      <div v-else-if="!filteredSkills.length" class="ext-state">
        <p>没有找到匹配的扩展</p>
        <span>试试更换分类或搜索关键词</span>
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
            <button type="button" class="btn btn-ghost btn-sm" @click="showDetails(skill)">详情</button>
            <button
              v-if="skill.status === 'available' || skill.status === 'update'"
              type="button"
              class="btn btn-primary btn-sm"
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
        <span>安装位置：本机用户数据目录下的 skills 文件夹</span>
      </footer>
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

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { extensionsInstall, extensionsMarket, openSettings } from '@/api'
import { useToast } from '@/composables'
import { getSkillIcon } from '@/utils/skillIcons'
import { formatDownloads, getCategoryLabel, SKILL_CATEGORY_LABELS, SKILL_STATUS_LABELS } from '@/utils/skillMeta'
import PageLayout from '@/layouts/PageLayout.vue'
import SkillDetailDialog from '@/components/SkillDetailDialog.vue'
import Toast from '@/components/Toast.vue'
import '@/styles/extensions.css'

const toast = useToast()
const { toastVisible, toastMessage, toastType } = toast

const skills = ref([])
const remote = ref(null)
const loading = ref(true)
const search = ref('')
const activeCategory = ref('all')
const installingName = ref('')
const detailVisible = ref(false)
const detailSkill = ref(null)
const enteringGrid = ref(false)
let enteringTimer = null

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

onMounted(() => load())
</script>
