/**
 * Cron表达式生成器逻辑
 * 支持 6-7 位 Cron 表达式（秒 分 时 日 月 周 年）
 */

// 字段配置
const FIELD_CONFIG = {
    second: { min: 0, max: 59, name: '秒' },
    minute: { min: 0, max: 59, name: '分' },
    hour: { min: 0, max: 23, name: '时' },
    day: { min: 1, max: 31, name: '日' },
    month: { min: 1, max: 12, name: '月' },
    week: { min: 0, max: 6, name: '周', names: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] },
    year: { min: 2024, max: 2100, name: '年' }
};

// 月份名称
const MONTH_NAMES = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

// 初始化
document.addEventListener('DOMContentLoaded', initCronGenerator);

function initCronGenerator() {
    // 初始化复选框网格
    initCheckboxGrids();
    
    // 绑定 Tab 切换事件
    bindTabEvents();
    
    // 绑定字段类型切换事件
    bindFieldTypeEvents();
    
    // 绑定按钮事件
    bindButtonEvents();
    
    // 绑定输入框事件
    bindInputEvents();
    
    // 初始生成表达式
    generateCronExpression();
}

// 初始化复选框网格
function initCheckboxGrids() {
    // 秒：0-59
    createNumberGrid('secondSpecificGrid', 0, 59);
    
    // 分：0-59
    createNumberGrid('minuteSpecificGrid', 0, 59);
    
    // 时：上午 0-11
    createNumberGrid('hourAmGrid', 0, 11);
    // 时：下午 12-23
    createNumberGrid('hourPmGrid', 12, 23);
    
    // 日：1-31
    createNumberGrid('daySpecificGrid', 1, 31);
    
    // 月：1-12
    createNumberGrid('monthSpecificGrid', 1, 12, (n) => MONTH_NAMES[n]);
}

// 创建数字复选框网格
function createNumberGrid(containerId, min, max, labelFormatter) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = '';
    for (let i = min; i <= max; i++) {
        const label = labelFormatter ? labelFormatter(i) : i.toString().padStart(2, '0');
        html += `
            <label class="checkbox-item">
                <input type="checkbox" value="${i}">
                <span>${label}</span>
            </label>
        `;
    }
    container.innerHTML = html;
}

// 绑定 Tab 切换事件
function bindTabEvents() {
    const tabs = document.querySelectorAll('.field-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPanel = tab.dataset.tab;
            
            // 切换 Tab 激活状态
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 切换面板显示
            document.querySelectorAll('.field-panel').forEach(panel => {
                panel.classList.remove('active');
                if (panel.dataset.panel === targetPanel) {
                    panel.classList.add('active');
                }
            });
        });
    });
}

// 绑定字段类型切换事件
function bindFieldTypeEvents() {
    const fields = ['second', 'minute', 'hour', 'day', 'month', 'week', 'year'];
    
    fields.forEach(field => {
        const radios = document.querySelectorAll(`input[name="${field}Type"]`);
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                updateFieldContent(field, radio.value);
                generateCronExpression();
            });
        });
    });
}

// 更新字段内容显示
function updateFieldContent(field, type) {
    // 获取该字段的指定网格
    const gridId = `${field}SpecificGrid`;
    const grid = document.getElementById(gridId);
    if (grid) {
        if (type === 'specific') {
            grid.classList.add('show');
        } else {
            grid.classList.remove('show');
        }
    }
    
    // 年的特殊处理
    if (field === 'year') {
        const yearRow = document.getElementById('yearSpecificRow');
        if (yearRow) {
            if (type === 'specific') {
                yearRow.classList.add('show');
            } else {
                yearRow.classList.remove('show');
            }
        }
    }
    
    // 小时网格的特殊处理
    if (field === 'hour' && type === 'specific') {
        const hourGrid = document.getElementById('hourSpecificGrid');
        if (hourGrid) {
            hourGrid.classList.add('show');
        }
    } else if (field === 'hour') {
        const hourGrid = document.getElementById('hourSpecificGrid');
        if (hourGrid) {
            hourGrid.classList.remove('show');
        }
    }
}

