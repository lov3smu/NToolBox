<template>
  <div
    v-if="showCreateDialog"
    v-modal-shell="{ onClose: closeCreateDialog, closeOnOutside: false }"
    class="dialog-overlay"
  >
    <ConnectionEnginePicker
      v-if="createDialogStep === 'type'"
      v-model="newConnection.engine"
      title="新建连接"
      @confirm="onEngineConfirm"
      @close="closeCreateDialog"
    />
    <ConnectionForm
      v-else
      v-model="newConnection"
      mode="create"
      title="新建连接"
      :busy="testingNewConn"
      :groups="groups"
      @back="createDialogStep = 'type'"
      @change-engine="onChangeEngine"
      @close="closeCreateDialog"
      @test="testNewConnection"
      @submit="saveConnection(true)"
    />
  </div>
</template>

<script setup>
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ConnectionEnginePicker from './ConnectionEnginePicker.vue'
import ConnectionForm from './ConnectionForm.vue'
import { applyEngineDefaults } from '../connectionDefaults'

const databaseStore = inject('database')
const {
  closeCreateDialog,
  createDialogStep,
  groups,
  newConnection,
  saveConnection,
  showCreateDialog,
  testNewConnection,
  testingNewConn
} = databaseStore

const engineAtPicker = ref(newConnection.value.engine)

watch(showCreateDialog, (open) => {
  if (open) engineAtPicker.value = newConnection.value.engine
})

function onEngineConfirm() {
  if (newConnection.value.engine !== engineAtPicker.value) {
    applyEngineDefaults(newConnection.value, engineAtPicker.value)
  }
  createDialogStep.value = 'form'
}

function onChangeEngine() {
  engineAtPicker.value = newConnection.value.engine
  createDialogStep.value = 'type'
}

function onKeydown(event) {
  if (event.key !== 'Escape' || !showCreateDialog.value || testingNewConn.value) return
  closeCreateDialog()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
