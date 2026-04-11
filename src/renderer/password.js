/**
 * 密码生成器逻辑
 */

// 字符集定义
const CHAR_SETS = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

// 历史记录
let passwordHistory = [];
const MAX_HISTORY = 10;

// 初始化
document.addEventListener('DOMContentLoaded', initPasswordGenerator);

function initPasswordGenerator() {
    // 获取DOM元素
    const lengthSlider = document.getElementById('passwordLength');
    const lengthValue = document.getElementById('passwordLengthValue');
    const generateBtn = document.getElementById('generatePasswordBtn');
    const copyBtn = document.getElementById('copyPasswordBtn');
    const toggleBtn = document.getElementById('toggleVisibilityBtn');
    const passwordOutput = document.getElementById('generatedPassword');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    // 字符类型复选框
    const checkboxes = {
        uppercase: document.getElementById('includeUppercase'),
        lowercase: document.getElementById('includeLowercase'),
        numbers: document.getElementById('includeNumbers'),
        special: document.getElementById('includeSpecial')
    };

    // 确保至少选中一项
    function ensureOneChecked() {
        const checked = Object.values(checkboxes).some(cb => cb && cb.checked);
        if (!checked) {
            checkboxes.lowercase.checked = true;
            updateCardState();
        }
    }

    // 更新卡片状态
    function updateCardState() {
        document.querySelectorAll('.checkbox-card').forEach(card => {
            const type = card.dataset.type;
            const checkbox = checkboxes[type];
            if (checkbox && checkbox.checked) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
        updatePasswordStrength();
    }

    // 滑块事件
    if (lengthSlider && lengthValue) {
        lengthSlider.addEventListener('input', () => {
            lengthValue.textContent = lengthSlider.value;
            updateSliderProgress();
            updatePasswordStrength();
        });
        
        // 初始化滑块进度
        updateSliderProgress();
    }

    // 卡片点击事件 - 由于label会自动触发checkbox，我们只需要处理样式更新
    document.querySelectorAll('.checkbox-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // label会自动处理checkbox的切换，我们只需要延迟检查状态
            setTimeout(() => {
                ensureOneChecked();
                updateCardState();
            }, 0);
        });
    });

    // 复选框变化事件
    Object.values(checkboxes).forEach(checkbox => {
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                ensureOneChecked();
                updateCardState();
            });
        }
    });

    // 生成按钮
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const password = generatePassword();
            if (passwordOutput) {
                passwordOutput.value = password;
                addToHistory(password);
            }
            updatePasswordStrength();
            showToast('密码已生成');
        });
    }

    // 复制按钮
    if (copyBtn && passwordOutput) {
        copyBtn.addEventListener('click', () => {
            if (passwordOutput.value) {
                copyToClipboard(passwordOutput.value);
            }
        });
    }

    // 显示/隐藏密码
    if (toggleBtn && passwordOutput) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordOutput.type === 'password';
            passwordOutput.type = isPassword ? 'text' : 'password';
            toggleBtn.textContent = isPassword ? '🙈' : '👁️';
        });
        // 默认为密码类型
        passwordOutput.type = 'password';
    }

    // 清空历史
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            passwordHistory = [];
            saveHistory();  // 关键：清除 localStorage
            renderHistory();
            showToast('历史记录已清空');
        });
    }

    // 初始化
    updateCardState();
    
    // 加载历史记录
    loadHistory();
}

// 更新滑块进度条
function updateSliderProgress() {
    const slider = document.getElementById('passwordLength');
    if (!slider) return;
    
    const min = slider.min || 1;
    const max = slider.max || 100;
    const value = slider.value;
    const progress = ((value - min) / (max - min)) * 100;
    
    slider.style.setProperty('--progress', `${progress}%`);
}

// 生成密码
function generatePassword() {
    const lengthSlider = document.getElementById('passwordLength');
    const length = parseInt(lengthSlider?.value || 18);
    
    const checkboxes = {
        uppercase: document.getElementById('includeUppercase')?.checked,
        lowercase: document.getElementById('includeLowercase')?.checked,
        numbers: document.getElementById('includeNumbers')?.checked,
        special: document.getElementById('includeSpecial')?.checked
    };

    let chars = '';
    if (checkboxes.uppercase) chars += CHAR_SETS.uppercase;
    if (checkboxes.lowercase) chars += CHAR_SETS.lowercase;
    if (checkboxes.numbers) chars += CHAR_SETS.numbers;
    if (checkboxes.special) chars += CHAR_SETS.special;

    if (chars === '') {
        return '';
    }

    // 确保每种选中的字符类型至少出现一次
    let password = '';
    const requiredChars = [];
    if (checkboxes.uppercase) requiredChars.push(getRandomChar(CHAR_SETS.uppercase));
    if (checkboxes.lowercase) requiredChars.push(getRandomChar(CHAR_SETS.lowercase));
    if (checkboxes.numbers) requiredChars.push(getRandomChar(CHAR_SETS.numbers));
    if (checkboxes.special) requiredChars.push(getRandomChar(CHAR_SETS.special));

    // 填充剩余长度
    const remainingLength = length - requiredChars.length;
    const array = new Uint32Array(remainingLength);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < remainingLength; i++) {
        password += chars[array[i] % chars.length];
    }

    // 合并并打乱
    password = password + requiredChars.join('');
    password = shuffleString(password);

    return password;
}

