// 全局变量
let currentConfig = null;
let currentOperateType = 'PUBLISH';
let lastAutoDirName = '';

// DOM 元素
const usageInput = document.getElementById('usage');
const databaseSelect = document.getElementById('database');
const scriptTypeSelect = document.getElementById('scriptType');
const dirNameInput = document.getElementById('dirName');
const generateBtn = document.getElementById('generateBtn');
const settingsBtn = document.getElementById('settingsBtn');
const resultDiv = document.getElementById('result');
const resultContent = document.getElementById('resultContent');
const scriptTypeSection = document.getElementById('scriptTypeSection');

// 前端日志函数
function logInfo(...args) { console.log('[INFO]', ...args); }
function logError(...args) { console.error('[ERROR]', ...args); }
function logDebug(...args) { console.debug('[DEBUG]', ...args); }

async function init() {
    logInfo('渲染进程初始化');
    await loadConfig();
    setupEventListeners();
    updateDefaultDirName(true);
}

async function loadConfig() {
    try {
        currentConfig = await window.electronAPI.getConfig();
        logInfo('配置加载成功', { databases: currentConfig.databases?.length, scriptTypes: currentConfig.script_types?.length });
        
        databaseSelect.innerHTML = '<option value="">请选择数据库</option>';
        if (currentConfig.databases && currentConfig.databases.length > 0) {
            currentConfig.databases.forEach(dbName => {
                const option = document.createElement('option');
                option.value = dbName;
                option.textContent = dbName;
                databaseSelect.appendChild(option);
            });
        }
        databaseSelect.size = 1;
        
        scriptTypeSelect.innerHTML = '<option value="">请选择脚本类型</option>';
        if (currentConfig.script_types && currentConfig.script_types.length > 0) {
            currentConfig.script_types.forEach(st => {
                const option = document.createElement('option');
                option.value = st.name;
                option.textContent = `${st.name} - ${st.description}`;
                scriptTypeSelect.appendChild(option);
            });
        }
        scriptTypeSelect.size = 1;
        
        updateDefaultDirName(true);
    } catch (error) {
        logError('加载配置失败:', error);
        showError('加载配置失败: ' + error.message);
    }
}

function updateDefaultDirName(force = false) {
    const now = new Date();
    const monthDay = now.toISOString().slice(5, 10).replace(/-/g, '');
    const usage = usageInput.value.trim();
    let newAutoName = usage ? `${monthDay}-${usage}` : `${monthDay}-脚本`;
    
    if (force || dirNameInput.value === '' || dirNameInput.value === lastAutoDirName) {
        dirNameInput.value = newAutoName;
        lastAutoDirName = newAutoName;
        logDebug('自动更新目录名:', newAutoName);
    }
}

function setupEventListeners() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOperateType = btn.dataset.type;
            logInfo('操作类型变更:', currentOperateType);
            
            if (currentOperateType === 'QUERY') {
                scriptTypeSection.style.display = 'none';
            } else {
                scriptTypeSection.style.display = 'block';
            }
            updateDefaultDirName(true);
        });
    });
    
    usageInput.addEventListener('input', () => updateDefaultDirName(true));
    dirNameInput.addEventListener('input', () => {
        if (dirNameInput.value !== lastAutoDirName) {
            lastAutoDirName = dirNameInput.value;
        }
    });
    generateBtn.addEventListener('click', generateScript);
    settingsBtn.addEventListener('click', showSettings);
}

