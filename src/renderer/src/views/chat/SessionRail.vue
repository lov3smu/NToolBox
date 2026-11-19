<template>
  <aside class="chat-rail" :style="{ width: `${width}px` }">
    <button class="rail-new" @click="$emit('new-chat')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8.5" x2="12" y2="15.5" />
        <line x1="8.5" y1="12" x2="15.5" y2="12" />
      </svg>
      <span>{{ t('新会话') }}</span>
    </button>

    <nav class="rail-nav">
      <button class="rail-nav-item" @click="$emit('open-memory')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 5a3 3 0 0 0-6 0 3 3 0 0 0-1 5.8A3.5 3.5 0 0 0 8 16.5V18a3 3 0 0 0 4 2.8" />
          <path d="M12 5a3 3 0 0 1 6 0 3 3 0 0 1 1 5.8 3.5 3.5 0 0 1-3 5.7V18a3 3 0 0 1-4 2.8" />
          <path d="M12 5v16" />
        </svg>
        <span>{{ t('记忆与知识库') }}</span>
      </button>
      <button class="rail-nav-item" @click="$emit('open-market')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
        <span>{{ t('扩展') }}</span>
      </button>
    </nav>

    <div class="rail-section">
      <div class="rail-section-head">
        <button
          class="rail-section-title-btn"
          :aria-expanded="workspaceOpen"
          :title="t('收起/展开工作区列表')"
          @click="$emit('toggle-workspace')"
        >
          <span class="rail-section-title">{{ t('工作区') }}</span>
          <svg class="rail-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div class="rail-section-actions">
          <button
            class="rail-icon-btn"
            :class="{ active: searchOpen }"
            :title="t('搜索会话')"
            @click="$emit('toggle-search')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="20" y1="20" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button class="rail-icon-btn" :title="t('添加工作区')" @click="$emit('add-workspace')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="searchOpen && workspaceOpen" class="rail-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.65" y2="16.65" />
        </svg>
        <input ref="searchInput" v-model="searchModel" type="text" :placeholder="t('搜索会话')" spellcheck="false" />
        <button v-if="search" :title="t('清空搜索')" @click="searchModel = ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div v-if="workspaceOpen" class="rail-list" @scroll="$emit('clear-menu')">
        <div
          v-for="group in workspaceGroups"
          :key="group.key"
          class="rail-group"
          :class="{ 'is-archived': group.archived }"
        >
          <div
            class="rail-group-head"
            :class="{ 'menu-open': workspaceMenu?.path === group.path }"
            :aria-expanded="!collapsedGroups[group.key]"
          >
            <WorkspaceHoverCard
              class="rail-group-anchor"
              :name="t(group.label)"
              :path="group.path"
              :description="group.description"
              :icon="group.icon || (group.path ? 'shield' : 'folder')"
              :color="group.color"
              :count="group.sessions.length"
              :delay="1500"
              placement="right"
              boundary=".chat-rail"
              :disabled="!group.path"
            >
              <button class="rail-group-toggle" @click="$emit('toggle-group', group.key)">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  :class="{ 'is-default': !group.path }"
                  :style="group.color ? { color: group.color } : null"
                >
                  <path v-if="group.icon" :d="iconPath(group.icon)" />
                  <path
                    v-else-if="!group.path"
                    d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                  />
                  <path v-else d="M12 22s8-3.5 8-10V5.5L12 2 4 5.5V12c0 6.5 8 10 8 10z" />
                </svg>
                <span class="rail-group-name">{{ t(group.label) }}</span>
                <svg class="rail-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </WorkspaceHoverCard>
            <div v-if="group.hasMeta" class="rail-group-meta">
              <div class="rail-group-actions">
                <button
                  class="rail-group-action"
                  :title="t('工作区操作')"
                  @click.stop="$emit('workspace-menu', group.path, $event)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none">
                    <circle cx="5" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                  </svg>
                </button>
                <button
                  class="rail-group-action"
                  :title="t('新建会话')"
                  @click.stop="$emit('workspace-new-chat', group.path)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div v-if="!collapsedGroups[group.key]" class="rail-group-body">
            <div
              v-for="session in group.sessions"
              :key="session.id"
              :class="[
                'session-item',
                { active: currentSessionId === session.id, 'menu-open': sessionMenu?.id === session.id }
              ]"
              @click="$emit('select-session', session.id)"
            >
              <span class="session-dot" aria-hidden="true" />
              <div class="session-info">
                <div v-if="editingSessionId !== session.id" class="session-title">
                  <svg
                    v-if="session.pinned"
                    class="session-pin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M12 17v5" />
                    <path d="M9 10.8V4h6v6.8l2 2.7V16H7v-2.5z" />
                  </svg>
                  <span class="session-title-text">{{ session.title || t('新会话') }}</span>
                </div>
                <input
                  v-else
                  v-model="editingTitleModel"
                  class="session-edit-input"
                  @keydown.enter="$emit('save-title', session.id, $event)"
                  @keydown.escape="$emit('cancel-title')"
                  @blur="$emit('save-title', session.id)"
                />
                <span v-if="editingSessionId !== session.id" class="session-time">
                  {{ formatTime(session.updatedAt) }}
                </span>
              </div>
              <div class="session-actions">
                <button
                  class="session-more"
                  :title="t('会话操作')"
                  @click.stop="$emit('session-menu', session.id, $event)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none">
                    <circle cx="5" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="workspaceGroups.length === 0" class="session-empty">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p>{{ search ? t('没有匹配的会话') : t('暂无会话') }}</p>
          <p class="hint">
            {{ search ? t('换个关键词试试') : t('点击上方 新会话 开始') }}
          </p>
        </div>
      </div>
    </div>

    <div class="rail-foot">
      <div class="rail-more-wrap">
        <button class="rail-more" @click.stop="$emit('toggle-rail-more')">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
          <span>{{ t('更多') }}</span>
        </button>
        <div v-if="railMoreOpen" v-clamp-viewport class="rail-more-menu" @click.stop>
          <button @click="$emit('rail-more', 'memory')">{{ t('记忆与知识库') }}</button>
          <button @click="$emit('rail-more', 'archived')">
            {{ showArchived ? t('隐藏已归档会话') : t('显示已归档会话') }}
          </button>
        </div>
      </div>
      <button class="rail-icon-btn rail-collapse" :title="t('收起侧栏')" @click="$emit('collapse')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="9" y1="4" x2="9" y2="20" />
          <polyline points="14.5 10 12 12 14.5 14" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { t } from '@/i18n'
