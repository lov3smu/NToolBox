import { computed, ref } from 'vue'
import { normalizeSplitPath } from '@shared/navTools'

export const SPLIT_SECONDARY_KEY = Symbol('split-secondary')

const STORAGE_KEY = 'ntb_split_secondary'

function readStored() {
  if (typeof localStorage === 'undefined') return ''
  try {
    return normalizeSplitPath(localStorage.getItem(STORAGE_KEY))
  } catch {
    return ''
  }
}

const secondaryPath = ref(readStored())

function persist() {
  if (typeof localStorage === 'undefined') return
  try {
    if (secondaryPath.value) localStorage.setItem(STORAGE_KEY, secondaryPath.value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore storage failures
  }
}

function setSecondaryPath(path) {
  secondaryPath.value = normalizeSplitPath(path)
  persist()
}

function closeSplit() {
  setSecondaryPath('')
}

const splitActive = computed(() => Boolean(secondaryPath.value))

export function useSplitView() {
  return {
    secondaryPath,
    splitActive,
    openSplit: setSecondaryPath,
    setSecondaryPath,
    closeSplit
  }
}
