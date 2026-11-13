<template>
  <Teleport to="body">
    <Transition name="about-dialog">
      <div v-if="visible" class="about-overlay" @click.self="emit('close')">
        <section class="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-dialog-title">
          <header class="about-header">
            <div class="about-header-title">
              <h2 id="about-dialog-title">关于软件</h2>
              <span v-if="version" class="about-badge">v{{ version }}</span>
            </div>
            <button type="button" class="about-close" aria-label="关闭" @click="emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div class="about-body">
            <div class="about-logo-wrap">
              <img :src="iconUrl" alt="NToolBox" class="about-logo" />
            </div>
            <p class="about-name">NToolBox</p>
            <p class="about-description">{{ description }}</p>

            <dl class="about-meta">
              <div class="about-meta-row">
                <dt>版本</dt>
                <dd v-if="version">v{{ version }}</dd>
                <dd v-else>--</dd>
              </div>
              <div class="about-meta-row">
                <dt>作者</dt>
                <dd>{{ author }}</dd>
              </div>
              <div class="about-meta-row">
                <dt>版权</dt>
                <dd>{{ copyright }}</dd>
              </div>
            </dl>
          </div>

          <footer class="about-footer">
            <button type="button" class="btn btn-default btn-sm" @click="openReleasePage">打开发布页</button>
            <span class="about-footer-spacer" />
            <button type="button" class="btn btn-primary btn-sm" @click="emit('close')">关闭</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getPackageInfo, openExternal } from '@/api'
import iconUrl from '@assets/icon.png'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const RELEASE_PAGE_URL = 'https://github.com/lov3smu/NToolBox/releases/latest'
const DEFAULT_DESCRIPTION = '一款面向开发人员的多端工具集合平台，集成丰富工具 + AI 大模型能力，启动快、功能全、更智能。'

const version = ref('')
const author = ref('lov3smu')
const description = ref(DEFAULT_DESCRIPTION)

const copyright = computed(() => `© ${new Date().getFullYear()} ${author.value}. All rights reserved.`)

async function loadPackageInfo() {
  const info = await getPackageInfo()
  if (info?.version) version.value = info.version
  if (info?.author)
    author.value =
      String(info.author)
        .replace(/<[^>]*>/g, '')
        .trim() || author.value
  if (info?.description) {
    description.value = String(info.description).replace(/^NToolBox\s*-\s*/, '') || DEFAULT_DESCRIPTION
  }
}

function openReleasePage() {
  openExternal(RELEASE_PAGE_URL)
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.visible) emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  loadPackageInfo()
})

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.about-overlay {
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

.about-dialog {
  display: flex;
  flex-direction: column;
  width: 460px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 48px);
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
}

.about-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.about-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.about-header-title h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 650;
  line-height: 1.3;
}

.about-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}

.about-close {
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

.about-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.about-close svg {
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
}

.about-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 20px 20px;
  text-align: center;
}

.about-logo-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  margin-bottom: 12px;
  border-radius: 18px;
  background: var(--surface-muted);
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.about-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
}

.about-name {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  letter-spacing: 0.2px;
}

.about-description {
  margin: 8px auto 0;
  max-width: 340px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.about-meta {
  margin: 18px 0 0;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  text-align: left;
}

.about-meta-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: var(--font-size-sm);
  line-height: 1.9;
}

.about-meta-row + .about-meta-row {
  border-top: 1px dashed var(--border-color);
}

.about-meta-row dt {
  flex-shrink: 0;
  width: 40px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.about-meta-row dd {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--text-secondary);
  word-break: break-word;
}

.about-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
}

.about-footer-spacer {
  flex: 1;
  min-width: 8px;
}

.about-dialog-enter-active,
.about-dialog-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}

.about-dialog-enter-active .about-dialog,
.about-dialog-leave-active .about-dialog {
  transition:
    transform var(--motion-panel) var(--motion-ease),
    opacity var(--motion-panel) var(--motion-ease);
}

.about-dialog-enter-from,
.about-dialog-leave-to {
  opacity: 0;
}

.about-dialog-enter-from .about-dialog,
.about-dialog-leave-to .about-dialog {
  transform: scale(0.97) translateY(4px);
  opacity: 0;
}
</style>
