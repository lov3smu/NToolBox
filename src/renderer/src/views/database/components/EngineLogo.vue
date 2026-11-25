<template>
  <svg
    class="engine-logo"
    :class="[`is-${normalizedEngine}`, `is-${size}`]"
    viewBox="0 0 128 128"
    fill="currentColor"
    aria-hidden="true"
    v-html="markup"
  />
</template>

<script setup>
import { computed } from 'vue'
import { normalizeDatabaseEngine } from '@shared/databaseEngines'
import { ENGINE_LOGOS } from '@/icons/engineLogos'

const props = defineProps({
  engine: { type: String, default: 'mysql' },
  size: { type: String, default: 'md' }
})

const normalizedEngine = computed(() => normalizeDatabaseEngine(props.engine))
const markup = computed(() => ENGINE_LOGOS[normalizedEngine.value])
</script>

<style scoped>
.engine-logo {
  display: block;
  flex-shrink: 0;
}

.engine-logo.is-mysql {
  color: var(--db-engine-mysql);
}

.engine-logo.is-postgres {
  color: var(--db-engine-postgres);
}

.engine-logo.is-sqlite {
  color: var(--db-engine-sqlite);
}

.engine-logo.is-xl {
  width: 40px;
  height: 40px;
}

.engine-logo.is-lg {
  width: 32px;
  height: 32px;
}

.engine-logo.is-md {
  width: 24px;
  height: 24px;
}

.engine-logo.is-sm {
  width: 20px;
  height: 20px;
}

.engine-logo.is-xs {
  width: 16px;
  height: 16px;
}
</style>
