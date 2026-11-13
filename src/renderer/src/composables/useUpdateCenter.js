import { reactive } from 'vue'
import {
  cancelUpdateDownload,
  checkForUpdates,
  downloadUpdate,
  getPackageInfo,
  installUpdate,
  onUpdateState,
  openExternal
} from '@/api'

export const UPDATE_RELEASE_URL = 'https://github.com/lov3smu/NToolBox/releases/latest'

export const updateCenter = reactive({
  visible: false,
  phase: 'idle',
  currentVersion: '',
  latestVersion: '',
  releaseNotes: '',
  releaseDate: '',
  progress: null,
  error: '',
  manual: false
})

let subscribed = false
let versionLoaded = false

function applyState(payload) {
  if (!payload || typeof payload !== 'object') return
  if (payload.open) updateCenter.visible = true
  if (payload.phase !== undefined) updateCenter.phase = payload.phase
  if (payload.currentVersion !== undefined) updateCenter.currentVersion = payload.currentVersion
  if (payload.latestVersion !== undefined) updateCenter.latestVersion = payload.latestVersion
  if (payload.releaseNotes !== undefined) updateCenter.releaseNotes = payload.releaseNotes
  if (payload.releaseDate !== undefined) updateCenter.releaseDate = payload.releaseDate
  if (payload.error !== undefined) updateCenter.error = payload.error
  if (payload.manual !== undefined) updateCenter.manual = Boolean(payload.manual)
  if ('progress' in payload) updateCenter.progress = payload.progress ?? null
}

function ensureSubscribed() {
  if (subscribed) return
  subscribed = true
  onUpdateState(applyState)
}

async function loadCurrentVersion() {
  if (versionLoaded) return
  versionLoaded = true
  const info = await getPackageInfo()
  if (info?.version && !updateCenter.currentVersion) updateCenter.currentVersion = info.version
}

export async function openUpdateCenter() {
  ensureSubscribed()
  loadCurrentVersion()
  updateCenter.visible = true

  if (['downloading', 'downloaded', 'installing'].includes(updateCenter.phase)) return

  updateCenter.phase = 'checking'
  updateCenter.error = ''
  updateCenter.progress = null

  const result = await checkForUpdates(true)
  if (result?.status === 'dev-environment' && updateCenter.phase === 'checking') {
    updateCenter.phase = 'dev-environment'
  }
}

export function closeUpdateCenter() {
  updateCenter.visible = false
}

export async function startUpdateDownload() {
  await downloadUpdate()
}

export async function cancelUpdateDownloadNow() {
  await cancelUpdateDownload()
}

export async function installUpdateNow() {
  await installUpdate()
}

export async function openUpdateReleasePage() {
  await openExternal(UPDATE_RELEASE_URL)
}

export function useUpdateCenter() {
  ensureSubscribed()
  loadCurrentVersion()
  return {
    updateCenter,
    openUpdateCenter,
    closeUpdateCenter,
    startUpdateDownload,
    cancelUpdateDownloadNow,
    installUpdateNow,
    openUpdateReleasePage
  }
}
