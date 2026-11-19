<template>
  <Teleport to="body">
    <Transition name="update-dialog">
      <div v-if="center.visible" class="update-overlay" @click.self="closeUpdateCenter">
        <section class="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title">
          <header class="update-header">
            <div class="update-header-title">
              <h2 id="update-dialog-title">{{ t('更新中心') }}</h2>
              <span v-if="badgeText" class="update-badge" :class="`update-badge-${badgeTone}`">{{ badgeText }}</span>
            </div>
            <button type="button" class="update-close" :aria-label="t('关闭')" @click="closeUpdateCenter">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <nav class="update-tabs" role="tablist" :aria-label="t('更新中心视图')">
            <button
              id="update-tab-app"
              type="button"
              role="tab"
              class="update-tab"
              :class="{ active: activeTab === 'app' }"
              :aria-selected="activeTab === 'app'"
              aria-controls="update-panel-app"
              @click="activeTab = 'app'"
            >
              {{ center.appName }}
            </button>
            <button
              id="update-tab-changelog"
              type="button"
              role="tab"
              class="update-tab"
              :class="{ active: activeTab === 'changelog' }"
              :aria-selected="activeTab === 'changelog'"
              aria-controls="update-panel-changelog"
              @click="activeTab = 'changelog'"
            >
              {{ t('更新日志') }}
            </button>
          </nav>

          <div
            v-if="activeTab === 'app'"
            id="update-panel-app"
            class="update-body"
            role="tabpanel"
            aria-labelledby="update-tab-app"
          >
            <div v-if="center.phase === 'checking'" class="update-state">
              <span class="update-spinner" aria-hidden="true" />
              <div>
                <p class="update-state-title">{{ t('正在检查更新') }}</p>
                <p class="update-state-text">{{ t('正在连接更新服务器，请稍候...') }}</p>
              </div>
            </div>

            <div v-else-if="center.phase === 'dev-environment'" class="update-state">
              <svg class="update-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div>
                <p class="update-state-title">{{ t('开发环境无法检查更新') }}</p>
                <p class="update-state-text">
                  {{ t('请在打包后的应用中测试更新功能，下方仍可查看历史版本。') }}
                </p>
              </div>
            </div>

            <div v-else-if="center.phase === 'not-available'" class="update-state">
              <svg
                class="update-state-icon update-state-icon-success"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 12 15 16 9" />
              </svg>
              <div>
                <p class="update-state-title">
                  {{ latestVersionText }}
                </p>
                <p class="update-state-text">{{ t('已是最新正式版本，历史版本可在下方展开查看。') }}</p>
              </div>
            </div>

            <div v-else-if="center.phase === 'error'" class="update-state">
              <svg
                class="update-state-icon update-state-icon-error"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div>
                <p class="update-state-title">{{ t('检查更新失败') }}</p>
                <p class="update-state-text">{{ center.error || t('无法连接更新服务器，请稍后重试。') }}</p>
              </div>
            </div>

            <template v-else-if="hasUpdate">
              <p class="update-version-line">
                <span>{{ t('发现新版本') }}</span>
                <strong class="update-version-latest">v{{ center.latestVersion }}</strong>
                <span v-if="center.currentVersion" class="update-version-current">{{
                  t('当前 v{version}', { version: center.currentVersion })
                }}</span>
              </p>
              <p v-if="center.phase === 'available'" class="update-state-text">
                {{ t('完整更新内容可在「更新日志」中查看。') }}
              </p>

              <div v-if="center.phase === 'downloading'" class="update-progress">
                <div class="update-progress-track">
                  <div class="update-progress-bar" :style="{ width: `${progressValue}%` }" />
                </div>
                <div class="update-progress-meta">
                  <span>{{ t('正在下载更新') }}</span>
                  <span class="update-progress-value">{{ progressValue }}%</span>
                </div>
                <p class="update-state-text">{{ t('可以关闭此窗口，下载会在后台继续。') }}</p>
              </div>

              <div v-else-if="center.phase === 'downloaded'" class="update-ready">
                <svg
                  class="update-state-icon update-state-icon-success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="9 12 12 15 16 9" />
                </svg>
                <span>{{ t('更新已下载完成，重启应用即可安装。') }}</span>
              </div>

              <div v-else-if="center.phase === 'installing'" class="update-state">
                <span class="update-spinner" aria-hidden="true" />
                <span class="update-state-text">{{ t('正在准备安装，应用即将重启...') }}</span>
              </div>
            </template>

            <div v-else class="update-state">
              <span class="update-spinner" aria-hidden="true" />
              <span class="update-state-text">{{ t('正在准备更新...') }}</span>
            </div>

            <section class="update-history">
              <button
                type="button"
                class="update-history-toggle"
                :class="{ open: historyOpen }"
                :aria-expanded="historyOpen"
                aria-controls="update-history-panel"
                @click="historyOpen = !historyOpen"
              >
                <span class="update-history-toggle-title">{{ t('历史版本') }}</span>
                <span v-if="historyReleases.length" class="update-history-count">{{ historyReleases.length }}</span>
                <svg class="update-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <div id="update-history-panel" class="update-history-collapse" :class="{ open: historyOpen }">
                <div class="update-history-inner">
                  <p class="update-history-hint">
                    {{ t('回退到旧版本前请先备份数据，旧版本可能无法读取新版本创建的数据或凭据。') }}
                  </p>

                  <div v-if="center.historyLoading" class="update-history-state">
                    <span class="update-spinner" aria-hidden="true" />
                    <span>{{ t('正在加载历史版本...') }}</span>
                  </div>

                  <div v-else-if="center.historyError" class="update-history-state">
                    <span>{{ t(center.historyError) }}</span>
                    <button type="button" class="update-history-retry" @click="loadUpdateReleases(true)">
                      {{ t('重试') }}
                    </button>
                  </div>

                  <p v-else-if="historyReleases.length === 0" class="update-history-state">
                    {{ t('暂无历史版本。') }}
                  </p>

                  <template v-else>
                    <ul class="update-history-list">
                      <li
                        v-for="release in visibleHistory"
                        :key="release.tag || release.version"
                        class="update-history-item"
                      >
                        <span class="update-history-version">v{{ release.version }}</span>
                        <span class="update-history-date">{{ formatReleaseDate(release.publishedAt) }}</span>
                        <button
                          type="button"
                          class="update-history-link"
                          :disabled="!release.htmlUrl"
                          @click="openRelease(release.htmlUrl)"
                        >
                          {{ t('打开下载页') }}
                        </button>
                      </li>
                    </ul>

                    <div v-if="hasMoreHistory" class="update-load-more">
                      <button type="button" class="update-load-more-btn" @click="loadMoreHistory">
                        {{ t('加载更多') }}
                        <span class="update-load-more-count">{{
                          t('剩余 {count}', { count: historyReleases.length - visibleHistory.length })
                        }}</span>
                      </button>
                    </div>
                  </template>
                </div>
              </div>
            </section>
          </div>

          <div
            v-else
            id="update-panel-changelog"
            class="update-body update-changelog"
            role="tabpanel"
            aria-labelledby="update-tab-changelog"
          >
            <div v-if="center.historyLoading" class="update-history-state">
              <span class="update-spinner" aria-hidden="true" />
              <span>{{ t('正在加载更新日志...') }}</span>
            </div>

            <div v-else-if="center.historyError" class="update-history-state">
              <span>{{ t(center.historyError) }}</span>
              <button type="button" class="update-history-retry" @click="loadUpdateReleases(true)">
                {{ t('重试') }}
              </button>
            </div>

            <template v-else-if="changelogEntries.length">
              <article v-for="entry in visibleChangelogEntries" :key="entry.key" class="update-changelog-entry">
                <header class="update-changelog-head">
                  <span class="update-changelog-version">v{{ entry.version }}</span>
                  <span v-if="entry.isLatest" class="update-changelog-new">NEW</span>
                  <span v-if="entry.publishedLabel" class="update-changelog-date">{{ entry.publishedLabel }}</span>
                </header>
                <div v-if="entry.html" class="update-notes-content" @click="handleNotesClick" v-html="entry.html" />
                <p v-else class="update-state-text">{{ t('该版本暂无更新说明。') }}</p>
              </article>

              <div v-if="hasMoreChangelog" class="update-load-more">
                <button type="button" class="update-load-more-btn" @click="loadMoreChangelog">
                  {{ t('加载更多') }}
                  <span class="update-load-more-count">{{
                    t('剩余 {count}', { count: changelogEntries.length - visibleChangelogEntries.length })
                  }}</span>
                </button>
              </div>
            </template>

            <p v-else class="update-state-text">{{ t('暂无更新日志。') }}</p>
          </div>

          <footer class="update-footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="openUpdateReleasePage">
              {{ t('打开下载页') }}
            </button>
            <span class="update-footer-spacer" />

            <template v-if="center.phase === 'available'">
              <button type="button" class="btn btn-secondary btn-sm" @click="closeUpdateCenter">
                {{ t('稍后') }}
              </button>
              <button type="button" class="btn btn-primary btn-sm" @click="startUpdateDownload">
                {{ t('立即下载') }}
              </button>
            </template>

            <template v-else-if="center.phase === 'downloading'">
              <button type="button" class="btn btn-secondary btn-sm" @click="cancelUpdateDownloadNow">
                {{ t('取消下载') }}
              </button>
              <button type="button" class="btn btn-primary btn-sm" disabled>
                {{ t('下载中 {percent}%', { percent: progressValue }) }}
              </button>
            </template>

            <template v-else-if="center.phase === 'downloaded'">
              <button type="button" class="btn btn-secondary btn-sm" @click="closeUpdateCenter">
                {{ t('稍后') }}
              </button>
              <button type="button" class="btn btn-primary btn-sm" @click="installUpdateNow">
                {{ t('立即重启安装') }}
              </button>
            </template>

            <button v-else-if="center.phase === 'installing'" type="button" class="btn btn-primary btn-sm" disabled>
              {{ t('正在安装...') }}
            </button>

            <template v-else-if="center.phase === 'error' || center.phase === 'not-available'">
              <button type="button" class="btn btn-secondary btn-sm" @click="closeUpdateCenter">
                {{ t('关闭') }}
              </button>
              <button type="button" class="btn btn-primary btn-sm" @click="openUpdateCenter">
                {{ t('重新检查') }}
              </button>
            </template>

            <button
              v-else-if="center.phase === 'dev-environment'"
              type="button"
              class="btn btn-primary btn-sm"
              @click="closeUpdateCenter"
            >
              {{ t('知道了') }}
            </button>
            <button v-else type="button" class="btn btn-secondary btn-sm" @click="closeUpdateCenter">
              {{ t('取消') }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { openExternal } from '@/api'
import {
  cancelUpdateDownloadNow,
  closeUpdateCenter,
  installUpdateNow,
  loadUpdateReleases,
  openUpdateCenter,
  openUpdateReleasePage,
  startUpdateDownload,
  useUpdateCenter
} from '@/composables'
import { renderMarkdown } from '@/utils/markdown'
import { t, getLocale } from '@/i18n'

const { updateCenter: center } = useUpdateCenter()

const activeTab = ref('app')
const historyOpen = ref(false)

const PAGE_SIZE = 10
const historyVisibleCount = ref(PAGE_SIZE)
const changelogVisibleCount = ref(PAGE_SIZE)

const hasUpdate = computed(() => ['available', 'downloading', 'downloaded', 'installing'].includes(center.phase))

const progressValue = computed(() => Math.max(0, Math.min(100, Math.round(center.progress ?? 0))))

const latestVersionText = computed(() => {
  if (center.currentVersion) {
    return t('{name} 已是最新版本（v{version}）。', { name: center.appName, version: center.currentVersion })
  }
  return t('{name} 已是最新版本。', { name: center.appName })
})

function formatReleaseDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (getLocale() === 'en-US') {
    return `Released ${new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)}`
  }
  return t('发布于 {p0}年{p1}月{p2}日', { p0: date.getFullYear(), p1: date.getMonth() + 1, p2: date.getDate() })
}

