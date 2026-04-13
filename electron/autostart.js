const { app, dialog } = require('electron')
const log = require('electron-log')
const { getConfig, saveConfig } = require('./config')

async function setAutoStart(enable) {
  try {
    if (!app.isPackaged) {
      log.warn('开发环境，跳过开机启动设置')
      return true
    }

    const exePath = process.execPath
    log.info(`设置开机启动: ${enable ? '开启' : '关闭'}，路径: ${exePath}`)

    app.setLoginItemSettings({
      openAtLogin: enable,
      path: exePath,
    })

    const settings = app.getLoginItemSettings({
      path: exePath,
    })
    log.info(`开机启动验证: openAtLogin=${settings.openAtLogin}`)

    return true
  } catch (error) {
    log.error('设置开机启动失败:', error)
    return false
  }
}

async function getAutoStart() {
  if (!app.isPackaged) return false
  return app.getLoginItemSettings().openAtLogin
}

async function promptAutoStartOnFirstLaunch(mainWindow) {
  const config = getConfig()

  if (config.first_launch_done) {
    log.info('首次启动询问已完成')
    if (app.isPackaged) {
      await setAutoStart(config.auto_start)
    }
    return
  }

  log.info('首次启动，准备弹窗询问开机启动设置')

  if (!mainWindow || mainWindow.isDestroyed()) {
    log.warn('主窗口不存在，跳过弹窗')
    return
  }

  setTimeout(async () => {
    try {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: '开机启动',
        message: '是否设置开机自动启动？',
        detail: '开启后，系统启动时会自动运行本应用。\n\n您也可以在【设置】页面随时更改此选项。',
        buttons: ['开启', '不开启'],
        defaultId: 0,
        cancelId: 1,
      })

      const enableAutoStart = result.response === 0
      await setAutoStart(enableAutoStart)
      config.auto_start = enableAutoStart
      config.first_launch_done = true
      await saveConfig(config)

      log.info(`首次启动询问结果: ${enableAutoStart ? '开启' : '关闭'}开机启动`)
    } catch (error) {
      log.error('开机启动询问失败:', error)
    }
  }, 1000)
}

module.exports = {
  setAutoStart,
  getAutoStart,
  promptAutoStartOnFirstLaunch,
}