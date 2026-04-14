<template>
  <router-view />
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  window.electronAPI?.onNavigateTo((path) => {
    router.push(path)
  })
})

onUnmounted(() => {
})
</script>