// 获取随机字符
function getRandomChar(charSet) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return charSet[array[0] % charSet.length];
}

// 打乱字符串
function shuffleString(str) {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join('');
}

// 更新密码强度显示
function updatePasswordStrength() {
    const lengthSlider = document.getElementById('passwordLength');
    const length = parseInt(lengthSlider?.value || 0);
    
    const checkboxes = {
        uppercase: document.getElementById('includeUppercase')?.checked,
        lowercase: document.getElementById('includeLowercase')?.checked,
        numbers: document.getElementById('includeNumbers')?.checked,
        special: document.getElementById('includeSpecial')?.checked
    };
    
    const strengthBar = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const strengthHint = document.getElementById('strengthHint');
    
    if (!strengthBar || !strengthText) return;

    // 计算字符集大小
    let charSetSize = 0;
    if (checkboxes.uppercase) charSetSize += 26;
    if (checkboxes.lowercase) charSetSize += 26;
    if (checkboxes.numbers) charSetSize += 10;
    if (checkboxes.special) charSetSize += 25;

    if (charSetSize === 0) {
        strengthBar.className = 'strength-fill';
        strengthText.className = 'strength-text';
        strengthText.textContent = '请选择字符类型';
        if (strengthHint) strengthHint.textContent = '建议同时使用大小写字母、数字和特殊字符';
        return;
    }

    // 计算熵值 (bits)
    const entropy = length * Math.log2(charSetSize);
    
    // 更新强度显示
    strengthBar.className = 'strength-fill';
    strengthText.className = 'strength-text';
    
    if (entropy < 50) {
        strengthBar.classList.add('weak');
        strengthText.classList.add('weak');
        strengthText.textContent = '弱';
        if (strengthHint) strengthHint.textContent = '建议增加密码长度或添加更多字符类型';
    } else if (entropy < 80) {
        strengthBar.classList.add('medium');
        strengthText.classList.add('medium');
        strengthText.textContent = '中等';
        if (strengthHint) strengthHint.textContent = '密码强度尚可，建议添加特殊字符';
    } else {
        strengthBar.classList.add('strong');
        strengthText.classList.add('strong');
        strengthText.textContent = '强';
        if (strengthHint) strengthHint.textContent = '密码强度优秀，可以安全使用';
    }
}

// 添加到历史记录
function addToHistory(password) {
    if (!password) return;
    
    // 避免重复
    passwordHistory = passwordHistory.filter(p => p !== password);
    
    // 添加到开头
    passwordHistory.unshift(password);
    
    // 限制数量
    if (passwordHistory.length > MAX_HISTORY) {
        passwordHistory = passwordHistory.slice(0, MAX_HISTORY);
    }
    
    // 保存并渲染
    saveHistory();
    renderHistory();
}

// 渲染历史记录
function renderHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    if (passwordHistory.length === 0) {
        historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
        return;
    }
    
    historyList.innerHTML = passwordHistory.map((password, index) => `
        <div class="history-item" data-index="${index}">
            <span class="password-text">${maskPassword(password)}</span>
            <span class="password-length">${password.length}位</span>
            <button class="copy-btn" data-password="${escapeHtml(password)}" title="复制">📋</button>
        </div>
    `).join('');
    
    // 绑定复制事件
    historyList.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const password = btn.dataset.password;
            copyToClipboard(password);
        });
    });
}

// 隐藏密码显示
function maskPassword(password) {
    if (password.length <= 4) return '*'.repeat(password.length);
    return password.substring(0, 2) + '*'.repeat(password.length - 4) + password.substring(password.length - 2);
}

// 复制到剪贴板
async function copyToClipboard(text) {
    if (!text) return;
    
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板');
    } catch (err) {
        logError('复制失败:', err);
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

// 保存历史记录到 localStorage
function saveHistory() {
    try {
        if (passwordHistory.length === 0) {
            localStorage.removeItem('password_history');
        } else {
            localStorage.setItem('password_history', JSON.stringify(passwordHistory));
        }
    } catch (e) {
        logError('保存历史记录失败:', e);
    }
}

// 从 localStorage 加载历史记录
function loadHistory() {
    try {
        const saved = localStorage.getItem('password_history');
        if (saved) {
            passwordHistory = JSON.parse(saved);
            renderHistory();
        }
    } catch (e) {
        logError('加载历史记录失败:', e);
    }
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
