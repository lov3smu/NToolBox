<template>
  <div
    class="settings-layout"
    :class="{ 'menu-collapsed': menuCollapsed, 'is-resizing': settingsSidebarResizing }"
    :style="menuCollapsed ? null : { '--settings-sidebar-width': `${settingsSidebarWidth}px` }"
  >
    <header class="settings-topbar" :class="{ 'platform-darwin': isMac }">
      <div class="settings-nav">
        <button
          type="button"
          class="settings-nav-tool"
          :title="menuCollapsed ? '展开菜单' : '收起菜单'"
          :aria-label="menuCollapsed ? '展开菜单' : '收起菜单'"
          @click="menuCollapsed = !menuCollapsed"
        >
          <svg
            class="settings-nav-collapse-icon"
            :class="{ collapsed: menuCollapsed }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M9.5 4v16" />
            <path d="m15.5 9.5-2.5 2.5 2.5 2.5" />
          </svg>
        </button>
        <button
          type="button"
          class="settings-nav-tool"
          title="返回上一页"
          aria-label="返回上一页"
          :disabled="!canGoBackTab"
          @click="goBackTab"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          class="settings-nav-tool"
          title="前进下一页"
          aria-label="前进下一页"
          :disabled="!canGoForwardTab"
          @click="goForwardTab"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
      <div v-if="!isMac" class="settings-window-controls">
        <button
          type="button"
          class="settings-window-control"
          title="最小化"
          aria-label="最小化"
          @click="minimizeWindow"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M6 12h12" />
          </svg>
        </button>
        <button
          type="button"
          class="settings-window-control"
          :title="isMaximized ? '还原窗口' : '最大化'"
          :aria-label="isMaximized ? '还原窗口' : '最大化'"
          @click="toggleMaximizeWindow"
        >
          <svg
            v-if="isMaximized"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="5" y="8" width="11" height="11" rx="1.5" />
            <path d="M8 8V6.5A1.5 1.5 0 0 1 9.5 5h9A1.5 1.5 0 0 1 20 6.5v9a1.5 1.5 0 0 1-1.5 1.5H17" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="5" y="5" width="14" height="14" rx="1.5" />
          </svg>
        </button>
        <button type="button" class="settings-window-control close" title="关闭" aria-label="关闭" @click="closeWindow">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </header>

    <div class="settings-body">
      <aside class="settings-sidebar">
        <div class="settings-menu-item settings-return" title="返回应用" @click="leaveSettings">
          <span class="menu-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
              <path d="M9.5 21v-6h5v6" />
            </svg>
          </span>
          <span class="menu-text">返回应用</span>
        </div>
        <div class="settings-menu-divider" />
        <div
          v-for="item in menuItems"
          :key="item.id"
          :class="['settings-menu-item', { active: activeTab === item.id }]"
          @click="selectTab(item.id)"
        >
          <span class="menu-icon">
            <svg v-if="item.id === 'general'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
            </svg>
            <svg v-else-if="item.id === 'api'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="7.5" cy="15.5" r="5.5" />
              <path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
            </svg>
            <svg
              v-else-if="item.id === 'database'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14a9 3 0 0 0 18 0V5" />
              <path d="M3 12a9 3 0 0 0 18 0" />
            </svg>
            <svg
              v-else-if="item.id === 'scripttype'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            <svg
              v-else-if="item.id === 'shortcuts'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
            </svg>
            <svg
              v-else-if="item.id === 'extensions'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M14 3h5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3l-3 3v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h3l3-3V5a2 2 0 0 1 2-2z"
              />
              <circle cx="8" cy="8" r="2" />
            </svg>
            <svg
              v-else-if="item.id === 'appearance'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </span>
          <span class="menu-text">{{ item.text }}</span>
        </div>
      </aside>
      <SplitHandle
        v-if="!menuCollapsed"
        orientation="vertical"
        :resizing="settingsSidebarResizing"
        label="拖动调整设置菜单宽度"
        @pointerdown="startSettingsSidebarResize"
        @keydown="onSettingsSidebarKeydown"
      />

      <div class="settings-main">
        <div ref="settingsContentRef" class="settings-content">
          <div v-if="activeTab !== 'extensions'" class="settings-page-head">
            <div class="settings-page-title">
              <h2>{{ activeMeta.title }}</h2>
              <p>{{ activeMeta.description }}</p>
            </div>
          </div>

          <div v-show="activeTab === 'general'" class="settings-tab">
            <div class="form-group">
              <label>脚本位置</label>
              <div class="path-input-group">
                <input v-model="basePath" type="text" class="input-field" placeholder="脚本存储根目录" />
                <button class="btn btn-secondary" @click="selectDir">浏览</button>
              </div>
            </div>
            <div class="form-group">
              <label>开发者中文名</label>
              <input v-model="developerChName" type="text" class="input-field" placeholder="用于脚本作者署名" />
            </div>
            <div class="form-group">
              <label>开发者英文名</label>
              <input v-model="developerEnName" type="text" class="input-field" placeholder="用于脚本历史记录标识" />
            </div>
            <div class="form-group">
              <label>文本编辑器</label>
              <select v-model="textEditApp" class="select-field">
                <option value="">自定义路径</option>
                <option v-for="editor in editorPresets" :key="editor.path" :value="editor.path">
                  {{ editor.name }}
                </option>
              </select>
              <div
                v-if="!editorPresets.some((e) => e.path === textEditApp)"
                class="path-input-group"
                style="margin-top: 8px"
              >
                <input v-model="textEditApp" type="text" class="input-field" placeholder="编辑器可执行文件路径" />
                <button class="btn btn-secondary" @click="selectEditor">浏览</button>
              </div>
              <div class="setting-hint">选择编辑脚本文件使用的文本编辑器</div>
            </div>
            <div class="form-group">
              <label> <input v-model="autoUpdate" type="checkbox" /> 有更新时自动更新 </label>
              <div class="setting-hint">开启后，应用会自动下载并安装新版本</div>
            </div>
            <div class="form-group">
              <label> <input v-model="autoStart" type="checkbox" /> 开机自动启动 </label>
              <div class="setting-hint">开启后，系统启动时会自动运行本应用</div>
            </div>
            <div class="form-group">
              <label>关闭行为</label>
              <select v-model="closeAction" class="select-field">
                <option value="ask">每次询问</option>
                <option value="hide">隐藏到托盘</option>
                <option value="quit">直接退出</option>
              </select>
              <div class="setting-hint">选择点击关闭按钮时的默认行为</div>
            </div>
          </div>

          <div v-show="activeTab === 'appearance'" class="settings-tab">
            <div class="form-group">
              <label>主题模式</label>
              <div class="theme-options">
                <button
                  v-for="option in themeOptions"
                  :key="option.value"
                  type="button"
                  class="theme-option"
                  :class="{ active: theme === option.value }"
                  @click="selectTheme(option.value)"
                >
                  <span class="theme-preview" :class="`theme-preview-${option.value}`">
                    <span class="preview-sidebar" />
                    <span class="preview-body">
                      <span class="preview-bar" />
                      <span class="preview-line" />
                      <span class="preview-line preview-line-short" />
                    </span>
                  </span>
                  <span class="theme-label">{{ option.label }}</span>
                </button>
              </div>
              <div class="setting-hint">选择“跟随系统”时，会随操作系统的深色/浅色设置自动切换</div>
            </div>

            <div class="form-group">
              <label>主题配色</label>
              <div class="palette-options">
                <button
                  v-for="option in themeStyleOptions"
                  :key="option.value"
                  type="button"
                  class="theme-option palette-option"
                  :class="{ active: themeStyle === option.value }"
                  @click="selectThemeStyle(option.value)"
                >
                  <span class="palette-preview" :style="swatchStyle(option.swatch)">
                    <span class="palette-sidebar" />
                    <span class="palette-body">
                      <span class="palette-bar" />
                      <span class="palette-accent" />
                    </span>
                  </span>
                  <span class="theme-label">{{ option.label }}</span>
                </button>
              </div>
              <div class="setting-hint">配色会同时作用于按钮、文字和背景，并自动适配明暗模式</div>
            </div>

            <div class="form-group">
              <label>字体大小</label>
              <select class="select-field" :value="fontSize" @change="selectFontSize($event.target.value)">
                <option v-for="option in fontSizeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <div class="setting-hint">调整界面与内容区文字大小，图标和控件尺寸保持不变</div>
            </div>
          </div>

          <div v-show="activeTab === 'api'" class="settings-tab api-settings">
            <div class="form-group">
              <label>默认 AI 平台</label>
              <select v-model="aiProvider" class="select-field" @change="onProviderChange">
                <option v-for="provider in aiProviders" :key="provider.type" :value="provider.type">
                  {{ provider.name }} - {{ provider.description }}
                </option>
              </select>
              <div class="setting-hint">AI 助手默认使用该平台；各平台 API Key 独立保存，可在聊天页随时切换平台</div>
            </div>

            <div class="provider-cards">
              <div
                v-for="provider in aiProviders"
                :key="provider.type"
                class="provider-card"
                :class="{ expanded: isProviderExpanded(provider.type) }"
              >
                <div
                  class="provider-card-header"
                  role="button"
                  tabindex="0"
                  @click="toggleProviderExpanded(provider.type)"
                  @keydown.enter.prevent="toggleProviderExpanded(provider.type)"
                >
                  <div class="provider-title">
                    <span class="provider-name">{{ provider.name }}</span>
                    <span class="provider-id">{{ provider.type }}</span>
                    <span class="provider-tag" :class="{ configured: hasProviderKey(provider.type) }">
                      {{ hasProviderKey(provider.type) ? '已配置' : '未配置' }}
                    </span>
                    <span v-if="aiBaseUrls[provider.type]" class="provider-tag custom">自定义地址</span>
                    <span v-if="provider.type === aiProvider" class="provider-tag default">默认</span>
                  </div>
                  <div class="provider-header-actions">
                    <button
                      v-if="provider.type !== aiProvider"
                      type="button"
                      class="link-btn"
                      @click.stop="setDefaultProvider(provider.type)"
                    >
                      设为默认
                    </button>
                    <button
                      v-if="provider.docsUrl"
                      type="button"
                      class="link-btn"
                      @click.stop="openProviderDocs(provider)"
                    >
                      平台文档
                    </button>
                    <svg
                      class="provider-chevron"
                      :class="{ rotated: isProviderExpanded(provider.type) }"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                <div v-if="isProviderExpanded(provider.type)" class="provider-card-body">
                  <div class="provider-field">
                    <div class="field-label-row">
                      <label>API 密钥</label>
                      <span
                        class="field-help"
                        :title="
                          provider.envKey ? `留空时会读取 ${provider.envKey} 环境变量` : '填写平台控制台生成的 API 密钥'
                        "
                      >
                        ?
                      </span>
                    </div>
                    <div class="api-key-input-group">
                      <input
                        v-model="aiApiKeys[provider.type]"
                        :type="showApiKey[provider.type] ? 'text' : 'password'"
                        class="input-field"
                        :placeholder="
                          provider.hasEnvKey ? `已通过 ${provider.envKey} 提供` : `输入 ${provider.name} API Key`
                        "
                      />
                      <button class="btn btn-secondary" @click="toggleShowApiKey(provider.type)">
                        {{ showApiKey[provider.type] ? '隐藏' : '显示' }}
                      </button>
                      <button
                        class="btn btn-primary"
                        :disabled="
                          (!hasStoredApiKey(provider.type) && !provider.hasEnvKey) || testingApiKey[provider.type]
                        "
                        @click="testApiKey(provider)"
                      >
                        {{ testingApiKey[provider.type] ? '验证中...' : '验证' }}
                      </button>
                    </div>
                    <div
                      v-if="apiKeyTestResult[provider.type]"
                      class="api-test-result"
                      :class="apiKeyTestResult[provider.type].success ? 'success' : 'error'"
                    >
                      {{ apiKeyTestResult[provider.type].message }}
                    </div>
                    <div
                      v-if="provider.envKey && !hasStoredApiKey(provider.type)"
                      class="env-status"
                      :class="provider.hasEnvKey ? 'detected' : 'missing'"
                    >
                      {{
                        provider.hasEnvKey
                          ? `已检测到环境变量 ${provider.envKey}，无需填写密钥`
                          : `未检测到环境变量 ${provider.envKey}，请填写密钥或先设置环境变量`
                      }}
                    </div>
                  </div>

                  <div class="custom-settings">
                    <button type="button" class="custom-settings-toggle" @click="toggleCustomSettings(provider.type)">
                      <svg
                        class="provider-chevron small"
                        :class="{ rotated: isCustomSettingsOpen(provider.type) }"
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true"
                      >
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                      <span>自定义设置</span>
                    </button>
                    <div v-if="isCustomSettingsOpen(provider.type)" class="custom-settings-body">
                      <label>API 地址</label>
                      <input
                        v-model="aiBaseUrls[provider.type]"
                        class="input-field"
                        :placeholder="provider.defaultBaseUrl"
                      />
                      <div class="setting-hint">使用 OpenAI 兼容协议，留空则使用平台默认地址</div>
                    </div>
                  </div>

                  <div class="model-section">
                    <div class="model-section-header">
                      <div class="field-label-row">
                        <label>模型目录</label>
                        <span class="field-help" title="模型列表用于聊天时选择；可手动增删并配置高级参数"> ? </span>
                      </div>
                      <div class="model-config-actions">
                        <button
                          class="btn btn-secondary btn-sm"
                          :disabled="modelFetching[provider.type]"
                          @click="refreshModels(provider)"
                        >
                          {{ modelFetching[provider.type] ? '获取中...' : '获取最新模型' }}
                        </button>
                        <button
                          class="btn btn-default btn-sm"
                          :disabled="modelFetching[provider.type]"
                          @click="resetModels(provider)"
                        >
                          恢复内置模型
                        </button>
                      </div>
                    </div>
                    <div class="setting-hint">{{ modelSourceHint(provider.type) }}</div>

                    <div
                      v-if="modelFetchMessage[provider.type]"
                      class="api-test-result"
                      :class="modelFetchSuccess[provider.type] ? 'success' : 'error'"
                    >
                      {{ modelFetchMessage[provider.type] }}
                    </div>

                    <div class="model-default-row">
                      <label>默认模型</label>
                      <select v-model="modelConfigs[provider.type].default" class="select-field">
                        <option value="" disabled>请选择默认模型</option>
                        <option
                          v-for="model in modelConfigs[provider.type].models.filter((item) => item.id)"
                          :key="model.id"
                          :value="model.id"
                        >
                          {{ model.name || model.id }}
                        </option>
                      </select>
                    </div>

                    <div class="model-list">
                      <div
                        v-for="(model, index) in modelConfigs[provider.type].models"
                        :key="provider.type + '-model-' + index"
                        class="model-item"
                        :class="{
                          dragging: isModelDragging(provider.type, index),
                          'drag-over': isModelDragOver(provider.type, index)
                        }"
                        :draggable="isModelDragEnabled(provider.type)"
                        @dragstart="startModelDrag(provider.type, index, $event)"
                        @dragover.prevent="overModelDrag(provider.type, index)"
                        @drop.stop.prevent="dropModelDrag(provider.type)"
                        @dragend="endModelDrag(provider.type)"
                      >
                        <div class="model-row">
                          <span
                            class="model-drag-handle"
                            title="拖动排序"
                            @mousedown="enableModelDrag(provider.type)"
                            @click="endModelDrag(provider.type)"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                              <circle cx="9" cy="6" r="1.4" />
                              <circle cx="15" cy="6" r="1.4" />
                              <circle cx="9" cy="12" r="1.4" />
                              <circle cx="15" cy="12" r="1.4" />
                              <circle cx="9" cy="18" r="1.4" />
                              <circle cx="15" cy="18" r="1.4" />
                            </svg>
                          </span>
                          <input v-model="model.id" class="input-field model-id" placeholder="模型 ID" />
                          <input v-model="model.name" class="input-field model-name" placeholder="显示名称" />
                          <button
                            type="button"
                            class="model-icon-btn"
                            :title="isModelExpanded(provider.type, index) ? '收起高级参数' : '展开高级参数'"
                            @click="toggleModelExpanded(provider.type, index)"
                          >
                            <svg
                              class="provider-chevron small"
                              :class="{ rotated: isModelExpanded(provider.type, index) }"
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="model-icon-btn danger"
                            title="删除模型"
                            @click="removeModel(provider.type, index)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            </svg>
                          </button>
                        </div>
                        <div v-if="isModelExpanded(provider.type, index)" class="model-advanced">
                          <div class="advanced-field">
                            <label>上下文窗口</label>
                            <input
                              v-model.number="model.contextWindow"
                              type="number"
                              min="1"
                              class="input-field"
                              :placeholder="`默认 ${defaultContextWindow(provider)}`"
                            />
                          </div>
                          <div class="advanced-field">
                            <label>最大输出 token 数</label>
                            <input
                              v-model.number="model.maxOutput"
                              type="number"
                              min="1"
                              class="input-field"
                              placeholder="留空使用平台默认"
                            />
                          </div>
                          <div class="advanced-field">
                            <label>输入类型</label>
                            <div class="input-type-options">
                              <label class="checkbox-field">
                                <input
                                  type="checkbox"
                                  :checked="hasInputType(model, 'text')"
                                  @change="toggleInputType(model, 'text')"
                                />
                                文本
                              </label>
                              <label class="checkbox-field">
                                <input
                                  type="checkbox"
                                  :checked="hasInputType(model, 'image')"
                                  @change="toggleInputType(model, 'image')"
                                />
                                图片
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-if="modelConfigs[provider.type].models.length === 0" class="model-empty">
                        暂无模型，请获取最新模型或手动添加
                      </div>
                    </div>

                    <button type="button" class="add-model-btn" @click="addModel(provider.type)">+ 添加模型</button>
                  </div>

                  <div class="provider-card-footer">
                    <button class="btn btn-secondary" @click="cancelProviderCard(provider)">取消</button>
                    <button
                      class="btn btn-primary"
                      :disabled="providerSaving[provider.type]"
                      @click="saveProviderCard(provider)"
                    >
                      {{ providerSaving[provider.type] ? '保存中...' : '保存' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'database'" class="settings-tab">
            <div class="form-group">
              <label>数据库</label>
              <div
                ref="databaseListRef"
                class="config-list"
                @dragover.prevent
                @drop.prevent="dropConfigDrag('database')"
              >
                <div
                  v-for="(db, index) in databases"
                  :key="index"
                  class="config-item"
                  :class="{
                    dragging: isDragging('database', index),
                    'drag-over': isDragOver('database', index)
                  }"
                  :draggable="isDragEnabled('database')"
                  @dragstart="startConfigDrag('database', index, $event)"
                  @dragover.prevent="overConfigDrag('database', index)"
                  @drop.stop.prevent="dropConfigDrag('database')"
                  @dragend="endConfigDrag('database')"
                >
                  <span
                    class="config-drag-handle"
                    title="拖动排序"
                    aria-label="拖动排序"
                    @mousedown="enableConfigDrag('database')"
                    @click="endConfigDrag('database')"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <circle cx="9" cy="6" r="1.4" />
                      <circle cx="15" cy="6" r="1.4" />
                      <circle cx="9" cy="12" r="1.4" />
                      <circle cx="15" cy="12" r="1.4" />
                      <circle cx="9" cy="18" r="1.4" />
                      <circle cx="15" cy="18" r="1.4" />
                    </svg>
                  </span>
                  <div class="config-item-info">
                    <input
                      v-model="db.name"
                      type="text"
                      class="input-field"
                      placeholder="数据库名"
                      :class="{ error: db.error }"
                    />
                  </div>
                  <div class="config-item-actions">
                    <button class="btn btn-danger" @click="removeDatabase(index)">删除</button>
                  </div>
                </div>
              </div>
              <button class="btn btn-secondary" @click="addDatabase">+ 添加数据库</button>
            </div>
          </div>

          <div v-show="activeTab === 'scripttype'" class="settings-tab">
            <div class="form-group">
              <label>脚本类型</label>
              <div
                ref="scriptTypeListRef"
                class="config-list"
                @dragover.prevent
                @drop.prevent="dropConfigDrag('scriptType')"
              >
                <div
                  v-for="(st, index) in scriptTypes"
                  :key="index"
                  class="config-item"
                  :class="{
                    dragging: isDragging('scriptType', index),
                    'drag-over': isDragOver('scriptType', index)
                  }"
                  :draggable="isDragEnabled('scriptType')"
                  @dragstart="startConfigDrag('scriptType', index, $event)"
                  @dragover.prevent="overConfigDrag('scriptType', index)"
                  @drop.stop.prevent="dropConfigDrag('scriptType')"
                  @dragend="endConfigDrag('scriptType')"
                >
                  <span
                    class="config-drag-handle"
                    title="拖动排序"
                    aria-label="拖动排序"
                    @mousedown="enableConfigDrag('scriptType')"
                    @click="endConfigDrag('scriptType')"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <circle cx="9" cy="6" r="1.4" />
                      <circle cx="15" cy="6" r="1.4" />
                      <circle cx="9" cy="12" r="1.4" />
                      <circle cx="15" cy="12" r="1.4" />
                      <circle cx="9" cy="18" r="1.4" />
                      <circle cx="15" cy="18" r="1.4" />
                    </svg>
                  </span>
                  <div class="config-item-info">
                    <input
                      v-model="st.name"
                      type="text"
                      class="input-field"
                      placeholder="名称"
                      style="width: 120px; margin-right: 10px"
                      :class="{ error: st.error }"
                    />
                    <input
                      v-model="st.description"
                      type="text"
                      class="input-field"
                      placeholder="描述"
                      style="flex: 1"
                    />
                  </div>
                  <div class="config-item-actions">
                    <button class="btn btn-danger" @click="removeScriptType(index)">删除</button>
                  </div>
                </div>
              </div>
              <button class="btn btn-secondary" @click="addScriptType">+ 添加脚本类型</button>
            </div>
          </div>

          <div v-show="activeTab === 'shortcuts'" class="settings-tab">
            <div class="form-group">
              <label>快捷键配置</label>
              <div class="shortcut-list">
                <div v-for="tool in shortcutTools" :key="tool.path" class="shortcut-item">
                  <span class="shortcut-name">{{ tool.name }}</span>
                  <input
                    v-model="shortcuts[tool.shortcutKey]"
                    type="text"
                    class="input-field shortcut-input"
                    placeholder="快捷键"
                  />
                </div>
              </div>
              <div class="setting-hint">格式示例: CmdOrCtrl+,（留空则不设置快捷键）</div>
            </div>
          </div>

          <div v-if="activeTab === 'extensions'" class="settings-tab extensions-tab">
            <ExtensionsManager />
          </div>

          <div v-show="activeTab === 'about'" class="settings-tab">
            <div class="about-section">
              <div class="about-icon">
                <img :src="iconUrl" alt="NToolBox Logo" />
              </div>
              <div class="about-name">NToolBox</div>
              <div class="about-version">版本: {{ version }}</div>
              <div class="about-description">
                一款面向开发人员的多端工具集合平台，集成丰富工具 + AI大模型能力，启动快、功能全、更智能。
              </div>
              <div class="about-author">作者: {{ author }}</div>
              <div class="about-copyright">{{ year }} {{ author }}. All rights reserved.</div>
              <div class="about-buttons">
                <button class="btn btn-secondary btn-sm" @click="checkUpdate">检查更新</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab !== 'extensions'" class="settings-footer">
          <button class="btn btn-primary" @click="save">保存</button>
          <button class="btn btn-default" @click="closeWindow">取消</button>
        </div>
      </div>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { openUpdateCenter, usePaneResize, useToast } from '@/composables'
