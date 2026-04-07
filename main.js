const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { exec } = require('child_process');

let mainWindow;
let config = {};

const configPath = path.join(__dirname, 'config.json');

// 获取图标路径
function getIconPath() {
    const icoPath = path.join(__dirname, 'assets', 'icon.ico');
    const pngPath = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(icoPath)) return icoPath;
    if (fs.existsSync(pngPath)) return pngPath;
    return null;
}

// 获取默认配置内容
function getDefaultConfigContent() {
    // 基础路径：当前目录下的 Develop\11 - Database Script
    const defaultBasePath = path.join(process.cwd(), 'Develop', '11 - Database Script');
    return {
        base_path: defaultBasePath,
        developer_ch_name: "张三",
        developer_en_name: "zhangsan",
        text_edit_app: "",  // 默认为空，用户自行选择编辑器
        databases: [
            "order_db",
            "product_db",
            "community_db",
            "content_db",
            "device_db",
            "main_db",
            "promotion_db",
            "ota_db",
            "payment_db",
            "pmp_db",
            "report_db",
            "report_data_db",
            "sharespace_db",
            "user_db",
            "workbench_db",
            "worktask_db",
            "data_warehouse_db"
        ],
        script_types: [
            { name: "DDL", description: "Data Definition Language (CREATE, ALTER, DROP)" },
            { name: "DML", description: "Data Manipulation Language (INSERT, UPDATE, DELETE)" },
            { name: "DQL", description: "Data Query Language (SELECT)" }
        ]
    };
}

// 创建默认配置文件
async function createDefaultConfig() {
    const defaultConfig = getDefaultConfigContent();
    await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log('已创建默认配置文件:', configPath);
    return defaultConfig;
}

// 加载配置 - 如果文件不存在则自动创建默认配置
async function loadConfig() {
    try {
        const data = await fsPromises.readFile(configPath, 'utf8');
        config = JSON.parse(data);
        console.log('配置文件加载成功');
        console.log('数据库数量:', config.databases?.length);
        console.log('脚本类型数量:', config.script_types?.length);
        
        // 基本字段校验
        if (!config.base_path || !config.developer_ch_name || !config.developer_en_name) {
            throw new Error('配置文件缺少必要字段 (base_path, developer_ch_name, developer_en_name)');
        }
        if (!Array.isArray(config.databases) || !Array.isArray(config.script_types)) {
            throw new Error('配置文件 databases 或 script_types 不是数组');
        }
        return config;
    } catch (error) {
        // 如果文件不存在（ENOENT），则创建默认配置
        if (error.code === 'ENOENT') {
            console.log('配置文件不存在，正在创建默认配置...');
            config = await createDefaultConfig();
            return config;
        }
        // 其他错误（如 JSON 解析错误）则弹窗退出
        console.error('加载配置文件失败:', error);
        dialog.showErrorBox('配置错误', `无法加载配置文件 config.json：\n${error.message}\n\n请检查文件格式是否正确。`);
        app.quit();
        return null;
    }
}

async function saveConfig(newConfig) {
    try {
        await fsPromises.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
        config = newConfig;
        return true;
    } catch (error) {
        console.error('保存配置文件失败:', error);
        return false;
    }
}

function createWindow() {
    const iconPath = getIconPath();
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'SQL Script Generator Tool'
    });

    mainWindow.loadFile('index.html');
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

async function generateSQLFile(scriptInfo) {
    try {
        const now = new Date();
        const currentYear = now.getFullYear().toString();
        const currentDate = now.toISOString().split('T')[0];
        const dateCompact = now.toISOString().slice(2, 10).replace(/-/g, '');
        
        let targetPath;
        switch (scriptInfo.operateType) {
            case 'FIX':
                targetPath = path.join(config.base_path, 'PRODUCT-FIX', currentYear, scriptInfo.dirName);
                if (scriptInfo.scriptType) {
                    targetPath = path.join(targetPath, scriptInfo.scriptType);
                }
                break;
            case 'PUBLISH':
                targetPath = path.join(config.base_path, 'PUBLISH', currentYear, scriptInfo.dirName);
                if (scriptInfo.scriptType) {
                    targetPath = path.join(targetPath, scriptInfo.scriptType);
                }
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
        console.error('生成文件失败:', error);
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
        console.error('打开文件失败:', error);
        return false;
    }
}

async function openFolder(folderPath) {
    try {
        await fsPromises.access(folderPath);
        await shell.openPath(folderPath);
        return true;
    } catch (error) {
        console.error('打开文件夹失败:', error);
        return false;
    }
}

async function setupIPCHandlers() {
    ipcMain.handle('get-config', async () => config);
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
}

app.whenReady().then(async () => {
    await loadConfig();
    await setupIPCHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});