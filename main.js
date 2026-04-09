const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { exec } = require('child_process');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

// ========== 配置自动更新日志 ==========
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.logger.transports.console.level = 'debug';

// ========== 全局变量 ==========
let mainWindow = null;
let splashWindow = null;
let tray = null;
let config = {};
let updateCheckInterval = null;
let splashStartTime = null;
let isTransitioning = false;
let isMainWindowReady = false;
const MIN_SPLASH_DISPLAY_TIME = 1500;
const UPDATE_CHECK_INTERVAL = 12 * 60 * 60 * 1000;

// ========== 获取安装目录 ==========
function getInstallDir() {
    if (app.isPackaged) {
        return path.dirname(app.getPath('exe'));
    } else {
        return process.cwd();
    }
}

// ========== 配置日志路径 ==========
const installDir = getInstallDir();
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

const configPath = path.join(installDir, 'config.json');
log.info('配置文件路径:', configPath);

const packageJson = require('./package.json');
const appVersion = packageJson.version;
let appAuthor = packageJson.author || 'lov3smu';
if (appAuthor === '未知作者') appAuthor = 'lov3smu';
appAuthor = appAuthor.replace(/<[^>]*>/g, '').trim();

// ========== 获取图标路径 ==========
function getIconPath() {
    let iconPath = null;
    
    if (app.isPackaged) {
        // 生产环境：从 resources 目录读取
        const resourcesDir = process.resourcesPath;
        
        // 尝试多个可能的路径
        const possiblePaths = [
            path.join(resourcesDir, 'assets', 'icon.ico'),
            path.join(resourcesDir, 'assets', 'icon.png'),
            path.join(__dirname, 'assets', 'icon.ico'),
            path.join(__dirname, 'assets', 'icon.png')
        ];
        
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                iconPath = p;
                log.info('找到图标:', iconPath);
                break;
            }
        }
    } else {
        // 开发环境
        const devPath = path.join(__dirname, 'assets', 'icon.ico');
        if (fs.existsSync(devPath)) {
            iconPath = devPath;
        } else {
            const devPngPath = path.join(__dirname, 'assets', 'icon.png');
            if (fs.existsSync(devPngPath)) {
                iconPath = devPngPath;
            }
        }
    }
    
    if (!iconPath) {
        log.warn('未找到图标文件');
    }
    
    return iconPath;
}

// ========== 获取托盘图标路径 ==========
function getTrayIconPath() {
    let iconPath = null;
    
    if (app.isPackaged) {
        // 生产环境：从 resources 目录读取
        const resourcesDir = process.resourcesPath;
        
        const possiblePaths = [
            path.join(resourcesDir, 'assets', 'icon.png'),
            path.join(resourcesDir, 'assets', 'icon.ico'),
            path.join(__dirname, 'assets', 'icon.png'),
            path.join(__dirname, 'assets', 'icon.ico')
        ];
        
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                iconPath = p;
                log.info('找到托盘图标:', iconPath);
                break;
            }
        }
    } else {
        // 开发环境
        const devPngPath = path.join(__dirname, 'assets', 'icon.png');
        if (fs.existsSync(devPngPath)) {
            iconPath = devPngPath;
        } else {
            const devIcoPath = path.join(__dirname, 'assets', 'icon.ico');
            if (fs.existsSync(devIcoPath)) {
                iconPath = devIcoPath;
            }
        }
    }
    
    return iconPath;
}

// ========== 默认配置 ==========
function getDefaultConfigContent() {
    const defaultBasePath = path.join(installDir, 'Develop', '11 - Database Script');
    return {
        base_path: defaultBasePath,
        developer_ch_name: "张三",
        developer_en_name: "zhangsan",
        text_edit_app: "",
        auto_update: true,
        auto_start: true,
        first_launch_done: false,
        close_action: "ask",
        databases: [
            "order_db", "product_db", "community_db", "content_db", "device_db",
            "main_db", "promotion_db", "ota_db", "payment_db", "pmp_db",
            "report_db", "report_data_db", "sharespace_db", "user_db",
            "workbench_db", "worktask_db", "data_warehouse_db"
        ],
        script_types: [
            { name: "DDL", description: "Data Definition Language (CREATE, ALTER, DROP)" },
            { name: "DML", description: "Data Manipulation Language (INSERT, UPDATE, DELETE)" },
            { name: "DQL", description: "Data Query Language (SELECT)" }
        ]
    };
}

async function createDefaultConfig() {
    try {
        const defaultConfig = getDefaultConfigContent();
        await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
        log.info('已创建默认配置文件:', configPath);
        return defaultConfig;
    } catch (error) {
        log.error('创建默认配置文件失败:', error);
        throw error;
    }
}