import Toast from '@/components/Toast.vue'
import SplitHandle from '@/components/SplitHandle.vue'
import ExtensionsManager from '@/components/ExtensionsManager.vue'
import {
  getConfig,
  saveConfig,
  selectDirectory,
  selectFile,
  getPackageInfo,
  getAiProviders,
  getProviderModels,
  validateApiKey,
  closeSettingsWindow,
  returnToApp,
  windowMinimize,
  windowToggleMaximize,
  windowIsMaximized,
  windowClose,
  platform as hostPlatform,
  setAutoStart,
  reloadConfig,
  reloadMenu,
  openExternal,
  onSettingsTab,
  onWindowMaximized
} from '@/api'
import iconUrl from '@assets/icon.png'
import { tools } from '@shared/tools'
import {
  applyFontSize,
  applyTheme,
  applyThemeStyle,
  getFontSizePreference,
  getThemePreference,
  getThemeStylePreference,
  normalizeFontSizePreference,
  normalizeThemeStyle
} from '@/utils/theme'

const route = useRoute()
const { toastVisible, toastMessage, toastType, showError, showSuccess } = useToast()
const isMac = hostPlatform === 'darwin'
let removeSettingsTabListener = null
let removeWindowMaximizedListener = null

const shortcutTools = tools.filter((tool) => tool.shortcutKey)