function normalizeVersion(value) {
  return String(value || '')
    .trim()
    .replace(/^v/i, '')
}

function compareVersions(left, right) {
  const partsA = normalizeVersion(left).split('.')
  const partsB = normalizeVersion(right).split('.')
  const length = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < length; i++) {
    const numA = Number.parseInt(partsA[i], 10)
    const numB = Number.parseInt(partsB[i], 10)
    if (Number.isNaN(numA) || Number.isNaN(numB)) {
      const result = String(partsA[i] || '').localeCompare(String(partsB[i] || ''), undefined, { numeric: true })
      if (result) return result
      continue
    }
    if (numA !== numB) return numA - numB
  }
  return 0
}

const historyReleases = computed(() => {
  const currentKey = normalizeVersion(center.currentVersion)
  return center.history.filter((release) => normalizeVersion(release.version) !== currentKey)
})

const visibleHistory = computed(() => historyReleases.value.slice(0, historyVisibleCount.value))

const hasMoreHistory = computed(() => historyVisibleCount.value < historyReleases.value.length)

function loadMoreHistory() {
  historyVisibleCount.value += PAGE_SIZE
}

watch(historyReleases, () => {
  historyVisibleCount.value = PAGE_SIZE
})

const latestReleaseVersion = computed(() => {
  let latest = normalizeVersion(center.latestVersion)
  for (const release of center.history) {
    const version = normalizeVersion(release.version)
    if (version && compareVersions(version, latest) > 0) latest = version
  }
  return latest
})

