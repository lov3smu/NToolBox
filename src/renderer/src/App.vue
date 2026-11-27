<template>
  <AppShell v-if="!standalone">
    <div ref="workspaceRef" class="app-workspace" :class="{ 'is-split': splitVisible }">
      <div class="workspace-pane is-primary">
        <router-view v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <KeepAlive :include="['Chat']">
              <component :is="Component" :key="route.path" @open-search="searchVisible = true" />
            </KeepAlive>
          </Transition>
        </router-view>
      </div>
      <template v-if="splitVisible">
        <SplitHandle
          orientation="vertical"
          :resizing="splitResizing"
          :label="t('拖动调整分屏宽度')"
          @pointerdown="startSplitResize"
          @keydown="onSplitKeydown"
        />
        <div class="workspace-pane is-secondary" :style="{ width: `${splitPercent}%` }">
          <SplitPane :path="secondaryPath" @close="closeSplit" @swap="swapSplit" />
        </div>
      </template>
    </div>
  </AppShell>
  <router-view v-else @open-search="searchVisible = true" />
  <SearchModal v-if="!standalone" :visible="searchVisible" @close="searchVisible = false" />
  <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  <UpdateDialog />
  <AboutDialog :visible="aboutVisible" @close="aboutVisible = false" />
  <ImagePreviewDialog />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import SearchModal from '@/components/SearchModal.vue'
import SplitHandle from '@/components/SplitHandle.vue'
import SplitPane from '@/components/SplitPane.vue'
import UpdateDialog from '@/components/UpdateDialog.vue'
import AboutDialog from '@/components/AboutDialog.vue'
import ImagePreviewDialog from '@/components/ImagePreviewDialog.vue'
import Toast from '@/components/Toast.vue'
import { getConfig, onConfigChanged, onNavigateTo, onShowAbout } from '@/api'
import { usePaneResize, useSplitView, useToast } from '@/composables'
import { syncThemeFromConfig, syncThemeStyleFromConfig, syncFontSizeFromConfig } from '@/utils/theme'
import { setLocale, t } from '@/i18n'
import { SETTINGS_PATH, isSplitTool, setRecentToolsLimit } from '@shared/navTools'
import { DEFAULT_SHORTCUT_ACTIONS } from '@shared/shortcutActions'
import { matchesAccelerator } from '@/utils/shortcut'

const route = useRoute()
const router = useRouter()
const { toastVisible, toastMessage, toastType } = useToast()
const searchVisible = ref(false)
const aboutVisible = ref(false)
const searchAccelerator = ref(DEFAULT_SHORTCUT_ACTIONS.global_search)
const standalone = computed(() => route.path === SETTINGS_PATH)

const workspaceRef = ref(null)
const { secondaryPath, splitActive, setSecondaryPath, closeSplit } = useSplitView()
const splitVisible = computed(() => splitActive.value && !standalone.value)
const {
  size: splitPercent,
  resizing: splitResizing,
  startResize: startSplitResize,
  onKeydown: onSplitKeydown
} = usePaneResize({
  key: 'appSplitRatio',
  initial: 50,
  min: 30,
  max: 70,
  unit: 'percent',
  direction: 'horizontal',
  container: () => workspaceRef.value
})

watch(
  () => route.path,
  (to, from) => {
    if (!splitActive.value || to !== secondaryPath.value) return
    if (from && from !== to && isSplitTool(from)) setSecondaryPath(from)
    else closeSplit()
  }
)

function swapSplit() {
  if (!secondaryPath.value) return
  router.push(secondaryPath.value)
}
let removeNavigateListener = null
let removeConfigListener = null
let removeAboutListener = null

async function loadThemeFromConfig() {
  const config = await getConfig()
  syncThemeFromConfig(config?.appearance.theme)
  syncThemeStyleFromConfig(config?.appearance.theme_style)
  syncFontSizeFromConfig(config?.appearance.font_size)
  setLocale(config?.appearance.language)
  setRecentToolsLimit(config?.app.recent_tools_limit)
  searchAccelerator.value = config?.app?.shortcuts?.global_search || DEFAULT_SHORTCUT_ACTIONS.global_search
}

onMounted(async () => {
  removeNavigateListener = onNavigateTo((target) => {
    if (typeof target === 'string') {
      router.push(target)
      return
    }
    if (!target?.path) return
    router.push(target.prompt ? { path: target.path, query: { prompt: target.prompt } } : target.path)
  })
  removeConfigListener = onConfigChanged(loadThemeFromConfig)
  removeAboutListener = onShowAbout(() => {
    aboutVisible.value = true
  })
  window.addEventListener('keydown', handleKeydown)
  await loadThemeFromConfig()
})

onUnmounted(() => {
  removeNavigateListener?.()
  removeConfigListener?.()
  removeAboutListener?.()
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e) {
  if (standalone.value) return
  if (matchesAccelerator(e, searchAccelerator.value)) {
    e.preventDefault()
    searchVisible.value = !searchVisible.value
  }
}
</script>

<style>
.app-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background: var(--app-bg);
}

.workspace-pane {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-pane.is-primary {
  flex: 1;
}

.workspace-pane.is-secondary {
  flex: 0 0 auto;
  min-width: 340px;
}

@media (max-width: 1024px) {
  .app-workspace.is-split .workspace-pane.is-secondary,
  .app-workspace.is-split > .split-handle {
    display: none;
  }
}

.page-enter-active {
  animation: page-in var(--motion-base) var(--motion-ease);
}

@keyframes page-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}
</style>