const menuItems = [
  { id: 'general', text: '通用' },
  { id: 'appearance', text: '外观' },
  { id: 'api', text: '模型' },
  { id: 'database', text: '数据库' },
  { id: 'scripttype', text: '脚本类型' },
  { id: 'shortcuts', text: '快捷键' },
  { id: 'extensions', text: '扩展管理' },
  { id: 'about', text: '关于软件' }
]

const tabMeta = {
  general: { title: '通用设置', description: '配置脚本目录、开发者署名、文本编辑器以及启动与关闭行为。' },
  appearance: { title: '外观', description: '选择主题模式、配色方案与字体大小，界面会随系统明暗设置自动适配。' },
  api: {
    title: 'AI 平台',
    description: '管理各平台的 API 密钥、自定义地址与模型目录，可在线获取模型并配置上下文等高级参数。'
  },
  database: { title: '数据库', description: '维护常用数据库名称，供数据库工具快速选择。' },
  scripttype: { title: '脚本类型', description: '定义脚本类型与说明，用于脚本生成与归档。' },
  shortcuts: { title: '快捷键', description: '为常用工具设置全局快捷键，留空则不启用。' },
  about: { title: '关于软件', description: '查看版本信息、项目动态与更新入口。' }
}

const themeOptions = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '明亮' },
  { value: 'dark', label: '暗黑' }
]

