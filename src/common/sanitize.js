/**
 * 安全相关工具函数（路径净化、SQL 转义）
 */
const path = require('path');

/**
 * SQL 字符串值转义（用于单引号内的值）
 */
function escapeSql(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "''")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\0/g, '');
}

/**
 * 数据库/标识符名称合法性校验（仅允许字母、数字、下划线）
 */
function isValidIdentifier(name) {
    if (!name || typeof name !== 'string') return false;
    return /^[a-zA-Z0-9_]+$/.test(name);
}

/**
 * 安全转义 SQL 标识符（反引号包裹）
 */
function escapeIdentifier(name) {
    if (!name) return '``';
    return '`' + name.replace(/`/g, '``') + '`';
}

/**
 * 净化路径片段，移除路径遍历字符和非法文件名字符
 */
function sanitizePathSegment(segment) {
    if (!segment || typeof segment !== 'string') return '';
    return segment
        .replace(/\.\./g, '')
        .replace(/[\/\\:*?"<>|]/g, '_')
        .trim();
}

/**
 * 校验目标路径是否位于基准路径内
 */
function isPathWithinBase(targetPath, basePath) {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(basePath);
    return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

module.exports = {
    escapeSql,
    isValidIdentifier,
    escapeIdentifier,
    sanitizePathSegment,
    isPathWithinBase,
};