import { WORKSPACE_ICONS } from '@/utils/workspaceIcons'
import WorkspaceHoverCard from '@/components/WorkspaceHoverCard.vue'

const props = defineProps({
  width: { type: Number, default: 260 },
  workspaceGroups: { type: Array, default: () => [] },
  collapsedGroups: { type: Object, default: () => ({}) },
  currentSessionId: { type: String, default: '' },
  sessionMenu: { type: Object, default: null },
  workspaceMenu: { type: Object, default: null },
  editingSessionId: { type: String, default: '' },
  editingTitle: { type: String, default: '' },
  search: { type: String, default: '' },
  searchOpen: { type: Boolean, default: false },
  workspaceOpen: { type: Boolean, default: true },
  railMoreOpen: { type: Boolean, default: false },
  showArchived: { type: Boolean, default: false },
  formatTime: { type: Function, required: true }
})

const emit = defineEmits([
  'new-chat',
  'open-memory',
  'open-market',
  'add-workspace',
  'toggle-search',
  'toggle-workspace',
  'toggle-group',
  'select-session',
  'session-menu',
  'workspace-menu',
  'workspace-new-chat',
  'save-title',
  'cancel-title',
  'toggle-rail-more',
  'clear-menu',
  'rail-more',
  'collapse',
  'update:search',
  'update:editingTitle'
])

const searchInput = ref(null)

const searchModel = computed({
  get: () => props.search,
  set: (value) => emit('update:search', value)
})

const editingTitleModel = computed({
  get: () => props.editingTitle,
  set: (value) => emit('update:editingTitle', value)
})

watch(
  () => props.searchOpen,
  (open) => {
    if (open) nextTick(() => searchInput.value?.focus())
  }
)

function iconPath(id) {
  return WORKSPACE_ICONS.find((item) => item.id === id)?.d || ''
}
</script>