const themeStyleOptions = [
  {
    value: 'sapphire',
    label: '蓝宝石',
    swatch: { accent: '#2f5fd0', surface: '#fbfcff', app: '#e9eff9', sidebar: '#1d3557' }
  },
  {
    value: 'forest',
    label: '森林',
    swatch: { accent: '#2f7d5c', surface: '#fbfdfb', app: '#ebf2ed', sidebar: '#1b2b22' }
  },
  {
    value: 'mint',
    label: '薄荷',
    swatch: { accent: '#0e9c88', surface: '#fbfefd', app: '#e9f4f1', sidebar: '#15302b' }
  },
  {
    value: 'bee',
    label: '蜜蜂',
    swatch: { accent: '#b77900', surface: '#fffdf7', app: '#f7f0dc', sidebar: '#2f2716' }
  },
  {
    value: 'parchment',
    label: '羊皮纸',
    swatch: { accent: '#9c6a3c', surface: '#fbf7ee', app: '#f0e8d6', sidebar: '#352a1d' }
  }
]

const fontSizeOptions = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '标准' },
  { value: 'large', label: '大' },
  { value: 'xlarge', label: '特大' }
]

function swatchStyle(swatch) {
  return {
    '--swatch-accent': swatch.accent,
    '--swatch-surface': swatch.surface,
    '--swatch-app': swatch.app,
    '--swatch-sidebar': swatch.sidebar
  }
}

const activeTab = ref('general')
const settingsContentRef = ref(null)
const menuCollapsed = ref(false)
const {
  size: settingsSidebarWidth,
  resizing: settingsSidebarResizing,
  startResize: startSettingsSidebarResize,
  onKeydown: onSettingsSidebarKeydown
} = usePaneResize({
  key: 'settingsSidebarWidth',
  initial: 176,
  min: 150,
  max: () => Math.min(360, Math.max(180, window.innerWidth - 620))
})
const isMaximized = ref(false)
const activeMeta = computed(() => tabMeta[activeTab.value] || { title: '', description: '' })
const tabHistory = ref([])
const tabForwardHistory = ref([])
const canGoBackTab = computed(() => tabHistory.value.length > 0)
const canGoForwardTab = computed(() => tabForwardHistory.value.length > 0)