const changelogEntries = computed(() => {
  if (center.history.length) {
    return center.history.map((release) => ({
      key: release.tag || release.version,
      version: release.version,
      publishedLabel: formatReleaseDate(release.publishedAt),
      isLatest: normalizeVersion(release.version) === latestReleaseVersion.value,
      html: renderMarkdown(release.notes || '')
    }))
  }

  if (center.releaseNotes) {
    return [
      {
        key: 'latest',
        version: center.latestVersion || center.currentVersion,
        publishedLabel: formatReleaseDate(center.releaseDate),
        isLatest: true,
        html: renderMarkdown(center.releaseNotes)
      }
    ]
  }

  return []
})

const visibleChangelogEntries = computed(() => changelogEntries.value.slice(0, changelogVisibleCount.value))

const hasMoreChangelog = computed(() => changelogVisibleCount.value < changelogEntries.value.length)

function loadMoreChangelog() {
  changelogVisibleCount.value += PAGE_SIZE
}

watch(changelogEntries, () => {
  changelogVisibleCount.value = PAGE_SIZE
})

function handleNotesClick(event) {
  const link = event.target.closest?.('a')
  if (!link) return
  const href = link.getAttribute('href') || ''
  if (!/^https?:\/\//i.test(href)) return
  event.preventDefault()
  openExternal(href)
}

function openRelease(url) {
  if (/^https?:\/\//i.test(url || '')) openExternal(url)
}

const badgeText = computed(() => {
  switch (center.phase) {
    case 'checking':
      return t('检查中')
    case 'available':
      return t('发现新版本')
    case 'downloading':
      return `${progressValue.value}%`
    case 'downloaded':
      return t('已下载')
    case 'installing':
      return t('安装中')
    case 'not-available':
      return t('已是最新')
    case 'error':
      return t('检查失败')
    case 'dev-environment':
      return t('开发环境')
    default:
      return ''
  }
})

const badgeTone = computed(() => {
  switch (center.phase) {
    case 'available':
    case 'downloading':
      return 'primary'
    case 'downloaded':
    case 'not-available':
      return 'success'
    case 'error':
      return 'danger'
    case 'installing':
      return 'warning'
    default:
      return 'neutral'
  }
})

watch(
  () => center.visible,
  (visible) => {
    if (visible) {
      activeTab.value = 'app'
      historyVisibleCount.value = PAGE_SIZE
      changelogVisibleCount.value = PAGE_SIZE
    }
  }
)

function onKeydown(event) {
  if (event.key === 'Escape' && center.visible) closeUpdateCenter()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.update-overlay {
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

.update-dialog {
  display: flex;
  flex-direction: column;
  width: 680px;
  max-width: calc(100vw - 32px);
  max-height: min(720px, calc(100vh - 48px));
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
}

.update-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.update-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.update-header-title h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 650;
  line-height: 1.3;
}

.update-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1.5;
}

.update-badge-primary {
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
}

.update-badge-success {
  background: rgba(var(--success-rgb), 0.14);
  color: var(--success-dark);
}

.update-badge-warning {
  background: rgba(var(--warning-rgb), 0.16);
  color: var(--warning-dark);
}

.update-badge-danger {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error-dark);
}

.update-badge-neutral {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

.update-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.update-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.update-close svg {
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
}

.update-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
}

.update-tab {
  position: relative;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 550;
  cursor: pointer;
  transition: color var(--motion-fast) var(--motion-ease);
}

.update-tab::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: -1px;
  left: 10px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background var(--motion-fast) var(--motion-ease);
}