// 绑定按钮事件
function bindButtonEvents() {
    // 反解析表达式
    const parseBtn = document.getElementById('btnParse');
    if (parseBtn) {
        parseBtn.addEventListener('click', () => {
            parseCronExpression();
        });
    }
    
    // 复制表达式
    const copyBtn = document.getElementById('btnCopy');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const input = document.getElementById('cronExpression');
            if (input && input.value) {
                copyToClipboard(input.value);
            }
        });
    }
}

// 绑定输入框事件
function bindInputEvents() {
    // 监听所有输入变化，自动更新表达式
    const inputs = document.querySelectorAll('input[type="number"], input[type="text"], select');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            generateCronExpression();
        });
        input.addEventListener('input', () => {
            if (input.type === 'text') return; // 文本输入在 blur 时处理
            generateCronExpression();
        });
    });
    
    // 监听复选框变化
    document.querySelectorAll('.specific-grid input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            generateCronExpression();
        });
    });
    
    // 监听表达式输入框（反解析）
    const cronInput = document.getElementById('cronExpression');
    if (cronInput) {
        cronInput.addEventListener('blur', () => {
            // 用户手动编辑时更新描述和执行时间
            updateExpressionDesc();
            updateScheduleList();
            updateFieldTags();
        });
    }
}

// 生成 Cron 表达式
function generateCronExpression() {
    const parts = [];
    
    // 秒
    parts.push(generateFieldExpression('second'));
    // 分
    parts.push(generateFieldExpression('minute'));
    // 时
    parts.push(generateFieldExpression('hour'));
    // 日
    parts.push(generateFieldExpression('day'));
    // 月
    parts.push(generateFieldExpression('month'));
    // 周
    parts.push(generateFieldExpression('week'));
    // 年（可选）
    const yearExpr = generateFieldExpression('year');
    if (yearExpr && yearExpr !== '') {
        parts.push(yearExpr);
    }
    
    const expression = parts.join(' ');
    const input = document.getElementById('cronExpression');
    if (input) {
        input.value = expression;
    }
    
    // 更新字段标签
    updateFieldTags();
    
    // 更新描述
    updateExpressionDesc();
    
    // 更新执行计划
    updateScheduleList();
}

// 更新字段标签显示
function updateFieldTags() {
    const input = document.getElementById('cronExpression');
    if (!input) return;
    
    const parts = input.value.trim().split(/\s+/);
    const fields = ['second', 'minute', 'hour', 'day', 'month', 'week', 'year'];
    
    fields.forEach((field, index) => {
        const tag = document.getElementById(`tag-${field}`);
        if (tag) {
            if (index < parts.length) {
                tag.textContent = parts[index];
            } else {
                tag.textContent = '';
            }
        }
    });
}

