<template>
  <PageLayout tool-path="/password-manager" page-class="password-manager-page">
    <template #actions>
      <div class="vault-toolbar">
        <template v-if="!vaultLocked">
          <button class="btn btn-primary btn-sm" @click="openCreateEntry()">
            <AppIcon name="plus" size="14" />
            {{ t('新建密码') }}
          </button>
          <button class="btn btn-secondary btn-sm" @click="openGenerator()">
            <AppIcon name="key-generate" size="14" />
            {{ t('生成密码') }}
          </button>
          <button class="btn btn-secondary btn-sm" @click="startCreateGroup()">
            <AppIcon name="folder-plus" size="14" />
            {{ t('新建分组') }}
          </button>
          <span class="toolbar-divider" />
          <button class="btn btn-secondary btn-sm" :disabled="!selectedEntry" @click="openEditEntry()">
            <AppIcon name="edit" size="14" />
            {{ t('编辑') }}
          </button>
          <button class="btn btn-danger btn-sm" :disabled="!selectedEntry" @click="confirmDeleteEntry(selectedEntry)">
            <AppIcon name="trash" :size="14" />
            {{ t('删除') }}
          </button>
        </template>
        <span class="toolbar-spacer" />
        <label v-if="!vaultLocked" class="vault-search">
          <AppIcon name="search" :size="14" />
          <input
            ref="searchInput"
            v-model="searchText"
            :placeholder="t('搜索 (Ctrl+F)...')"
            @keyup.esc="searchText = ''"
          />
          <button v-if="searchText" type="button" class="search-clear" @click="searchText = ''">
            <AppIcon name="close" :size="12" />
          </button>
        </label>
      </div>
    </template>

    <div v-if="vaultReady && vaultLocked" class="page-body vault-page vault-lock-page">
      <form class="vault-lock-card" @submit.prevent="submitMasterPassword">
        <div class="vault-lock-icon">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <h2>{{ vaultInitialized ? t('解锁密码保险库') : t('设置管理密码') }}</h2>
        <p class="vault-lock-desc">
          {{
            vaultInitialized
              ? t('输入管理密码以查看加密保存的密码条目。')
              : t('首次使用密码管理，需要先设置一个管理密码。')
          }}
        </p>
        <label class="vault-lock-field">
          <span>{{ t('管理密码') }}</span>
          <AppInput
            ref="masterInput"
            v-model="masterPassword"
            type="password"
            :maxlength="MAX_MASTER_PASSWORD_LENGTH"
            :autocomplete="vaultInitialized ? 'current-password' : 'new-password'"
            :placeholder="t('请输入管理密码')"
            @input="masterError = ''"
          />
        </label>
        <label v-if="!vaultInitialized" class="vault-lock-field">
          <span>{{ t('确认管理密码') }}</span>
          <AppInput
            v-model="masterConfirm"
            type="password"
            :maxlength="MAX_MASTER_PASSWORD_LENGTH"
            autocomplete="new-password"
            :placeholder="t('再次输入管理密码')"
            @input="masterError = ''"
          />
        </label>
        <p v-if="!vaultInitialized" class="vault-lock-hint">{{ t('请牢记管理密码，每次进入密码管理都需要输入。') }}</p>
        <p v-if="masterError" class="vault-lock-error">{{ masterError }}</p>
        <button type="submit" class="btn btn-primary vault-lock-submit" :disabled="masterBusy">
          {{ vaultInitialized ? t('解锁') : t('设置并进入') }}
        </button>
      </form>
    </div>

    <div v-else-if="vaultReady" class="page-body vault-page">
      <div class="vault-shell">
        <aside class="vault-sidebar">
          <div class="tree-section">
            <div
              class="tree-node"
              :class="{ selected: isRootActive }"
              @contextmenu.prevent="openGroupContextMenu($event, null)"
            >
              <button
                type="button"
                class="tree-toggle"
                :aria-expanded="rootExpanded"
                @click="rootExpanded = !rootExpanded"
              >
                <AppIcon name="chevron-right" :class="{ open: rootExpanded }" />
              </button>
              <button type="button" class="tree-label" @click="selectGroup(null)">
                <span class="node-icon">
                  <AppIcon name="home" />
                </span>
                <span class="node-name">{{ t('根分组') }}</span>
                <span class="node-count">{{ rootCount }}</span>
              </button>
            </div>

            <template v-if="rootExpanded">
              <div
                v-for="node in treeNodes"
                :key="node.group.id"
                class="tree-node"
                :class="{ selected: isGroupActive(node.group) }"
                @contextmenu.prevent="openGroupContextMenu($event, node.group)"
              >
                <span class="tree-indent" :style="{ width: `${4 + (node.depth - 1) * 12}px` }" />
                <button
                  v-if="hasChildGroups(node.group.id)"
                  type="button"
                  class="tree-toggle"
                  :aria-expanded="!isGroupCollapsed(node.group.id)"
                  @click="toggleGroupExpanded(node.group.id)"
                >
                  <AppIcon name="chevron-right" :class="{ open: !isGroupCollapsed(node.group.id) }" />
                </button>
                <span v-else class="tree-toggle-spacer" />
                <button type="button" class="tree-label" @click="selectGroup(node.group.id)">
                  <span class="node-icon">
                    <AppIcon name="folder" />
                  </span>
                  <span class="node-name">{{ node.group.name }}</span>
                  <span class="node-count">{{ groupEntryCount(node.group.id) }}</span>
                </button>
                <div class="node-actions">
                  <button class="btn-icon btn-sm" :title="t('编辑分组')" @click.stop="startEditGroup(node.group)">
                    <AppIcon name="edit" size="14" />
                  </button>
                  <button
                    class="btn-icon btn-sm btn-icon-danger"
                    :title="t('删除分组')"
                    @click.stop="confirmDeleteGroup(node.group)"
                  >
                    <AppIcon name="trash" :size="14" />
                  </button>
                </div>
              </div>
              <div v-if="!groups.length" class="tree-empty">{{ t('暂无分组') }}</div>
            </template>
          </div>

          <div class="filter-section">
            <div class="filter-heading">{{ t('搜索与标签') }}</div>
            <button
              type="button"
              class="filter-item"
              :class="{ active: hasFilter }"
              :disabled="!hasFilter"
              @click="clearFilters"
            >
              <AppIcon name="search-x" :size="14" />
              <span class="filter-label">{{ t('清除搜索') }}</span>
            </button>
            <button type="button" class="filter-item" :class="{ active: showAll }" @click="selectAllEntries">
              <AppIcon name="list" size="14" />
              <span class="filter-label">{{ t('所有条目') }}</span>
              <span class="filter-count">{{ entries.length }}</span>
            </button>

            <template v-if="allTags.length">
              <div class="filter-heading tags">{{ t('标签') }}</div>
              <button
                v-for="tag in allTags"
                :key="tag"
                type="button"
                class="filter-item"
                :class="{ active: activeTag === tag }"
                @click="toggleTag(tag)"
              >
                <AppIcon name="tag" size="14" />
                <span class="filter-label">{{ tag }}</span>
                <span class="filter-count">{{ tagCounts.get(tag) }}</span>
              </button>
            </template>
          </div>

          <div class="vault-note">
            <AppIcon name="lock" size="13" />
            {{ t('全部数据加密保存在本机') }}
          </div>
        </aside>

        <section class="vault-list">
          <div class="list-scroll">
            <table class="entry-table">
              <colgroup>
                <col class="col-title" />
                <col class="col-user" />
                <col class="col-url" />
                <col class="col-notes" />
                <col class="col-time" />
                <col class="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" class="sortable" :title="t('排序')" @click="toggleSort('title')">
                    <span class="th-label">
                      <AppIcon name="lock" size="13" />
                      {{ t('标题') }}
                    </span>
                    <span v-if="sortKey === 'title'" class="sort-arrow" :class="{ desc: sortDir === 'desc' }"> ▲ </span>
                  </th>
                  <th scope="col" class="sortable" :title="t('排序')" @click="toggleSort('username')">
                    {{ t('用户名') }}
                    <span v-if="sortKey === 'username'" class="sort-arrow" :class="{ desc: sortDir === 'desc' }">
                      ▲
                    </span>
                  </th>
                  <th scope="col" class="sortable" :title="t('排序')" @click="toggleSort('url')">
                    {{ t('URL 地址') }}
                    <span v-if="sortKey === 'url'" class="sort-arrow" :class="{ desc: sortDir === 'desc' }">▲</span>
                  </th>
                  <th scope="col" class="sortable" :title="t('排序')" @click="toggleSort('notes')">
                    {{ t('备注') }}
                    <span v-if="sortKey === 'notes'" class="sort-arrow" :class="{ desc: sortDir === 'desc' }">▲</span>
                  </th>
                  <th scope="col" class="sortable" :title="t('排序')" @click="toggleSort('updatedAt')">
                    {{ t('修改时间') }}
                    <span v-if="sortKey === 'updatedAt'" class="sort-arrow" :class="{ desc: sortDir === 'desc' }">
                      ▲
                    </span>
                  </th>
                  <th scope="col" class="col-actions-head" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in visibleEntries"
                  :key="entry.id"
                  :class="{ selected: entry.id === selectedEntryId }"
                  @click="selectedEntryId = entry.id"
                  @dblclick="openEditEntry(entry)"
                >
                  <td>
                    <div class="cell-title">
                      <span class="cell-icon">
                        <AppIcon name="key" />
                      </span>
                      <span class="cell-text" :title="entry.title">{{ entry.title }}</span>
                    </div>
                  </td>
                  <td :title="entry.username">{{ entry.username || '—' }}</td>
                  <td>
                    <button
                      v-if="entry.url"
                      type="button"
                      class="url-link"
                      :title="entry.url"
                      @click.stop="openUrl(entry.url)"
                    >
                      {{ entry.url }}
                    </button>
                    <span v-else class="cell-muted">—</span>
                  </td>
                  <td :title="entry.notes">{{ entry.notes || '—' }}</td>
                  <td :title="formatDateTime(entry.updatedAt)">
                    {{ formatDateTime(entry.updatedAt, 'datetime') || '—' }}
                  </td>
                  <td class="cell-actions" @click.stop>
                    <div class="row-actions">
                      <button
                        class="btn-icon btn-sm"
                        :title="t('复制')"
                        :disabled="!entry.username"
                        @click="copyText(entry.username)"
                      >
                        <AppIcon name="user" size="14" />
                      </button>
                      <button
                        class="btn-icon btn-sm"
                        :title="t('复制密码')"
                        :disabled="!entry.hasPassword"
                        @click="copyEntryPassword(entry)"
                      >
                        <AppIcon name="key" size="14" />
                      </button>
                      <button class="btn-icon btn-sm" :title="t('编辑')" @click="openEditEntry(entry)">
                        <AppIcon name="edit" size="14" />
                      </button>
                      <button
                        class="btn-icon btn-sm btn-icon-danger"
                        :title="t('删除')"
                        @click="confirmDeleteEntry(entry)"
                      >
                        <AppIcon name="trash" :size="14" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="!visibleEntries.length" class="list-empty">
              <AppIcon name="lock" :stroke-width="1.6" />
              <p>{{ entries.length ? t('没有匹配的密码') : t('暂无密码条目') }}</p>
              <button v-if="!entries.length" class="btn btn-primary btn-sm" @click="openCreateEntry()">
                {{ t('新建密码') }}
              </button>
            </div>
          </div>

          <footer class="list-status">
            <span class="status-scope">{{ scopeLabel }}</span>
            <span>·</span>
            <span>{{ t('共 {count} 条', { count: visibleEntries.length }) }}</span>
          </footer>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="editorVisible" class="vault-modal-overlay">
        <div class="vault-modal" role="dialog" aria-modal="true">
          <header class="vault-modal-header">
            <div class="vault-modal-heading">
              <h2>{{ creating ? t('新建密码') : t('编辑密码') }}</h2>
              <span class="vault-modal-sub">{{ editorGroupName }}</span>
            </div>
            <button type="button" class="btn-icon" :title="t('取消')" @click="closeEditor">
              <AppIcon name="close" :size="16" />
            </button>
          </header>

          <div class="vault-modal-body">
            <div class="form-grid">
              <div class="field field-wide">
                <label class="field-label">{{ t('标题') }}</label>
                <AppInput ref="titleInput" v-model="form.title" maxlength="120" :placeholder="t('例如：GitHub')" />
              </div>

              <div class="field">
                <label class="field-label">{{ t('用户名') }}</label>
                <div class="inline-control">
                  <AppInput v-model="form.username" maxlength="200" autocomplete="off" :placeholder="t('用户名')" />
                  <button
                    class="btn-icon"
                    :title="t('复制')"
                    :disabled="!form.username"
                    @click="copyText(form.username)"
                  >
                    <AppIcon name="copy" :size="14" />
                  </button>
                </div>
              </div>

              <div class="field">
                <label class="field-label">{{ t('密码') }}</label>
                <div class="inline-control">
                  <AppInput
                    v-model="form.password"
                    :type="formPasswordVisible ? 'text' : 'password'"
                    maxlength="512"
                    autocomplete="new-password"
                    :placeholder="form.id ? '' : t('设置密码')"
                  />
                  <button class="btn-icon" :title="t('生成密码')" @click="openGenerator(true)">
                    <AppIcon name="key-generate" size="14" />
                  </button>
                  <button
                    class="btn-icon"
                    :title="formPasswordVisible ? t('隐藏密码') : t('显示密码')"
                    :disabled="!form.id && !form.password"
                    @click="toggleFormPassword"
                  >
                    <AppIcon v-if="formPasswordVisible" name="eye" :size="14" />
                    <AppIcon v-else name="eye-off" size="14" />
                  </button>
                  <button
                    class="btn-icon"
                    :title="t('复制密码')"
                    :disabled="!form.id && !form.password"
                    @click="copyFormPassword"
                  >
                    <AppIcon name="copy" :size="14" />
                  </button>
                </div>
                <div class="field-hint">
                  {{ form.id ? t('留空则保持原密码') : t('密码将使用本机密钥加密存储') }}
                </div>
              </div>

              <div class="field field-wide">
                <label class="field-label">{{ t('URL 地址') }}</label>
                <div class="inline-control">
                  <AppInput v-model="form.url" maxlength="1024" autocomplete="off" placeholder="https://example.com" />
                  <button class="btn-icon" :title="t('打开链接')" :disabled="!form.url" @click="openUrl(form.url)">
                    <AppIcon name="external-link" size="14" />
                  </button>
                  <button class="btn-icon" :title="t('复制')" :disabled="!form.url" @click="copyText(form.url)">
                    <AppIcon name="copy" :size="14" />
                  </button>
                </div>
              </div>

              <div class="field field-wide">
                <label class="field-label">{{ t('标签') }}</label>
                <AppInput v-model="form.tagsText" :placeholder="t('多个标签用逗号分隔')" />
                <div v-if="parsedTags.length" class="entry-tags tag-preview">
                  <span v-for="tag in parsedTags" :key="tag" class="mini-tag">{{ tag }}</span>
                </div>
              </div>

              <div class="field field-wide">
                <label class="field-label">{{ t('备注') }}</label>
                <AppTextarea v-model="form.notes" class="vault-textarea" maxlength="4000" />
              </div>
            </div>
          </div>

          <footer class="vault-modal-footer">
            <button
              v-if="!creating"
              class="btn btn-danger btn-sm"
              :disabled="saving"
              @click="confirmDeleteEntry(selectedEntry)"
            >
              {{ t('删除') }}
            </button>
            <span class="footer-spacer" />
            <button class="btn btn-secondary" :disabled="saving" @click="closeEditor">{{ t('取消') }}</button>
            <button class="btn btn-primary" :disabled="saving" @click="saveEntry">{{ t('保存') }}</button>
          </footer>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="groupEditorVisible" class="vault-modal-overlay">
        <div class="vault-modal" role="dialog" aria-modal="true">
          <header class="vault-modal-header">
            <div class="vault-modal-heading">
              <h2>{{ groupModalTitle }}</h2>
              <span class="vault-modal-sub">{{ t('上级分组：{name}', { name: groupParentLabel }) }}</span>
            </div>
            <button type="button" class="btn-icon" :title="t('取消')" @click="closeGroupEditor">
              <AppIcon name="close" :size="16" />
            </button>
          </header>

          <div class="vault-modal-body">
            <div class="form-grid">
              <div class="field field-wide">
                <label class="field-label">{{ t('名称') }}</label>
                <AppInput
                  ref="groupNameInput"
                  v-model="groupForm.name"
                  maxlength="60"
                  :placeholder="t('分组名称')"
                  @keyup.enter="saveGroup"
                />
              </div>

              <div class="field field-wide">
                <label class="field-label">{{ t('备注') }}</label>
                <AppTextarea v-model="groupForm.notes" class="vault-textarea" maxlength="4000" />
              </div>
            </div>
          </div>

          <footer class="vault-modal-footer">
            <span class="footer-spacer" />
            <button class="btn btn-secondary" :disabled="groupSaving" @click="closeGroupEditor">
              {{ t('取消') }}
            </button>
            <button class="btn btn-primary" :disabled="groupSaving" @click="saveGroup">{{ t('保存') }}</button>
          </footer>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="context-backdrop"
        @click="closeGroupContextMenu"
        @contextmenu.prevent="closeGroupContextMenu"
        @wheel.passive="closeGroupContextMenu"
      />
      <div
        v-if="contextMenuVisible"
        v-clamp-viewport
        class="context-menu"
        role="menu"
        :style="{ left: `${contextMenuX}px`, top: `${contextMenuY}px` }"
      >
        <button
          v-if="contextMenuGroup"
          type="button"
          class="context-item"
          role="menuitem"
          @click="handleContextAction('subgroup')"
        >
          <AppIcon name="folder-plus" size="14" />
          {{ t('新建子分组') }}
        </button>
        <button v-else type="button" class="context-item" role="menuitem" @click="handleContextAction('group')">
          <AppIcon name="folder-plus" size="14" />
          {{ t('新建分组') }}
        </button>
        <button type="button" class="context-item" role="menuitem" @click="handleContextAction('entry')">
          <AppIcon name="key" size="14" />
          {{ t('新建密码') }}
        </button>
        <template v-if="contextMenuGroup">
          <div class="context-divider" />
          <button type="button" class="context-item" role="menuitem" @click="handleContextAction('edit')">
            <AppIcon name="edit" size="14" />
            {{ t('编辑分组') }}
          </button>
          <button type="button" class="context-item danger" role="menuitem" @click="handleContextAction('delete')">
            <AppIcon name="trash" :size="14" />
            {{ t('删除分组') }}
          </button>
        </template>
      </div>
    </Teleport>

    <PasswordGeneratorDialog
      :visible="generatorVisible"
      :allow-apply="generatorApply"
      @close="closeGenerator"
      @apply="applyGeneratedPassword"
      @copied="showSuccess(t('已复制到剪贴板'))"
      @copy-failed="showError(t('复制失败'))"
    />
    <MessageDialog
      :visible="confirmVisible"
      type="confirm"
      :title="confirmTitle"
      :message="confirmMessage"
      @confirm="handleConfirm"
      @cancel="closeConfirm"
      @close="closeConfirm"
    />
  </PageLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useToast } from '@/composables'