.update-tab:hover {
  color: var(--text-primary);
}

.update-tab.active {
  color: var(--accent-color);
}

.update-tab.active::after {
  background: var(--accent-color);
}

.update-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
}

.update-state {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.update-state-icon {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--accent-color);
}

.update-state-icon-success {
  color: var(--success-color);
}

.update-state-icon-error {
  color: var(--error-color);
}

.update-state-title {
  margin: 0 0 4px;
  font-size: var(--font-size-base);
  font-weight: 600;
}

.update-state-text {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  word-break: break-word;
}

.update-spinner {
  width: var(--spinner-md);
  height: var(--spinner-md);
  flex-shrink: 0;
  margin-top: 2px;
  border: 2px solid rgba(var(--accent-rgb), 0.25);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: update-spin var(--spinner-duration) linear infinite;
}

@keyframes update-spin {
  to {
    transform: rotate(360deg);
  }
}

.update-version-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin: 0 0 10px;
  font-size: var(--font-size-base);
}

.update-version-latest {
  color: var(--accent-color);
  font-size: var(--font-size-md);
}

.update-version-current {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.update-history {
  margin-top: 20px;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.update-history-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.update-history-toggle-title {
  flex-shrink: 0;
}

.update-history-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.update-chevron {
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
  margin-left: auto;
  color: var(--text-tertiary);
  transition: transform var(--motion-fast) var(--motion-ease);
}

.update-history-toggle.open .update-chevron {
  transform: rotate(180deg);
}

.update-history-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--motion-panel) var(--motion-ease);
}

