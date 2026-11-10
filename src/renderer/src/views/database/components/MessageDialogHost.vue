<template>
  <MessageDialog
    :visible="messageDialog.visible"
    :type="messageDialog.type"
    :title="messageDialog.title"
    :message="messageDialog.message"
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
