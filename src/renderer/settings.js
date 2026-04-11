/**
 * 设置页面逻辑（独立窗口版）
 */

let settingsConfig = null;

// ========== 初始化 ==========
async function initSettings() {
    logInfo('设置页面初始化');
    settingsConfig = await window.electronAPI.getConfig();

    // 填充表单
    document.getElementById('basePath').value = settingsConfig.base_path || '';
    document.getElementById('devChName').value = settingsConfig.developer_ch_name || '';
    document.getElementById('devEnName').value = settingsConfig.developer_en_name || '';
    document.getElementById('textEditor').value = settingsConfig.text_edit_app || '';
    document.getElementById('autoUpdateCheckbox').checked = settingsConfig.auto_update !== false;
    document.getElementById('autoStartCheckbox').checked = settingsConfig.auto_start === true;
    document.getElementById('closeActionSelect').value = settingsConfig.close_action || 'ask';

    renderDatabasesConfig(settingsConfig.databases || []);
    renderScriptTypesConfig(settingsConfig.script_types || []);

    // 关于页面
    const packageJson = await window.electronAPI.getPackageInfo();
    document.getElementById('aboutVersion').textContent = `版本: ${packageJson.version || '1.0.0'}`;
    let author = packageJson.author || 'lov3smu';
    author = author.replace(/<[^>]*>/g, '').trim();
    document.getElementById('aboutAuthor').textContent = `作者: ${author}`;
    const year = new Date().getFullYear();
    document.getElementById('aboutCopyright').textContent = `© ${year} ${author}. All rights reserved.`;

    // 标签页切换
    initSettingsTabs();

    // 事件绑定
    document.getElementById('saveSettingsBtn').onclick = async () => {
        if (validateSettings()) {
            await saveSettings();
        }
    };
    document.getElementById('cancelSettingsBtn').onclick = () => window.close();

    document.getElementById('checkUpdateBtn').onclick = async () => {
        const result = await window.electronAPI.checkForUpdates(true);
        if (result && result.status === 'update-not-available') {
            alert('当前已是最新版本');
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

// ========== 渲染配置列表 ==========
function renderDatabasesConfig(databases) {
    const container = document.getElementById('databasesConfig');
    if (!container) return;
    container.innerHTML = '';
    databases.forEach(dbName => {
        const div = document.createElement('div');
        div.className = 'config-item';
        div.innerHTML = `
            <div class="config-item-info">
                <input type="text" placeholder="数据库名" value="${escapeHtml(dbName)}" class="input-field" style="width: 100%;">
            </div>
            <div class="config-item-actions">
                <button class="btn-small btn-danger delete-btn">删除</button>
            </div>
        `;
        div.querySelector('.delete-btn').onclick = () => div.remove();
        container.appendChild(div);
    });
}

function renderScriptTypesConfig(scriptTypes) {
    const container = document.getElementById('scriptTypesConfig');
    if (!container) return;
    container.innerHTML = '';
    scriptTypes.forEach(st => {
        const div = document.createElement('div');
        div.className = 'config-item';
        div.innerHTML = `
            <div class="config-item-info">
                <input type="text" placeholder="名称" value="${escapeHtml(st.name)}" class="input-field" style="width: 120px; margin-right: 10px;">
                <input type="text" placeholder="描述" value="${escapeHtml(st.description)}" class="input-field" style="width: 300px;">
            </div>
            <div class="config-item-actions">
                <button class="btn-small btn-danger delete-btn">删除</button>
            </div>
        `;
        div.querySelector('.delete-btn').onclick = () => div.remove();
        container.appendChild(div);
    });
}

function addDatabaseItem() {
    const container = document.getElementById('databasesConfig');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'config-item';
    div.innerHTML = `
        <div class="config-item-info">
            <input type="text" placeholder="数据库名" class="input-field" style="width: 100%;">
        </div>
        <div class="config-item-actions">
            <button class="btn-small btn-danger delete-btn">删除</button>
        </div>
    `;
    div.querySelector('.delete-btn').onclick = () => div.remove();
    container.appendChild(div);
}

function addScriptTypeItem() {
    const container = document.getElementById('scriptTypesConfig');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'config-item';
    div.innerHTML = `
        <div class="config-item-info">
            <input type="text" placeholder="名称" class="input-field" style="width: 120px; margin-right: 10px;">
            <input type="text" placeholder="描述" class="input-field" style="width: 300px;">
        </div>
        <div class="config-item-actions">
            <button class="btn-small btn-danger delete-btn">删除</button>
        </div>
    `;
    div.querySelector('.delete-btn').onclick = () => div.remove();
    container.appendChild(div);
}

// ========== 校验 ==========
function validateSettings() {
    let isValid = true;
    let errorMessages = [];

    document.querySelectorAll('.config-item').forEach(item => {
        item.classList.remove('error');
        item.querySelectorAll('input').forEach(input => input.classList.remove('error'));
    });

    const dbNames = [];
    document.querySelectorAll('#databasesConfig .config-item').forEach(item => {
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
    document.querySelectorAll('#scriptTypesConfig .config-item').forEach(item => {
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
        showSettingsError(errorMessages[0]);
    }
    return isValid;
}

function showSettingsError(message) {
    // 移除已有的提示
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== 标签页 ==========
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
                if (settingsContent) settingsContent.scrollTop = 0;
            }
        });
    });
}

// ========== 保存 ==========
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
        ...(settingsConfig || {}),
        base_path: document.getElementById('basePath').value,
        developer_ch_name: document.getElementById('devChName').value,
        developer_en_name: document.getElementById('devEnName').value,
        text_edit_app: document.getElementById('textEditor').value,
        auto_update: document.getElementById('autoUpdateCheckbox').checked,
        auto_start: document.getElementById('autoStartCheckbox').checked,
        close_action: document.getElementById('closeActionSelect').value,
        databases,
        script_types: scriptTypes,
    };

    logInfo('保存配置', {
        databases: databases.length,
        scriptTypes: scriptTypes.length,
        close_action: newConfig.close_action,
    });

    const success = await window.electronAPI.saveConfig(newConfig);
    if (success) {
        await window.electronAPI.setAutoStart(newConfig.auto_start);
        // 通知主窗口重新加载配置
        await window.electronAPI.reloadConfig();
        window.close();
    } else {
        showSettingsError('保存失败，请检查配置');
    }
}

document.addEventListener('DOMContentLoaded', initSettings);