.update-history-collapse.open {
  grid-template-rows: 1fr;
}

.update-history-inner {
  min-height: 0;
  overflow: hidden;
}

.update-history-hint {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.update-history-state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 0 10px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.update-history-state .update-spinner {
  width: var(--spinner-sm, 14px);
  height: var(--spinner-sm, 14px);
  margin-top: 0;
}

.update-history-retry {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-color);
  font-size: inherit;
  font-weight: 600;
  cursor: pointer;
}

.update-history-list {
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
}

.update-history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 2px;
  border-top: 1px solid var(--border-color);
  font-size: var(--font-size-sm);
}

.update-history-item:first-child {
  border-top: none;
}

.update-history-version {
  flex-shrink: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.update-history-date {
  flex: 1;
  min-width: 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.update-history-link {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
}

.update-history-link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.update-history-link:disabled {
  color: var(--text-tertiary);
  cursor: default;
  text-decoration: none;
}

.update-changelog {
  padding-top: 8px;
}

.update-changelog-entry {
  padding: 14px 0;
  border-top: 1px solid var(--border-color);
}

.update-changelog-entry:first-child {
  padding-top: 8px;
  border-top: none;
}

.update-changelog-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}

.update-changelog-version {
  font-size: var(--font-size-base);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.update-changelog-new {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--success-rgb), 0.14);
  color: var(--success-dark);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.6;
}

