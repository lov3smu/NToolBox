<template>
  <router-view @open-search="searchVisible = true" />
  <SearchModal
    :visible="searchVisible"
    @close="searchVisible = false"
  />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import SearchModal from '@/components/SearchModal.vue'

const router = useRouter()
const searchVisible = ref(false)

onMounted(() => {
  window.electronAPI?.onNavigateTo((path) => {
    router.push(path)
  })
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    searchVisible.value = !searchVisible.value
  }
}
</script>