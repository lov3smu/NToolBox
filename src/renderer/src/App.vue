<template>
  <AppShell v-if="!standalone">
    <router-view v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" @open-search="searchVisible = true" />
      </Transition>
    </router-view>
  </AppShell>
  <router-view v-else @open-search="searchVisible = true" />
  <SearchModal v-if="!standalone" :visible="searchVisible" @close="searchVisible = false" />
  <UpdateDialog />
  <AboutDialog :visible="aboutVisible" @close="aboutVisible = false" />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import SearchModal from '@/components/SearchModal.vue'
import UpdateDialog from '@/components/UpdateDialog.vue'
import AboutDialog from '@/components/AboutDialog.vue'
import { getConfig, onConfigChanged, onNavigateTo, onShowAbout } from '@/api'
import { syncThemeFromConfig, syncThemeStyleFromConfig, syncFontSizeFromConfig } from '@/utils/theme'
import { SETTINGS_PATH } from '@shared/tools'

const route = useRoute()
const router = useRouter()
const searchVisible = ref(false)
const aboutVisible = ref(false)
const standalone = computed(() => route.path === SETTINGS_PATH)
let removeNavigateListener = null
let removeConfigListener = null
let removeAboutListener = null

async function loadThemeFromConfig() {
  const config = await getConfig()
  syncThemeFromConfig(config?.theme)
  syncThemeStyleFromConfig(config?.theme_style)
  syncFontSizeFromConfig(config?.font_size)
}

onMounted(async () => {
  removeNavigateListener = onNavigateTo((path) => {
    if (!standalone.value) router.push(path)
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
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    searchVisible.value = !searchVisible.value
  }
}
</script>

<style>
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
