<template>
  <MessageDialog
    :visible="messageDialog.visible"
    :type="messageDialog.type"
    :title="messageDialog.title"
    :message="messageDialog.message"
    :prompt="Boolean(messageDialog.prompt)"
    :input-value="messageDialog.inputValue"
    @update:input-value="messageDialog.inputValue = $event"
    @confirm="onMessageConfirm"
    @cancel="onMessageCancel"
  />
</template>

<script setup>
import MessageDialog from '@/components/MessageDialog.vue'
import { inject } from 'vue'

const databaseStore = inject('database')
const { messageDialog, onMessageCancel, onMessageConfirm } = databaseStore
</script>