async function generateScript() {
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
            usage, database, scriptType, dirName
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
    resultDiv.style.display = 'block';
    resultContent.innerHTML = `
        <div class="success-message">✓ 脚本生成成功！</div>
        <div><strong>文件名：</strong> ${result.filename}</div>
        <div class="file-path"><strong>文件路径：</strong><br>${result.filePath}</div>
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
    resultDiv.style.display = 'block';
    resultContent.innerHTML = `<div class="error-message">✗ 错误</div><div>${message}</div>`;
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 拖动相关变量
let dragStartX = 0, dragStartY = 0;
let dragInitialLeft = 0, dragInitialTop = 0;
let dragModalContent = null;
let dragMouseMoveHandler = null;
let dragMouseUpHandler = null;

function cleanupDragListeners() {
    if (dragMouseMoveHandler) {
        document.removeEventListener('mousemove', dragMouseMoveHandler);
        dragMouseMoveHandler = null;
    }
    if (dragMouseUpHandler) {
        document.removeEventListener('mouseup', dragMouseUpHandler);
        dragMouseUpHandler = null;
    }
    if (dragModalContent) {
        dragModalContent.style.position = '';
        dragModalContent.style.left = '';
        dragModalContent.style.top = '';
        dragModalContent.style.transform = '';
        dragModalContent = null;
    }
}

function makeDraggable(modalContent, handle) {
    cleanupDragListeners();
    let isDragging = false;
    
    const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        modalContent.style.left = `${dragInitialLeft + dx}px`;
        modalContent.style.top = `${dragInitialTop + dy}px`;
        modalContent.style.transform = 'none';
    };
    
    const onMouseUp = () => {
        isDragging = false;
    };
    
    const onMouseDown = (e) => {
        if (e.target.classList.contains('close')) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = modalContent.getBoundingClientRect();
        dragInitialLeft = rect.left;
        dragInitialTop = rect.top;
        modalContent.style.position = 'fixed';
        modalContent.style.margin = '0';
        e.preventDefault();
    };
    
    handle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    dragMouseMoveHandler = onMouseMove;
    dragMouseUpHandler = onMouseUp;
    dragModalContent = modalContent;
}

function closeSettingsModal(modal) {
    if (modal) modal.style.display = 'none';
    cleanupDragListeners();
}

async function showSettings() {
    const modal = document.getElementById('settingsModal');
    const config = await window.electronAPI.getConfig();
    logInfo('打开设置窗口');
    
    document.getElementById('basePath').value = config.base_path || '';
    document.getElementById('devChName').value = config.developer_ch_name || '';
    document.getElementById('devEnName').value = config.developer_en_name || '';
    document.getElementById('textEditor').value = config.text_edit_app || '';
    
    renderDatabasesConfig(config.databases || []);
    renderScriptTypesConfig(config.script_types || []);
    initSettingsTabs();
    
    modal.style.display = 'flex';
    const modalContent = modal.querySelector('.modal-content');
    const modalHeader = modal.querySelector('.modal-header');
    makeDraggable(modalContent, modalHeader);
    
    const closeModal = () => closeSettingsModal(modal);
    document.querySelector('.close').onclick = closeModal;
    document.getElementById('cancelSettingsBtn').onclick = closeModal;
    document.getElementById('saveSettingsBtn').onclick = async () => {
        if (validateSettings()) {
            await saveSettings();
            closeModal();
        }
    };
    
    document.getElementById('browsePathBtn').onclick = async () => {
        const path = await window.electronAPI.selectDirectory();
        if (path) document.getElementById('basePath').value = path;
    };
    document.getElementById('browseEditorBtn').onclick = async () => {
        const filePath = await window.electronAPI.selectFile();
        if (filePath) document.getElementById('textEditor').value = filePath;
    };
    document.getElementById('addDatabaseBtn').onclick = () => addDatabaseItem();
    document.getElementById('addScriptTypeBtn').onclick = () => addScriptTypeItem();
}

function validateSettings() {
    let isValid = true;
    let errorMessages = [];
    document.querySelectorAll('.config-item').forEach(item => {
        item.classList.remove('error');
        const inputs = item.querySelectorAll('input');
        inputs.forEach(input => input.classList.remove('error'));
    });
    
    const dbNames = [];
    const dbItems = document.querySelectorAll('#databasesConfig .config-item');
    dbItems.forEach(item => {
        const input = item.querySelector('input');
        const name = input.value.trim();
        if (!name) {
            input.classList.add('error');
            isValid = false;
            errorMessages.push('数据库名称不能为空');
        } else if (dbNames.includes(name)) {
            input.classList.add('error');
            isValid = false;
            errorMessages.push(`数据库名称 "${name}" 重复`);
        } else {
            dbNames.push(name);
        }
    });
    
    const typeNames = [];
    const typeItems = document.querySelectorAll('#scriptTypesConfig .config-item');
    typeItems.forEach(item => {
        const nameInput = item.querySelector('input:first-child');
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.classList.add('error');
            isValid = false;
            errorMessages.push('脚本类型名称不能为空');
        } else if (typeNames.includes(name)) {
            nameInput.classList.add('error');
            isValid = false;
            errorMessages.push(`脚本类型名称 "${name}" 重复`);
        } else {
            typeNames.push(name);
        }
    });
    
    if (!isValid) {
        logError('配置验证失败:', errorMessages[0]);
        showError(errorMessages[0]);
    }
    return isValid;
}

function initSettingsTabs() {
    const menuItems = document.querySelectorAll('.settings-menu-item');
    const tabs = document.querySelectorAll('.settings-tab');
    const settingsContent = document.querySelector('.settings-content');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            menuItems.forEach(mi => mi.classList.remove('active'));
            tabs.forEach(tab => tab.classList.remove('active'));
            item.classList.add('active');
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
                if (settingsContent) {
                    settingsContent.scrollTop = 0;
                }
            }
        });
    });
}

function renderDatabasesConfig(databases) {
    const container = document.getElementById('databasesConfig');
    container.innerHTML = '';
    databases.forEach(dbName => {
        const div = document.createElement('div');
        div.className = 'config-item';
        div.innerHTML = `
            <div class="config-item-info">
                <input type="text" placeholder="数据库名" value="${dbName}" class="input-field" style="width: 100%;">
            </div>
            <div class="config-item-actions">
                <button class="btn-small delete-btn">删除</button>
            </div>
        `;
        div.querySelector('.delete-btn').onclick = () => div.remove();
        container.appendChild(div);
    });
}

function renderScriptTypesConfig(scriptTypes) {
    const container = document.getElementById('scriptTypesConfig');
    container.innerHTML = '';
    scriptTypes.forEach(st => {
        const div = document.createElement('div');
        div.className = 'config-item';
        div.innerHTML = `
            <div class="config-item-info">
                <input type="text" placeholder="名称" value="${st.name}" class="input-field" style="width: 120px; margin-right: 10px;">
                <input type="text" placeholder="描述" value="${st.description}" class="input-field" style="width: 300px;">
            </div>
            <div class="config-item-actions">
                <button class="btn-small delete-btn">删除</button>
            </div>
        `;
        div.querySelector('.delete-btn').onclick = () => div.remove();
        container.appendChild(div);
    });
}

function addDatabaseItem() {
    const container = document.getElementById('databasesConfig');
    const div = document.createElement('div');
    div.className = 'config-item';
    div.innerHTML = `
        <div class="config-item-info">
            <input type="text" placeholder="数据库名" class="input-field" style="width: 100%;">
        </div>
        <div class="config-item-actions">
            <button class="btn-small delete-btn">删除</button>
        </div>
    `;
    div.querySelector('.delete-btn').onclick = () => div.remove();
    container.appendChild(div);
}

function addScriptTypeItem() {
    const container = document.getElementById('scriptTypesConfig');
    const div = document.createElement('div');
    div.className = 'config-item';
    div.innerHTML = `
        <div class="config-item-info">
            <input type="text" placeholder="名称" class="input-field" style="width: 120px; margin-right: 10px;">
            <input type="text" placeholder="描述" class="input-field" style="width: 300px;">
        </div>
        <div class="config-item-actions">
            <button class="btn-small delete-btn">删除</button>
        </div>
    `;
    div.querySelector('.delete-btn').onclick = () => div.remove();
    container.appendChild(div);
}

async function saveSettings() {
    const databases = [];
    document.querySelectorAll('#databasesConfig .config-item').forEach(item => {
        const dbName = item.querySelector('input[type="text"]')?.value.trim();
        if (dbName) databases.push(dbName);
    });
    
    const scriptTypes = [];
    document.querySelectorAll('#scriptTypesConfig .config-item').forEach(item => {
        const inputs = item.querySelectorAll('input[type="text"]');
        const name = inputs[0]?.value.trim();
        const description = inputs[1]?.value.trim();
        if (name) scriptTypes.push({ name, description: description || '' });
    });
    
    const newConfig = {
        base_path: document.getElementById('basePath').value,
        developer_ch_name: document.getElementById('devChName').value,
        developer_en_name: document.getElementById('devEnName').value,
        text_edit_app: document.getElementById('textEditor').value,
        databases, script_types: scriptTypes
    };
    
    logInfo('保存配置', { databases: databases.length, scriptTypes: scriptTypes.length });
    const success = await window.electronAPI.saveConfig(newConfig);
    if (success) {
        // 手动保存配置后刷新页面，使所有更改完全生效
        location.reload();
    } else {
        alert('保存失败');
    }
}

document.addEventListener('DOMContentLoaded', init);