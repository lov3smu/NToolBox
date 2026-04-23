import { app, dialog, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { log } from '../utils'
import { UPDATE_CHECK_INTERVAL } from '../constants'
import { getConfig } from './config'

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.logger.transports.console.level = 'debug'

if (process.platform === 'win32') {
  autoUpdater.autoDownload = false
  autoUpdater.allowPrerelease = false
}

let updateCheckInterval = null

export function checkForUpdates(manual = true, mainWindow = null) {
  if (!app.isPackaged) {
    log.info('开发环境，跳过更新检查')
    if (manual && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '检查更新',
        message: '当前为开发环境，无法检查更新。\n请打包后测试更新功能。',
        buttons: ['确定']
      })
    }
    return Promise.resolve({ status: 'dev-environment' })
  }

  log.info('开始检查更新，手动触发:', manual)

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'lov3smu',
    repo: 'sql-script-generator',
    releaseType: 'release'
  })

  autoUpdater.removeAllListeners('checking-for-update')
  autoUpdater.removeAllListeners('update-available')
  autoUpdater.removeAllListeners('update-not-available')
  autoUpdater.removeAllListeners('error')
  autoUpdater.removeAllListeners('download-progress')
  autoUpdater.removeAllListeners('update-downloaded')

  return new Promise((resolve) => {
    autoUpdater.once('checking-for-update', () => {
      log.info('正在检查更新...')
      if (manual && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', '正在检查更新...')
      }
    })

    autoUpdater.once('update-available', (info) => {
      log.info('发现新版本:', info.version)
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '发现新版本',
          message: `发现新版本 ${info.version}，是否立即下载？`,
          buttons: ['下载', '以后']
        }).then(result => {
          if (result.response === 0) autoUpdater.downloadUpdate()
        })
      }
      resolve({ status: 'update-available', info })
    })

    autoUpdater.once('update-not-available', () => {
      log.info('当前已是最新版本')
      if (manual && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '检查更新',
          message: '当前已是最新版本',
          buttons: ['确定']
        })
      }
      resolve({ status: 'update-not-available' })
    })

    autoUpdater.once('error', (err) => {
      log.error('更新出错:', err)
      
      if (err.message && err.message.includes('not signed')) {
        log.warn('更新包签名验证失败')
        if (manual && mainWindow && !mainWindow.isDestroyed()) {
          dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: '更新失败',
            message: '无法安装更新：更新包签名验证失败。\n\n请前往 GitHub Releases 页面手动下载最新版本。',
            buttons: ['前往下载', '取消']
          }).then(result => {
            if (result.response === 0) {
              shell.openExternal(
                'https://github.com/lov3smu/sql-script-generator/releases'
              )
            }
          })
        }
        resolve({ status: 'error', error: err })
        return
      }
      
      if (manual && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox('检查更新失败', `无法检查更新：${err.message}`)
      }
      resolve({ status: 'error', error: err })
    })

    autoUpdater.once('download-progress', (progressObj) => {
      log.info(`下载进度: ${progressObj.percent}%`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-progress', progressObj.percent)
      }
    })

    autoUpdater.once('update-downloaded', (info) => {
      log.info('更新下载完成:', info)
      if (!mainWindow || mainWindow.isDestroyed()) {
        log.warn('主窗口不存在，跳过更新安装提示')
        return
      }
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '更新就绪',
        message: `新版本 ${info.version} 已下载完成，是否立即重启安装？`,
        buttons: ['立即重启', '稍后']
      }).then(result => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
    })

    autoUpdater.checkForUpdatesAndNotify()
  })
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