import { copyToClipboard } from '@/utils/clipboard'
import { formatDateTime } from '@/utils/format'
import {
  MAX_MASTER_PASSWORD_LENGTH,
  MIN_MASTER_PASSWORD_LENGTH,
  PASSWORD_VAULT_ERRORS,
  normalizeTags
} from '@shared/passwordVault'
import PageLayout from '@/layouts/PageLayout.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import PasswordGeneratorDialog from '@/components/PasswordGeneratorDialog.vue'
import { t } from '@/i18n'
import {
  openExternal,
  passwordEntryDelete,
  passwordEntryReveal,
  passwordEntrySave,
  passwordGroupDelete,
  passwordGroupSave,
  passwordVaultLock,
  passwordVaultSetMasterPassword,
  passwordVaultState,
  passwordVaultUnlock
} from '@/api'

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
import AppTextarea from '@/components/AppTextarea.vue'
const { showSuccess, showError, showWarning } = useToast()

const groups = ref([])
const entries = ref([])
const selectedGroupId = ref(null)
const selectedEntryId = ref('')
const showAll = ref(false)
const searchText = ref('')
const activeTag = ref('')
const sortKey = ref('updatedAt')
const sortDir = ref('desc')
const rootExpanded = ref(true)

const editorVisible = ref(false)
const creating = ref(false)
const saving = ref(false)

