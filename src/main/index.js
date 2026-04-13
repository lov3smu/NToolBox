/**
 * 主进程入口
 * 负责应用生命周期管理，串联各子模块
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

const { installDir, loadConfig } = require('./config');
const { createSplashWindow, createMainWindow, setupSplashTimeout, getMainWindow, getSplashWindow, getSettingsWindow, getPasswordWindow, getCronWindow } = require('./window');
const { createTray, destroyTray } = require('./tray');
const { createAppMenu } = require('./menu');
const { setupIPCHandlers } = require('./ipc');
const { checkForUpdates, startAutoUpdateCheck } = require('./updater');
const { promptAutoStartOnFirstLaunch } = require('./autostart');

// ========== 配置日志路径 ==========
const logDir = path.join(installDir, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log');
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('========================================');
log.info('应用启动，安装目录:', installDir);
log.info('日志目录:', logDir);
log.info('========================================');

// ========== 应用退出处理 ==========
app.on('before-quit', () => {
    app.isQuitting = true;
    destroyTray();
    
    const windows = [getMainWindow(), getSettingsWindow(), getPasswordWindow(), getCronWindow(), getSplashWindow()];
    windows.forEach(win => {
        if (win && !win.isDestroyed()) {
            win.destroy();
        }
    });
    log.info('所有窗口已关闭');
});

app.on('window-all-closed', () => {
    // 不退出应用，保持在托盘运行
});

// ========== 应用启动 ==========
app.whenReady().then(async () => {
    log.info('========================================');
    log.info('Electron 应用准备就绪');
    log.info('========================================');

    const shouldHide = process.argv.includes('--hidden');
    log.info('启动模式:', shouldHide ? '隐藏（开机自启）' : '正常');

    // 加载配置
    const loadedConfig = await loadConfig();
    if (!loadedConfig) {
        log.error('配置加载失败，应用即将退出');
        return;
    }

    // 注册 IPC
    setupIPCHandlers(getMainWindow, checkForUpdates);

    // 创建托盘
    createTray(null, checkForUpdates);

    // 正常模式下显示 splash，等 splash 显示后再创建主窗口
    if (!shouldHide) {
        createSplashWindow(async () => {
            setupSplashTimeout();
            
            const mainWindow = createMainWindow({
                shouldHide,
                onReady: (win) => {
                    setTimeout(() => promptAutoStartOnFirstLaunch(win), 1000);
                },
            });
            
            createTray(mainWindow, checkForUpdates);
            createAppMenu(mainWindow, checkForUpdates);
            startAutoUpdateCheck(mainWindow);
            
            log.info('应用启动完成');
        });
    } else {
        // 隐藏模式下直接创建主窗口
        const mainWindow = createMainWindow({
            shouldHide,
            onReady: (win) => {
                setTimeout(() => promptAutoStartOnFirstLaunch(win), 1000);
            },
        });
        
        createTray(mainWindow, checkForUpdates);
        createAppMenu(mainWindow, checkForUpdates);
        startAutoUpdateCheck(mainWindow);
        
        log.info('应用启动完成（隐藏模式）');
    }
});