async function loadConfig() {
    try {
        const data = await fsPromises.readFile(configPath, 'utf8');
        config = JSON.parse(data);
        log.info('配置文件加载成功');
        
        if (config.auto_update === undefined) config.auto_update = true;
        if (config.auto_start === undefined) config.auto_start = true;
        if (config.first_launch_done === undefined) config.first_launch_done = false;
        if (config.close_action === undefined) config.close_action = "ask";
        
        return config;
    } catch (error) {
        if (error.code === 'ENOENT') {
            log.info('配置文件不存在，创建默认配置');
            config = await createDefaultConfig();
            return config;
        }
        log.error('加载配置文件失败:', error);
        dialog.showErrorBox('配置错误', `无法加载配置文件 config.json：\n${error.message}`);
        app.quit();
        return null;
    }
}

async function saveConfig(newConfig) {
    try {
        await fsPromises.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
        config = newConfig;
        log.info('配置保存成功');
        return true;
    } catch (error) {
        log.error('保存配置文件失败:', error);
        return false;
    }
}

// ========== 开机启动设置 ==========
async function setAutoStart(enable) {
    try {
        app.setLoginItemSettings({
            openAtLogin: enable,
            path: app.getPath('exe'),
            args: enable ? ['--hidden'] : [],
            enabled: enable
        });
        log.info(`开机启动设置: ${enable ? '开启' : '关闭'}`);
        return true;
    } catch (error) {
        log.error('设置开机启动失败:', error);
        return false;
    }
}

async function getAutoStart() {
    return app.getLoginItemSettings().openAtLogin;
}

// ========== 首次启动询问开机启动 ==========
async function promptAutoStartOnFirstLaunch() {
    if (config.first_launch_done) {
        log.info('首次启动询问已完成，直接应用保存的开机启动设置:', config.auto_start);
        await setAutoStart(config.auto_start);
        return;
    }
    
    log.info('首次启动，准备弹窗询问开机启动设置');
    
    if (!mainWindow || mainWindow.isDestroyed()) {
        log.warn('主窗口不存在，跳过弹窗');
        return;
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
                cancelId: 1
            });
            
            const enableAutoStart = (result.response === 0);
            await setAutoStart(enableAutoStart);
            config.auto_start = enableAutoStart;
            config.first_launch_done = true;
            await saveConfig(config);
            
            log.info(`首次启动询问结果: ${enableAutoStart ? '开启' : '关闭'}开机启动`);
        } catch (error) {
            log.error('开机启动询问失败:', error);
        }
    }, 1000);
}

// ========== 创建系统托盘 ==========
function createTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
    
    let iconPath = getTrayIconPath();
    
    if (!iconPath || !fs.existsSync(iconPath)) {
        iconPath = getIconPath();
    }
    
    if (!iconPath || !fs.existsSync(iconPath)) {
        const defaultIcon = nativeImage.createFromDataURL(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADSSURBVDiNpZMxSgNBFIafNwsJFhZqY6WVWAgWXiCtF2gTb2AnHkGwtBEtBAsL8QpWsRFUkNRCYwjMzm4KhyCbKDObeTL8/3zzzftn4H+zTGn2V1OrB2CSUgqPLZtFQnSj1Pz5tSIlgPco0n1dUj9kzT1EW1IqyUYZ0K1AN+Ms0s1zIcR99mZ3AH5n4DqbzDMIE6CvjR7gBqgUYhfnAAdoCmB2JxVrKwf0QwhhpVgLfRDCE9C/HgT4HntSygXKskzlnH+A5c2Oruu+mqaRZVm+r+u6/iCE8F7f3F0AbRfnMiBN7nQAAAAASUVORK5CYII='
        );
        tray = new Tray(defaultIcon);
    } else {
        tray = new Tray(iconPath);
    }
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: '设置',
            click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.webContents.send('open-settings');
                }
            }
        },
        { type: 'separator' },
        {
            label: '检查更新',
            click: () => checkForUpdates(true)
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.isQuitting = true;
                if (tray) {
                    tray.destroy();
                    tray = null;
                }
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('SQL Script Generator');
    
    tray.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                if (mainWindow.isMinimized()) {
                    mainWindow.restore();
                }
                mainWindow.focus();
            }
        }
    });
    
    tray.on('double-click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });
    
    log.info('系统托盘已创建');
}

// ========== 创建启动画面 ==========
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
        show: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    splashWindow.loadFile('splash.html');
    splashWindow.center();
    
    splashWindow.on('closed', () => {
        splashWindow = null;
        log.info('启动画面已关闭');
    });
    
    log.info('启动画面已创建');
}