const groupEditorVisible = ref(false)
const groupCreating = ref(false)
const groupSaving = ref(false)
const groupNameInput = ref(null)
const collapsedGroupIds = ref(new Set())

const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuGroup = ref(null)

const searchInput = ref(null)
const titleInput = ref(null)
const formPasswordVisible = ref(false)

const generatorVisible = ref(false)
const generatorApply = ref(false)

const vaultReady = ref(false)
const vaultInitialized = ref(false)
const vaultLocked = ref(true)
const masterInput = ref(null)
const masterPassword = ref('')
const masterConfirm = ref('')
const masterError = ref('')
const masterBusy = ref(false)

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
let pendingConfirm = null

function emptyForm(groupId = null) {
  return {
    id: '',
    groupId,
    title: '',
    username: '',
    password: '',
    url: '',
    tagsText: '',
    notes: ''
  }
}

const form = ref(emptyForm())

function emptyGroupForm() {
  return { id: '', parentId: null, name: '', notes: '' }
}

const groupForm = ref(emptyGroupForm())

const selectedEntry = computed(() => entries.value.find((entry) => entry.id === selectedEntryId.value) || null)

const hasFilter = computed(() => Boolean(searchText.value.trim() || activeTag.value))

const isRootActive = computed(() => !showAll.value && selectedGroupId.value === null)

