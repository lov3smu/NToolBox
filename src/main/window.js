/**
 * 窗口管理模块（主窗口、启动画面、过渡动画）
 */
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { MIN_SPLASH_DISPLAY_TIME } = require('../common/constants');
const { getConfig, saveConfig } = require('./config');

let mainWindow = null;
let settingsWindow = null;
let passwordWindow = null;
let splashWindow = null;
let splashStartTime = null;
let isTransitioning = false;
let isMainWindowReady = false;

// ========== 图标路径 ==========
function getIconPath() {
    let iconPath = null;
    if (app.isPackaged) {
        const resourcesDir = process.resourcesPath;
        const possiblePaths = [
            path.join(resourcesDir, 'assets', 'icon.ico'),
            path.join(resourcesDir, 'assets', 'icon.png'),
            path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
            path.join(__dirname, '..', '..', 'assets', 'icon.png'),
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) { iconPath = p; break; }
        }
    } else {
        const devIco = path.join(__dirname, '..', '..', 'assets', 'icon.ico');
        const devPng = path.join(__dirname, '..', '..', 'assets', 'icon.png');
        if (fs.existsSync(devIco)) iconPath = devIco;
        else if (fs.existsSync(devPng)) iconPath = devPng;
    }
    if (!iconPath) log.warn('未找到图标文件');
    return iconPath;
}

function getTrayIconPath() {
    let iconPath = null;
    if (app.isPackaged) {
        const resourcesDir = process.resourcesPath;
        const possiblePaths = [
            path.join(resourcesDir, 'assets', 'icon.png'),
            path.join(resourcesDir, 'assets', 'icon.ico'),
            path.join(__dirname, '..', '..', 'assets', 'icon.png'),
            path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) { iconPath = p; break; }
        }
    } else {
        const devPng = path.join(__dirname, '..', '..', 'assets', 'icon.png');
        const devIco = path.join(__dirname, '..', '..', 'assets', 'icon.ico');
        if (fs.existsSync(devPng)) iconPath = devPng;
        else if (fs.existsSync(devIco)) iconPath = devIco;
    }
    return iconPath;
}

// ========== 启动画面 ==========
function createSplashWindow() {
    splashStartTime = Date.now();
    log.info('创建启动画面');

    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload', 'index.js'),
        },
    });

    splashWindow.loadFile(path.join(__dirname, '..', 'pages', 'splash.html'));
    splashWindow.center();

    splashWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.show();
            log.info('启动画面内容就绪，已显示');
        }
    });

    splashWindow.on('closed', () => {
        splashWindow = null;
        log.info('启动画面已关闭');
    });

    log.info('启动画面已创建');
    return splashWindow;
}

// ========== 平滑过渡 ==========
function smoothTransitionToMain() {
    if (isTransitioning) {
        log.info('过渡中，跳过重复调用');
        return;
    }

    if (!splashWindow || splashWindow.isDestroyed()) {
        log.info('启动画面已不存在，直接显示主窗口');
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
            mainWindow.show();
        }
        return;
    }

    isTransitioning = true;
    const elapsed = Date.now() - (splashStartTime || Date.now());
    const remainingTime = Math.max(0, MIN_SPLASH_DISPLAY_TIME - elapsed);
    log.info(`启动画面已显示 ${elapsed}ms，还需等待 ${remainingTime}ms`);

    const doTransition = () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            isTransitioning = false;
            return;
        }
        if (!mainWindow.isVisible()) {
            mainWindow.show();
            log.info('主窗口已显示（在 splash 下方）');
        }
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
                splashWindow = null;
                log.info('启动画面已销毁');
            }
            isTransitioning = false;
        }, 300);
    };

    if (remainingTime > 0) {
        setTimeout(doTransition, remainingTime);
    } else {
        doTransition();
    }
}

// ========== 窗口关闭处理 ==========
async function handleWindowClose(event) {
    if (app.isQuitting) return;
    event.preventDefault();

    const config = getConfig();

    if (config.close_action === 'hide') {
        mainWindow.hide();
        log.info('主窗口已隐藏到系统托盘（根据用户设置）');
    } else if (config.close_action === 'quit') {
        app.isQuitting = true;
        app.quit();
        log.info('应用已退出（根据用户设置）');
    } else {
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            title: '关闭确认',
            message: '是否隐藏到系统托盘？',
            detail: '选择"隐藏"后，应用将在后台运行，可通过托盘图标打开。\n选择"退出"将完全关闭应用。\n\n如果不勾选"记住我的选择"，下次关闭时会继续询问。',
            buttons: ['隐藏', '退出'],
            defaultId: 0,
            cancelId: 1,
            checkboxLabel: '记住我的选择，不再询问',
            checkboxChecked: false,
        });

        log.info(`对话框返回: response=${result.response}, checkboxChecked=${result.checkboxChecked}`);

        if (result.response === 0) {
            if (result.checkboxChecked) {
                config.close_action = 'hide';
                await saveConfig(config);
                log.info('用户选择记住：隐藏到托盘');
            }
            mainWindow.hide();
            log.info('主窗口已隐藏到系统托盘');
        } else if (result.response === 1) {
            if (result.checkboxChecked) {
                config.close_action = 'quit';
                await saveConfig(config);
                log.info('用户选择记住：退出应用');
            } else {
                log.info('用户点击了退出按钮（未记住）');
            }
            app.isQuitting = true;
            app.quit();
        }
    }
}