// ========== 平滑过渡：关闭启动画面并显示主窗口 ==========
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
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setBackgroundColor('#f0f0f0');
    }
    
    const doTransition = () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.hide();
            log.info('启动画面已隐藏');
        }
        
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
            mainWindow.show();
            log.info('主窗口已显示');
        }
        
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
                splashWindow = null;
                log.info('启动画面已销毁');
            }
            isTransitioning = false;
        }, 100);
    };
    
    if (remainingTime > 0) {
        setTimeout(doTransition, remainingTime);
    } else {
        doTransition();
    }
}

// ========== 处理窗口关闭事件 ==========
async function handleWindowClose(event) {
    // 如果正在退出应用，直接关闭
    if (app.isQuitting) {
        return;
    }
    
    event.preventDefault();
    
    // 根据保存的行为决定操作
    if (config.close_action === "hide") {
        // 直接隐藏到托盘
        mainWindow.hide();
        log.info('主窗口已隐藏到系统托盘（根据用户设置）');
    } else if (config.close_action === "quit") {
        // 直接退出应用
        app.isQuitting = true;
        app.quit();
        log.info('应用已退出（根据用户设置）');
    } else {
        // 显示系统默认询问对话框
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            title: '关闭确认',
            message: '是否隐藏到系统托盘？',
            detail: '选择"隐藏"后，应用将在后台运行，可通过托盘图标打开。\n选择"退出"将完全关闭应用。\n\n如果不勾选"记住我的选择"，下次关闭时会继续询问。',
            buttons: ['隐藏', '退出'],
            defaultId: 0,
            cancelId: 1,
            checkboxLabel: '记住我的选择，不再询问',
            checkboxChecked: false
        });
        
        log.info(`对话框返回: response=${result.response}, checkboxChecked=${result.checkboxChecked}`);
        
        if (result.response === 0) {
            // 用户点击了"隐藏"按钮
            if (result.checkboxChecked) {
                config.close_action = "hide";
                await saveConfig(config);
                log.info('用户选择记住：隐藏到托盘');
            }
            mainWindow.hide();
            log.info('主窗口已隐藏到系统托盘');
        } else if (result.response === 1 && result.checkboxChecked === true) {
            // 用户点击了"退出"按钮并且勾选了复选框
            config.close_action = "quit";
            await saveConfig(config);
            log.info('用户选择记住：退出应用');
            app.isQuitting = true;
            app.quit();
            log.info('应用已退出');
        } else if (result.response === 1 && result.checkboxChecked === false) {
            // 用户点击了"退出"按钮但未勾选复选框，或者是点击了关闭按钮（X）
            // 两者都返回 response=1, checkboxChecked=false
            // 为了安全，不退出应用，只关闭对话框
            log.info('用户点击了退出按钮（未记住）或关闭按钮，不退出应用');
            // 什么都不做，主窗口保持打开
        } else {
            log.info('对话框被取消，不执行任何操作');
        }
    }
}

// ========== 创建主窗口 ==========
function createWindow() {
    const iconPath = getIconPath();
    const shouldHide = process.argv.includes('--hidden');
    
    log.info('创建主窗口，shouldHide:', shouldHide);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.destroy();
        mainWindow = null;
    }
    
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        show: false,
        backgroundColor: '#f0f0f0',
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'SQL Script Generator Tool'
    });

    mainWindow.loadFile('index.html');
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
        
        setTimeout(() => {
            promptAutoStartOnFirstLaunch();
        }, 1000);
    });
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        log.error('主窗口页面加载失败:', errorCode, errorDescription, validatedURL);
        
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
        }
        
        if (!shouldHide) {
            mainWindow.show();
        }
        isTransitioning = false;
    });
    
    mainWindow.on('close', handleWindowClose);
    
    createAppMenu();
    log.info('主窗口创建完成');
}