function isGroupActive(group) {
  return !showAll.value && selectedGroupId.value === group.id
}

const groupParents = computed(() => new Map(groups.value.map((group) => [group.id, group.parentId || null])))

const treeNodes = computed(() => {
  if (!rootExpanded.value) return []
  const childrenByParent = new Map()
  for (const group of groups.value) {
    const key = group.parentId || null
    if (!childrenByParent.has(key)) childrenByParent.set(key, [])
    childrenByParent.get(key).push(group)
  }
  const nodes = []
  const walk = (parentId, depth) => {
    for (const group of childrenByParent.get(parentId) || []) {
      nodes.push({ group, depth })
      if (!collapsedGroupIds.value.has(group.id)) walk(group.id, depth + 1)
    }
  }
  walk(null, 1)
  return nodes
})

function hasChildGroups(groupId) {
  return groups.value.some((group) => group.parentId === groupId)
}

function isGroupCollapsed(groupId) {
  return collapsedGroupIds.value.has(groupId)
}

function toggleGroupExpanded(groupId) {
  const next = new Set(collapsedGroupIds.value)
  if (next.has(groupId)) next.delete(groupId)
  else next.add(groupId)
  collapsedGroupIds.value = next
}

function groupInSubtree(groupId, ancestorId) {
  let cursor = groupId
  const seen = new Set()
  while (cursor) {
    if (cursor === ancestorId) return true
    if (seen.has(cursor)) return false
    seen.add(cursor)
    cursor = groupParents.value.get(cursor) || null
  }
  return false
}

const scopedEntries = computed(() => {
  if (showAll.value) return entries.value
  if (selectedGroupId.value === null) return entries.value.filter((entry) => !entry.groupId)
  return entries.value.filter((entry) => entry.groupId && groupInSubtree(entry.groupId, selectedGroupId.value))
})

