<template>
  <div v-if="promptDialog.visible" class="dialog-overlay" @click.self="onPromptCancel">
    <div class="dialog dialog-small">
      <div class="dialog-header">
        <h3>{{ promptDialog.title }}</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="onPromptCancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <input
            ref="promptInputRef"
            v-model="promptDialog.value"
            type="text"
            class="input-field"
            @keyup.enter="onPromptConfirm"
          />
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="onPromptCancel">取消</button>
        <button class="btn btn-primary" @click="onPromptConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { onPromptCancel, onPromptConfirm, promptDialog, promptInputRef } = databaseStore
</script>