// 生成单个字段的表达式
function generateFieldExpression(field) {
    const config = FIELD_CONFIG[field];
    const typeRadio = document.querySelector(`input[name="${field}Type"]:checked`);
    if (!typeRadio) {
        return field === 'year' ? '' : '*';
    }
    
    const type = typeRadio.value;
    
    switch (type) {
        case 'every':
            return field === 'year' ? '' : '*';
        case 'notSpecify':
            return '?';
        case 'range':
            if (field === 'week') {
                const from = document.getElementById('weekRangeFrom')?.value || '1';
                const to = document.getElementById('weekRangeTo')?.value || '0';
                return `${from}-${to}`;
            }
            const fromEl = document.getElementById(`${field}RangeFrom`);
            const toEl = document.getElementById(`${field}RangeTo`);
            const from = fromEl?.value || config.min;
            const to = toEl?.value || config.max;
            return `${from}-${to}`;
        case 'interval':
            const startEl = document.getElementById(`${field}IntervalStart`);
            const stepEl = document.getElementById(`${field}IntervalStep`);
            const start = startEl?.value || config.min;
            const step = stepEl?.value || '1';
            return `${start}/${step}`;
        case 'specific':
            if (field === 'year') {
                const yearVal = document.getElementById('yearSpecific')?.value?.trim();
                if (!yearVal) return '';
                return yearVal;
            }
            if (field === 'week') {
                const checked = document.querySelectorAll('#weekSpecificGrid input:checked');
                if (checked.length === 0) return '?';
                if (checked.length === 7) return '*';
                return Array.from(checked).map(cb => cb.value).sort((a, b) => parseInt(a) - parseInt(b)).join(',');
            }
            // 小时特殊处理（上午下午两个网格）
            if (field === 'hour') {
                const amChecked = document.querySelectorAll('#hourAmGrid input:checked');
                const pmChecked = document.querySelectorAll('#hourPmGrid input:checked');
                const allChecked = [...Array.from(amChecked), ...Array.from(pmChecked)];
                if (allChecked.length === 0) return '*';
                if (allChecked.length === 24) return '*';
                return allChecked.map(cb => cb.value).sort((a, b) => parseInt(a) - parseInt(b)).join(',');
            }
            const containerId = `${field}SpecificGrid`;
            const checked = document.querySelectorAll(`#${containerId} input:checked`);
            if (checked.length === 0) return '*';
            const minVal = config.min;
            const maxVal = config.max;
            if (checked.length === (maxVal - minVal + 1)) return '*';
            return Array.from(checked).map(cb => cb.value).sort((a, b) => parseInt(a) - parseInt(b)).join(',');
        case 'workDay':
            const workDay = document.getElementById('dayWorkDay')?.value || '1';
            return `${workDay}W`;
        case 'lastDay':
            return 'L';
        case 'nth':
            const nth = document.getElementById('weekNth')?.value || '1';
            const nthDay = document.getElementById('weekNthDay')?.value || '1';
            return `${nthDay}#${nth}`;
        case 'last':
            const lastDay = document.getElementById('weekLastDay')?.value || '1';
            return `${lastDay}L`;
        default:
            return field === 'year' ? '' : '*';
    }
}

// 反解析 Cron 表达式
function parseCronExpression() {
    const input = document.getElementById('cronExpression');
    if (!input) return;
    
    const expression = input.value.trim();
    if (!expression) {
        showToast('请输入表达式');
        return;
    }
    
    const parts = expression.split(/\s+/);
    if (parts.length < 6 || parts.length > 7) {
        showToast('表达式格式错误，应为 6-7 个字段');
        return;
    }
    
    // 解析各字段
    const fields = ['second', 'minute', 'hour', 'day', 'month', 'week'];
    if (parts.length === 7) {
        fields.push('year');
    }
    
    fields.forEach((field, index) => {
        if (index < parts.length) {
            parseFieldExpression(field, parts[index]);
        }
    });
    
    // 更新描述和执行计划
    updateExpressionDesc();
    updateScheduleList();
    updateFieldTags();
    showToast('表达式已反解析');
}