function compareEntries(a, b) {
  const direction = sortDir.value === 'asc' ? 1 : -1
  const key = sortKey.value
  const left = String(a[key] ?? '')
  const right = String(b[key] ?? '')
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }) * direction
}

const visibleEntries = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  const list = scopedEntries.value.filter((entry) => {
    if (activeTag.value && !entry.tags.includes(activeTag.value)) return false
    if (!keyword) return true
    const haystack = [entry.title, entry.username, entry.url, entry.notes, ...entry.tags].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
  return list.slice().sort(compareEntries)
})

const rootCount = computed(() => entries.value.filter((entry) => !entry.groupId).length)

const allTags = computed(() => {
  const seen = new Set()
  const tags = []
  for (const entry of entries.value) {
    for (const tag of entry.tags) {
      const key = tag.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags
})

const tagCounts = computed(() => {
  const counts = new Map()
  for (const entry of entries.value) {
    for (const tag of entry.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  return counts
})

const scopeLabel = computed(() => {
  if (showAll.value) return t('所有条目')
  if (!selectedGroupId.value) return t('根分组')
  return groups.value.find((group) => group.id === selectedGroupId.value)?.name || t('根分组')
})

const editorGroupName = computed(() => {
  if (!form.value.groupId) return t('根分组')
  return groups.value.find((group) => group.id === form.value.groupId)?.name || t('根分组')
})

const groupModalTitle = computed(() => {
  if (!groupCreating.value) return t('编辑分组')
  return groupForm.value.parentId ? t('新建子分组') : t('新建分组')
})

const groupParentLabel = computed(() => {
  if (!groupForm.value.parentId) return t('根分组')
  return groups.value.find((group) => group.id === groupForm.value.parentId)?.name || t('根分组')
})

const parsedTags = computed(() => normalizeTags(form.value.tagsText))

function groupEntryCount(groupId) {
  return entries.value.filter((entry) => entry.groupId && groupInSubtree(entry.groupId, groupId)).length
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = key === 'updatedAt' ? 'desc' : 'asc'
}

function selectGroup(groupId) {
  showAll.value = false
  selectedGroupId.value = groupId
  selectedEntryId.value = ''
}

function selectAllEntries() {
  showAll.value = true
  selectedGroupId.value = null
  selectedEntryId.value = ''
}

function clearFilters() {
  searchText.value = ''
  activeTag.value = ''
}

function toggleTag(tag) {
  activeTag.value = activeTag.value === tag ? '' : tag
}

function applyState(result) {
  if (!result?.success) return false
  groups.value = Array.isArray(result.groups) ? result.groups : []
  entries.value = Array.isArray(result.entries) ? result.entries : []
  if (selectedGroupId.value && !groups.value.some((group) => group.id === selectedGroupId.value)) {
    selectedGroupId.value = null
    showAll.value = false
  }
  if (selectedEntryId.value && !entries.value.some((entry) => entry.id === selectedEntryId.value)) {
    selectedEntryId.value = ''
  }
  if (activeTag.value && !allTags.value.includes(activeTag.value)) activeTag.value = ''
  const groupIds = new Set(groups.value.map((group) => group.id))
  collapsedGroupIds.value = new Set([...collapsedGroupIds.value].filter((id) => groupIds.has(id)))
  return true
}

function errorText(code) {
  switch (code) {
    case PASSWORD_VAULT_ERRORS.GROUP_NAME_REQUIRED:
      return t('请输入分组名称')
    case PASSWORD_VAULT_ERRORS.GROUP_NAME_DUPLICATE:
      return t('分组名称已存在')
    case PASSWORD_VAULT_ERRORS.GROUP_NOT_FOUND:
      return t('分组不存在')
    case PASSWORD_VAULT_ERRORS.ENTRY_TITLE_REQUIRED:
      return t('请输入标题')
    case PASSWORD_VAULT_ERRORS.ENTRY_NOT_FOUND:
      return t('密码条目不存在')
    case PASSWORD_VAULT_ERRORS.VAULT_LOCKED:
      return t('密码保险库已锁定')
    case PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_REQUIRED:
      return t('请输入管理密码')
    case PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_TOO_SHORT:
      return t('管理密码至少需要 8 个字符')
    case PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_TOO_LONG:
      return t('管理密码不能超过 128 个字符')
    case PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_INCORRECT:
      return t('管理密码错误')
    case PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_ALREADY_SET:
      return t('管理密码已设置')
    case PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_NOT_SET:
      return t('请先设置管理密码')
    default:
      return t('操作失败')
  }
}

async function loadState() {
  const result = await passwordVaultState()
  if (!result?.success) {
    showError(t('加载密码保险库失败'))
    return
  }
  if (result.locked) {
    vaultInitialized.value = Boolean(result.initialized)
    vaultLocked.value = true
    groups.value = []
    entries.value = []
    selectedEntryId.value = ''
    vaultReady.value = true
    await nextTick()
    masterInput.value?.focus()
    return
  }
  if (!applyState(result)) {
    showError(t('加载密码保险库失败'))
    return
  }
  vaultInitialized.value = true
  vaultLocked.value = false
  vaultReady.value = true
}

async function submitMasterPassword() {
  if (masterBusy.value) return
  masterError.value = ''
  const password = masterPassword.value
  const settingUp = !vaultInitialized.value
  if (!password) {
    masterError.value = t('请输入管理密码')
    return
  }
  if (settingUp) {
    if (password.length < MIN_MASTER_PASSWORD_LENGTH) {
      masterError.value = t('管理密码至少需要 8 个字符')
      return
    }
    if (password !== masterConfirm.value) {
      masterError.value = t('两次输入的管理密码不一致')
      return
    }
  }

  masterBusy.value = true
  try {
    const result = settingUp ? await passwordVaultSetMasterPassword(password) : await passwordVaultUnlock(password)
    if (!result?.success) {
      masterError.value = errorText(result?.error)
      return
    }
    vaultInitialized.value = true
    vaultLocked.value = false
    masterPassword.value = ''
    masterConfirm.value = ''
    applyState(result)
    showSuccess(settingUp ? t('管理密码已设置') : t('密码保险库已解锁'))
  } finally {
    masterBusy.value = false
  }
}

watch(vaultLocked, async (locked) => {
  if (!locked) return
  await nextTick()
  masterInput.value?.focus()
})

function loadForm(entry) {
  form.value = {
    id: entry.id,
    groupId: entry.groupId,
    title: entry.title,
    username: entry.username,
    password: '',
    url: entry.url,
    tagsText: entry.tags.join(', '),
    notes: entry.notes
  }
}

async function openCreateEntry(groupId = undefined) {
  creating.value = true
  formPasswordVisible.value = false
  const target = groupId === undefined ? (showAll.value ? null : selectedGroupId.value) : groupId
  form.value = emptyForm(target ?? null)
  editorVisible.value = true
  await nextTick()
  titleInput.value?.focus()
}

async function openEditEntry(entry = selectedEntry.value) {
  if (!entry) return
  selectedEntryId.value = entry.id
  creating.value = false
  formPasswordVisible.value = false
  loadForm(entry)
  editorVisible.value = true
  await nextTick()
  titleInput.value?.focus()
}

function closeEditor() {
  editorVisible.value = false
  creating.value = false
  formPasswordVisible.value = false
  generatorVisible.value = false
  form.value = emptyForm()
}

async function saveEntry() {
  if (saving.value) return
  if (!form.value.title.trim()) {
    showWarning(t('请输入标题'))
    return
  }
  saving.value = true
  try {
    const result = await passwordEntrySave({
      id: form.value.id || undefined,
      groupId: form.value.groupId ?? null,
      title: form.value.title,
      username: form.value.username,
      password: form.value.password,
      url: form.value.url,
      tags: parsedTags.value,
      notes: form.value.notes
    })
    if (!applyState(result)) {
      showError(errorText(result?.error))
      return
    }
    creating.value = false
    editorVisible.value = false
    selectedEntryId.value = result.id || ''
    showSuccess(t('密码已保存'))
  } finally {
    saving.value = false
  }
}

async function copyFormPassword() {
  let password = form.value.password
  if (!password && form.value.id) {
    const result = await passwordEntryReveal(form.value.id)
    if (!result?.success) {
      showError(errorText(result?.error))
      return
    }
    password = result.password || ''
  }
  if (!password) {
    showWarning(t('暂无密码'))
    return
  }
  await copyText(password)
}

async function copyEntryPassword(entry) {
  if (!entry.hasPassword) {
    showWarning(t('暂无密码'))
    return
  }
  const result = await passwordEntryReveal(entry.id)
  if (!result?.success) {
    showError(errorText(result?.error))
    return
  }
  if (!result.password) {
    showWarning(t('暂无密码'))
    return
  }
  await copyText(result.password)
}

async function copyText(value) {
  if (!value) return
  const copied = await copyToClipboard(value)
  if (copied) showSuccess(t('已复制到剪贴板'))
  else showError(t('复制失败'))
}

function openUrl(value) {
  let url = String(value || '').trim()
  if (!url) return
  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)) url = `https://${url}`
  openExternal(url)
}

async function toggleFormPassword() {
  if (form.value.id && !form.value.password) {
    const result = await passwordEntryReveal(form.value.id)
    if (!result?.success) {
      showError(errorText(result?.error))
      return
    }
    form.value.password = result.password || ''
  }
  formPasswordVisible.value = !formPasswordVisible.value
}

function openGenerator(applyToEntry = false) {
  generatorApply.value = applyToEntry
  generatorVisible.value = true
}

function closeGenerator() {
  generatorVisible.value = false
}

function applyGeneratedPassword(password) {
  if (!editorVisible.value) return
  form.value.password = password
  formPasswordVisible.value = true
  closeGenerator()
}

async function startCreateGroup(parentId = null) {
  groupCreating.value = true
  groupForm.value = { ...emptyGroupForm(), parentId: parentId || null }
  if (parentId) collapsedGroupIds.value = new Set([...collapsedGroupIds.value].filter((id) => id !== parentId))
  groupEditorVisible.value = true
  await nextTick()
  groupNameInput.value?.focus()
}

async function startEditGroup(group) {
  groupCreating.value = false
  groupForm.value = {
    id: group.id,
    parentId: group.parentId || null,
    name: group.name,
    notes: group.notes || ''
  }
  groupEditorVisible.value = true
  await nextTick()
  groupNameInput.value?.focus()
}

function openGroupContextMenu(event, group) {
  const menuWidth = 196
  const menuHeight = group ? 188 : 104
  const padding = 8
  contextMenuX.value = Math.min(event.clientX, window.innerWidth - menuWidth - padding)
  contextMenuY.value = Math.min(event.clientY, window.innerHeight - menuHeight - padding)
  contextMenuGroup.value = group
  contextMenuVisible.value = true
}

function closeGroupContextMenu() {
  contextMenuVisible.value = false
  contextMenuGroup.value = null
}

function handleContextAction(action) {
  const group = contextMenuGroup.value
  closeGroupContextMenu()
  switch (action) {
    case 'subgroup':
      startCreateGroup(group?.id || null)
      break
    case 'group':
      startCreateGroup()
      break
    case 'entry':
      openCreateEntry(group?.id ?? null)
      break
    case 'edit':
      if (group) startEditGroup(group)
      break
    case 'delete':
      if (group) confirmDeleteGroup(group)
      break
  }
}

function handleContextKeydown(event) {
  if (event.key === 'Escape' && contextMenuVisible.value) closeGroupContextMenu()
}

function closeGroupEditor() {
  groupEditorVisible.value = false
  groupCreating.value = false
  groupForm.value = emptyGroupForm()
}

async function saveGroup() {
  if (groupSaving.value) return
  if (!groupForm.value.name.trim()) {
    showWarning(t('请输入分组名称'))
    return
  }
  groupSaving.value = true
  try {
    const result = await passwordGroupSave({
      id: groupForm.value.id || undefined,
      parentId: groupForm.value.parentId ?? null,
      name: groupForm.value.name,
      notes: groupForm.value.notes
    })
    if (!applyState(result)) {
      showError(errorText(result?.error))
      return
    }
    const savedId = result.id || groupForm.value.id
    closeGroupEditor()
    if (savedId) selectGroup(savedId)
    showSuccess(t('分组已保存'))
  } finally {
    groupSaving.value = false
  }
}

function openConfirm(title, message, action) {
  confirmTitle.value = title
  confirmMessage.value = message
  pendingConfirm = action
  confirmVisible.value = true
}

function handleConfirm() {
  const action = pendingConfirm
  closeConfirm()
  action?.()
}

function closeConfirm() {
  confirmVisible.value = false
  pendingConfirm = null
}

function confirmDeleteGroup(group) {
  openConfirm(
    t('删除分组'),
    t('删除分组「{name}」？子分组将移至上一级，分组内的条目将移至根分组。', { name: group.name }),
    async () => {
      const result = await passwordGroupDelete(group.id)
      if (!applyState(result)) {
        showError(errorText(result?.error))
        return
      }
      if (selectedGroupId.value === group.id) selectGroup(null)
      if (form.value.groupId === group.id) form.value.groupId = null
      if (groupForm.value.id === group.id) closeGroupEditor()
      showSuccess(t('分组已删除'))
    }
  )
}

function confirmDeleteEntry(entry) {
  if (!entry) return
  openConfirm(t('删除密码'), t('删除密码条目「{title}」？此操作不可撤销。', { title: entry.title }), async () => {
    const result = await passwordEntryDelete(entry.id)
    if (!applyState(result)) {
      showError(errorText(result?.error))
      return
    }
    if (selectedEntryId.value === entry.id) selectedEntryId.value = ''
    if (form.value.id === entry.id) closeEditor()
    showSuccess(t('密码已删除'))
  })
}

function handleShortcut(event) {
  if (vaultLocked.value || editorVisible.value || groupEditorVisible.value || generatorVisible.value) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    searchInput.value?.focus()
    searchInput.value?.select()
  }
}

function handleModalKeydown(event) {
  if (event.key !== 'Escape' || confirmVisible.value || generatorVisible.value) return
  if (editorVisible.value) {
    event.stopPropagation()
    closeEditor()
    return
  }
  if (groupEditorVisible.value) {
    event.stopPropagation()
    closeGroupEditor()
  }
}

watch([editorVisible, groupEditorVisible], ([entryOpen, groupOpen]) => {
  if (entryOpen || groupOpen) window.addEventListener('keydown', handleModalKeydown, true)
  else window.removeEventListener('keydown', handleModalKeydown, true)
})

onMounted(() => {
  loadState()
  window.addEventListener('keydown', handleShortcut)
  window.addEventListener('keydown', handleContextKeydown)
  window.addEventListener('resize', closeGroupContextMenu)
  window.addEventListener('scroll', closeGroupContextMenu, true)
})

onUnmounted(() => {
  if (vaultInitialized.value && !vaultLocked.value) passwordVaultLock().catch(() => {})
  window.removeEventListener('keydown', handleShortcut)
  window.removeEventListener('keydown', handleModalKeydown, true)
  window.removeEventListener('keydown', handleContextKeydown)
  window.removeEventListener('resize', closeGroupContextMenu)
  window.removeEventListener('scroll', closeGroupContextMenu, true)
})
</script>

<style scoped>
.vault-page {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 0;
}

.vault-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  background: var(--surface);
}

