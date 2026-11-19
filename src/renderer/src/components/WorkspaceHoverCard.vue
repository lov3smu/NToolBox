<template>
  <HoverPopover
    :inline="inline"
    :delay="delay"
    :hide-delay="hideDelay"
    :offset="offset"
    :placement="placement"
    :boundary="boundary"
    :disabled="disabled"
  >
    <slot />
    <template #content>
      <div class="workspace-card-body">
        <div class="workspace-card-head">
          <span class="workspace-card-icon" :class="{ 'is-default': !path }" :style="color ? { color } : null">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path :d="iconPath" />
            </svg>
          </span>
          <span class="workspace-card-name">{{ name }}</span>
          <span v-if="count !== null" class="workspace-card-count">{{ t('{p0} 个会话', { p0: count }) }}</span>
        </div>
        <p v-if="description" class="workspace-card-desc">{{ description }}</p>
        <div v-if="path" class="workspace-card-path">{{ path }}</div>
      </div>
    </template>
  </HoverPopover>
</template>

<script setup>
import { computed } from 'vue'
import HoverPopover from '@/components/HoverPopover.vue'
import { t } from '@/i18n'
import { WORKSPACE_ICONS } from '@/utils/workspaceIcons'

const props = defineProps({
  name: { type: String, default: '' },
  path: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: String, default: 'folder' },
  color: { type: String, default: '' },
  count: { type: Number, default: null },
  inline: { type: Boolean, default: false },
  delay: { type: Number, default: 320 },
  hideDelay: { type: Number, default: 140 },
  offset: { type: Number, default: 8 },
  placement: { type: String, default: 'bottom' },
  boundary: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const iconPath = computed(() => WORKSPACE_ICONS.find((item) => item.id === props.icon)?.d || WORKSPACE_ICONS[0].d)
</script>
