/**
 * 脚本生成 UI 逻辑
 */

let currentOperateType = 'PUBLISH';
let lastAutoDirName = '';

function updateDefaultDirName(force = false) {
    const usageInput = document.getElementById('usage');
    const dirNameInput = document.getElementById('dirName');
    const now = new Date();
    const monthDay = now.toISOString().slice(5, 10).replace(/-/g, '');
    const usage = usageInput.value.trim();
    const newAutoName = usage ? `${monthDay}-${usage}` : `${monthDay}-脚本`;

    if (force || dirNameInput.value === '' || dirNameInput.value === lastAutoDirName) {
        dirNameInput.value = newAutoName;
        lastAutoDirName = newAutoName;
        logDebug('自动更新目录名:', newAutoName);
    }
}

function setupEventListeners() {
    // 缓存 DOM 元素引用
    const usageInput = document.getElementById('usage');
    const dirNameInput = document.getElementById('dirName');
    const generateBtn = document.getElementById('generateBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const scriptTypeSection = document.getElementById('scriptTypeSection');
    const typeBtns = document.querySelectorAll('.type-btn');

    // 操作类型按钮 - 使用事件委托优化
    const buttonGroup = document.querySelector('.button-group');
    if (buttonGroup) {
        buttonGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.type-btn');
            if (!btn) return;
            
            // 使用 requestAnimationFrame 优化 DOM 操作
            requestAnimationFrame(() => {
                typeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentOperateType = btn.dataset.type;
                
                scriptTypeSection.style.display = currentOperateType === 'QUERY' ? 'none' : 'block';
            });
            
            logInfo('操作类型变更:', currentOperateType);
            updateDefaultDirName(true);
        });
    }

    // 防抖处理的 input 事件
    let inputTimeout;
    usageInput.addEventListener('input', () => {
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => updateDefaultDirName(true), 100);
    });

    dirNameInput.addEventListener('input', () => {
        if (dirNameInput.value !== lastAutoDirName) {
            lastAutoDirName = dirNameInput.value;
        }
    });

    generateBtn.addEventListener('click', generateScript);
    settingsBtn.addEventListener('click', () => {
        window.electronAPI.openSettings();
    });
}

async function generateScript() {
    const usageInput = document.getElementById('usage');
    const databaseSelect = document.getElementById('database');
    const scriptTypeSelect = document.getElementById('scriptType');
    const dirNameInput = document.getElementById('dirName');
    const generateBtn = document.getElementById('generateBtn');

    const usage = usageInput.value.trim();
    if (!usage) {
        showError('请输入脚本用途');
        usageInput.focus();
        return;
    }

    const database = databaseSelect.value;
    if (!database) {
        showError('请选择数据库');
        return;
    }

    let scriptType = '';
    if (currentOperateType !== 'QUERY') {
        scriptType = scriptTypeSelect.value;
        if (!scriptType) {
            showError('请选择脚本类型');
            return;
        }
    }

    let dirName = dirNameInput.value.trim();
    if (!dirName) {
        const now = new Date();
        const monthDay = now.toISOString().slice(5, 10).replace(/-/g, '');
        dirName = usage ? `${monthDay}-${usage}` : `${monthDay}-脚本`;
        dirNameInput.value = dirName;
        lastAutoDirName = dirName;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = '生成中...';
    logInfo('开始生成脚本', { operateType: currentOperateType, usage, database, scriptType, dirName });

    try {
        const result = await window.electronAPI.generateScript({
            operateType: currentOperateType,
            usage,
            database,
            scriptType,
            dirName,
        });

        if (result.success) {
            logInfo('脚本生成成功', result.filePath);
            showSuccess(result);
        } else {
            logError('脚本生成失败', result.error);
            showError('生成失败: ' + result.error);
        }
    } catch (error) {
        logError('生成脚本异常:', error);
        showError('生成失败: ' + error.message);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '🚀 生成脚本';
    }
}

function showSuccess(result) {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');

    resultDiv.style.display = 'block';
    resultDiv.className = 'result-section result-success';
    resultContent.innerHTML = `
        <div class="success-message">✓ 脚本生成成功！</div>
        <div><strong>文件名：</strong> ${escapeHtml(result.filename)}</div>
        <div class="file-path"><strong>文件路径：</strong><br>${escapeHtml(result.filePath)}</div>
        <button id="openFileBtn" class="btn-small" style="margin-top: 10px;">📂 打开文件</button>
        <button id="openFolderBtn" class="btn-small" style="margin-top: 10px; margin-left: 10px;">📁 打开文件夹</button>
    `;

    document.getElementById('openFileBtn')?.addEventListener('click', async () => {
        logInfo('用户点击打开文件', result.filePath);
        await window.electronAPI.openFile(result.filePath);
    });

    document.getElementById('openFolderBtn')?.addEventListener('click', async () => {
        logInfo('用户点击打开文件夹', result.targetPath);
        await window.electronAPI.openFolder(result.targetPath);
    });

    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');

    resultDiv.style.display = 'block';
    resultDiv.className = 'result-section result-error';
    resultContent.innerHTML = `<div class="error-message">✗ ${escapeHtml(message)}</div>`;
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
