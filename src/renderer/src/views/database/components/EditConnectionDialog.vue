<template>
  <div v-if="showEditDialog" v-modal-shell="{ onClose: closeEditDialog, closeOnOutside: false }" class="dialog-overlay">
    <ConnectionEnginePicker
      v-if="editDialogStep === 'type'"
      v-model="editingConnection.engine"
      title="编辑连接"
      @confirm="onEngineConfirm"
      @close="closeEditDialog"
    />
    <ConnectionForm
      v-else
      v-model="editingConnection"
      mode="edit"
      title="编辑连接"
      :busy="testingEditConn"
      :groups="groups"
      @change-engine="onChangeEngine"
      @close="closeEditDialog"
      @test="testEditConnection"
      @submit="updateConnection"
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
  closeEditDialog,
  editDialogStep,
  editingConnection,
  groups,
  showEditDialog,
  testEditConnection,
  testingEditConn,
  updateConnection
} = databaseStore

const engineAtPicker = ref('mysql')

watch(showEditDialog, (open) => {
  if (open && editingConnection.value) engineAtPicker.value = editingConnection.value.engine
})

function onEngineConfirm() {
  if (editingConnection.value.engine !== engineAtPicker.value) {
    applyEngineDefaults(editingConnection.value, engineAtPicker.value)
  }
  editDialogStep.value = 'form'
}

function onChangeEngine() {
  engineAtPicker.value = editingConnection.value.engine
  editDialogStep.value = 'type'
}

function onKeydown(event) {
  if (event.key !== 'Escape' || !showEditDialog.value || testingEditConn.value) return
  closeEditDialog()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