// ========== 检查更新 ==========
function checkForUpdates(manual = true) {
    if (!app.isPackaged) {
        log.info('开发环境，跳过更新检查');
        if (manual && mainWindow) {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '检查更新',
                message: '当前为开发环境，无法检查更新。\n请打包后测试更新功能。',
                buttons: ['确定']
            });
        }
        return Promise.resolve({ status: 'dev-environment' });
    }
    
    log.info('开始检查更新，手动触发:', manual);
    
    autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'lov3smu',
        repo: 'sql-script-generator',
        releaseType: 'release'
    });
    
    autoUpdater.removeAllListeners('checking-for-update');
    autoUpdater.removeAllListeners('update-available');
    autoUpdater.removeAllListeners('update-not-available');
    autoUpdater.removeAllListeners('error');
    autoUpdater.removeAllListeners('download-progress');
    autoUpdater.removeAllListeners('update-downloaded');
    
    return new Promise((resolve) => {
        autoUpdater.on('checking-for-update', () => {
            log.info('正在检查更新...');
            if (manual && mainWindow) {
                mainWindow.webContents.send('update-status', '正在检查更新...');
            }
        });
        
        autoUpdater.on('update-available', (info) => {
            log.info('发现新版本:', info.version);
            if (mainWindow) {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: '发现新版本',
                    message: `发现新版本 ${info.version}（当前版本 ${appVersion}），是否立即下载？`,
                    buttons: ['下载', '以后']
                }).then(result => {
                    if (result.response === 0) {
                        autoUpdater.downloadUpdate();
                    }
                });
            }
            resolve({ status: 'update-available', info });
        });
        
        autoUpdater.on('update-not-available', () => {
            log.info('当前已是最新版本');
            if (manual && mainWindow) {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: '检查更新',
                    message: `当前已是最新版本（${appVersion}）`,
                    buttons: ['确定']
                });
            }
            resolve({ status: 'update-not-available' });
        });
        
        autoUpdater.on('error', (err) => {
            log.error('更新出错:', err);
            if (manual && mainWindow) {
                dialog.showErrorBox('检查更新失败', `无法检查更新：${err.message}`);
            }
            resolve({ status: 'error', error: err });
        });
        
        autoUpdater.on('download-progress', (progressObj) => {
            log.info(`下载进度: ${progressObj.percent}%`);
            if (mainWindow) {
                mainWindow.webContents.send('update-progress', progressObj.percent);
            }
        });
        
        autoUpdater.on('update-downloaded', (info) => {
            log.info('更新下载完成:', info);
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '更新就绪',
                message: `新版本 ${info.version} 已下载完成，是否立即重启安装？`,
                buttons: ['立即重启', '稍后']
            }).then(result => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });
        
        autoUpdater.checkForUpdatesAndNotify();
    });
}

// ========== 启动定时更新检查 ==========
function startAutoUpdateCheck() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }
    
    if (config.auto_update && app.isPackaged) {
        updateCheckInterval = setInterval(() => {
            log.info('定时检查更新');
            checkForUpdates(false);
        }, UPDATE_CHECK_INTERVAL);
        log.info(`已启动定时更新检查，间隔: ${UPDATE_CHECK_INTERVAL / 3600000} 小时`);
    } else {
        log.info('定时更新检查未开启');
    }
}

// ========== 关于软件对话框 ==========
function showAboutDialog() {
    const appName = 'SQL Script Generator';
    const version = appVersion;
    const author = appAuthor;
    const description = 'SQL脚本生成工具，用于快速生成符合规范的SQL脚本文件。';
    const copyright = `© ${new Date().getFullYear()} ${author}. All rights reserved.`;
    
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '关于软件',
        message: `${appName} ${version}`,
        detail: `${description}\n\n作者：${author}\n\n${copyright}`,
        buttons: ['确定'],
        icon: getIconPath()
    });
}