.vault-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.vault-toolbar .btn {
  gap: 6px;
  white-space: nowrap;
}

.toolbar-divider {
  flex-shrink: 0;
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: var(--border-color);
}

.toolbar-spacer {
  flex: 1;
  min-width: 12px;
}

.vault-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  width: 260px;
  height: var(--control-height);
  padding: 0 8px 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-tertiary);
  transition: var(--transition-fast);
}

.vault-search:focus-within {
  border-color: rgba(var(--accent-rgb), 0.5);
  color: var(--text-secondary);
}

.vault-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-sm);
}

.vault-search input::placeholder {
  color: var(--text-tertiary);
}

.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  cursor: pointer;
}

.search-clear:hover {
  color: var(--text-primary);
}

.vault-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.tree-section {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
  padding: 8px 6px;
}

.tree-node {
  display: flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  transition: var(--transition-fast);
}

.tree-node:hover {
  background: var(--surface-hover);
}

.tree-node.selected {
  border-color: rgba(var(--accent-rgb), 0.28);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.tree-toggle {
  flex-shrink: 0;
  width: 20px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--text-tertiary);
  cursor: pointer;
}

.tree-toggle:focus-visible,
.tree-label:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
  border-radius: var(--radius-xs);
}

.tree-toggle svg {
  width: 12px;
  height: 12px;
  transition: transform var(--motion-fast) ease;
}

