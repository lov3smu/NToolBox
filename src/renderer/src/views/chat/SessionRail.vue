<template>
  <aside class="chat-rail" :style="{ width: `${width}px` }">
    <button class="rail-new" @click="$emit('new-chat')">
      <AppIcon name="plus-circle" />
      <span>{{ t('新会话') }}</span>
    </button>

    <nav class="rail-nav">
      <button class="rail-nav-item" @click="$emit('open-knowledge')">
        <AppIcon name="book-open" :stroke-width="1.8" />
        <span>{{ t('知识库') }}</span>
      </button>
      <button class="rail-nav-item" @click="$emit('open-market')">
        <AppIcon name="layout-grid" :stroke-width="1.8" />
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
          <AppIcon name="chevron-down" class="rail-section-chevron" />
        </button>
        <div class="rail-section-actions">
          <button
            class="rail-icon-btn"
            :class="{ active: searchOpen }"
            :title="t('搜索会话')"
            @click="$emit('toggle-search')"
          >
            <AppIcon name="search" />
          </button>
          <button class="rail-icon-btn" :title="t('添加工作区')" @click="$emit('add-workspace')">
            <AppIcon name="plus" />
          </button>
        </div>
      </div>

      <div v-if="searchOpen && workspaceOpen" class="rail-search">
        <AppIcon name="search" />
        <input ref="searchInput" v-model="searchModel" type="text" :placeholder="t('搜索会话')" spellcheck="false" />
        <button v-if="search" :title="t('清空搜索')" @click="searchModel = ''">
          <AppIcon name="close" />
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
              :task-count="group.taskCount"
              :active-count="group.activeCount"
              :unread-count="group.unreadCount"
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
                <AppIcon name="chevron-down" class="rail-group-chevron" />
              </button>
            </WorkspaceHoverCard>
            <div v-if="group.hasMeta" class="rail-group-meta">
              <div class="rail-group-actions">
                <button
                  class="rail-group-action"
                  :title="t('工作区操作')"
                  @click.stop="$emit('workspace-menu', group.path, $event)"
                >
                  <AppIcon name="more" size="14" />
                </button>
                <button
                  class="rail-group-action"
                  :title="t('新建会话')"
                  @click.stop="$emit('workspace-new-chat', group.path)"
                >
                  <AppIcon name="plus" />
                </button>
              </div>
            </div>
          </div>
          <div
            class="rail-group-body"
            :class="{ 'is-collapsed': collapsedGroups[group.key] }"
            :inert="collapsedGroups[group.key] || undefined"
            :aria-hidden="collapsedGroups[group.key] || undefined"
          >
            <div class="rail-group-body-inner">
              <div
                v-for="session in group.sessions"
                :key="session.id"
                :class="[
                  'session-item',
                  { active: currentSessionId === session.id, 'menu-open': sessionMenu?.id === session.id }
                ]"
                @click="$emit('select-session', session.id)"
              >
                <span class="session-dot" :class="{ 'is-unread': session.unread }" aria-hidden="true" />
                <div class="session-info">
                  <div v-if="editingSessionId !== session.id" class="session-title">
                    <AppIcon v-if="session.pinned" name="pin" class="session-pin" />
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
                <div class="chat-session-actions">
                  <button
                    class="session-more"
                    :title="t('会话操作')"
                    @click.stop="$emit('session-menu', session.id, $event)"
                  >
                    <AppIcon name="more" size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <EmptyState
          v-if="workspaceGroups.length === 0"
          size="sm"
          icon="message-square"
          :title="search ? t('没有匹配的会话') : t('暂无会话')"
          :description="search ? t('换个关键词试试') : t('点击上方 新会话 开始')"
        />
      </div>
    </div>

    <div class="rail-foot">
      <div class="rail-more-wrap">
        <button class="rail-more" @click.stop="$emit('toggle-rail-more')">
          <AppIcon name="more" />
          <span>{{ t('更多') }}</span>
        </button>
        <div v-if="railMoreOpen" v-clamp-viewport class="rail-more-menu menu-pop" role="menu" @click.stop>
          <button role="menuitem" @click="$emit('rail-more', 'memory')">{{ t('记忆') }}</button>
          <button role="menuitem" @click="$emit('rail-more', 'archived')">
            {{ showArchived ? t('隐藏已归档会话') : t('显示已归档会话') }}
          </button>
        </div>
      </div>
      <button class="rail-icon-btn rail-collapse" :title="t('收起侧栏')" @click="$emit('collapse')">
        <AppIcon name="panel-left" />
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { t } from '@/i18n'
import { WORKSPACE_ICONS } from '@/utils/workspaceIcons'
import WorkspaceHoverCard from './components/WorkspaceHoverCard.vue'

import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
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
  'open-knowledge',
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
