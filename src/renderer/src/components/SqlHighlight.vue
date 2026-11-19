<template>
  <pre class="sql-highlight"><code v-if="code" v-html="html"></code><template v-else>{{ placeholder }}</template></pre>
</template>

<script setup>
import { computed } from 'vue'
import { highlightSqlToHtml } from '@/utils/sqlHighlight'

const props = defineProps({
  code: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  }
})

const html = computed(() => highlightSqlToHtml(props.code))
</script>
