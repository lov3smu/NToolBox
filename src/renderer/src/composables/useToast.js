import { ref } from 'vue'

const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

export function useToast() {
  function showToast(message, type = 'success', duration = 2000) {
    toastMessage.value = message
    toastType.value = type
    toastVisible.value = true
    
    if (duration > 0) {
      setTimeout(() => {
        toastVisible.value = false
      }, duration)
    }
  }

  function hideToast() {
    toastVisible.value = false
  }

  function showSuccess(message, duration = 2000) {
    showToast(message, 'success', duration)
  }

  function showError(message, duration = 3000) {
    showToast(message, 'error', duration)
  }

  function showWarning(message, duration = 2500) {
    showToast(message, 'warning', duration)
  }

  function getIcon() {
    switch (toastType.value) {
      case 'error':
        return '✗'
      case 'warning':
        return '⚠'
      default:
        return '✓'
    }
  }

  return {
    toastVisible,
    toastMessage,
    toastType,
    showToast,
    hideToast,
    showSuccess,
    showError,
    showWarning,
    getIcon
  }
}