watch(activeTab, async () => {
  await nextTick()
  const el = settingsContentRef.value
  if (!el || typeof el.animate !== 'function') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  el.animate(
    [
      { opacity: 0, transform: 'translateY(3px)' },
      { opacity: 1, transform: 'none' }
    ],
    { duration: 140, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
  )
})

function selectTab(tab) {
  if (tab === activeTab.value) return
  tabHistory.value.push(activeTab.value)
  tabForwardHistory.value = []
  activeTab.value = tab
}

function goBackTab() {
  if (!tabHistory.value.length) return
  tabForwardHistory.value.push(activeTab.value)
  activeTab.value = tabHistory.value.pop()
}

function goForwardTab() {
  if (!tabForwardHistory.value.length) return
  tabHistory.value.push(activeTab.value)
  activeTab.value = tabForwardHistory.value.pop()
}
const theme = ref('system')
const savedTheme = ref('system')
const themeStyle = ref('sapphire')
const savedThemeStyle = ref('sapphire')
const fontSize = ref('medium')
const savedFontSize = ref('medium')
const basePath = ref('')
const developerChName = ref('')
const developerEnName = ref('')
const textEditApp = ref('')
const autoUpdate = ref(true)
const autoStart = ref(false)
const closeAction = ref('ask')

const platform = ref('')
const editorPresets = ref([])
const aiProvider = ref('bailian')
const aiApiKeys = ref({
  bailian: '',
  moonshot: '',
  zhipu: '',
  minimax: '',
  minimax_group_id: '',
  volcengine: '',
  volcengine_endpoint_id: '',
  deepseek: ''
})
const aiProviders = ref([])
const aiBaseUrls = ref({})
const savedApiKeys = ref({})
const savedBaseUrls = ref({})
const aiModels = ref({})
const modelConfigs = ref({})
const initialModelConfigs = ref({})
const modelConfigSources = ref({})
const modelFetching = ref({})
const modelFetchMessage = ref({})
const modelFetchSuccess = ref({})
const providerSaving = ref({})
const expandedProviders = ref({})
const openCustomSettings = ref({})
const expandedModels = ref({})
const modelDrag = ref({ type: '', enabled: false, from: -1, over: -1 })
const databases = ref([])
const scriptTypes = ref([])
const shortcuts = ref({
  settings: 'CmdOrCtrl+,'
})
const version = ref('1.0.0')
const author = ref('lov3smu')
const databaseListRef = ref(null)
const scriptTypeListRef = ref(null)
const configDrag = ref({ list: '', enabled: false, from: -1, over: -1 })
const showApiKey = ref({})
const testingApiKey = ref({})
const apiKeyTestResult = ref({})

const year = computed(() => new Date().getFullYear())

function normalizeModelList(models) {
  return (Array.isArray(models) ? models : [])
    .map((model) => {
      const id = String(model?.id || '').trim()
      if (!id) return null
      const name = String(model?.name || id).trim() || id
      const normalized = { id, name }
      const contextWindow = Number(model?.contextWindow)
      if (Number.isFinite(contextWindow) && contextWindow > 0) {
        normalized.contextWindow = Math.floor(contextWindow)
      }
      const maxOutput = Number(model?.maxOutput)
      if (Number.isFinite(maxOutput) && maxOutput > 0) {
        normalized.maxOutput = Math.floor(maxOutput)
      }
      const inputTypes = Array.isArray(model?.inputTypes)
        ? [...new Set(model.inputTypes.filter((item) => item === 'text' || item === 'image'))]
        : ['text', 'image']
      normalized.inputTypes = inputTypes.length > 0 ? inputTypes : ['text']
      return normalized
    })
    .filter(Boolean)
}

function isSameModelConfig(a, b) {
  if (!a || !b) return false
  return (
    JSON.stringify({ default: a.default || '', models: normalizeModelList(a.models) }) ===
    JSON.stringify({ default: b.default || '', models: normalizeModelList(b.models) })
  )
}

function cloneModelConfig(config) {
  return {
    default: config.default,
    models: config.models.map((model) => ({
      ...model,
      inputTypes: [...(model.inputTypes || [])]
    }))
  }
}

function createProviderModelConfig(provider) {
  const saved = aiModels.value[provider.type]
  if (saved && Array.isArray(saved.models) && saved.models.length > 0) {
    const config = {
      default: saved.default || saved.models[0].id,
      models: normalizeModelList(saved.models)
    }
    return { config, initial: cloneModelConfig(config), source: 'config' }
  }

  const models = normalizeModelList(provider.models)
  const config = {
    default: models.some((model) => model.id === provider.defaultModel) ? provider.defaultModel : models[0]?.id || '',
    models
  }
  return { config, initial: cloneModelConfig(config), source: 'builtin' }
}

function initModelConfigs(providers) {
  const configs = {}
  const initial = {}
  const sources = {}
  for (const provider of providers) {
    const { config, initial: saved, source } = createProviderModelConfig(provider)
    configs[provider.type] = config
    initial[provider.type] = saved
    sources[provider.type] = source
  }
  modelConfigs.value = configs
  initialModelConfigs.value = initial
  modelConfigSources.value = sources
}

function serializeProviderModels(type) {
  const config = modelConfigs.value[type]
  if (!config || config.models.length === 0) return null
  const source = modelConfigSources.value[type]
  const changed = !isSameModelConfig(config, initialModelConfigs.value[type])
  if (source === 'builtin' && !changed) return null
  return {
    default: config.default || config.models[0]?.id || '',
    models: normalizeModelList(config.models)
  }
}

function serializeAiModels() {
  const result = {}
  for (const provider of aiProviders.value) {
    const entry = serializeProviderModels(provider.type)
    if (entry) result[provider.type] = entry
  }
  return result
}

function hasStoredApiKey(type) {
  return Boolean((aiApiKeys.value[type] || '').trim())
}

function isValidBaseUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return true
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function providerName(type) {
  return aiProviders.value.find((provider) => provider.type === type)?.name || type
}

function hasProviderKey(type) {
  if (hasStoredApiKey(type)) return true
  return Boolean(aiProviders.value.find((provider) => provider.type === type)?.hasEnvKey)
}

function isProviderExpanded(type) {
  return Boolean(expandedProviders.value[type])
}

function toggleProviderExpanded(type) {
  expandedProviders.value = { ...expandedProviders.value, [type]: !expandedProviders.value[type] }
}

function setDefaultProvider(type) {
  aiProvider.value = type
  expandedProviders.value = { ...expandedProviders.value, [type]: true }
}

function isCustomSettingsOpen(type) {
  return Boolean(openCustomSettings.value[type])
}

function toggleCustomSettings(type) {
  openCustomSettings.value = { ...openCustomSettings.value, [type]: !openCustomSettings.value[type] }
}

function defaultContextWindow(provider) {
  return Number(provider?.models?.[0]?.contextWindow) || 131072
}

function modelSourceHint(type) {
  const source = modelConfigSources.value[type]
  if (source === 'config') return '正在使用已保存的模型目录'
  if (source === 'custom') return '正在使用在线获取的模型目录'
  return '未自定义模型，正在使用平台内置模型目录'
}

function modelExpandedKey(type, index) {
  return `${type}:${index}`
}

function clearExpandedModels(type) {
  const next = {}
  for (const [key, value] of Object.entries(expandedModels.value)) {
    if (!key.startsWith(`${type}:`)) next[key] = value
  }
  expandedModels.value = next
}

function isModelExpanded(type, index) {
  return Boolean(expandedModels.value[modelExpandedKey(type, index)])
}

function toggleModelExpanded(type, index) {
  const key = modelExpandedKey(type, index)
  expandedModels.value = { ...expandedModels.value, [key]: !expandedModels.value[key] }
}

function currentInputTypes(model) {
  if (!Array.isArray(model.inputTypes) || model.inputTypes.length === 0) return ['text', 'image']
  return model.inputTypes
}

function hasInputType(model, type) {
  return currentInputTypes(model).includes(type)
}

function toggleInputType(model, type) {
  const types = currentInputTypes(model)
  const next = types.includes(type) ? types.filter((item) => item !== type) : [...types, type]
  model.inputTypes = next.length > 0 ? next : ['text']
}

function isModelDragEnabled(type) {
  return modelDrag.value.enabled && modelDrag.value.type === type
}

function isModelDragging(type, index) {
  return modelDrag.value.type === type && modelDrag.value.from === index
}

function isModelDragOver(type, index) {
  const state = modelDrag.value
  return state.type === type && state.from >= 0 && state.over === index && state.from !== index
}

function enableModelDrag(type) {
  modelDrag.value.type = type
  modelDrag.value.enabled = true
}

function startModelDrag(type, index, event) {
  if (!isModelDragEnabled(type)) {
    event.preventDefault()
    return
  }
  modelDrag.value.from = index
  modelDrag.value.over = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function overModelDrag(type, index) {
  if (modelDrag.value.type !== type || modelDrag.value.from < 0) return
  modelDrag.value.over = index
}

function dropModelDrag(type) {
  const state = modelDrag.value
  const config = modelConfigs.value[type]
  if (!config || state.type !== type || state.from < 0) return
  if (state.over >= 0 && state.over < config.models.length && state.from !== state.over) {
    const [moved] = config.models.splice(state.from, 1)
    config.models.splice(state.over, 0, moved)

    const nextExpanded = {}
    for (const [key, value] of Object.entries(expandedModels.value)) {
      const [keyType, keyIndex] = key.split(':')
      if (keyType !== type) {
        nextExpanded[key] = value
        continue
      }
      let index = Number(keyIndex)
      if (index === state.from) {
        index = state.over
      } else if (state.from < state.over && index > state.from && index <= state.over) {
        index -= 1
      } else if (state.from > state.over && index >= state.over && index < state.from) {
        index += 1
      }
      nextExpanded[modelExpandedKey(type, index)] = value
    }
    expandedModels.value = nextExpanded
  }
  endModelDrag(type)
}

function endModelDrag(type) {
  if (modelDrag.value.type !== type) return
  modelDrag.value = { type: '', enabled: false, from: -1, over: -1 }
}

function toggleShowApiKey(type) {
  showApiKey.value = { ...showApiKey.value, [type]: !showApiKey.value[type] }
}

onMounted(async () => {
  removeSettingsTabListener = onSettingsTab((tab) => {
    if (!menuItems.some((item) => item.id === tab)) return
    tabHistory.value = []
    tabForwardHistory.value = []
    activeTab.value = tab
  })

  isMaximized.value = Boolean(await windowIsMaximized())
  removeWindowMaximizedListener = onWindowMaximized((value) => {
    isMaximized.value = Boolean(value)
  })

  platform.value = navigator.platform.toLowerCase()

  if (platform.value.includes('win')) {
    editorPresets.value = [
      { name: 'VS Code', path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe' },
      { name: 'Notepad++', path: 'C:\\Program Files\\Notepad++\\notepad++.exe' },
      { name: 'Sublime Text', path: 'C:\\Program Files\\Sublime Text\\sublime_text.exe' },
      { name: '记事本', path: 'C:\\Windows\\System32\\notepad.exe' }
    ]
  } else if (platform.value.includes('mac')) {
    editorPresets.value = [
      { name: 'VS Code', path: '/Applications/Visual Studio Code.app' },
      { name: 'Sublime Text', path: '/Applications/Sublime Text.app' },
      { name: 'TextEdit', path: '/Applications/TextEdit.app' },
      { name: 'Vim', path: '/usr/bin/vim' }
    ]
  } else {
    editorPresets.value = [
      { name: 'VS Code', path: '/usr/bin/code' },
      { name: 'Vim', path: '/usr/bin/vim' },
      { name: 'Nano', path: '/usr/bin/nano' },
      { name: 'Gedit', path: '/usr/bin/gedit' }
    ]
  }

  const tabParam = route.query.tab
  if (tabParam && menuItems.some((item) => item.id === tabParam)) {
    activeTab.value = tabParam
  }

  const config = await getConfig()
  basePath.value = config.base_path || ''
  developerChName.value = config.developer_ch_name || ''
  developerEnName.value = config.developer_en_name || ''
  textEditApp.value = config.text_edit_app || ''
  autoUpdate.value = config.auto_update !== false
  autoStart.value = config.auto_start === true
  closeAction.value = config.close_action || 'ask'
  theme.value = config.theme || getThemePreference()
  savedTheme.value = theme.value
  applyTheme(theme.value)
  themeStyle.value = normalizeThemeStyle(config.theme_style || getThemeStylePreference())
  savedThemeStyle.value = themeStyle.value
  applyThemeStyle(themeStyle.value)
  fontSize.value = normalizeFontSizePreference(config.font_size || getFontSizePreference())
  savedFontSize.value = fontSize.value
  applyFontSize(fontSize.value)
  window.addEventListener('beforeunload', revertUnsavedTheme)
  aiProvider.value = config.ai_provider || 'bailian'
  aiApiKeys.value = { ...aiApiKeys.value, ...(config.ai_api_keys || {}) }
  aiBaseUrls.value = { ...(config.ai_base_urls || {}) }
  savedApiKeys.value = { ...aiApiKeys.value }
  savedBaseUrls.value = { ...aiBaseUrls.value }
  aiModels.value = config.ai_models && typeof config.ai_models === 'object' ? config.ai_models : {}
  databases.value = (config.databases || []).map((name) => ({ name, error: false }))
  scriptTypes.value = (config.script_types || []).map((st) => ({
    name: st.name,
    description: st.description || '',
    error: false
  }))

  if (config.shortcuts) {
    shortcuts.value = { ...shortcuts.value, ...config.shortcuts }
  }

  if (config.bailian_api_key && !aiApiKeys.value.bailian) {
    aiApiKeys.value.bailian = config.bailian_api_key
  }

  const providers = await getAiProviders()
  aiProviders.value = providers || []
  initModelConfigs(aiProviders.value)
  expandedProviders.value = { [aiProvider.value]: true }
  openCustomSettings.value = Object.fromEntries(
    aiProviders.value.map((provider) => [provider.type, Boolean((aiBaseUrls.value[provider.type] || '').trim())])
  )

  const packageJson = await getPackageInfo()
  if (packageJson.version) version.value = packageJson.version
  if (packageJson.author) {
    let a = packageJson.author
    a = a.replace(/<[^>]*>/g, '').trim()
    author.value = a
  }
})

onUnmounted(() => {
  removeSettingsTabListener?.()
  removeWindowMaximizedListener?.()
  revertUnsavedTheme()
  window.removeEventListener('beforeunload', revertUnsavedTheme)
})

function selectTheme(value) {
  theme.value = value
  applyTheme(value)
}

function selectThemeStyle(value) {
  themeStyle.value = normalizeThemeStyle(value)
  applyThemeStyle(themeStyle.value)
}

function selectFontSize(value) {
  fontSize.value = normalizeFontSizePreference(value)
  applyFontSize(fontSize.value)
}

function revertUnsavedTheme() {
  if (theme.value !== savedTheme.value) applyTheme(savedTheme.value)
  if (themeStyle.value !== savedThemeStyle.value) applyThemeStyle(savedThemeStyle.value)
  if (fontSize.value !== savedFontSize.value) applyFontSize(savedFontSize.value)
}

function isDragEnabled(list) {
  return configDrag.value.enabled && configDrag.value.list === list
}

function isDragging(list, index) {
  return configDrag.value.list === list && configDrag.value.from === index
}

function isDragOver(list, index) {
  const state = configDrag.value
  return state.list === list && state.from >= 0 && state.over === index && state.from !== index
}

function enableConfigDrag(list) {
  configDrag.value.list = list
  configDrag.value.enabled = true
}

function startConfigDrag(list, index, event) {
  if (!isDragEnabled(list)) {
    event.preventDefault()
    return
  }
  configDrag.value.from = index
  configDrag.value.over = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function overConfigDrag(list, index) {
  if (configDrag.value.list !== list || configDrag.value.from < 0) return
  configDrag.value.over = index
}

function dropConfigDrag(list) {
  const state = configDrag.value
  if (state.list !== list || state.from < 0) return
  const items = list === 'database' ? databases.value : scriptTypes.value
  if (state.over >= 0 && state.over < items.length && state.from !== state.over) {
    const [moved] = items.splice(state.from, 1)
    items.splice(state.over, 0, moved)
  }
  endConfigDrag(list)
}

function endConfigDrag(list) {
  if (configDrag.value.list !== list) return
  configDrag.value = { list: '', enabled: false, from: -1, over: -1 }
}

async function addDatabase() {
  databases.value.push({ name: '', error: false })
  await nextTick()
  if (databaseListRef.value) {
    const items = databaseListRef.value.querySelectorAll('.config-item')
    const lastItem = items[items.length - 1]
    if (lastItem) {
      lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const input = lastItem.querySelector('input')
      if (input) input.focus()
    }
  }
}

function removeDatabase(index) {
  databases.value.splice(index, 1)
}

async function addScriptType() {
  scriptTypes.value.push({ name: '', description: '', error: false })
  await nextTick()
  if (scriptTypeListRef.value) {
    const items = scriptTypeListRef.value.querySelectorAll('.config-item')
    const lastItem = items[items.length - 1]
    if (lastItem) {
      lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const input = lastItem.querySelector('input')
      if (input) input.focus()
    }
  }
}

function removeScriptType(index) {
  scriptTypes.value.splice(index, 1)
}

async function selectDir() {
  const path = await selectDirectory()
  if (path) basePath.value = path
}

async function selectEditor() {
  const path = await selectFile()
  if (path) textEditApp.value = path
}

function validate() {
  let isValid = true
  let errorMessage = ''

  databases.value.forEach((db) => (db.error = false))
  scriptTypes.value.forEach((st) => (st.error = false))

  const dbNames = []
  for (const db of databases.value) {
    const name = db.name.trim()
    if (!name) {
      db.error = true
      isValid = false
      errorMessage = '数据库名称不能为空'
      break
    }
    if (dbNames.includes(name)) {
      db.error = true
      isValid = false
      errorMessage = `数据库名称 "${name}" 重复`
      break
    }
    dbNames.push(name)
  }

  if (!isValid) {
    showError(errorMessage)
    return false
  }

  const typeNames = []
  for (const st of scriptTypes.value) {
    const name = st.name.trim()
    if (!name) {
      st.error = true
      isValid = false
      errorMessage = '脚本类型名称不能为空'
      break
    }
    if (typeNames.includes(name)) {
      st.error = true
      isValid = false
      errorMessage = `脚本类型名称 "${name}" 重复`
      break
    }
    typeNames.push(name)
  }

  if (!isValid) {
    showError(errorMessage)
    return false
  }

  return true
}

async function save() {
  if (!validate()) return

  const invalidBaseUrl = Object.entries(aiBaseUrls.value).find(([, value]) => !isValidBaseUrl(value))
  if (invalidBaseUrl) {
    showError(`${providerName(invalidBaseUrl[0])} 的 API 地址必须是有效的 http(s) URL`)
    return
  }

  const config = {
    base_path: basePath.value,
    developer_ch_name: developerChName.value,
    developer_en_name: developerEnName.value,
    text_edit_app: textEditApp.value,
    auto_update: autoUpdate.value,
    auto_start: autoStart.value,
    close_action: closeAction.value,
    theme: theme.value,
    theme_style: themeStyle.value,
    font_size: fontSize.value,
    ai_provider: aiProvider.value,
    ai_api_keys: { ...aiApiKeys.value },
    ai_base_urls: { ...aiBaseUrls.value },
    ai_models: serializeAiModels(),
    databases: databases.value.map((db) => db.name.trim()).filter(Boolean),
    script_types: scriptTypes.value
      .map((st) => ({
        name: st.name.trim(),
        description: st.description.trim()
      }))
      .filter((st) => st.name),
    shortcuts: { ...shortcuts.value }
  }

  try {
    const success = await saveConfig(config)
    if (success) {
      savedTheme.value = theme.value
      savedThemeStyle.value = themeStyle.value
      savedFontSize.value = fontSize.value
      await setAutoStart(autoStart.value)
      await reloadConfig()
      await reloadMenu()
      closeSettingsWindow()
    } else {
      showError('保存失败，请检查配置')
    }
  } catch (e) {
    showError('保存失败: ' + e.message)
  }
}

function minimizeWindow() {
  windowMinimize()
}

async function toggleMaximizeWindow() {
  isMaximized.value = Boolean(await windowToggleMaximize())
}

function closeWindow() {
  revertUnsavedTheme()
  windowClose()
}

function leaveSettings() {
  revertUnsavedTheme()
  returnToApp()
}

async function checkUpdate() {
  await openUpdateCenter()
}

async function testApiKey(provider) {
  const type = provider.type
  const apiKey = (aiApiKeys.value[type] || '').trim()
  if (!apiKey && !provider.hasEnvKey) return

  testingApiKey.value = { ...testingApiKey.value, [type]: true }
  apiKeyTestResult.value = { ...apiKeyTestResult.value, [type]: null }

  try {
    const isValid = await validateApiKey(type, apiKey, {
      baseUrl: (aiBaseUrls.value[type] || '').trim()
    })
    apiKeyTestResult.value = {
      ...apiKeyTestResult.value,
      [type]: isValid
        ? { success: true, message: `${provider.name} 验证成功` }
        : { success: false, message: `${provider.name} 验证失败，请检查密钥是否正确` }
    }
  } catch (e) {
    apiKeyTestResult.value = {
      ...apiKeyTestResult.value,
      [type]: { success: false, message: '验证失败: ' + e.message }
    }
  }

  testingApiKey.value = { ...testingApiKey.value, [type]: false }
}

function setModelFetchState(type, state) {
  if (state.fetching !== undefined) {
    modelFetching.value = { ...modelFetching.value, [type]: Boolean(state.fetching) }
  }
  if (state.success !== undefined) {
    modelFetchSuccess.value = { ...modelFetchSuccess.value, [type]: state.success }
  }
  if (state.message !== undefined) {
    modelFetchMessage.value = { ...modelFetchMessage.value, [type]: state.message }
  }
}

function mergeRemoteModels(remoteModels, previousModels) {
  return normalizeModelList(
    remoteModels.map((model) => {
      const existing = previousModels.find((item) => item.id === model.id)
      if (!existing) return model
      return {
        ...model,
        name: existing.name || model.name,
        contextWindow: existing.contextWindow,
        maxOutput: existing.maxOutput,
        inputTypes: existing.inputTypes
      }
    })
  )
}

async function refreshModels(provider) {
  const type = provider.type
  const apiKey = (aiApiKeys.value[type] || '').trim()
  if (!apiKey && !provider.hasEnvKey) {
    setModelFetchState(type, { success: false, message: '请先填写 API Key 或设置环境变量，再获取最新模型' })
    return
  }

  setModelFetchState(type, { fetching: true, message: '' })

  try {
    const result = await getProviderModels(type, {
      apiKey,
      baseUrl: (aiBaseUrls.value[type] || '').trim(),
      refresh: true
    })
    if (Array.isArray(result)) {
      setModelFetchState(type, {
        fetching: false,
        success: false,
        message: '主进程仍在运行旧版本，请重启应用后再获取最新模型'
      })
      return
    }
    if (!result?.success) {
      setModelFetchState(type, {
        fetching: false,
        success: false,
        message: result?.error || `${provider.name} 模型获取失败，请检查 API Key、网络或平台接口状态`
      })
      return
    }

    const config = modelConfigs.value[type]
    const models = mergeRemoteModels(result.models, config.models)
    if (models.length === 0) {
      setModelFetchState(type, { fetching: false, success: false, message: '未获取到可用模型' })
      return
    }

    const keepDefault = models.some((model) => model.id === config.default)
    config.models = models
    config.default = keepDefault ? config.default : result.defaultModel || models[0].id
    modelConfigSources.value = { ...modelConfigSources.value, [type]: 'custom' }
    clearExpandedModels(type)
    setModelFetchState(type, { fetching: false, success: true, message: `已获取 ${models.length} 个可用模型` })
  } catch (e) {
    setModelFetchState(type, {
      fetching: false,
      success: false,
      message: `获取 ${provider.name} 模型失败: ` + e.message
    })
  }
}

async function resetModels(provider) {
  const type = provider.type
  setModelFetchState(type, { fetching: true, message: '' })

  try {
    const result = await getProviderModels(type, { defaults: true })
    if (!result?.success) {
      setModelFetchState(type, {
        fetching: false,
        success: false,
        message: result?.error || '恢复内置模型失败'
      })
      return
    }

    const fallbackWindow = defaultContextWindow(provider)
    const models = normalizeModelList(
      result.models.map((model) => ({
        ...model,
        contextWindow: model.contextWindow || fallbackWindow
      }))
    )
    modelConfigs.value[type] = {
      default: result.defaultModel || models[0]?.id || '',
      models
    }
    modelConfigSources.value = { ...modelConfigSources.value, [type]: 'builtin' }
    clearExpandedModels(type)
    setModelFetchState(type, { fetching: false, success: true, message: '已恢复内置模型列表' })
  } catch (e) {
    setModelFetchState(type, {
      fetching: false,
      success: false,
      message: '恢复内置模型失败: ' + e.message
    })
  }
}

function addModel(type) {
  const config = modelConfigs.value[type]
  if (!config) return
  config.models.push({ id: '', name: '', inputTypes: ['text', 'image'] })
  expandedModels.value = {
    ...expandedModels.value,
    [modelExpandedKey(type, config.models.length - 1)]: true
  }
}

function removeModel(type, index) {
  const config = modelConfigs.value[type]
  if (!config) return

  const [removed] = config.models.splice(index, 1)
  if (removed?.id === config.default) {
    config.default = config.models.find((model) => model.id)?.id || ''
  }

  const nextExpanded = {}
  for (const [key, value] of Object.entries(expandedModels.value)) {
    const [keyType, keyIndex] = key.split(':')
    if (keyType !== type) {
      nextExpanded[key] = value
      continue
    }
    const expandedIndex = Number(keyIndex)
    if (expandedIndex < index) nextExpanded[key] = value
    else if (expandedIndex > index) nextExpanded[modelExpandedKey(type, expandedIndex - 1)] = value
  }
  expandedModels.value = nextExpanded
}

async function saveProviderCard(provider) {
  const type = provider.type
  const config = modelConfigs.value[type]
  if (!config) return

  const baseUrl = (aiBaseUrls.value[type] || '').trim()
  if (!isValidBaseUrl(baseUrl)) {
    showError(`${provider.name} 的 API 地址必须是有效的 http(s) URL`)
    return
  }

  const models = normalizeModelList(config.models)
  if (models.length === 0) {
    showError('请至少保留一个模型')
    return
  }
  const duplicate = models.find((model, index) => models.findIndex((item) => item.id === model.id) !== index)
  if (duplicate) {
    showError(`模型 ID "${duplicate.id}" 重复`)
    return
  }

  config.models = models
  if (!models.some((model) => model.id === config.default)) {
    config.default = models[0].id
  }

  const nextModels = { ...aiModels.value }
  const storedModels = serializeProviderModels(type)
  if (storedModels) nextModels[type] = storedModels
  else delete nextModels[type]

  const nextApiKeys = { ...savedApiKeys.value, [type]: (aiApiKeys.value[type] || '').trim() }
  const nextBaseUrls = { ...savedBaseUrls.value }
  if (baseUrl) nextBaseUrls[type] = baseUrl.replace(/\/+$/, '')
  else delete nextBaseUrls[type]

  providerSaving.value = { ...providerSaving.value, [type]: true }
  try {
    const success = await saveConfig({
      ai_api_keys: nextApiKeys,
      ai_base_urls: nextBaseUrls,
      ai_models: nextModels
    })
    if (!success) {
      showError('保存失败，请检查配置')
      return
    }

    savedApiKeys.value = nextApiKeys
    savedBaseUrls.value = nextBaseUrls
    aiModels.value = nextModels
    await reloadConfig()

    const providers = await getAiProviders()
    if (Array.isArray(providers) && providers.length > 0) aiProviders.value = providers

    const savedProvider = aiProviders.value.find((item) => item.type === type) || provider
    const { config: savedConfig, initial: savedInitial, source } = createProviderModelConfig(savedProvider)
    modelConfigs.value = { ...modelConfigs.value, [type]: savedConfig }
    initialModelConfigs.value = { ...initialModelConfigs.value, [type]: savedInitial }
    modelConfigSources.value = { ...modelConfigSources.value, [type]: source }
    clearExpandedModels(type)
    showSuccess(`${provider.name} 配置已保存`)
  } catch (e) {
    showError('保存失败: ' + e.message)
  } finally {
    providerSaving.value = { ...providerSaving.value, [type]: false }
  }
}

function cancelProviderCard(provider) {
  const type = provider.type

  aiApiKeys.value = { ...aiApiKeys.value, [type]: savedApiKeys.value[type] || '' }
  aiBaseUrls.value = { ...aiBaseUrls.value, [type]: savedBaseUrls.value[type] || '' }

  const saved = aiModels.value[type]
  if (saved && Array.isArray(saved.models) && saved.models.length > 0) {
    modelConfigs.value[type] = {
      default: saved.default || saved.models[0].id,
      models: normalizeModelList(saved.models)
    }
    modelConfigSources.value = { ...modelConfigSources.value, [type]: 'config' }
  } else {
    const models = normalizeModelList(provider.models)
    const defaultModel = provider.defaultModel
    modelConfigs.value[type] = {
      default: models.some((model) => model.id === defaultModel) ? defaultModel : models[0]?.id || '',
      models
    }
    modelConfigSources.value = { ...modelConfigSources.value, [type]: 'builtin' }
  }

  setModelFetchState(type, { fetching: false, message: '' })
  apiKeyTestResult.value = { ...apiKeyTestResult.value, [type]: null }
  clearExpandedModels(type)
}

function onProviderChange() {
  expandedProviders.value = { ...expandedProviders.value, [aiProvider.value]: true }
}

function openProviderDocs(provider) {
  if (provider?.docsUrl) {
    openExternal(provider.docsUrl)
  }
}
</script>

<style scoped>
.settings-layout {
  --settings-sidebar-width: 176px;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: var(--surface);
  overflow: hidden;
}

.settings-layout.menu-collapsed {
  --settings-sidebar-width: 84px;
}

.settings-topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  flex-shrink: 0;
  padding: 0 0 0 12px;
  background: var(--shell-titlebar-bg);
  border-bottom: 1px solid var(--shell-border);
  color: var(--shell-text);
  user-select: none;
  -webkit-app-region: drag;
}

.settings-topbar.platform-darwin {
  padding-left: 84px;
}

.settings-window-controls {
  display: flex;
  align-items: center;
  align-self: stretch;
  margin-left: auto;
  -webkit-app-region: no-drag;
}

.settings-window-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--shell-text-muted);
  cursor: pointer;
  transition: var(--transition-fast);
}

.settings-window-control:hover {
  background: var(--shell-hover-bg);
  color: var(--shell-text-strong);
}

.settings-window-control:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.settings-window-control.close:hover {
  background: #e81123;
  color: #fff;
}

.settings-window-control svg {
  width: 14px;
  height: 14px;
}

.settings-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.settings-sidebar {
  width: var(--settings-sidebar-width);
  background: var(--shell-sidebar-bg);
  border-right: 1px solid var(--shell-border);
  padding: 10px 8px;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.settings-layout.is-resizing .settings-sidebar {
  transition: none;
}

.settings-nav {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.settings-nav-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--shell-text-muted);
  cursor: pointer;
  transition: var(--transition-fast);
}

.settings-nav-tool:hover:not(:disabled) {
  background: var(--shell-hover-bg);
  color: var(--shell-text-strong);
}

.settings-nav-tool:disabled {
  opacity: 0.35;
  cursor: default;
}

.settings-nav-tool:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.settings-nav-tool svg {
  width: 16px;
  height: 16px;
}

.settings-nav-collapse-icon {
  transition: transform 0.22s;
}

.settings-nav-collapse-icon.collapsed {
  transform: rotate(180deg);
}

.settings-layout.menu-collapsed .settings-sidebar {
  padding: 10px 4px;
}

.settings-layout.menu-collapsed .menu-text {
  display: none;
}

.settings-layout.menu-collapsed .settings-menu-item {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}

.settings-menu-item {
  padding: 7px 10px;
  margin-bottom: 2px;
  cursor: pointer;
  font-size: var(--font-size-dense);
  color: var(--shell-text);
  display: flex;
  align-items: center;
  gap: 9px;
  border-radius: var(--radius-sm);
  transition:
    background 0.15s,
    color 0.15s;
}

.menu-icon {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-icon svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
}

.menu-text {
  flex: 1;
  font-weight: 500;
}

.settings-menu-item:hover {
  background: var(--shell-hover-bg);
  color: var(--shell-text-strong);
}

.settings-menu-item.active {
  background: var(--shell-active-bg);
  color: var(--shell-active-text);
}

.settings-menu-divider {
  height: 1px;
  margin: 6px 2px 8px;
  background: var(--shell-divider);
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface);
}

