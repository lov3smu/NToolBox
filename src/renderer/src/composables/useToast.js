import { ref } from 'vue'

const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

let toastTimer = null

function clearToastTimer() {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
}

export function useToast() {
  function showToast(message, type = 'success', duration = 2000) {
    clearToastTimer()
    toastMessage.value = message
    toastType.value = type
    toastVisible.value = true

    if (duration > 0) {
      toastTimer = setTimeout(() => {
        toastVisible.value = false
        toastTimer = null
      }, duration)
    }
  }

  function hideToast() {
    clearToastTimer()
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

  function showInfo(message, duration = 2500) {
    showToast(message, 'info', duration)
  }

  function showLoading(message, duration = 0) {
    showToast(message, 'loading', duration)
  }

  function getIcon() {
    switch (toastType.value) {
      case 'error':
        return '✗'
      case 'warning':
        return '⚠'
      case 'info':
        return 'ℹ'
      case 'loading':
        return ''
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
    showInfo,
    showLoading,
    getIcon
  }
}
