import { ref, onMounted, onUnmounted } from 'vue'
import { getConfig, onConfigChanged } from '../api'

export function useConfig() {
  const config = ref(null)
  const loading = ref(true)
  const error = ref(null)

  async function loadConfig() {
    loading.value = true
    error.value = null
    try {
      config.value = await getConfig()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    await loadConfig()
    onConfigChanged(loadConfig)
  })

  return {
    config,
    loading,
    error,
    reload: loadConfig
  }
}