.settings-content {
  flex: 1;
  padding: 18px 20px 24px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.settings-page-head {
  max-width: 1120px;
  margin: 0 auto 14px;
}

.settings-page-title h2 {
  margin: 0 0 4px;
  font-size: var(--font-size-md);
  font-weight: 650;
  color: var(--text-primary);
}

.settings-page-title p {
  margin: 0;
  max-width: 560px;
  font-size: var(--font-size-sm);
  line-height: 1.55;
  color: var(--text-secondary);
}

.settings-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 1120px;
  margin: 0 auto;
}

.settings-tab.extensions-tab {
  display: block;
  max-width: 1120px;
}

.form-group {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  transition: var(--transition-fast);
}

.form-group:hover {
  border-color: var(--border-strong);
}

.form-group > label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 650;
  color: var(--text-primary);
  margin-bottom: 10px;
  font-size: var(--font-size-dense);
}

.form-group > label input[type='checkbox'] {
  margin-right: 6px;
  accent-color: var(--accent-color);
}

.input-field {
  width: 100%;
}

.input-field.error {
  border-color: var(--error-dark);
}

.path-input-group {
  display: flex;
  gap: 8px;
}

.path-input-group .input-field {
  flex: 1;
}

.select-field {
  width: 100%;
  max-width: 320px;
}