// ========== 创建应用菜单 ==========
function createAppMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '隐藏窗口',
                    click: () => {
                        if (mainWindow) mainWindow.hide();
                    }
                },
                { type: 'separator' },
                {
                    label: '退出',
                    click: () => {
                        app.isQuitting = true;
                        if (tray) {
                            tray.destroy();
                            tray = null;
                        }
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于软件',
                    click: () => showAboutDialog()
                },
                {
                    label: '检查更新',
                    click: () => checkForUpdates(true)
                }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ========== 生成SQL文件 ==========
async function generateSQLFile(scriptInfo) {
    try {
        log.info('开始生成SQL文件', scriptInfo);
        const now = new Date();
        const currentYear = now.getFullYear().toString();
        const currentDate = now.toISOString().split('T')[0];
        const dateCompact = now.toISOString().slice(2, 10).replace(/-/g, '');
        
        let targetPath;
        switch (scriptInfo.operateType) {
            case 'FIX':
                targetPath = path.join(config.base_path, 'PRODUCT-FIX', currentYear, scriptInfo.dirName);
                if (scriptInfo.scriptType) targetPath = path.join(targetPath, scriptInfo.scriptType);
                break;
            case 'PUBLISH':
                targetPath = path.join(config.base_path, 'PUBLISH', currentYear, scriptInfo.dirName);
                if (scriptInfo.scriptType) targetPath = path.join(targetPath, scriptInfo.scriptType);
                break;
            case 'QUERY':
                targetPath = path.join(config.base_path, 'DATA-QUERY', currentYear, scriptInfo.dirName);
                break;
            default:
                throw new Error('无效的操作类型');
        }
        
        await fsPromises.mkdir(targetPath, { recursive: true });
        
        const files = await fsPromises.readdir(targetPath);
        const sqlFiles = files.filter(f => f.endsWith('.sql'));
        const fileCount = sqlFiles.length + 1;
        const sNumber = fileCount < 10 ? `S0${fileCount}` : `S${fileCount}`;
        
        let filename;
        if (scriptInfo.operateType === 'QUERY') {
            filename = `${sNumber}-${currentDate}-${scriptInfo.database}-${scriptInfo.usage}.sql`;
        } else {
            filename = `${sNumber}-${currentDate}-${scriptInfo.scriptType}-${scriptInfo.database}-${scriptInfo.usage}.sql`;
        }
        filename = filename.replace(/\s/g, '_');
        
        const filePath = path.join(targetPath, filename);
        
        const content = `-- Please use UTF8 encoding without BOM
-- Script Usage: ${scriptInfo.usage}
-- Script Author: ${config.developer_ch_name}
-- Creation Time: ${currentDate}

USE ${scriptInfo.database};

BEGIN;

SET @author = '${config.developer_en_name}${dateCompact}';

INSERT INTO t_script_history (scriptName, remark, create_by, modify_by, create_time, modify_time)
VALUES ('${filename}', '${scriptInfo.usage}', @author, @author, NOW(), NOW());

COMMIT;
`;
        
        await fsPromises.writeFile(filePath, content, 'utf8');
        
        return {
            success: true,
            filePath: filePath,
            filename: filename,
            targetPath: targetPath
        };
    } catch (error) {
        log.error('生成SQL文件失败:', error);
        return { success: false, error: error.message };
    }
}

async function openFile(filePath, editor) {
    try {
        await fsPromises.access(filePath);
        if (editor && editor !== '') {
            exec(`"${editor}" "${filePath}"`);
        } else {
            await shell.openPath(filePath);
        }
        return true;
    } catch (error) {
        log.error('打开文件失败:', error);
        return false;
    }
}

async function openFolder(folderPath) {
    try {
        await fsPromises.access(folderPath);
        await shell.openPath(folderPath);
        return true;
    } catch (error) {
        log.error('打开文件夹失败:', error);
        return false;
    }
}

// ========== IPC 处理 ==========
async function setupIPCHandlers() {
    ipcMain.handle('get-config', async () => config);
    ipcMain.handle('get-package-info', async () => packageJson);
    ipcMain.handle('save-config', async (event, newConfig) => await saveConfig(newConfig));
    ipcMain.handle('generate-script', async (event, scriptInfo) => await generateSQLFile(scriptInfo));
    ipcMain.handle('open-file', async (event, filePath) => await openFile(filePath, config.text_edit_app));
    ipcMain.handle('open-folder', async (event, folderPath) => await openFolder(folderPath));
    ipcMain.handle('select-directory', async () => {
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        return result.filePaths[0] || '';
    });
    ipcMain.handle('select-file', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: '可执行文件', extensions: ['exe'] },
                { name: '所有文件', extensions: ['*'] }
            ]
        });
        return result.filePaths[0] || '';
    });
    ipcMain.handle('reload-config', async () => {
        config = await loadConfig();
        return config;
    });
    ipcMain.handle('set-auto-start', async (event, enable) => await setAutoStart(enable));
    ipcMain.handle('get-auto-start', async () => await getAutoStart());
    ipcMain.handle('check-for-updates', async (event, manual) => await checkForUpdates(manual));
}

// ========== 应用退出处理 ==========
app.on('before-quit', () => {
    app.isQuitting = true;
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

app.on('window-all-closed', () => {
    if (!app.isQuitting) {
        // 不退出应用，保持在托盘运行
    }
});

app.on('will-quit', () => {
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

// ========== 应用启动 ==========
app.whenReady().then(async () => {
    log.info('========================================');
    log.info('Electron 应用准备就绪');
    log.info('========================================');
    
    createSplashWindow();
    
    await loadConfig();
    await setupIPCHandlers();
    
    createTray();
    createWindow();
    
    startAutoUpdateCheck();
    
    log.info('应用启动完成');
});

// 超时保护
setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed() && !isTransitioning && !isMainWindowReady) {
        log.warn('启动画面超时，强制过渡');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
        }
        splashWindow.close();
        splashWindow = null;
        isTransitioning = false;
    }
}, 10000);