/**
 * 配置加载与 UI 填充
 */

let currentConfig = null;

async function loadConfig() {
    try {
        currentConfig = await window.electronAPI.getConfig();
        logInfo('配置加载成功', {
            databases: currentConfig.databases?.length,
            scriptTypes: currentConfig.script_types?.length,
        });

        // 填充数据库下拉框
        const databaseSelect = document.getElementById('database');
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

        // 填充脚本类型下拉框
        const scriptTypeSelect = document.getElementById('scriptType');
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
    } catch (error) {
        logError('加载配置失败:', error);
        showError('加载配置失败: ' + error.message);
    }
}

function getCurrentConfig() {
    return currentConfig;
}
