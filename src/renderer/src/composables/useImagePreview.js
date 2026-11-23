import { reactive } from 'vue'

export const imagePreviewState = reactive({
  visible: false,
  src: '',
  name: ''
})

export function previewImage(src, name = '') {
  if (typeof src !== 'string' || !src) return
  imagePreviewState.src = src
  imagePreviewState.name = typeof name === 'string' ? name : ''
  imagePreviewState.visible = true
}

export function closeImagePreview() {
  imagePreviewState.visible = false
}

export function useImagePreview() {
  return { state: imagePreviewState, previewImage, closeImagePreview }
}