// 解析单个字段表达式
function parseFieldExpression(field, expr) {
    // 特殊字符处理
    if (expr === '*' || expr === '') {
        setFieldType(field, 'every');
        return;
    }
    
    if (expr === '?') {
        setFieldType(field, 'notSpecify');
        return;
    }
    
    if (expr === 'L') {
        setFieldType(field, 'lastDay');
        return;
    }
    
    // 工作日 (nW)
    if (expr.endsWith('W')) {
        setFieldType(field, 'workDay');
        const day = expr.slice(0, -1);
        const input = document.getElementById('dayWorkDay');
        if (input) input.value = day;
        return;
    }
    
    // 最后一个星期 (nL)
    if (expr.endsWith('L') && field === 'week') {
        setFieldType(field, 'last');
        const day = expr.slice(0, -1);
        const select = document.getElementById('weekLastDay');
        if (select) select.value = day;
        return;
    }
    
    // 第n个星期几 (n#m)
    if (expr.includes('#') && field === 'week') {
        setFieldType(field, 'nth');
        const [day, nth] = expr.split('#');
        const nthSelect = document.getElementById('weekNth');
        const daySelect = document.getElementById('weekNthDay');
        if (nthSelect) nthSelect.value = nth;
        if (daySelect) daySelect.value = day;
        return;
    }
    
    // 范围 (n-m)
    if (expr.includes('-')) {
        setFieldType(field, 'range');
        const [from, to] = expr.split('-');
        if (field === 'week') {
            const fromSel = document.getElementById('weekRangeFrom');
            const toSel = document.getElementById('weekRangeTo');
            if (fromSel) fromSel.value = from;
            if (toSel) toSel.value = to;
        } else {
            const fromIn = document.getElementById(`${field}RangeFrom`);
            const toIn = document.getElementById(`${field}RangeTo`);
            if (fromIn) fromIn.value = from;
            if (toIn) toIn.value = to;
        }
        return;
    }
    
    // 间隔 (n/m 或 */m)
    if (expr.includes('/')) {
        setFieldType(field, 'interval');
        const [start, step] = expr.split('/');
        const startIn = document.getElementById(`${field}IntervalStart`);
        const stepIn = document.getElementById(`${field}IntervalStep`);
        if (startIn) startIn.value = start === '*' ? '0' : start;
        if (stepIn) stepIn.value = step;
        return;
    }
    
    // 指定值 (n 或 n,m,p)
    setFieldType(field, 'specific');
    if (field === 'year') {
        const yearIn = document.getElementById('yearSpecific');
        if (yearIn) yearIn.value = expr;
    } else if (field === 'week') {
        const values = expr.split(',');
        document.querySelectorAll('#weekSpecificGrid input').forEach(cb => {
            cb.checked = values.includes(cb.value);
        });
    } else if (field === 'hour') {
        const values = expr.split(',');
        document.querySelectorAll('#hourAmGrid input, #hourPmGrid input').forEach(cb => {
            cb.checked = values.includes(cb.value);
        });
    } else {
        const values = expr.split(',');
        const containerId = `${field}SpecificGrid`;
        document.querySelectorAll(`#${containerId} input`).forEach(cb => {
            cb.checked = values.includes(cb.value);
        });
    }
}

// 设置字段类型
function setFieldType(field, type) {
    const radio = document.querySelector(`input[name="${field}Type"][value="${type}"]`);
    if (radio) {
        radio.checked = true;
        updateFieldContent(field, type);
    }
}

// 更新表达式描述
function updateExpressionDesc() {
    const input = document.getElementById('cronExpression');
    if (!input) return;
    
    const expression = input.value.trim();
    const descEl = document.getElementById('expressionDesc');
    if (!descEl) return;
    
    if (!expression) {
        descEl.textContent = '请输入表达式';
        return;
    }
    
    const desc = getExpressionDescription(expression);
    descEl.textContent = desc;
}

// 获取表达式描述
function getExpressionDescription(expression) {
    const parts = expression.split(/\s+/);
    if (parts.length < 6) return '格式错误';
    
    const [second, minute, hour, day, month, week, year] = parts;
    
    const descs = [];
    
    // 秒
    if (second === '*') {
        descs.push('每秒');
    } else {
        descs.push(`在 ${getFieldDesc('second', second)} 秒`);
    }
    
    // 分
    if (minute === '*') {
        descs.push('每分钟');
    } else {
        descs.push(`在 ${getFieldDesc('minute', minute)} 分`);
    }
    
    // 时
    if (hour === '*') {
        descs.push('每小时');
    } else {
        descs.push(`在 ${getFieldDesc('hour', hour)} 时`);
    }
    
    // 日/周的处理
    if (day === '?' || day === '*') {
        // 使用周
        if (week !== '*' && week !== '?') {
            descs.push(`在 ${getFieldDesc('week', week)}`);
        }
    } else if (week === '?' || week === '*') {
        // 使用日
        if (day !== '*') {
            descs.push(`在 ${getFieldDesc('day', day)} 日`);
        }
    }
    
    // 月
    if (month !== '*') {
        descs.push(`在 ${getFieldDesc('month', month)} 月`);
    }
    
    // 年
    if (year && year !== '*') {
        descs.push(`在 ${year} 年`);
    }
    
    return descs.join('，') + ' 执行';
}

