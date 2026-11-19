import { app } from 'electron'
import { autoUpdater, CancellationToken } from 'electron-updater'
import { log } from '../utils'
import { getConfig } from './config'
import { normalizeUpdateCheckInterval } from '../../shared/updater.js'
import { netFetch } from './network.js'
import { getUpdateFeedUrl } from '../../shared/network.js'
import { IPC_EVENTS } from '../../shared/ipc'
import { notify } from './notifications.js'
import { t } from './i18n.js'

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

const RELEASES_TIMEOUT = 12000

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
      .replace(/\r\n/g, '\n')
  }
  return typeof notes === 'string' ? notes.replace(/\r\n/g, '\n') : ''
}

function describeInfo(info) {
  return {
    latestVersion: info?.version || '',
    releaseNotes: normalizeReleaseNotes(info),
    releaseDate: info?.releaseDate || ''
  }
}

function normalizeReleaseVersion(value) {
  return String(value || '')
    .trim()
    .replace(/^v/i, '')
}

function normalizeReleaseEntry(release) {
  const version = normalizeReleaseVersion(release?.tag_name || release?.name)
  if (!version) return null
  return {
    version,
    tag: String(release?.tag_name || ''),
    name: String(release?.name || release?.tag_name || version),
    notes: typeof release?.body === 'string' ? release.body.replace(/\r\n/g, '\n').trim() : '',
    publishedAt: release?.published_at || release?.created_at || '',
    htmlUrl: String(release?.html_url || ''),
    prerelease: Boolean(release?.prerelease)
  }
}

export async function getUpdateReleases() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RELEASES_TIMEOUT)

  try {
    const response = await netFetch(getUpdateFeedUrl(getConfig().network?.market_sources), {
      signal: controller.signal,
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'NToolBox'
      }
    })
    if (!response.ok) {
      return { success: false, releases: [], error: `获取历史版本失败（HTTP ${response.status}）` }
    }

    const data = await response.json()
    if (!Array.isArray(data)) {
      return { success: false, releases: [], error: '历史版本数据格式异常' }
    }

    const releases = data
      .filter((release) => !release?.draft && !release?.prerelease)
      .map(normalizeReleaseEntry)
      .filter(Boolean)

    return { success: true, releases }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { success: false, releases: [], error: '获取历史版本超时，请稍后重试' }
    }
    log.warn('获取历史版本失败:', error)
    return { success: false, releases: [], error: error?.message || '获取历史版本失败' }
  } finally {
    clearTimeout(timer)
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
    if (!manualCheck) {
      void notify('update_found', {
        title: t('发现新版本'),
        body: t('NToolBox {version} 已发布，点击查看更新内容', { version: info.version })
      })
    }
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
    publish({ phase: 'error', error: err?.message || t('检查更新失败'), progress: null }, { open: manualCheck })
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
  if (config.update.auto_update && app.isPackaged) {
    const hours = normalizeUpdateCheckInterval(config.update.check_interval)
    updateCheckInterval = setInterval(
      () => {
        log.info('定时检查更新')
        checkForUpdates(false, mainWindow)
      },
      hours * 60 * 60 * 1000
    )
    log.info(`已启动定时更新检查，间隔: ${hours} 小时`)
  } else {
    log.info('定时更新检查未开启')
  }
}
