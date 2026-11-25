<template>
  <Teleport to="body" :disabled="inline">
    <div v-if="visible" ref="rootRef" class="modal-layer">
      <slot />
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { activateModal } from '@/utils/modalShell'

const props = defineProps({
  visible: { type: Boolean, default: false },
  closeOnEsc: { type: Boolean, default: true },
  closeOnOutside: { type: Boolean, default: true },
  dialogSelector: { type: String, default: '[role="dialog"], .message-dialog, .dialog' },
  inline: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const rootRef = ref(null)
let cleanup = null

function deactivate() {
  cleanup?.()
  cleanup = null
}

watch(
  () => props.visible,
  async (visible) => {
    deactivate()
    if (!visible) return
    await nextTick()
    const overlay = rootRef.value
    if (!overlay) return
    cleanup = activateModal(overlay, {
      dialog: overlay.querySelector(props.dialogSelector),
      closeOnEsc: props.closeOnEsc,
      closeOnOutside: props.closeOnOutside,
      onClose: () => emit('close')
    })
  },
  { immediate: true }
)

onBeforeUnmount(deactivate)
</script>