// 获取字段描述
function getFieldDesc(field, expr) {
    if (expr === '*') return '每' + FIELD_CONFIG[field].name;
    
    if (expr.includes('-')) {
        const [from, to] = expr.split('-');
        if (field === 'week') {
            const names = FIELD_CONFIG.week.names;
            return `${names[parseInt(from)]} 到 ${names[parseInt(to)]}`;
        }
        return `${from} 到 ${to}`;
    }
    
    if (expr.includes('/')) {
        const [start, step] = expr.split('/');
        if (field === 'week') {
            const names = FIELD_CONFIG.week.names;
            return `${names[parseInt(start)]} 开始每隔 ${step} 天`;
        }
        return `${start} 开始每隔 ${step}`;
    }
    
    if (expr.includes(',')) {
        const values = expr.split(',');
        if (field === 'week') {
            const names = FIELD_CONFIG.week.names;
            return values.map(v => names[parseInt(v)]).join('、');
        }
        if (field === 'month') {
            return values.map(v => MONTH_NAMES[parseInt(v)]).join('、');
        }
        return values.join('、');
    }
    
    if (expr.endsWith('W')) {
        return `${expr.slice(0, -1)} 号最近工作日`;
    }
    
    if (expr === 'L') {
        return '最后一天';
    }
    
    if (expr.includes('#')) {
        const [day, nth] = expr.split('#');
        const names = FIELD_CONFIG.week.names;
        return `第${nth}个${names[parseInt(day)]}`;
    }
    
    if (expr.endsWith('L')) {
        const day = expr.slice(0, -1);
        const names = FIELD_CONFIG.week.names;
        return `最后一个${names[parseInt(day)]}`;
    }
    
    if (field === 'week') {
        return FIELD_CONFIG.week.names[parseInt(expr)];
    }
    if (field === 'month') {
        return MONTH_NAMES[parseInt(expr)];
    }
    
    return expr;
}

// 更新执行计划列表
function updateScheduleList() {
    const input = document.getElementById('cronExpression');
    if (!input) return;
    
    const expression = input.value.trim();
    const listEl = document.getElementById('scheduleList');
    if (!listEl) return;
    
    if (!expression) {
        listEl.innerHTML = '<div class="schedule-empty">请输入表达式查看执行计划</div>';
        return;
    }
    
    try {
        const schedules = getNextExecutionTimes(expression, 5);
        
        if (schedules.length === 0) {
            listEl.innerHTML = '<div class="schedule-empty">无法计算执行时间，请检查表达式格式</div>';
            return;
        }
        
        const now = new Date();
        listEl.innerHTML = schedules.map((time, index) => {
            const timeStr = formatDateTime(time);
            const remaining = getTimeRemaining(now, time);
            return `
                <div class="schedule-item">
                    <span class="index">${index + 1}</span>
                    <span class="time">${timeStr}</span>
                    <span class="remaining">${remaining}</span>
                </div>
            `;
        }).join('');
    } catch (err) {
        if (typeof logError === 'function') {
            logError('计算执行时间失败:', err);
        }
        listEl.innerHTML = '<div class="schedule-empty">无法计算执行时间</div>';
    }
}

