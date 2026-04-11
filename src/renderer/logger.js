/**
 * 渲染进程日志模块
 */

function logInfo(...args)  { console.log('[INFO]', ...args); }
function logError(...args) { console.error('[ERROR]', ...args); }
function logDebug(...args) { console.debug('[DEBUG]', ...args); }
