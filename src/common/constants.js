/**
 * 应用全局共享常量
 */

/** 启动画面最短显示时间（毫秒） */
const MIN_SPLASH_DISPLAY_TIME = 1500;

/** 自动更新检查间隔（毫秒），12 小时 */
const UPDATE_CHECK_INTERVAL = 12 * 60 * 60 * 1000;

/** 关闭行为选项白名单 */
const VALID_CLOSE_ACTIONS = ['ask', 'hide', 'quit'];

/** 操作类型白名单 */
const VALID_OPERATE_TYPES = ['FIX', 'PUBLISH', 'QUERY'];

module.exports = {
    MIN_SPLASH_DISPLAY_TIME,
    UPDATE_CHECK_INTERVAL,
    VALID_CLOSE_ACTIONS,
    VALID_OPERATE_TYPES,
};