.tree-toggle svg.open {
  transform: rotate(90deg);
}

.tree-toggle-spacer {
  flex-shrink: 0;
  width: 20px;
  height: 30px;
}

.tree-indent {
  flex-shrink: 0;
  width: 4px;
}

.tree-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px 0 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}

.node-icon {
  flex-shrink: 0;
  display: inline-flex;
  color: var(--text-tertiary);
}

.node-icon svg {
  width: 15px;
  height: 15px;
}

.tree-node.selected .node-icon {
  color: var(--accent-color);
}

.node-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-count {
  flex-shrink: 0;
  min-width: 18px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 18px;
  text-align: center;
}

.tree-node.selected .node-count {
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
}

.node-actions {
  display: flex;
  gap: 1px;
  padding-right: 4px;
  opacity: 0;
  transition: opacity var(--motion-fast) ease;
}

.tree-node:hover .node-actions,
.tree-node.selected .node-actions,
.node-actions:focus-within {
  opacity: 1;
}

.node-actions .btn-icon {
  width: 24px;
  height: 24px;
  border-color: transparent;
  background: transparent;
}

.tree-empty {
  padding: 12px 8px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.context-backdrop {
  position: fixed;
  inset: 0;
  /* 垫在右键菜单(2000)下方，只负责捕获外部点击 */
  z-index: 1200;
}

.context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 180px;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}

