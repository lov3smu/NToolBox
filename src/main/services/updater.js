import { app } from 'electron'
import { autoUpdater, CancellationToken } from 'electron-updater'
import { log } from '../utils'
import { UPDATE_CHECK_INTERVAL } from '../constants'
import { getConfig } from './config'
import { IPC_EVENTS } from '../../shared/ipc'

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.logger.transports.console.level = 'debug'
autoUpdater.autoDownload = false
autoUpdater.allowPrerelease = false

let updateCheckInterval = null
let targetWindow = null
let downloadCancellation = null
let downloadCancelled = false
let manualCheck = false
let initialized = false

let updateState = {
  phase: 'idle',
  currentVersion: app.getVersion(),
  latestVersion: '',
  releaseNotes: '',
  releaseDate: '',
  progress: null,
  error: '',
  manual: false
}

function setTargetWindow(win) {
  if (win && !win.isDestroyed()) targetWindow = win
  return targetWindow
}

function publish(patch = {}, { open = false } = {}) {
  updateState = { ...updateState, ...patch }
  const win = targetWindow
  if (!win || win.isDestroyed()) return
  win.webContents.send(IPC_EVENTS.updateState, { ...updateState, open })
}

function normalizeReleaseNotes(info) {
  const notes = info?.releaseNotes
  if (Array.isArray(notes)) {
    return notes
      .map((entry) => (typeof entry === 'string' ? entry : entry?.note || ''))
      .filter(Boolean)
      .join('\n\n')
  }
  return typeof notes === 'string' ? notes : ''
}

function describeInfo(info) {
  return {
    latestVersion: info?.version || '',
    releaseNotes: normalizeReleaseNotes(info),
    releaseDate: info?.releaseDate || ''
  }
}

function initUpdater() {
  if (initialized) return
  initialized = true

  autoUpdater.on('checking-for-update', () => {
    log.info('正在检查更新...')
    publish({ phase: 'checking', error: '', progress: null })
  })

  autoUpdater.on('update-available', (info) => {
    log.info('发现新版本:', info.version)
    publish({ phase: 'available', ...describeInfo(info), progress: null, error: '' }, { open: true })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('当前已是最新版本')
    publish(
      { phase: 'not-available', latestVersion: '', releaseNotes: '', releaseDate: '', progress: null, error: '' },
      { open: manualCheck }
    )
  })

  autoUpdater.on('error', (err) => {
    log.error('更新出错:', err)
    publish({ phase: 'error', error: err?.message || '检查更新失败', progress: null }, { open: manualCheck })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    log.info(`下载进度: ${progressObj.percent}%`)
    publish({ phase: 'downloading', progress: Math.round(progressObj.percent) })
  })

  autoUpdater.on('update-cancelled', () => {
    log.info('更新下载已取消')
    publish({ phase: 'available', progress: null, error: '' })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('更新下载完成:', info)
    publish({ phase: 'downloaded', ...describeInfo(info), progress: 100, error: '' }, { open: true })
  })
}

function showTargetWindow(win) {
  if (!win || win.isDestroyed()) return
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

export async function checkForUpdates(manual = true, win = null) {
  initUpdater()

  const target = setTargetWindow(win)
  manualCheck = manual

  if (!app.isPackaged) {
    log.info('开发环境，跳过更新检查')
    if (manual) {
      showTargetWindow(target)
      publish(
        {
          phase: 'dev-environment',
          currentVersion: app.getVersion(),
          latestVersion: '',
          releaseNotes: '',
          releaseDate: '',
          progress: null,
          error: '',
          manual: true
        },
        { open: true }
      )
    }
    return { status: 'dev-environment' }
  }

  if (['downloading', 'downloaded', 'installing'].includes(updateState.phase)) {
    showTargetWindow(target)
    publish({ manual }, { open: manual })
    return { status: updateState.phase }
  }

  if (manual) showTargetWindow(target)
  log.info('开始检查更新，手动触发:', manual)

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'lov3smu',
    repo: 'NToolBox',
    releaseType: 'release'
  })

  publish(
    {
      phase: 'checking',
      currentVersion: app.getVersion(),
      progress: null,
      error: '',
      manual
    },
    { open: manual }
  )

  try {
    const result = await autoUpdater.checkForUpdates()
    return { status: updateState.phase, info: result?.updateInfo }
  } catch (err) {
    log.error('检查更新失败:', err)
    publish({ phase: 'error', error: err?.message || '检查更新失败', progress: null }, { open: manual })
    return { status: 'error', error: err }
  }
}

export async function downloadUpdate(win = null) {
  initUpdater()
  setTargetWindow(win)

  if (!app.isPackaged) {
    publish({ phase: 'dev-environment', error: '' }, { open: true })
    return { status: 'dev-environment' }
  }

  if (updateState.phase === 'downloading') return { status: 'downloading' }
  if (updateState.phase === 'downloaded') return { status: 'downloaded' }
  if (updateState.phase === 'installing') return { status: 'installing' }

  downloadCancelled = false
  downloadCancellation = new CancellationToken()
  publish({ phase: 'downloading', progress: 0, error: '' }, { open: true })

  try {
    await autoUpdater.downloadUpdate(downloadCancellation)
    return { status: 'downloaded' }
  } catch (err) {
    if (downloadCancelled) {
      log.info('已取消更新下载')
      publish({ phase: 'available', progress: null, error: '' })
      return { status: 'cancelled' }
    }
    log.error('下载更新失败:', err)
    publish({ phase: 'error', error: err?.message || '下载更新失败', progress: null }, { open: true })
    return { status: 'error', error: err }
  } finally {
    downloadCancellation = null
    downloadCancelled = false
  }
}

export function cancelUpdateDownload() {
  if (!downloadCancellation) return false
  downloadCancelled = true
  downloadCancellation.cancel()
  downloadCancellation = null
  publish({ phase: 'available', progress: null, error: '' })
  return true
}

export function installUpdate() {
  if (updateState.phase !== 'downloaded') return false
  publish({ phase: 'installing', error: '' }, { open: true })
  setTimeout(() => autoUpdater.quitAndInstall(), 120)
  return true
}

export function startAutoUpdateCheck(mainWindow) {
  if (updateCheckInterval) clearInterval(updateCheckInterval)

  const config = getConfig()
  if (config.auto_update && app.isPackaged) {
    updateCheckInterval = setInterval(() => {
      log.info('定时检查更新')
      checkForUpdates(false, mainWindow)
    }, UPDATE_CHECK_INTERVAL)
    log.info(`已启动定时更新检查，间隔: ${UPDATE_CHECK_INTERVAL / 3600000} 小时`)
  } else {
    log.info('定时更新检查未开启')
  }
}
