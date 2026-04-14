import { ref, onMounted, onUnmounted } from 'vue'

export function useWindowWidth(defaultWidth = 1200) {
  const windowWidth = ref(defaultWidth)

  function updateWidth() {
    windowWidth.value = window.innerWidth < defaultWidth ? window.innerWidth : defaultWidth
  }

  onMounted(() => {
    updateWidth()
    window.addEventListener('resize', updateWidth)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
  })

  return windowWidth
}