.context-item svg {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.context-item:hover {
  background: var(--surface-hover);
}

.context-item.danger {
  color: var(--error-dark);
}

.context-item.danger svg {
  color: inherit;
}

.context-divider {
  height: 1px;
  margin: 4px 2px;
  background: var(--border-color);
}

.filter-section {
  flex-shrink: 0;
  max-height: 46%;
  overflow-y: auto;
  padding: 8px 6px 10px;
  border-top: 1px solid var(--border-color);
}

.filter-heading {
  padding: 4px 8px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.filter-heading.tags {
  margin-top: 4px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.filter-item:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.filter-item.active {
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.filter-item:disabled {
  cursor: default;
  opacity: 0.55;
}

.filter-item svg {
  flex-shrink: 0;
  opacity: 0.85;
}

.filter-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-count {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.filter-item.active .filter-count {
  color: var(--accent-color);
}

.vault-note {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.vault-list {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--surface);
}

.list-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.entry-table {
  width: 100%;
  min-width: 760px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.col-title {
  width: 27%;
}

.col-user {
  width: 15%;
}

.col-url {
  width: 20%;
}

.col-notes {
  width: 18%;
}

.col-time {
  width: 122px;
}

.col-actions {
  width: 112px;
}

.entry-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 34px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

.entry-table thead th.sortable {
  cursor: pointer;
  user-select: none;
}

.entry-table thead th.sortable:hover {
  color: var(--text-primary);
}

.th-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sort-arrow {
  display: inline-block;
  margin-left: 3px;
  font-size: calc(9px * var(--font-scale));
  color: var(--accent-color);
  transition: transform var(--motion-fast) ease;
}

.sort-arrow.desc {
  transform: rotate(180deg);
}

.col-actions-head {
  cursor: default;
}

.entry-table tbody td {
  height: 38px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-table tbody tr {
  transition: background var(--motion-fast) ease;
}

.entry-table tbody tr:hover {
  background: var(--surface-hover);
}

.entry-table tbody tr.selected {
  background: rgba(var(--accent-rgb), 0.1);
}

.entry-table tbody tr.selected td {
  color: var(--text-primary);
}

.cell-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cell-icon {
  flex-shrink: 0;
  display: inline-flex;
  color: var(--text-tertiary);
}

.cell-icon svg {
  width: 14px;
  height: 14px;
}

.entry-table tbody tr.selected .cell-icon {
  color: var(--accent-color);
}

.cell-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-weight: 500;
}

.cell-muted {
  color: var(--text-tertiary);
}

.url-link {
  max-width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-color);
  font: inherit;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.url-link:hover {
  text-decoration: underline;
}

.cell-actions {
  overflow: visible;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1px;
  opacity: 0;
  transition: opacity var(--motion-fast) ease;
}

.entry-table tbody tr:hover .row-actions,
.entry-table tbody tr.selected .row-actions,
.row-actions:focus-within {
  opacity: 1;
}

.row-actions .btn-icon {
  width: 26px;
  height: 26px;
  border-color: transparent;
  background: transparent;
}

.row-actions .btn-icon:hover:not(:disabled) {
  color: var(--accent-color);
  border-color: rgba(var(--accent-rgb), 0.3);
  background: rgba(var(--accent-rgb), 0.08);
}

.row-actions .btn-icon-danger:hover:not(:disabled) {
  color: var(--error-darker);
  border-color: rgba(var(--error-rgb), 0.4);
  background: rgba(var(--error-rgb), 0.1);
}

.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 16px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.list-empty svg {
  width: 38px;
  height: 38px;
  opacity: 0.5;
}

.list-empty p {
  margin: 0;
}

.list-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 12px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.status-scope {
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.vault-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.vault-modal {
  display: flex;
  flex-direction: column;
  width: 560px;
  max-width: 100%;
  max-height: calc(100vh - 48px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: vault-modal-in var(--motion-panel) var(--motion-ease);
}

.vault-modal-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border-color);
}

.vault-modal-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: 600;
}

.vault-modal-sub {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.vault-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px;
}

.vault-modal-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.footer-spacer {
  flex: 1;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-wide {
  grid-column: 1 / -1;
}

.field-hint {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.inline-control {
  display: flex;
  gap: 6px;
}

.inline-control .input-field {
  flex: 1;
  min-width: 0;
}

.inline-control .btn-icon {
  width: var(--control-height);
  height: var(--control-height);
}

.vault-textarea {
  min-height: 90px;
}

.entry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-preview {
  margin-top: 4px;
}

.mini-tag {
  padding: 0 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 18px;
}

/* 入场动画只作用于卡片：遮罩层始终不透明，动画帧被节流时也不会留下不可见却拦截点击的全屏层 */
@keyframes vault-modal-in {
  from {
    transform: translateY(6px) scale(0.98);
    opacity: 0.85;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vault-modal {
    animation: none;
  }
}

@media (max-width: 980px) {
  .vault-shell {
    grid-template-columns: 208px minmax(0, 1fr);
  }

  .node-actions {
    opacity: 1;
  }
}

@media (max-width: 760px) {
  .vault-shell {
    grid-template-columns: 184px minmax(0, 1fr);
  }

  .vault-search {
    width: 200px;
  }

  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.vault-lock-page {
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.vault-lock-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(400px, 100%);
  padding: 28px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-md);
}

.vault-lock-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  color: var(--accent-color);
}

.vault-lock-card h2 {
  margin: 4px 0 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}

.vault-lock-desc,
.vault-lock-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.vault-lock-hint {
  color: var(--text-tertiary);
}

.vault-lock-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vault-lock-field span {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.vault-lock-error {
  margin: 0;
  color: var(--danger-bg);
  font-size: var(--font-size-sm);
}

.vault-lock-submit {
  justify-content: center;
  width: 100%;
  margin-top: 4px;
}
</style>