.update-load-more {
  display: flex;
  justify-content: center;
  padding: 10px 0 2px;
}

.update-load-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 550;
  cursor: pointer;
  transition: var(--transition-fast);
}

.update-load-more-btn:hover {
  border-color: var(--border-strong);
  background: var(--surface-hover);
  color: var(--text-primary);
}

.update-load-more-count {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.update-changelog-date {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.update-notes-content {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.65;
  word-break: break-word;
}

.update-changelog .update-notes-content {
  max-height: none;
  padding: 0;
  overflow: visible;
}

.update-notes-content :deep(h1),
.update-notes-content :deep(h2),
.update-notes-content :deep(h3),
.update-notes-content :deep(h4),
.update-notes-content :deep(h5),
.update-notes-content :deep(h6) {
  margin: 10px 0 6px;
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-weight: 650;
  line-height: 1.4;
}

.update-notes-content :deep(h1:first-child),
.update-notes-content :deep(h2:first-child),
.update-notes-content :deep(h3:first-child),
.update-notes-content :deep(h4:first-child),
.update-notes-content :deep(h5:first-child),
.update-notes-content :deep(h6:first-child) {
  margin-top: 0;
}

.update-notes-content :deep(ul),
.update-notes-content :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.update-notes-content :deep(li) {
  margin: 2px 0;
}

.update-notes-content :deep(strong) {
  color: var(--text-primary);
}

.update-notes-content :deep(a) {
  color: var(--accent-color);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.update-notes-content :deep(code) {
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--surface-hover);
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-xs);
}

.update-notes-content :deep(pre) {
  margin: 8px 0;
  padding: 10px;
  overflow: auto;
  border-radius: var(--radius-sm);
  background: var(--surface-hover);
}

.update-notes-content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.update-notes-content :deep(blockquote) {
  margin: 8px 0;
  padding-left: 10px;
  border-left: 3px solid var(--border-strong);
  color: var(--text-tertiary);
}

.update-notes-content :deep(hr) {
  margin: 10px 0;
  border: none;
  border-top: 1px solid var(--border-color);
}

.update-progress {
  margin-top: 16px;
}

.update-progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.14);
}

.update-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--primary-gradient);
  transition: width 0.2s ease;
}

.update-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.update-progress-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--text-primary);
}

.update-progress .update-state-text {
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.update-ready {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(var(--success-rgb), 0.3);
  border-radius: var(--radius-md);
  background: rgba(var(--success-rgb), 0.08);
  color: var(--success-dark);
  font-size: var(--font-size-sm);
}

.update-ready .update-state-icon {
  margin-top: 0;
}

.update-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
}

.update-footer-spacer {
  flex: 1;
  min-width: 8px;
}

.update-dialog-enter-active,
.update-dialog-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}

.update-dialog-enter-active .update-dialog,
.update-dialog-leave-active .update-dialog {
  transition:
    transform var(--motion-panel) var(--motion-ease),
    opacity var(--motion-panel) var(--motion-ease);
}

.update-dialog-enter-from,
.update-dialog-leave-to {
  opacity: 0;
}

.update-dialog-enter-from .update-dialog,
.update-dialog-leave-to .update-dialog {
  transform: scale(0.97) translateY(4px);
  opacity: 0;
}
</style>
