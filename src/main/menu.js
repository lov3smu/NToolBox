/**
 * 应用菜单模块
 */
const { app, Menu, dialog } = require('electron');
const { getIconPath, createSettingsWindow, createPasswordWindow } = require('./window');
const { destroyTray } = require('./tray');

const packageJson = require('../../package.json');
const appVersion = packageJson.version;
let appAuthor = packageJson.author || 'lov3smu';
appAuthor = appAuthor.replace(/<[^>]*>/g, '').trim();

/**
 * 显示关于对话框
 */
function showAboutDialog(mainWindow) {
    const appName = 'SQL Script Generator';
    const description = 'SQL脚本生成工具，用于快速生成符合规范的SQL脚本文件。';
    const copyright = `© ${new Date().getFullYear()} ${appAuthor}. All rights reserved.`;

    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '关于软件',
        message: `${appName} ${appVersion}`,
        detail: `${description}\n\n作者：${appAuthor}\n\n${copyright}`,
        buttons: ['确定'],
        icon: getIconPath(),
    });
}

/**
 * 创建应用菜单
 * @param {BrowserWindow} mainWindow
 * @param {Function} checkForUpdatesFn
 */
function createAppMenu(mainWindow, checkForUpdatesFn) {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '隐藏窗口',
                    click: () => { if (mainWindow) mainWindow.hide(); },
                },
                { type: 'separator' },
                {
                    label: '退出',
                    click: () => {
                        app.isQuitting = true;
                        destroyTray();
                        app.quit();
                    },
                },
            ],
        },
        {
            label: '工具',
            submenu: [
                {
                    label: '密码生成器',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => createPasswordWindow(),
                },
                {
                    label: '设置',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => createSettingsWindow(),
                },
            ],
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '检查更新',
                    click: () => checkForUpdatesFn(true, mainWindow),
                },
                { type: 'separator' },
                {
                    label: '关于软件',
                    click: () => showAboutDialog(mainWindow),
                },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = {
    createAppMenu,
    showAboutDialog,
};
