/**
 * 渲染进程入口（主窗口）
 *
 * 加载顺序（在 index.html 中）:
 *   1. utils.js         - escapeHtml
 *   2. logger.js        - logInfo, logError, logDebug
 *   3. config-loader.js - loadConfig, getCurrentConfig
 *   4. generator.js     - generateScript, showSuccess, showError, setupEventListeners, updateDefaultDirName
 *   5. index.js         - init (此文件)
 */

async function init() {
    logInfo('渲染进程初始化');
    await loadConfig();
    setupEventListeners();
    updateDefaultDirName(true);

    // 监听设置窗口关闭后的配置变更通知，自动刷新主界面
    if (window.electronAPI && window.electronAPI.onConfigChanged) {
        window.electronAPI.onConfigChanged(async () => {
            logInfo('配置已变更，重新加载');
            await loadConfig();
            updateDefaultDirName(true);
        });
    }
}

document.addEventListener('DOMContentLoaded', init);
