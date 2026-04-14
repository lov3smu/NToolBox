import { ref, watch } from 'vue'

export function useAutoDirName(usage) {
  const dirName = ref('')
  const lastAutoDirName = ref('')

  function updateDirName(force = false) {
    const now = new Date()
    const monthDay = now.toISOString().slice(5, 10).replace(/-/g, '')
    const usageText = usage.value?.trim() || ''
    const newAutoName = usageText ? `${monthDay}-${usageText}` : `${monthDay}-脚本`

    if (force || dirName.value === '' || dirName.value === lastAutoDirName.value) {
      dirName.value = newAutoName
      lastAutoDirName.value = newAutoName
    }
  }

  watch(dirName, (val) => {
    if (val !== lastAutoDirName.value) {
      lastAutoDirName.value = val
    }
  })

  return {
    dirName,
    updateDirName,
  }
}