// ========== 创建主窗口 ==========
function createMainWindow(options = {}) {
    const { shouldHide = false, onReady } = options;
    const iconPath = getIconPath();

    log.info('创建主窗口，shouldHide:', shouldHide);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.destroy();
        mainWindow = null;
    }

    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        show: false,
        backgroundColor: '#667eea',
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload', 'index.js'),
        },
        title: 'SQL Script Generator',
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'pages', 'index.html'));
    log.info('主窗口 HTML 开始加载');

    mainWindow.once('ready-to-show', () => {
        log.info('主窗口 ready-to-show 事件触发');
        isMainWindowReady = true;

        if (!shouldHide) {
            smoothTransitionToMain();
        } else {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
                splashWindow = null;
            }
            log.info('开机启动模式，主窗口保持隐藏');
        }

        if (onReady) onReady(mainWindow);
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        log.error('主窗口页面加载失败:', errorCode, errorDescription, validatedURL);
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
        }
        if (!shouldHide) mainWindow.show();
        isTransitioning = false;
    });

    mainWindow.on('close', handleWindowClose);

    log.info('主窗口创建完成');
    return mainWindow;
}

// ========== splash 超时保护 ==========
function setupSplashTimeout() {
    setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed() && !isTransitioning && !isMainWindowReady) {
            log.warn('启动画面超时，强制过渡');
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
            splashWindow.close();
            splashWindow = null;
            isTransitioning = false;
        }
    }, 10000);
}

// ========== 设置窗口 ==========
function createSettingsWindow() {
    // 如果已存在，聚焦而非重复创建
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus();
        return settingsWindow;
    }

    const iconPath = getIconPath();

    settingsWindow = new BrowserWindow({
        width: 750,
        height: 550,
        minWidth: 600,
        minHeight: 400,
        parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
        modal: false,
        show: false,
        minimizable: false,
        maximizable: false,
        icon: iconPath,
        backgroundColor: '#f5f5f5',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload', 'index.js'),
        },
        title: '设置',
    });

    settingsWindow.setMenuBarVisibility(false);
    settingsWindow.loadFile(path.join(__dirname, '..', 'pages', 'settings.html'));

    settingsWindow.once('ready-to-show', () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.show();
        }
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
        log.info('设置窗口已关闭');
        // 通知主窗口重新加载配置
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('config-changed');
        }
    });

    log.info('设置窗口已创建');
    return settingsWindow;
}

// ========== 密码工具窗口 ==========
function createPasswordWindow() {
    // 如果已存在，聚焦而非重复创建
    if (passwordWindow && !passwordWindow.isDestroyed()) {
        passwordWindow.focus();
        return passwordWindow;
    }

    const iconPath = getIconPath();

    passwordWindow = new BrowserWindow({
        width: 750,
        height: 550,
        minWidth: 600,
        minHeight: 400,
        parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
        modal: false,
        show: false,
        minimizable: false,
        maximizable: false,
        icon: iconPath,
        backgroundColor: '#667eea',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload', 'index.js'),
        },
        title: '密码生成器',
    });

    passwordWindow.setMenuBarVisibility(false);
    passwordWindow.loadFile(path.join(__dirname, '..', 'pages', 'password.html'));

    passwordWindow.once('ready-to-show', () => {
        if (passwordWindow && !passwordWindow.isDestroyed()) {
            passwordWindow.show();
        }
    });

    passwordWindow.on('closed', () => {
        passwordWindow = null;
        log.info('密码工具窗口已关闭');
    });

    log.info('密码工具窗口已创建');
    return passwordWindow;
}

function getPasswordWindow() {
    return passwordWindow;
}

function getMainWindow() {
    return mainWindow;
}

function getSettingsWindow() {
    return settingsWindow;
}

function getSplashWindow() {
    return splashWindow;
}

module.exports = {
    getIconPath,
    getTrayIconPath,
    createSplashWindow,
    createMainWindow,
    createSettingsWindow,
    createPasswordWindow,
    setupSplashTimeout,
    getMainWindow,
    getSettingsWindow,
    getPasswordWindow,
    getSplashWindow,
};
