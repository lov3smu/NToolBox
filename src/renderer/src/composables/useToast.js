import { ref } from 'vue'

const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

export function useToast() {
  function showToast(message, type = 'success') {
    toastMessage.value = message
    toastType.value = type
    toastVisible.value = true
    setTimeout(() => {
      toastVisible.value = false
    }, 2000)
  }

  function showError(message) {
    showToast(message, 'error')
  }

  function showSuccess(message) {
    showToast(message, 'success')
  }

  return {
    toastVisible,
    toastMessage,
    toastType,
    showToast,
    showError,
    showSuccess
  }
}