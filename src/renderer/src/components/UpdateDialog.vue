<template>
  <Teleport to="body">
    <Transition name="update-dialog">
      <div v-if="center.visible" class="update-overlay" @click.self="closeUpdateCenter">
        <section class="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title">
          <header class="update-header">
            <div class="update-header-title">
              <h2 id="update-dialog-title">更新中心</h2>
              <span v-if="badgeText" class="update-badge" :class="`update-badge-${badgeTone}`">{{ badgeText }}</span>
            </div>
            <button type="button" class="update-close" aria-label="关闭" @click="closeUpdateCenter">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div class="update-body">
            <div v-if="center.phase === 'checking'" class="update-state">
              <span class="update-spinner" aria-hidden="true" />
              <div>
                <p class="update-state-title">正在检查更新</p>
                <p class="update-state-text">正在连接更新服务器，请稍候...</p>
              </div>
            </div>

            <div v-else-if="center.phase === 'dev-environment'" class="update-state">
              <svg class="update-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div>
                <p class="update-state-title">开发环境无法检查更新</p>
                <p class="update-state-text">请在打包后的应用中测试更新功能。</p>
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
                <p class="update-state-title">当前已是最新版本</p>
                <p v-if="center.currentVersion" class="update-state-text">当前版本 v{{ center.currentVersion }}</p>
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
                <p class="update-state-title">检查更新失败</p>
                <p class="update-state-text">{{ center.error || '无法连接更新服务器，请稍后重试。' }}</p>
              </div>
            </div>

            <template v-else-if="hasUpdate">
              <p class="update-version-line">
                <span>发现新版本</span>
                <strong class="update-version-latest">v{{ center.latestVersion }}</strong>
                <span v-if="center.currentVersion" class="update-version-current"
                  >当前 v{{ center.currentVersion }}</span
                >
              </p>

              <div v-if="center.releaseNotes" class="update-notes">
                <div class="update-notes-title">更新日志</div>
                <div class="update-notes-content" @click="handleNotesClick" v-html="renderedNotes" />
              </div>
              <p v-else class="update-state-text">新版本已准备好下载。</p>

              <div v-if="center.phase === 'downloading'" class="update-progress">
                <div class="update-progress-track">
                  <div class="update-progress-bar" :style="{ width: `${progressValue}%` }" />
                </div>
                <div class="update-progress-meta">
                  <span>正在下载更新</span>
                  <span class="update-progress-value">{{ progressValue }}%</span>
                </div>
                <p class="update-state-text">可以关闭此窗口，下载会在后台继续。</p>
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
                <span>更新已下载完成，重启应用即可安装。</span>
              </div>

              <div v-else-if="center.phase === 'installing'" class="update-state">
                <span class="update-spinner" aria-hidden="true" />
                <span class="update-state-text">正在准备安装，应用即将重启...</span>
              </div>
            </template>

            <div v-else class="update-state">
              <span class="update-spinner" aria-hidden="true" />
              <span class="update-state-text">正在准备更新...</span>
            </div>
          </div>

          <footer class="update-footer">
            <button
              v-if="showReleaseButton"
              type="button"
              class="btn btn-default btn-sm"
              @click="openUpdateReleasePage"
            >
              打开发布页
            </button>
            <span class="update-footer-spacer" />

            <template v-if="center.phase === 'available'">
              <button type="button" class="btn btn-default btn-sm" @click="closeUpdateCenter">稍后</button>
              <button type="button" class="btn btn-primary btn-sm" @click="startUpdateDownload">立即下载</button>
            </template>

            <template v-else-if="center.phase === 'downloading'">
              <button type="button" class="btn btn-default btn-sm" @click="cancelUpdateDownloadNow">取消下载</button>
              <button type="button" class="btn btn-primary btn-sm" disabled>下载中 {{ progressValue }}%</button>
            </template>

            <template v-else-if="center.phase === 'downloaded'">
              <button type="button" class="btn btn-default btn-sm" @click="closeUpdateCenter">稍后</button>
              <button type="button" class="btn btn-primary btn-sm" @click="installUpdateNow">立即重启安装</button>
            </template>

            <button v-else-if="center.phase === 'installing'" type="button" class="btn btn-primary btn-sm" disabled>
              正在安装...
            </button>

            <template v-else-if="center.phase === 'error' || center.phase === 'not-available'">
              <button type="button" class="btn btn-default btn-sm" @click="closeUpdateCenter">关闭</button>
              <button type="button" class="btn btn-primary btn-sm" @click="openUpdateCenter">重新检查</button>
            </template>

            <button
              v-else-if="center.phase === 'dev-environment'"
              type="button"
              class="btn btn-primary btn-sm"
              @click="closeUpdateCenter"
            >
              知道了
            </button>
            <button v-else type="button" class="btn btn-default btn-sm" @click="closeUpdateCenter">取消</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { openExternal } from '@/api'
import {
  cancelUpdateDownloadNow,
  closeUpdateCenter,
  installUpdateNow,
  openUpdateCenter,
  openUpdateReleasePage,
  startUpdateDownload,
  useUpdateCenter
} from '@/composables'
import { renderMarkdown } from '@/utils/markdown'

const { updateCenter: center } = useUpdateCenter()

const hasUpdate = computed(() => ['available', 'downloading', 'downloaded', 'installing'].includes(center.phase))

const renderedNotes = computed(() => renderMarkdown(center.releaseNotes))

function handleNotesClick(event) {
  const link = event.target.closest?.('a')
  if (!link) return
  const href = link.getAttribute('href') || ''
  if (!/^https?:\/\//i.test(href)) return
  event.preventDefault()
  openExternal(href)
}

const progressValue = computed(() => Math.max(0, Math.min(100, Math.round(center.progress ?? 0))))

const showReleaseButton = computed(() => hasUpdate.value || center.phase === 'error')

const badgeText = computed(() => {
  switch (center.phase) {
    case 'checking':
      return '检查中'
    case 'available':
      return '发现新版本'
    case 'downloading':
      return `${progressValue.value}%`
    case 'downloaded':
      return '已下载'
    case 'installing':
      return '安装中'
    case 'not-available':
      return '已是最新'
    case 'error':
      return '检查失败'
    case 'dev-environment':
      return '开发环境'
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
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.update-dialog {
  display: flex;
  flex-direction: column;
  width: 640px;
  max-width: calc(100vw - 32px);
  max-height: min(680px, calc(100vh - 48px));
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
  margin: 0 0 14px;
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

.update-notes {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.update-notes-title {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.update-notes-content {
  max-height: 240px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.65;
  word-break: break-word;
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