.setting-hint {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin-top: 6px;
}

.setting-hint a {
  color: var(--accent-color);
  text-decoration: none;
}

.setting-hint a:hover {
  text-decoration: underline;
}

.config-list {
  margin-bottom: 10px;
  max-height: none;
  overflow-y: visible;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 8px;
  background: var(--surface-muted);
}

.config-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 24px;
  color: var(--text-tertiary);
  cursor: grab;
  user-select: none;
}

.config-drag-handle svg {
  width: 14px;
  height: 14px;
}

.config-drag-handle:hover {
  color: var(--text-secondary);
}

.config-drag-handle:active {
  cursor: grabbing;
}

.config-item.dragging {
  opacity: 0.45;
}

.config-item.drag-over {
  border-color: var(--accent-color);
  box-shadow: inset 2px 0 0 var(--accent-color);
}

.config-item {
  background: var(--surface);
  padding: 8px;
  margin-bottom: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--border-color);
  gap: 8px;
}

.config-item:hover {
  border-color: var(--border-strong);
}

.config-item:last-child {
  margin-bottom: 0;
}

.config-item-info {
  flex: 1;
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
  min-width: 0;
}

.config-item-actions {
  flex-shrink: 0;
}

.settings-footer {
  padding: 10px max(20px, calc((100% - 1120px) / 2));
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
  flex-shrink: 0;
}