// 获取下一次执行时间
function getNextExecutionTimes(expression, count) {
    const parts = expression.split(/\s+/);
    if (parts.length < 6) return [];
    
    const [secondExpr, minuteExpr, hourExpr, dayExpr, monthExpr, weekExpr, yearExpr] = parts;
    
    const results = [];
    let current = new Date();
    current.setMilliseconds(0);
    
    // 解析各字段
    const secondSet = parseCronField(secondExpr, 0, 59);
    const minuteSet = parseCronField(minuteExpr, 0, 59);
    const hourSet = parseCronField(hourExpr, 0, 23);
    const daySet = dayExpr === '?' ? null : parseCronField(dayExpr, 1, 31);
    const monthSet = parseCronField(monthExpr, 1, 12);
    const weekSet = weekExpr === '?' ? null : parseCronField(weekExpr, 0, 6);
    const yearSet = yearExpr ? parseCronField(yearExpr, 2024, 2100) : null;
    
    // 最大搜索 3 年
    const maxDate = new Date(current.getFullYear() + 3, 11, 31, 23, 59, 59);
    
    while (results.length < count && current <= maxDate) {
        // 检查年
        if (yearSet && !yearSet.includes(current.getFullYear())) {
            current.setFullYear(current.getFullYear() + 1);
            current.setMonth(0, 1);
            current.setHours(0, 0, 0);
            continue;
        }
        
        // 检查月
        if (!monthSet.includes(current.getMonth() + 1)) {
            current.setMonth(current.getMonth() + 1);
            current.setDate(1);
            current.setHours(0, 0, 0);
            continue;
        }
        
        // 检查日/周
        let dateMatch = false;
        if (daySet && weekSet) {
            // 都指定了，使用 OR 逻辑
            dateMatch = daySet.includes(current.getDate()) || weekSet.includes(current.getDay());
        } else if (weekSet) {
            // 只指定了周
            dateMatch = weekSet.includes(current.getDay());
        } else if (daySet) {
            // 只指定了日
            dateMatch = daySet.includes(current.getDate());
        } else {
            // 都没指定
            dateMatch = true;
        }
        
        if (!dateMatch) {
            current.setDate(current.getDate() + 1);
            current.setHours(0, 0, 0);
            continue;
        }
        
        // 检查是否为有效日期（比如2月30日这种无效日期）
        if (current.getMonth() + 1 !== monthSet.find(m => m === current.getMonth() + 1)) {
             current.setDate(current.getDate() + 1);
             current.setHours(0, 0, 0);
             continue;
        }
        
        // 检查时
        if (!hourSet.includes(current.getHours())) {
            current.setHours(current.getHours() + 1);
            current.setMinutes(0, 0);
            continue;
        }
        
        // 检查分
        if (!minuteSet.includes(current.getMinutes())) {
            current.setMinutes(current.getMinutes() + 1);
            current.setSeconds(0);
            continue;
        }
        
        // 检查秒
        if (!secondSet.includes(current.getSeconds())) {
            current.setSeconds(current.getSeconds() + 1);
            continue;
        }
        
        // 找到匹配的时间
        results.push(new Date(current));
        current.setSeconds(current.getSeconds() + 1);
    }
    
    return results;
}

// 解析 Cron 字段
function parseCronField(expr, min, max) {
    const result = [];
    
    if (!expr || expr === '*' || expr === '?') {
        for (let i = min; i <= max; i++) {
            result.push(i);
        }
        return result;
    }
    
    // 处理 L（最后一天）
    if (expr === 'L') {
        return [31]; // 简化处理
    }
    
    // 处理 W（工作日）
    if (expr.endsWith('W')) {
        return [parseInt(expr)];
    }
    
    const parts = expr.split(',');
    
    for (const part of parts) {
        if (part.includes('-')) {
            // 范围
            const [start, end] = part.split('-').map(Number);
            for (let i = start; i <= end; i++) {
                result.push(i);
            }
        } else if (part.includes('/')) {
            // 间隔
            const [startStep, step] = part.split('/').map(Number);
            let start = startStep;
            // 处理 */n 格式
            if (part.startsWith('*/')) {
                start = min;
            }
            for (let i = start; i <= max; i += step) {
                result.push(i);
            }
        } else if (part.includes('#')) {
            // 第n个星期几，这里简化处理
            result.push(Number(part.split('#')[0]));
        } else if (part.endsWith('L')) {
            // 最后一个星期几，简化处理
            result.push(Number(part.slice(0, -1)));
        } else {
            // 单个值
            result.push(Number(part));
        }
    }
    
    return result.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
}

// 格式化日期时间
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// 获取时间差描述
function getTimeRemaining(from, to) {
    const diff = to - from;
    if (diff < 0) return '已过期';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}时`);
    if (minutes > 0) parts.push(`${minutes}分`);
    if (seconds > 0 && parts.length < 2) parts.push(`${seconds}秒`);
    
    if (parts.length === 0) return '即将执行';
    return parts.join('') + '后';
}

// 复制到剪贴板
async function copyToClipboard(text) {
    if (!text) return;
    
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板');
    } catch (err) {
        if (typeof logError === 'function') {
            logError('复制失败:', err);
        }
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('已复制到剪贴板');
        } catch (e) {
            showToast('复制失败，请手动复制');
        }
        document.body.removeChild(textarea);
    }
}

// 显示提示
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}