.settings-footer .btn {
  min-width: 84px;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 148px));
  gap: 10px;
}

.palette-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.palette-option {
  padding: 8px;
}

.palette-preview {
  display: flex;
  width: 100%;
  height: 52px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--swatch-app);
}

.palette-sidebar {
  width: 24%;
  flex-shrink: 0;
  background: var(--swatch-sidebar);
}

.palette-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 9px;
  background: var(--swatch-surface);
}

.palette-bar {
  width: 70%;
  height: 5px;
  border-radius: 2px;
  background: rgba(120, 120, 120, 0.32);
}

.palette-accent {
  width: 48%;
  height: 10px;
  border-radius: 5px;
  background: var(--swatch-accent);
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.theme-option:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  color: var(--text-primary);
}

.theme-option.active {
  border-color: var(--accent-color);
  color: var(--text-primary);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.14);
}

.theme-preview {
  display: flex;
  width: 100%;
  height: 56px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: #f4f5f7;
}

.theme-preview-light {
  background: #f4f5f7;
}

.theme-preview-dark {
  background: #141519;
}

.theme-preview-system {
  background: linear-gradient(90deg, #f4f5f7 0 50%, #141519 50% 100%);
}

.preview-sidebar {
  width: 22%;
  flex-shrink: 0;
  background: #1b1b1f;
}

.preview-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.preview-bar {
  height: 8px;
  border-radius: 2px;
  background: rgba(128, 128, 128, 0.45);
}

.preview-line {
  width: 82%;
  height: 5px;
  border-radius: 2px;
  background: rgba(128, 128, 128, 0.3);
}

.preview-line-short {
  width: 56%;
}

.theme-label {
  font-weight: 500;
}

.about-section {
  text-align: center;
  padding: 32px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.about-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.about-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: white;
}

.about-name {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.about-version {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin-bottom: 16px;
  font-weight: 500;
}

.about-description {
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.7;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.about-author {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.about-copyright {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin-bottom: 20px;
}

.about-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.shortcut-list {
  margin-bottom: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 4px 12px;
  background: var(--surface-muted);
}

.shortcut-item {
  display: flex;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid var(--border-color);
}

.shortcut-item:last-child {
  border-bottom: none;
}

.shortcut-name {
  flex: 1;
  font-size: var(--font-size-dense);
  color: var(--text-primary);
  font-weight: 500;
}

.shortcut-input {
  width: 190px;
  font-size: var(--font-size-sm);
  text-align: center;
}

.api-key-input-group {
  display: flex;
  gap: 8px;
}

.api-key-input-group .input-field {
  flex: 1;
}

.api-test-result {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.api-test-result.success {
  background: rgba(var(--success-rgb), 0.1);
  color: var(--success-dark);
  border: 1px solid rgba(var(--success-rgb), 0.3);
}

.api-test-result.error {
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
  border: 1px solid rgba(var(--error-rgb), 0.3);
}

.provider-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
  transition: var(--transition-fast);
}

.provider-card:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
}

.provider-card.expanded {
  border-color: rgba(var(--accent-rgb), 0.35);
  box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.08));
}

.provider-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}

.provider-card-header:hover {
  background: var(--surface-hover);
}

.provider-card.expanded .provider-card-header {
  border-bottom: 1px solid var(--border-color);
}

.provider-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.provider-name {
  font-size: var(--font-size-dense);
  font-weight: 600;
  color: var(--text-primary);
}

.provider-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.provider-header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
}

.provider-chevron {
  color: var(--text-tertiary);
  transition: transform 0.18s ease;
}

.provider-chevron.rotated {
  transform: rotate(180deg);
}

.provider-chevron.small.rotated {
  transform: rotate(90deg);
}

.provider-tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.provider-tag.configured {
  color: var(--success-dark);
  border-color: rgba(var(--success-rgb), 0.35);
  background: rgba(var(--success-rgb), 0.1);
}

.provider-tag.custom {
  color: var(--warning-darker);
  border-color: rgba(var(--warning-rgb), 0.35);
  background: rgba(var(--warning-rgb), 0.1);
}

.provider-tag.default {
  color: var(--accent-color);
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.1);
}

.link-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-color);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.provider-card-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.provider-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-label-row > label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.field-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1;
  cursor: help;
}

.provider-card .api-key-input-group .input-field {
  min-width: 0;
}

.env-status {
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.env-status.detected {
  background: rgba(var(--success-rgb), 0.08);
  border-color: rgba(var(--success-rgb), 0.3);
  color: var(--success-dark);
}

.env-status.missing {
  background: rgba(var(--warning-rgb), 0.1);
  border-color: rgba(var(--warning-rgb), 0.35);
  color: var(--warning-darker);
}

.custom-settings {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.custom-settings-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}

.custom-settings-toggle:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.custom-settings-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--border-color);
}

.custom-settings-body > label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.model-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.model-config-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.model-default-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.model-default-row > label {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.model-default-row .select-field {
  flex: 1;
  min-width: 0;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.model-item {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  transition: var(--transition-fast);
}

.model-item.dragging {
  opacity: 0.5;
}

.model-item.drag-over {
  border-color: var(--accent-color);
}

.model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}

.model-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  color: var(--text-tertiary);
  cursor: grab;
}

.model-drag-handle svg {
  width: 14px;
  height: 14px;
}

.model-row .model-id {
  flex: 3;
  min-width: 0;
}

.model-row .model-name {
  flex: 2;
  min-width: 0;
}

.model-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.model-icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.model-icon-btn.danger:hover {
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
}

.model-advanced {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 10px 12px 12px 34px;
  border-top: 1px dashed var(--border-color);
}

.advanced-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.advanced-field > label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.input-type-options {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 32px;
}

.checkbox-field {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.checkbox-field input {
  accent-color: var(--accent-color);
}

.add-model-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.add-model-btn:hover {
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.05);
  color: var(--accent-color);
}

.model-empty {
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  text-align: center;
}

.provider-card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 900px) {
  .model-advanced {
    grid-template-columns: 1fr;
  }
}
</style>
