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
          :title="menuCollapsed ? t('展开菜单') : t('收起菜单')"
          :aria-label="menuCollapsed ? t('展开菜单') : t('收起菜单')"
          @click="menuCollapsed = !menuCollapsed"
        >
          <svg
            class="settings-nav-collapse-icon"
            :class="{ collapsed: menuCollapsed }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
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
          :title="t('返回上一页')"
          :aria-label="t('返回上一页')"
          :disabled="!canGoBackTab"
          @click="goBackTab"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
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
          :title="t('前进下一页')"
          :aria-label="t('前进下一页')"
          :disabled="!canGoForwardTab"
          @click="goForwardTab"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
      <WindowControls v-if="!isMac" @minimize="minimizeWindow" @maximize="toggleMaximizeWindow" @close="closeWindow" />
    </header>

    <div class="settings-body">
      <aside class="settings-sidebar">
        <div class="settings-menu-item settings-return" :title="t('返回应用')" @click="leaveSettings">
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
          <span class="menu-text">{{ t('返回应用') }}</span>
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
              v-else-if="item.id === 'database-client'"
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
              v-else-if="item.id === 'sql-generator'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            <svg
              v-else-if="item.id === 'image-hosting'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
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
              v-else-if="item.id === 'assistant'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="4" y="8" width="16" height="12" rx="3" />
              <path d="M12 4v4M8 14h.01M16 14h.01M9 17h6" />
            </svg>
            <svg
              v-else-if="item.id === 'network'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
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
          <span class="menu-text">{{ t(item.text) }}</span>
        </div>
      </aside>
      <SplitHandle
        v-if="!menuCollapsed"
        orientation="vertical"
        :resizing="settingsSidebarResizing"
        :label="t('拖动调整设置菜单宽度')"
        @pointerdown="startSettingsSidebarResize"
        @keydown="onSettingsSidebarKeydown"
      />

      <div class="settings-main">
        <div ref="settingsContentRef" class="settings-content" @focusout="onSettingsFocusOut">
          <div v-if="activeTab !== 'extensions'" class="settings-page-head">
            <div class="settings-page-title">
              <h2>{{ activeMeta.title }}</h2>
              <p>{{ t(activeMeta.description) }}</p>
            </div>
          </div>

          <div v-show="activeTab === 'general'" class="settings-tab">
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('界面') }}</h3>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('语言') }}</span>
                    <span class="setting-row-desc">{{ t('界面显示语言，切换后立即生效') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect v-model="language" :options="languageOptions" :placeholder="t('选择语言')" />
                  </div>
                </div>
              </div>
            </section>
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('启动与窗口') }}</h3>
                <span class="setting-section-desc">{{ t('应用启动、更新检查，以及点击关闭按钮时的默认行为') }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('有更新时自动更新') }}</span>
                    <span class="setting-row-desc">{{ t('开启后，应用会自动下载并安装新版本') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="autoUpdate" type="checkbox" class="switch" />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('检查更新间隔') }}</span>
                    <span class="setting-row-desc">{{ t('应用运行期间按此间隔自动检查新版本') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="updateCheckInterval"
                      :options="updateCheckIntervalOptions"
                      :disabled="!autoUpdate"
                      :placeholder="t('选择间隔')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('开机自动启动') }}</span>
                    <span class="setting-row-desc">{{ t('开启后，系统启动时会自动运行本应用') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="autoStart" type="checkbox" class="switch" />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('关闭行为') }}</span>
                    <span class="setting-row-desc">{{ t('点击关闭按钮时默认执行的窗口操作') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="closeAction"
                      :options="closeActionOptions"
                      :placeholder="t('选择关闭行为')"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('系统通知') }}</h3>
              </div>
              <div class="setting-section-body">
                <div v-for="item in notificationItems" :key="item.key" class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t(item.label) }}</span>
                    <span class="setting-row-desc">{{ t(item.hint) }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="notifications[item.key]" type="checkbox" class="switch" />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('数据与隐私') }}</h3>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('剪贴板历史持久化') }}</span>
                    <span class="setting-row-desc">
                      {{ t('开启后历史会保存到本地，重启应用后仍可查看；关闭后仅保留本次运行的记录') }}
                    </span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="clipboardPersist" type="checkbox" class="switch" />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('保留条数') }}</span>
                    <span class="setting-row-desc">{{ t('超出后自动清理最早的记录，置顶记录不受影响') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="clipboardMaxEntriesModel"
                      :options="clipboardLimitOptions"
                      :disabled="!clipboardPersist"
                      :placeholder="t('选择条数')"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div v-show="activeTab === 'appearance'" class="settings-tab">
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('主题') }}</h3>
              </div>
              <div class="setting-section-body">
                <div class="setting-row is-block">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('主题模式') }}</span>
                    <span class="setting-row-desc">{{
                      t('选择“跟随系统”时，会随操作系统的深色/浅色设置自动切换')
                    }}</span>
                  </div>
                  <div class="setting-row-control">
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
                        <span class="theme-label">{{ t(option.label) }}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="setting-row is-block">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('主题配色') }}</span>
                    <span class="setting-row-desc">{{
                      t('配色会同时作用于按钮、文字和背景，并自动适配明暗模式')
                    }}</span>
                  </div>
                  <div class="setting-row-control">
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
                        <span class="theme-label">{{ t(option.label) }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('显示') }}</h3>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('字体大小') }}</span>
                    <span class="setting-row-desc">{{ t('调整界面与内容区文字大小，图标和控件尺寸保持不变') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      :model-value="fontSize"
                      :options="fontSizeOptions"
                      :placeholder="t('选择字号')"
                      @update:model-value="selectFontSize"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('最近使用工具数') }}</span>
                    <span class="setting-row-desc">{{ t('首页「最近使用」区域展示的工具数量') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="recentToolsLimit"
                      :options="recentToolsLimitOptions"
                      :placeholder="t('选择数量')"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div v-show="activeTab === 'api'" class="settings-tab api-settings">
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('对话设置') }}</h3>
                <span class="setting-section-desc">{{
                  t('聊天页新会话默认使用的模型，以及单次请求的等待时间；选择后自动保存')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('默认对话模型') }}</span>
                    <span class="setting-row-desc">{{
                      t('仅在已配置密钥的服务商中选择；不可用时回退到其他已配置服务商')
                    }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="aiProviderModel"
                      :options="chatModelOptions"
                      :placeholder="t('跟随已配置的服务商')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('请求超时') }}</span>
                    <span class="setting-row-desc">{{
                      t('单次对话或工具调用等待响应的最长时间，超时会中断并提示错误')
                    }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect v-model="aiTimeout" :options="aiTimeoutOptions" :placeholder="t('选择超时时间')" />
                  </div>
                </div>
              </div>
            </section>

            <div class="provider-cards">
              <div v-if="visibleProviders.length === 0" class="provider-empty">
                {{ t('尚未添加模型服务商，可通过下方按钮添加') }}
              </div>
              <div
                v-for="provider in visibleProviders"
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
                    <span class="provider-name">{{ t(provider.name) }}</span>
                    <span class="provider-id">{{ provider.type }}</span>
                    <span class="provider-tag" :class="{ configured: hasProviderKey(provider.type) }">
                      {{ hasProviderKey(provider.type) ? t('已配置') : t('未配置') }}
                    </span>
                    <span v-if="provider.type === aiProvider" class="provider-tag default-chat">{{
                      t('默认对话')
                    }}</span>
                    <span v-if="aiBaseUrls[provider.type]" class="provider-tag custom">{{ t('自定义地址') }}</span>
                  </div>
                  <div class="provider-header-actions">
                    <button
                      v-if="provider.docsUrl"
                      type="button"
                      class="link-btn"
                      @click.stop="openProviderDocs(provider)"
                    >
                      {{ t('服务商文档') }}
                    </button>
                    <button
                      type="button"
                      class="provider-edit-btn"
                      :aria-expanded="isProviderExpanded(provider.type)"
                      @click.stop="toggleProviderExpanded(provider.type)"
                    >
                      {{ isProviderExpanded(provider.type) ? t('收起') : t('编辑') }}
                      <svg
                        class="provider-chevron"
                        :class="{ rotated: isProviderExpanded(provider.type) }"
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div
                  class="provider-collapse"
                  :class="{ open: isProviderExpanded(provider.type) }"
                  :inert="isProviderExpanded(provider.type) ? null : ''"
                  :aria-hidden="isProviderExpanded(provider.type) ? 'false' : 'true'"
                >
                  <div class="provider-collapse-inner">
                    <div class="provider-card-body">
                      <div class="provider-field">
                        <div class="setting-row">
                          <div class="setting-row-text">
                            <span class="setting-row-label">{{ t('API 密钥') }}</span>
                            <span class="setting-row-desc">
                              {{
                                provider.envKey
                                  ? t('留空时会读取 {envKey} 环境变量', { envKey: provider.envKey })
                                  : t('填写服务商控制台生成的 API 密钥')
                              }}
                            </span>
                          </div>
                          <div class="setting-row-control">
                            <div class="api-key-input-group">
                              <input
                                v-model="aiApiKeys[provider.type]"
                                :type="showApiKey[provider.type] ? 'text' : 'password'"
                                class="input-field"
                                :placeholder="
                                  provider.hasEnvKey
                                    ? t('已通过 {envKey} 提供', { envKey: provider.envKey })
                                    : t('输入 {provider} API Key', { provider: t(provider.name) })
                                "
                              />
                              <button class="btn btn-secondary" @click="toggleShowApiKey(provider.type)">
                                {{ showApiKey[provider.type] ? t('隐藏') : t('显示') }}
                              </button>
                              <button
                                class="btn btn-primary"
                                :disabled="
                                  (!hasStoredApiKey(provider.type) && !provider.hasEnvKey) ||
                                  testingApiKey[provider.type]
                                "
                                @click="testApiKey(provider)"
                              >
                                {{ testingApiKey[provider.type] ? t('验证中...') : t('验证') }}
                              </button>
                            </div>
                          </div>
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
                              ? t('已检测到环境变量 {envKey}，无需填写密钥', { envKey: provider.envKey })
                              : t('未检测到环境变量 {envKey}，请填写密钥或先设置环境变量', { envKey: provider.envKey })
                          }}
                        </div>
                      </div>

                      <div class="custom-settings">
                        <button
                          type="button"
                          class="custom-settings-toggle"
                          @click="toggleCustomSettings(provider.type)"
                        >
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
                          <span>{{ t('自定义设置') }}</span>
                        </button>
                        <div v-if="isCustomSettingsOpen(provider.type)" class="custom-settings-body">
                          <div class="setting-row">
                            <div class="setting-row-text">
                              <span class="setting-row-label">{{ t('API 地址') }}</span>
                              <span class="setting-row-desc">{{
                                t('使用 OpenAI 兼容协议，留空则使用服务商默认地址')
                              }}</span>
                            </div>
                            <div class="setting-row-control">
                              <input
                                v-model="aiBaseUrls[provider.type]"
                                class="input-field"
                                :placeholder="provider.defaultBaseUrl"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="model-section">
                        <div class="model-section-header">
                          <div class="field-label-col">
                            <label>{{ t('模型目录') }}</label>
                            <span class="setting-row-desc">{{
                              t('模型列表用于聊天时选择；可手动增删并配置高级参数')
                            }}</span>
                          </div>
                          <div class="model-config-actions">
                            <button
                              class="btn btn-secondary"
                              :disabled="modelFetching[provider.type]"
                              @click="refreshModels(provider)"
                            >
                              {{ modelFetching[provider.type] ? t('获取中...') : t('获取最新模型') }}
                            </button>
                            <button
                              class="btn btn-secondary"
                              :disabled="modelFetching[provider.type]"
                              @click="resetModels(provider)"
                            >
                              {{ t('恢复内置模型') }}
                            </button>
                          </div>
                        </div>
                        <div class="setting-hint">{{ t(modelSourceHint(provider.type)) }}</div>

                        <div
                          v-if="modelFetchMessage[provider.type]"
                          class="api-test-result"
                          :class="modelFetchSuccess[provider.type] ? 'success' : 'error'"
                        >
                          {{ modelFetchMessage[provider.type] }}
                        </div>

                        <div class="model-default-row">
                          <label>{{ t('默认模型') }}</label>
                          <SettingSelect
                            v-model="modelConfigs[provider.type].default"
                            :options="modelDefaultOptions(provider.type)"
                            :placeholder="t('跟随列表第一个模型')"
                          />
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
                                :title="t('拖动排序')"
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
                              <input v-model="model.id" class="input-field model-id" :placeholder="t('模型 ID')" />
                              <input v-model="model.name" class="input-field model-name" :placeholder="t('显示名称')" />
                              <button
                                type="button"
                                class="model-icon-btn"
                                :title="isModelExpanded(provider.type, index) ? t('收起高级参数') : t('展开高级参数')"
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
                                :title="t('删除模型')"
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
                              <div class="setting-row">
                                <div class="setting-row-text">
                                  <span class="setting-row-label">{{ t('上下文窗口') }}</span>
                                  <span class="setting-row-desc">{{
                                    t('单次请求可处理的最大 token 数，留空使用服务商默认')
                                  }}</span>
                                </div>
                                <div class="setting-row-control">
                                  <input
                                    v-model.number="model.contextWindow"
                                    type="number"
                                    min="1"
                                    class="input-field"
                                    :placeholder="t('默认 {value}', { value: defaultContextWindow(provider) })"
                                  />
                                </div>
                              </div>
                              <div class="setting-row">
                                <div class="setting-row-text">
                                  <span class="setting-row-label">{{ t('最大输出 token 数') }}</span>
                                  <span class="setting-row-desc">{{
                                    t('单次回复生成的最大 token 数，留空使用服务商默认')
                                  }}</span>
                                </div>
                                <div class="setting-row-control">
                                  <input
                                    v-model.number="model.maxOutput"
                                    type="number"
                                    min="1"
                                    class="input-field"
                                    :placeholder="t('留空使用服务商默认')"
                                  />
                                </div>
                              </div>
                              <div class="setting-row">
                                <div class="setting-row-text">
                                  <span class="setting-row-label">{{ t('输入类型') }}</span>
                                  <span class="setting-row-desc">{{ t('该模型支持的消息输入类型') }}</span>
                                </div>
                                <div class="setting-row-control">
                                  <div class="input-type-options">
                                    <label class="checkbox-field">
                                      <input
                                        type="checkbox"
                                        class="switch"
                                        :checked="hasInputType(model, 'text')"
                                        @change="toggleInputType(model, 'text')"
                                      />
                                      {{ t('文本') }}
                                    </label>
                                    <label class="checkbox-field">
                                      <input
                                        type="checkbox"
                                        class="switch"
                                        :checked="hasInputType(model, 'image')"
                                        @change="toggleInputType(model, 'image')"
                                      />
                                      {{ t('图片') }}
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div v-if="modelConfigs[provider.type].models.length === 0" class="model-empty">
                            {{ t('暂无模型，请获取最新模型或手动添加') }}
                          </div>
                        </div>

                        <button type="button" class="add-model-btn" @click="addModel(provider.type)">
                          {{ t('+ 添加模型') }}
                        </button>
                      </div>

                      <div class="provider-card-footer">
                        <button
                          type="button"
                          class="btn btn-danger provider-remove-btn"
                          :disabled="providerSaving[provider.type]"
                          @click="requestRemoveProvider(provider)"
                        >
                          {{ t('移除服务商') }}
                        </button>
                        <button class="btn btn-secondary" @click="cancelProviderCard(provider)">
                          {{ pendingProviders[provider.type] ? t('取消添加') : t('还原') }}
                        </button>
                        <button
                          class="btn btn-primary"
                          :disabled="providerSaving[provider.type]"
                          @click="saveProviderCard(provider)"
                        >
                          {{ providerSaving[provider.type] ? t('保存中...') : t('保存') }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="provider-add-toggle"
                :class="{ open: addProviderOpen }"
                :disabled="addableProviders.length === 0 && !addProviderOpen"
                :aria-expanded="addProviderOpen"
                @click="addProviderOpen = !addProviderOpen"
              >
                <span>{{
                  addableProviders.length === 0 && !addProviderOpen ? t('全部模型服务商已添加') : t('+ 添加模型服务商')
                }}</span>
                <svg
                  v-if="addableProviders.length > 0 || addProviderOpen"
                  class="provider-chevron"
                  :class="{ rotated: addProviderOpen }"
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <div v-if="addProviderOpen" class="provider-add-panel">
                <button
                  v-for="provider in addableProviders"
                  :key="provider.type"
                  type="button"
                  class="provider-add-option"
                  @click="addProvider(provider)"
                >
                  <span class="provider-add-option-name">{{ t(provider.name) }}</span>
                  <span class="provider-add-option-desc">{{ t(provider.description) }}</span>
                  <span class="provider-add-option-action">{{ t('添加') }}</span>
                </button>
              </div>
            </div>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('故障转移') }}</h3>
                <span class="setting-section-desc">{{
                  t('主模型重试后仍失败时，按顺序切换备用模型；留空则自动选择其他已配置密钥的服务商')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('自动切换') }}</span>
                    <span class="setting-row-desc">{{ t('主模型调用失败并重试后，自动尝试备用模型') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="fallbackEnabled" type="checkbox" class="switch" />
                  </div>
                </div>
                <div class="setting-row is-block">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('备用模型') }}</span>
                    <span class="setting-row-desc">{{
                      t('按从上到下的顺序尝试，最多 5 个；格式为 provider:model')
                    }}</span>
                  </div>
                  <div class="setting-row-control fallback-model-list">
                    <div v-for="(_, index) in fallbackModels" :key="index" class="fallback-model-row">
                      <SettingModelPicker
                        v-model="fallbackModels[index]"
                        :options="fallbackModelOptions"
                        :placeholder="t('如 deepseek:deepseek-chat')"
                      />
                      <button
                        type="button"
                        class="model-icon-btn danger"
                        :title="t('移除备用模型')"
                        @click="removeFallbackModel(index)"
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
                    <div v-if="fallbackModels.length === 0" class="fallback-model-empty">
                      {{ t('未配置备用模型，主模型失败时将尝试其他已配置服务商') }}
                    </div>
                    <button
                      type="button"
                      class="add-model-btn"
                      :disabled="fallbackModels.length >= 5"
                      @click="addFallbackModel"
                    >
                      {{ t('+ 添加备用模型') }}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div v-show="activeTab === 'assistant'" class="settings-tab">
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('场景预设') }}</h3>
                <span class="setting-section-desc">{{
                  t('一键套用一组参数，应用后仍可逐项微调，更改会自动保存')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row is-block">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('模式') }}</span>
                    <span class="setting-row-desc">
                      {{ t('预设会覆盖温度、压缩、Agent 运行与工具预算；严格审批模式同时切回“写操作前询问”') }}
                    </span>
                  </div>
                  <div class="setting-row-control preset-actions">
                    <button
                      v-for="preset in aiPresets"
                      :key="preset.id"
                      type="button"
                      class="btn"
                      :class="appliedPresetId === preset.id ? 'btn-primary' : 'btn-secondary'"
                      :title="t(preset.description)"
                      @click="applyAiPreset(preset)"
                    >
                      {{ t(preset.name) }}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('人设与风格') }}</h3>
                <span class="setting-section-desc">
                  {{ t('追加到系统提示词，让助手以指定身份与风格回答；不会改变工具执行与安全规则') }}
                </span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row is-block">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('自定义人设') }}</span>
                    <span class="setting-row-desc">
                      {{ t('例如：你是一位资深后端工程师，回答先给结论，再给关键步骤与风险提示') }}
                    </span>
                  </div>
                  <div class="setting-row-control">
                    <textarea
                      v-model="aiPersona"
                      class="input-field persona-input"
                      rows="6"
                      maxlength="4000"
                      spellcheck="false"
                      :placeholder="t('描述希望助手扮演的角色、语气与回答偏好，留空使用默认设定')"
                    ></textarea>
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('生成参数') }}</h3>
                <span class="setting-section-desc">{{
                  t('仅影响对话请求；任务规划、上下文压缩等辅助请求使用各自的固定参数')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('温度') }}</span>
                    <span class="setting-row-desc">
                      {{ t('0 最稳定，0.7 较平衡，1 以上更发散；留空使用供应商默认值，部分推理模型固定温度') }}
                    </span>
                  </div>
                  <div class="setting-row-control">
                    <input
                      v-model="aiTemperature"
                      type="number"
                      class="input-field temperature-input"
                      min="0"
                      max="2"
                      step="0.1"
                      :placeholder="t('默认')"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('分场景模型') }}</h3>
                <span class="setting-section-desc">
                  {{ t('规划与压缩等辅助任务可指定更便宜的模型；留空跟随当前对话模型，格式为 provider:model') }}
                </span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('任务规划') }}</span>
                    <span class="setting-row-desc">{{ t('生成执行计划时使用；计划仅为内部参考') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingModelPicker
                      v-model="scenarioPlanner"
                      :options="scenarioModelOptions"
                      :placeholder="t('如 bailian:qwen3.8-flash')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('上下文压缩') }}</span>
                    <span class="setting-row-desc">{{ t('对话历史达到窗口阈值时压缩摘要使用') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingModelPicker
                      v-model="scenarioCompression"
                      :options="scenarioModelOptions"
                      :placeholder="t('如 bailian:qwen3.8-flash')"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('上下文压缩') }}</h3>
                <span class="setting-section-desc">{{
                  t('对话历史占用达到阈值时，较早的消息会被摘要压缩，避免超出模型上下文窗口')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('触发阈值') }}</span>
                    <span class="setting-row-desc">{{ t('历史占用达到上下文窗口的该比例时开始压缩') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="aiCompressThreshold"
                      :options="aiCompressThresholdOptions"
                      :placeholder="t('选择阈值')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('压缩后保留消息数') }}</span>
                    <span class="setting-row-desc">{{ t('最近若干条消息保留原文，更早的内容才会被摘要') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="aiCompressKeepRecent"
                      :options="aiCompressKeepRecentOptions"
                      :placeholder="t('选择条数')"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('附件限制') }}</h3>
                <span class="setting-section-desc">{{ t('限制单条消息可携带的附件数量与单个文件大小') }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('附件数量') }}</span>
                    <span class="setting-row-desc">{{ t('单条消息最多可添加的附件个数') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="aiMaxAttachments"
                      :options="aiMaxAttachmentOptions"
                      :placeholder="t('选择数量')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('图片大小上限') }}</span>
                    <span class="setting-row-desc">{{ t('单张图片超过该大小时拒绝添加') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect v-model="aiMaxImageMb" :options="aiMaxImageMbOptions" :placeholder="t('选择大小')" />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('文本文件上限') }}</span>
                    <span class="setting-row-desc">{{ t('单个文本附件超过该大小时拒绝添加') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect v-model="aiMaxTextKb" :options="aiMaxTextKbOptions" :placeholder="t('选择大小')" />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('Agent 运行') }}</h3>
                <span class="setting-section-desc">{{
                  t('控制单次任务的循环深度与时长上限，修改后对新对话生效')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('最大执行轮次') }}</span>
                    <span class="setting-row-desc">{{ t('模型与工具循环的上限，达到后停止自动执行并给出提示') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="agentMaxIterations"
                      :options="agentMaxIterationsOptions"
                      :placeholder="t('选择轮次')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('单任务超时') }}</span>
                    <span class="setting-row-desc">{{ t('单次任务从开始到结束的时长上限，超时后停止并提示') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="agentTimeoutMin"
                      :options="agentTimeoutMinOptions"
                      :placeholder="t('选择时长')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('计划步骤上限') }}</span>
                    <span class="setting-row-desc">{{ t('规划器最多拆分的步骤数，复杂任务可适当调高') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="agentPlanSteps"
                      :options="agentPlanStepsOptions"
                      :placeholder="t('选择步骤数')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('并行工具数') }}</span>
                    <span class="setting-row-desc">{{ t('同一轮内多个工具调用的并发上限，调低更稳、调高更快') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="agentParallelTools"
                      :options="agentParallelToolsOptions"
                      :placeholder="t('选择并发数')"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('工具结果预算') }}</h3>
                <span class="setting-section-desc">{{
                  t('超大工具输出会被截断并落盘，可用 result-read 分页读取')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('单结果上限') }}</span>
                    <span class="setting-row-desc">{{ t('单个工具输出超过该大小时截断，完整内容落盘保留') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="toolResultMaxKb"
                      :options="toolResultMaxKbOptions"
                      :placeholder="t('选择大小')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('单次运行上限') }}</span>
                    <span class="setting-row-desc">{{
                      t('一次任务累计工具输出的上限，超出后后续结果也会被截断')
                    }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="toolResultRunKb"
                      :options="toolResultRunKbOptions"
                      :placeholder="t('选择大小')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('溢出结果保留') }}</span>
                    <span class="setting-row-desc">{{ t('落盘的完整工具结果保留天数，过期自动清理') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="toolResultRetentionDays"
                      :options="toolResultRetentionOptions"
                      :placeholder="t('选择天数')"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('工具审批') }}</h3>
                <span class="setting-section-desc">{{
                  t('AI 调用写操作工具前的确认策略；对话页可临时切换本次会话的策略')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('审批策略') }}</span>
                    <span class="setting-row-desc">{{ t(toolPolicyHint) }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect v-model="toolPolicy" :options="toolPolicyOptions" :placeholder="t('选择审批策略')" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div v-show="activeTab === 'database-client'" class="settings-tab">
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('查询与分页') }}</h3>
                <span class="setting-section-desc">{{ t('打开表数据与保留查询历史时的默认行为') }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('默认分页大小') }}</span>
                    <span class="setting-row-desc">{{ t('打开表数据时每页加载的行数，可在标签页内临时调整') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="databasePageSize"
                      :options="databasePageSizeOptions"
                      :placeholder="t('选择行数')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('查询历史条数') }}</span>
                    <span class="setting-row-desc">{{ t('本地保留的查询历史条数，超出后自动清理最早的记录') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="databaseHistoryLimit"
                      :options="databaseHistoryLimitOptions"
                      :placeholder="t('选择条数')"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('刷新与传输') }}</h3>
                <span class="setting-section-desc">{{ t('实例状态轮询与数据传输的默认参数') }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('自动刷新间隔') }}</span>
                    <span class="setting-row-desc">{{
                      t('实例状态与会话面板的轮询间隔，选择「关闭」仅手动刷新')
                    }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="databaseRefreshInterval"
                      :options="databaseRefreshIntervalOptions"
                      :placeholder="t('选择间隔')"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('默认批量大小') }}</span>
                    <span class="setting-row-desc">{{
                      t('数据传输时每批读取与写入的行数，可在传输对话框中临时调整')
                    }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="databaseTransferBatchSize"
                      :options="databaseTransferBatchSizeOptions"
                      :placeholder="t('选择批量')"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('安全与审计') }}</h3>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('安全模式') }}</span>
                    <span class="setting-row-desc">{{ t('拦截 UPDATE、DELETE 等高风险语句，避免误操作') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="databaseSafeMode" type="checkbox" class="switch" />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('SQL 审计') }}</span>
                    <span class="setting-row-desc">{{ t('执行前按规则检查脚本，提示潜在风险') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="databaseAuditEnabled" type="checkbox" class="switch" />
                  </div>
                </div>
                <div v-if="databaseAuditEnabled" class="audit-rule-list">
                  <label v-for="rule in sqlAuditRules" :key="rule.id" class="audit-rule-item">
                    <span class="audit-rule-text">
                      <span class="audit-rule-head">
                        <span class="audit-rule-name">{{ t(rule.label) }}</span>
                        <span class="audit-rule-level" :class="rule.level">
                          {{ rule.level === 'error' ? t('拦截级') : t('提示级') }}
                        </span>
                      </span>
                      <span class="audit-rule-desc">{{ t(rule.description) }}</span>
                    </span>
                    <input v-model="databaseAuditRules[rule.id]" type="checkbox" class="switch" />
                  </label>
                  <label class="audit-rule-item audit-rule-strict">
                    <span class="audit-rule-text">
                      <span class="audit-rule-head">
                        <span class="audit-rule-name">{{ t('严格模式') }}</span>
                      </span>
                      <span class="audit-rule-desc">{{ t('出现拦截级问题时禁止执行，只能返回修改') }}</span>
                    </span>
                    <input v-model="databaseAuditStrict" type="checkbox" class="switch" />
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('操作日志') }}</span>
                    <span class="setting-row-desc">{{ t('记录数据库中的建表、改表与数据变更操作') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="databaseOperationLogEnabled" type="checkbox" class="switch" />
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('编辑器') }}</h3>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('编辑器主题') }}</span>
                    <span class="setting-row-desc">{{ t('SQL 编辑器的配色方案') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect
                      v-model="databaseEditor.theme"
                      :options="databaseEditorThemes"
                      :placeholder="t('选择编辑器主题')"
                    />
                  </div>
                </div>
                <div v-for="option in databaseEditorOptions" :key="option.key" class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t(option.label) }}</span>
                    <span class="setting-row-desc">{{ t(option.description) }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input v-model="databaseEditor[option.key]" type="checkbox" class="switch" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div v-show="activeTab === 'sql-generator'" class="settings-tab">
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('脚本生成') }}</h3>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('脚本存储路径') }}</span>
                    <span class="setting-row-desc">{{ t('生成脚本的默认保存目录，留空使用用户文档目录') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <div class="path-input-group">
                      <input v-model="basePath" type="text" class="input-field" :placeholder="t('脚本存储根目录')" />
                      <button class="btn btn-secondary" @click="selectDir">{{ t('浏览') }}</button>
                    </div>
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('开发者姓名') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <div class="name-input-group">
                      <input
                        v-model="developerChName"
                        type="text"
                        class="input-field"
                        :placeholder="t('中文署名（脚本作者）')"
                        :aria-label="t('开发者姓名（中文）')"
                      />
                      <input
                        v-model="developerEnName"
                        type="text"
                        class="input-field"
                        :placeholder="t('英文署名（历史记录）')"
                        :aria-label="t('开发者姓名（英文）')"
                      />
                    </div>
                  </div>
                </div>
                <div class="setting-row is-top">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('默认文本编辑器') }}</span>
                    <span class="setting-row-desc">{{ t('在系统文件管理器中打开脚本时使用') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect v-model="textEditApp" :options="textEditorOptions" :placeholder="t('自定义路径')" />
                    <div v-if="!editorPresets.some((e) => e.path === textEditApp)" class="path-input-group">
                      <input
                        v-model="textEditApp"
                        type="text"
                        class="input-field"
                        :placeholder="t('编辑器可执行文件路径')"
                      />
                      <button class="btn btn-secondary" @click="selectEditor">{{ t('浏览') }}</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('数据库列表') }}</h3>
                <span class="setting-section-desc">{{ t('生成脚本时可选的数据库，可拖动调整顺序') }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-list-block">
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
                        :title="t('拖动排序')"
                        :aria-label="t('拖动排序')"
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
                          :placeholder="t('数据库名')"
                          :class="{ error: db.error }"
                        />
                      </div>
                      <div class="config-item-actions">
                        <button class="btn btn-danger" @click="removeDatabase(index)">{{ t('删除') }}</button>
                      </div>
                    </div>
                  </div>
                  <button class="btn btn-secondary" @click="addDatabase">{{ t('+ 添加数据库') }}</button>
                </div>
              </div>
            </section>
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('脚本类型') }}</h3>
                <span class="setting-section-desc">{{ t('生成脚本时可选的脚本类型，可拖动调整顺序') }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-list-block">
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
                        :title="t('拖动排序')"
                        :aria-label="t('拖动排序')"
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
                          :placeholder="t('名称')"
                          style="width: 120px; margin-right: 10px"
                          :class="{ error: st.error }"
                        />
                        <input
                          v-model="st.description"
                          type="text"
                          class="input-field"
                          :placeholder="t('描述')"
                          style="flex: 1"
                        />
                      </div>
                      <div class="config-item-actions">
                        <button class="btn btn-danger" @click="removeScriptType(index)">{{ t('删除') }}</button>
                      </div>
                    </div>
                  </div>
                  <button class="btn btn-secondary" @click="addScriptType">{{ t('+ 添加脚本类型') }}</button>
                </div>
              </div>
            </section>
          </div>

          <div v-show="activeTab === 'image-hosting'" class="settings-tab">
            <ImageHostSettingsPanel />
          </div>

          <div v-show="activeTab === 'network'" class="settings-tab">
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('代理') }}</h3>
                <span class="setting-section-desc">
                  {{ t('所有联网功能（模型对话、扩展市场、类型注册表、更新检查、图床）统一走以下设置') }}
                </span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('连接方式') }}</span>
                    <span class="setting-row-desc">{{ t(proxyModeHint) }}</span>
                  </div>
                  <div class="setting-row-control">
                    <SettingSelect v-model="proxyMode" :options="proxyModeOptions" :placeholder="t('选择连接方式')" />
                  </div>
                </div>
                <template v-if="proxyMode === 'manual'">
                  <div class="setting-row">
                    <div class="setting-row-text">
                      <span class="setting-row-label">{{ t('代理地址') }}</span>
                      <span class="setting-row-desc">
                        {{ t('支持 http:// 、https:// 与 socks5://；代理凭据会以明文保存在本地 config.json') }}
                      </span>
                    </div>
                    <div class="setting-row-control">
                      <input
                        v-model="proxyUrl"
                        type="text"
                        class="input-field"
                        placeholder="http://127.0.0.1:7890"
                        spellcheck="false"
                      />
                    </div>
                  </div>
                  <div class="setting-row">
                    <div class="setting-row-text">
                      <span class="setting-row-label">{{ t('忽略代理的地址') }}</span>
                      <span class="setting-row-desc">
                        {{
                          t(
                            '&lt;local&gt; 表示本机地址；多条规则用逗号或空格分隔，例如 &lt;local&gt; 10.0.0.0/8,*.corp'
                          )
                        }}
                      </span>
                    </div>
                    <div class="setting-row-control">
                      <input v-model="proxyBypass" type="text" class="input-field" spellcheck="false" />
                    </div>
                  </div>
                </template>
                <div class="setting-row is-top">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('连通性测试') }}</span>
                    <span class="setting-row-desc">{{ t('按当前设置发起一次请求，验证代理是否生效') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <div class="path-input-group">
                      <input
                        v-model="networkTestUrl"
                        type="text"
                        class="input-field"
                        placeholder="https://example.com"
                        spellcheck="false"
                      />
                      <button class="btn btn-secondary" :disabled="networkTesting" @click="runNetworkTest">
                        {{ networkTesting ? t('测试中...') : t('测试') }}
                      </button>
                    </div>
                    <div
                      v-if="networkTestResult"
                      class="api-test-result"
                      :class="networkTestResult.ok ? 'success' : 'error'"
                    >
                      {{ networkTestResult.message }}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('自定义源') }}</h3>
                <span class="setting-section-desc">{{ t('留空使用官方默认地址；适合需要镜像或内网代理的场景') }}</span>
              </div>
              <div class="setting-section-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('ClawHub 地址') }}</span>
                    <span class="setting-row-desc">{{ t('扩展市场技能来源，默认 https://clawhub.ai') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input
                      v-model="marketSources.clawhub"
                      type="text"
                      class="input-field"
                      placeholder="https://clawhub.ai"
                      spellcheck="false"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('MCP 类型注册表') }}</span>
                    <span class="setting-row-desc">{{ t('默认 https://registry.modelcontextprotocol.io/v0') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input
                      v-model="marketSources.mcp_registry"
                      type="text"
                      class="input-field"
                      placeholder="https://registry.modelcontextprotocol.io/v0"
                      spellcheck="false"
                    />
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('更新源') }}</span>
                    <span class="setting-row-desc">{{ t('历史版本列表的 GitHub Releases API 地址') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <input
                      v-model="marketSources.update_feed"
                      type="text"
                      class="input-field"
                      :placeholder="defaultUpdateFeed"
                      spellcheck="false"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div v-show="activeTab === 'shortcuts'" class="settings-tab">
            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('快捷键配置') }}</h3>
                <span class="setting-section-desc">{{ t('点击修改录制新的快捷键组合，清除后不设置快捷键') }}</span>
              </div>
              <div class="setting-section-body">
                <div class="shortcut-list">
                  <div v-for="tool in shortcutTools" :key="tool.path" class="shortcut-item">
                    <span class="shortcut-name">{{ t(tool.name) }}</span>
                    <div class="shortcut-control">
                      <span class="shortcut-value" :class="{ 'is-empty': !shortcuts[tool.shortcutKey] }">
                        {{ shortcuts[tool.shortcutKey] ? shortcutLabel(shortcuts[tool.shortcutKey]) : t('未设置') }}
                      </span>
                      <button
                        type="button"
                        class="btn-icon btn-sm"
                        :title="t('修改')"
                        :aria-label="t('修改')"
                        @click="openShortcutEditor(tool.shortcutKey, t(tool.name))"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="btn-icon btn-sm"
                        :title="t('清除')"
                        :aria-label="t('清除')"
                        :disabled="!shortcuts[tool.shortcutKey]"
                        @click="clearShortcut(tool.shortcutKey)"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path
                            d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21"
                          />
                          <path d="M22 21H7" />
                          <path d="m5 11 9 9" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="setting-section">
              <div class="setting-section-head">
                <h3 class="setting-section-title">{{ t('通用快捷键') }}</h3>
                <span class="setting-section-desc">{{
                  t('作用于聊天输入框、数据库查询与全局搜索，清除后恢复默认值')
                }}</span>
              </div>
              <div class="setting-section-body">
                <div v-for="item in shortcutActionItems" :key="item.key" class="setting-row is-top">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t(item.label) }}</span>
                    <span class="setting-row-desc">{{ t(item.desc) }}</span>
                  </div>
                  <div class="setting-row-control shortcut-control">
                    <span class="shortcut-value" :class="{ 'is-empty': !shortcuts[item.key] }">
                      {{
                        shortcuts[item.key]
                          ? shortcutLabel(shortcuts[item.key])
                          : t('默认：{shortcut}', { shortcut: item.placeholder })
                      }}
                    </span>
                    <button
                      type="button"
                      class="btn-icon btn-sm"
                      :title="t('修改')"
                      :aria-label="t('修改')"
                      @click="openShortcutEditor(item.key, t(item.label), DEFAULT_SHORTCUT_ACTIONS[item.key])"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="btn-icon btn-sm"
                      :title="t('清除')"
                      :aria-label="t('清除')"
                      :disabled="!shortcuts[item.key]"
                      @click="clearShortcut(item.key)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path
                          d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21"
                        />
                        <path d="M22 21H7" />
                        <path d="m5 11 9 9" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </section>
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
              <div class="about-version">{{ t('版本: {version}', { version }) }}</div>
              <div class="about-description">
                {{ t('一款面向开发人员的多端工具集合平台，集成丰富工具 + AI大模型能力，启动快、功能全、更智能。') }}
              </div>
              <div class="about-author">{{ t('作者: {author}', { author }) }}</div>
              <div class="about-copyright">{{ year }} {{ author }}. All rights reserved.</div>
              <div class="about-buttons">
                <button class="btn btn-secondary" @click="checkUpdate">{{ t('检查更新') }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <MessageDialog
      :visible="Boolean(removeProviderTarget)"
      type="confirm"
      :title="t('移除模型服务商')"
      :message="removeProviderMessage"
      @confirm="confirmRemoveProvider"
      @cancel="removeProviderTarget = ''"
      @close="removeProviderTarget = ''"
    />
    <ShortcutRecorderDialog
      :visible="shortcutEditor.visible"
      :name="shortcutEditor.name"
      :accelerator="shortcuts[shortcutEditor.key] || ''"
      :fallback="shortcutEditor.fallback"
      :is-mac="isMac"
      @cancel="closeShortcutEditor"
      @save="saveShortcut"
    />
    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { openUpdateCenter, useAutoSaveConfig, usePaneResize, useToast } from '@/composables'
import Toast from '@/components/Toast.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import ShortcutRecorderDialog from '@/components/ShortcutRecorderDialog.vue'
import SplitHandle from '@/components/SplitHandle.vue'
import ExtensionsManager from '@/components/ExtensionsManager.vue'
import ImageHostSettingsPanel from '@/components/settings/ImageHostSettingsPanel.vue'
import SettingSelect from '@/components/settings/SettingSelect.vue'
import SettingModelPicker from '@/components/settings/SettingModelPicker.vue'
import WindowControls from '@/components/WindowControls.vue'
import {
  getConfig,
  patchConfig,
  selectDirectory,
  selectFile,
  getPackageInfo,
  getAiProviders,
  getProviderModels,
  validateApiKey,
  getAiApiKey,
  returnToApp,
  windowMinimize,
  windowToggleMaximize,
  windowClose,
  platform as hostPlatform,
  setAutoStart,
  reloadConfig,
  reloadMenu,
  openExternal,
  onSettingsTab,
  networkTest
} from '@/api'
import iconUrl from '@assets/icon.png'
import { tools, RECENT_TOOLS_LIMIT_OPTIONS, normalizeRecentToolsLimit } from '@shared/tools'
import { DEFAULT_SHORTCUT_ACTIONS, getDefaultShortcuts } from '@shared/shortcutActions'
import { formatAccelerator } from '@/utils/shortcut'
import { normalizeDatabaseEditorConfig, DATABASE_EDITOR_THEME_OPTIONS } from '@shared/databaseEditor'
import {
  DATABASE_HISTORY_LIMIT_OPTIONS,
  DATABASE_PAGE_SIZE_OPTIONS,
  DATABASE_REFRESH_INTERVAL_OPTIONS,
  DATABASE_TRANSFER_BATCH_SIZE_OPTIONS,
  normalizeDatabaseHistoryLimit,
  normalizeDatabasePageSize,
  normalizeDatabaseRefreshInterval,
  normalizeDatabaseTransferBatchSize
} from '@shared/databaseClient'
import { UPDATE_CHECK_INTERVAL_OPTIONS, normalizeUpdateCheckInterval } from '@shared/updater'
import { SQL_AUDIT_RULES, DEFAULT_SQL_AUDIT_RULES } from '@shared/sqlAudit'
import { SECRET_MASK, isSecretMask } from '@shared/secrets'
import {
  PROXY_MODE_OPTIONS,
  DEFAULT_PROXY_BYPASS,
  DEFAULT_MARKET_SOURCES,
  UPDATE_FEED_DEFAULT_URL,
  isHttpUrl,
  isProxyUrl
} from '@shared/network'
import {
  TOOL_POLICY_OPTIONS,
  AI_TIMEOUT_OPTIONS,
  AI_COMPRESS_THRESHOLD_OPTIONS,
  AI_COMPRESS_KEEP_RECENT_OPTIONS,
  AI_MAX_ATTACHMENT_OPTIONS,
  AI_MAX_IMAGE_MB_OPTIONS,
  AI_MAX_TEXT_KB_OPTIONS,
  AI_AGENT_MAX_ITERATIONS_OPTIONS,
  AI_AGENT_TIMEOUT_MIN_OPTIONS,
  AI_AGENT_PLAN_STEPS_OPTIONS,
  AI_AGENT_PARALLEL_TOOLS_OPTIONS,
  AI_TOOL_RESULT_MAX_KB_OPTIONS,
  AI_TOOL_RESULT_RUN_KB_OPTIONS,
  AI_TOOL_RESULT_RETENTION_OPTIONS,
  AI_PRESETS,
  normalizeToolPolicy,
  normalizeAiTimeout,
  normalizeAiCompressThreshold,
  normalizeAiCompressKeepRecent,
  normalizeAiMaxAttachments,
  normalizeAiMaxImageMb,
  normalizeAiMaxTextKb,
  normalizeAiAgentMaxIterations,
  normalizeAiAgentTimeoutMin,
  normalizeAiAgentPlanSteps,
  normalizeAiAgentParallelTools,
  normalizeAiToolResultMaxKb,
  normalizeAiToolResultRunKb,
  normalizeAiToolResultRetentionDays,
  parseScenarioModel
} from '@shared/aiBehavior'
import { NOTIFICATION_ITEMS, normalizeNotificationConfig } from '@shared/notifications'
import { CLIPBOARD_HISTORY_LIMITS, normalizeClipboardHistoryConfig } from '@shared/clipboardSettings'
import { t, setLocale } from '@/i18n'
import { DEFAULT_LOCALE, LOCALE_OPTIONS } from '@shared/i18n'
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

const shortcutTools = tools.filter((tool) => tool.shortcutKey)
const shortcutActionItems = [
  {
    key: 'chat_send',
    label: '发送消息',
    desc: '聊天输入框中发送消息，未设置时按 Enter 发送、Shift+Enter 换行',
    placeholder: formatAccelerator(DEFAULT_SHORTCUT_ACTIONS.chat_send, isMac)
  },
  {
    key: 'database_run',
    label: '执行查询',
    desc: '数据库查询编辑器中执行当前 SQL',
    placeholder: formatAccelerator(DEFAULT_SHORTCUT_ACTIONS.database_run, isMac)
  },
  {
    key: 'global_search',
    label: '全局搜索',
    desc: '打开全局搜索面板',
    placeholder: formatAccelerator(DEFAULT_SHORTCUT_ACTIONS.global_search, isMac)
  }
]

function toSelectOptions(options) {
  return options.map((option) => ({ ...option, value: String(option.value) }))
}

function applyAiPreset(preset) {
  if (!preset?.values) return
  const values = preset.values
  aiTemperature.value =
    values.temperature === null || values.temperature === undefined ? '' : String(values.temperature)
  aiCompressThreshold.value = String(normalizeAiCompressThreshold(values.context.compress_threshold))
  aiCompressKeepRecent.value = String(normalizeAiCompressKeepRecent(values.context.keep_recent))
  agentMaxIterations.value = String(normalizeAiAgentMaxIterations(values.agent.max_iterations))
  agentTimeoutMin.value = String(normalizeAiAgentTimeoutMin(values.agent.timeout_min))
  agentPlanSteps.value = String(normalizeAiAgentPlanSteps(values.agent.max_plan_steps))
  agentParallelTools.value = String(normalizeAiAgentParallelTools(values.agent.max_parallel_tools))
  toolResultMaxKb.value = String(normalizeAiToolResultMaxKb(values.tool_result.max_kb))
  toolResultRunKb.value = String(normalizeAiToolResultRunKb(values.tool_result.run_kb))
  toolResultRetentionDays.value = String(normalizeAiToolResultRetentionDays(values.tool_result.retention_days))
  if (values.agent.tool_policy) toolPolicy.value = normalizeToolPolicy(values.agent.tool_policy)
  appliedPresetId.value = preset.id
}

const menuItems = [
  {
    id: 'general',
    get text() {
      return t('通用')
    }
  },
  {
    id: 'appearance',
    get text() {
      return t('外观')
    }
  },
  {
    id: 'shortcuts',
    get text() {
      return t('快捷键')
    }
  },
  {
    id: 'api',
    get text() {
      return t('模型')
    }
  },
  {
    id: 'assistant',
    get text() {
      return t('AI 助手')
    }
  },
  {
    id: 'network',
    get text() {
      return t('网络')
    }
  },
  {
    id: 'database-client',
    get text() {
      return t('数据库客户端')
    }
  },
  {
    id: 'sql-generator',
    get text() {
      return t('SQL 脚本生成')
    }
  },
  {
    id: 'image-hosting',
    get text() {
      return t('图床配置')
    }
  },
  {
    id: 'extensions',
    get text() {
      return t('扩展管理')
    }
  },
  {
    id: 'about',
    get text() {
      return t('关于')
    }
  }
]

// Old deep links (settings windows opened before the rename) keep working.
const TAB_ALIASES = {
  'database-editor': 'database-client',
  database: 'sql-generator',
  scripttype: 'sql-generator',
  mcp: 'extensions'
}

function resolveTabId(tab) {
  return TAB_ALIASES[tab] || tab
}

const tabMeta = {
  general: {
    get title() {
      return t('通用')
    },
    get description() {
      return t('管理界面语言、启动与窗口行为、系统通知以及剪贴板历史。')
    }
  },
  appearance: {
    get title() {
      return t('外观')
    },
    get description() {
      return t('选择主题模式、配色方案与字体大小，界面会随系统明暗设置自动适配。')
    }
  },
  api: {
    get title() {
      return t('模型')
    },
    get description() {
      return t('管理已添加的模型服务商，可编辑密钥、自定义地址与模型目录；未配置的服务商可通过下方按钮添加。')
    }
  },
  assistant: {
    get title() {
      return t('AI 助手')
    },
    get description() {
      return t('定义助手的人设与回答风格，设置采样参数、分场景模型、上下文压缩、Agent 运行与工具审批策略。')
    }
  },
  network: {
    get title() {
      return t('网络')
    },
    get description() {
      return t('配置代理、类型镜像源与更新检查地址；更改会自动保存并对后续联网请求生效。')
    }
  },
  'database-client': {
    get title() {
      return t('数据库客户端')
    },
    get description() {
      return t('设置查询分页、刷新轮询、数据传输、安全审计与编辑器偏好。')
    }
  },
  'sql-generator': {
    get title() {
      return t('SQL 脚本生成')
    },
    get description() {
      return t('配置脚本存储路径、开发者信息、默认编辑器以及可选的数据库与脚本类型。')
    }
  },
  'image-hosting': {
    get title() {
      return t('图床配置')
    },
    get description() {
      return t('配置上传使用的图床服务、单文件大小与历史记录上限。')
    }
  },
  shortcuts: {
    get title() {
      return t('快捷键')
    },
    get description() {
      return t('配置打开设置窗口、聊天发送、数据库执行查询与全局搜索的快捷键。')
    }
  },
  about: {
    get title() {
      return t('关于软件')
    },
    get description() {
      return t('查看版本信息、项目动态与更新入口。')
    }
  }
}

const themeOptions = [
  {
    value: 'system',
    get label() {
      return t('跟随系统')
    }
  },
  {
    value: 'light',
    get label() {
      return t('明亮')
    }
  },
  {
    value: 'dark',
    get label() {
      return t('暗黑')
    }
  }
]

const themeStyleOptions = [
  {
    value: 'sapphire',
    get label() {
      return t('蓝宝石')
    },
    swatch: { accent: '#2f5fd0', surface: '#fbfcff', app: '#e9eff9', sidebar: '#1d3557' }
  },
  {
    value: 'forest',
    get label() {
      return t('森林')
    },
    swatch: { accent: '#2f7d5c', surface: '#fbfdfb', app: '#ebf2ed', sidebar: '#1b2b22' }
  },
  {
    value: 'mint',
    get label() {
      return t('薄荷')
    },
    swatch: { accent: '#0e9c88', surface: '#fbfefd', app: '#e9f4f1', sidebar: '#15302b' }
  },
  {
    value: 'bee',
    get label() {
      return t('蜜蜂')
    },
    swatch: { accent: '#b77900', surface: '#fffdf7', app: '#f7f0dc', sidebar: '#2f2716' }
  },
  {
    value: 'parchment',
    get label() {
      return t('羊皮纸')
    },
    swatch: { accent: '#9c6a3c', surface: '#fbf7ee', app: '#f0e8d6', sidebar: '#352a1d' }
  }
]

const fontSizeOptions = [
  {
    value: 'small',
    get label() {
      return t('小')
    }
  },
  {
    value: 'medium',
    get label() {
      return t('标准')
    }
  },
  {
    value: 'large',
    get label() {
      return t('大')
    }
  },
  {
    value: 'xlarge',
    get label() {
      return t('特大')
    }
  }
]

const databaseEditorOptions = [
  {
    key: 'line_numbers',
    get label() {
      return t('显示行号')
    },
    get description() {
      return t('在编辑区左侧展示行号')
    }
  },
  {
    key: 'run_button',
    get label() {
      return t('显示左侧执行按钮')
    },
    get description() {
      return t('每条语句左侧显示 ▶ 按钮，可直接执行该语句')
    }
  },
  {
    key: 'statement_outline',
    get label() {
      return t('显示当前语句外框线')
    },
    get description() {
      return t('用外框线标出光标所在的 SQL 语句')
    }
  },
  {
    key: 'active_line',
    get label() {
      return t('高亮当前行')
    },
    get description() {
      return t('突出显示光标所在行')
    }
  },
  {
    key: 'word_wrap',
    get label() {
      return t('自动换行')
    },
    get description() {
      return t('较长的 SQL 在编辑区内折行显示')
    }
  },
  {
    key: 'autocomplete',
    get label() {
      return t('自动补全')
    },
    get description() {
      return t('输入时提示表名、字段、函数与代码片段')
    }
  },
  {
    key: 'diagnostics',
    get label() {
      return t('SQL 语义诊断')
    },
    get description() {
      return t('检测未知表、未知字段与歧义字段并给出警告')
    }
  },
  {
    key: 'hover_ddl',
    get label() {
      return t('悬浮表名展示 DDL')
    },
    get description() {
      return t('鼠标悬停表名时显示建表语句')
    }
  }
]

const databaseEditorThemes = DATABASE_EDITOR_THEME_OPTIONS

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
  void flushAutoSave(false, autoSaveKind())
  tabHistory.value.push(activeTab.value)
  tabForwardHistory.value = []
  activeTab.value = tab
}

function goBackTab() {
  if (!tabHistory.value.length) return
  void flushAutoSave(false, autoSaveKind())
  tabForwardHistory.value.push(activeTab.value)
  activeTab.value = tabHistory.value.pop()
}

function goForwardTab() {
  if (!tabForwardHistory.value.length) return
  void flushAutoSave(false, autoSaveKind())
  tabHistory.value.push(activeTab.value)
  activeTab.value = tabForwardHistory.value.pop()
}
const theme = ref('system')
const themeStyle = ref('sapphire')
const fontSize = ref('medium')
const language = ref(DEFAULT_LOCALE)
const languageOptions = LOCALE_OPTIONS
const basePath = ref('')
const developerChName = ref('')
const developerEnName = ref('')
const textEditApp = ref('')
const autoUpdate = ref(true)
const autoStart = ref(false)
const closeAction = ref('ask')
const closeActionOptions = [
  {
    value: 'ask',
    get label() {
      return t('每次询问')
    },
    get hint() {
      return t('关闭时弹窗选择隐藏到托盘或退出')
    }
  },
  {
    value: 'hide',
    get label() {
      return t('隐藏到托盘')
    },
    get hint() {
      return t('关闭后窗口隐藏，应用在托盘继续运行')
    }
  },
  {
    value: 'quit',
    get label() {
      return t('直接退出')
    },
    get hint() {
      return t('关闭窗口即完全退出应用')
    }
  }
]
const updateCheckInterval = ref('1')
const updateCheckIntervalOptions = toSelectOptions(UPDATE_CHECK_INTERVAL_OPTIONS)
const recentToolsLimit = ref('4')
const recentToolsLimitOptions = toSelectOptions(RECENT_TOOLS_LIMIT_OPTIONS)
const notificationItems = NOTIFICATION_ITEMS
const notifications = ref(normalizeNotificationConfig())
const clipboardLimitOptions = CLIPBOARD_HISTORY_LIMITS.map((limit) => ({
  value: String(limit),
  label: t('{p0} 条', { p0: limit })
}))
const clipboardSettings = normalizeClipboardHistoryConfig()
const clipboardPersist = ref(clipboardSettings.persist)
const clipboardMaxEntries = ref(clipboardSettings.max_entries)
const clipboardMaxEntriesModel = computed({
  get: () => String(clipboardMaxEntries.value),
  set: (value) => {
    clipboardMaxEntries.value = Number(value)
  }
})

const platform = ref('')
const editorPresets = ref([])
const textEditorOptions = computed(() => [
  {
    value: '',
    get label() {
      return t('自定义路径')
    }
  },
  ...editorPresets.value.map((editor) => ({ value: editor.path, label: editor.name }))
])
const aiProvider = ref('bailian')
const aiApiKeys = ref({
  bailian: '',
  moonshot: '',
  zhipu: '',
  minimax: '',
  minimax_group_id: '',
  volcengine: '',
  volcengine_endpoint_id: '',
  deepseek: '',
  mimo: '',
  opencode: '',
  opencode_go: '',
  openai: '',
  google: '',
  anthropic: ''
})
const aiProviders = ref([])
const aiBaseUrls = ref({})
const savedApiKeys = ref({})
const savedBaseUrls = ref({})
const aiModels = ref({})
const fallbackEnabled = ref(true)
const fallbackModels = ref([])
const modelConfigs = ref({})
const initialModelConfigs = ref({})
const modelConfigSources = ref({})
const modelFetching = ref({})
const modelFetchMessage = ref({})
const modelFetchSuccess = ref({})
const providerSaving = ref({})
const expandedProviders = ref({})
const pendingProviders = ref({})
const addProviderOpen = ref(false)
const removeProviderTarget = ref('')
const openCustomSettings = ref({})
const expandedModels = ref({})
const modelDrag = ref({ type: '', enabled: false, from: -1, over: -1 })
const databases = ref([])
const databaseEditor = ref(normalizeDatabaseEditorConfig())
const databaseSafeMode = ref(true)
const databaseAuditEnabled = ref(false)
const databaseAuditStrict = ref(false)
const databaseOperationLogEnabled = ref(true)
const databaseAuditRules = ref({ ...DEFAULT_SQL_AUDIT_RULES })
const sqlAuditRules = SQL_AUDIT_RULES
const scriptTypes = ref([])
const shortcuts = ref(getDefaultShortcuts())
const shortcutEditor = ref({ visible: false, key: '', name: '', fallback: '' })

function shortcutLabel(value) {
  if (!value) return ''
  return formatAccelerator(value, isMac) || value
}

function openShortcutEditor(key, name, fallback = '') {
  shortcutEditor.value = { visible: true, key, name, fallback: fallback || '' }
}

function closeShortcutEditor() {
  shortcutEditor.value = { ...shortcutEditor.value, visible: false }
}

function saveShortcut(accelerator) {
  const key = shortcutEditor.value.key
  if (!key || !accelerator) return
  shortcuts.value = { ...shortcuts.value, [key]: accelerator }
  closeShortcutEditor()
}

function clearShortcut(key) {
  shortcuts.value = { ...shortcuts.value, [key]: '' }
}
const proxyMode = ref('system')
const proxyUrl = ref('')
const proxyBypass = ref(DEFAULT_PROXY_BYPASS)
const marketSources = ref({ ...DEFAULT_MARKET_SOURCES })
const networkTestUrl = ref('https://clawhub.ai')
const networkTesting = ref(false)
const networkTestResult = ref(null)
const proxyModeOptions = PROXY_MODE_OPTIONS
const defaultUpdateFeed = UPDATE_FEED_DEFAULT_URL
const proxyModeHint = computed(() => PROXY_MODE_OPTIONS.find((option) => option.value === proxyMode.value)?.hint || '')
const aiPersona = ref('')
const aiTemperature = ref('')
const scenarioPlanner = ref('')
const scenarioCompression = ref('')
const aiTimeout = ref('60')
const aiTimeoutOptions = toSelectOptions(AI_TIMEOUT_OPTIONS)
const aiCompressThreshold = ref('70')
const aiCompressThresholdOptions = toSelectOptions(AI_COMPRESS_THRESHOLD_OPTIONS)
const aiCompressKeepRecent = ref('6')
const aiCompressKeepRecentOptions = toSelectOptions(AI_COMPRESS_KEEP_RECENT_OPTIONS)
const aiMaxAttachments = ref('6')
const aiMaxAttachmentOptions = toSelectOptions(AI_MAX_ATTACHMENT_OPTIONS)
const aiMaxImageMb = ref('10')
const aiMaxImageMbOptions = toSelectOptions(AI_MAX_IMAGE_MB_OPTIONS)
const aiMaxTextKb = ref('256')
const aiMaxTextKbOptions = toSelectOptions(AI_MAX_TEXT_KB_OPTIONS)
const agentMaxIterations = ref('10')
const agentMaxIterationsOptions = toSelectOptions(AI_AGENT_MAX_ITERATIONS_OPTIONS)
const agentTimeoutMin = ref('5')
const agentTimeoutMinOptions = toSelectOptions(AI_AGENT_TIMEOUT_MIN_OPTIONS)
const agentPlanSteps = ref('8')
const agentPlanStepsOptions = toSelectOptions(AI_AGENT_PLAN_STEPS_OPTIONS)
const agentParallelTools = ref('4')
const agentParallelToolsOptions = toSelectOptions(AI_AGENT_PARALLEL_TOOLS_OPTIONS)
const toolResultMaxKb = ref('24')
const toolResultMaxKbOptions = toSelectOptions(AI_TOOL_RESULT_MAX_KB_OPTIONS)
const toolResultRunKb = ref('160')
const toolResultRunKbOptions = toSelectOptions(AI_TOOL_RESULT_RUN_KB_OPTIONS)
const toolResultRetentionDays = ref('7')
const toolResultRetentionOptions = toSelectOptions(AI_TOOL_RESULT_RETENTION_OPTIONS)
const aiPresets = AI_PRESETS
const appliedPresetId = ref('')
const databasePageSize = ref('100')
const databasePageSizeOptions = toSelectOptions(DATABASE_PAGE_SIZE_OPTIONS)
const databaseRefreshInterval = ref('5')
const databaseRefreshIntervalOptions = toSelectOptions(DATABASE_REFRESH_INTERVAL_OPTIONS)
const databaseTransferBatchSize = ref('1000')
const databaseTransferBatchSizeOptions = toSelectOptions(DATABASE_TRANSFER_BATCH_SIZE_OPTIONS)
const databaseHistoryLimit = ref('200')
const databaseHistoryLimitOptions = toSelectOptions(DATABASE_HISTORY_LIMIT_OPTIONS)
const toolPolicy = ref('all')
const toolPolicyOptions = TOOL_POLICY_OPTIONS
const toolPolicyHint = computed(
  () => TOOL_POLICY_OPTIONS.find((option) => option.value === toolPolicy.value)?.hint || ''
)
const scenarioModelOptions = computed(() =>
  aiProviders.value.flatMap((provider) =>
    (modelConfigs.value[provider.type]?.models || []).map((model) => ({
      value: `${provider.type}:${model.id}`,
      label: `${t(provider.name)} · ${model.name || model.id}`
    }))
  )
)
const version = ref('1.0.0')
const author = ref('lov3smu')
const databaseListRef = ref(null)
const scriptTypeListRef = ref(null)
const configDrag = ref({ list: '', enabled: false, from: -1, over: -1 })
const showApiKey = ref({})
const revealedApiKeys = ref({})
const testingApiKey = ref({})
const apiKeyTestResult = ref({})

const year = computed(() => new Date().getFullYear())
const visibleProviders = computed(() =>
  aiProviders.value.filter((provider) => hasProviderKey(provider.type) || pendingProviders.value[provider.type])
)
const addableProviders = computed(() =>
  aiProviders.value.filter((provider) => !hasProviderKey(provider.type) && !pendingProviders.value[provider.type])
)
const chatModelOptions = computed(() =>
  visibleProviders.value.flatMap((provider) =>
    (modelConfigs.value[provider.type]?.models || [])
      .filter((model) => model.id)
      .map((model) => ({
        value: `${provider.type}:${model.id}`,
        label: `${t(provider.name)} · ${model.name || model.id}`
      }))
  )
)
const fallbackModelOptions = computed(() => {
  const options = [...chatModelOptions.value]
  const seen = new Set(options.map((option) => option.value))
  for (const entry of fallbackModels.value) {
    const value = String(entry || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    options.push({ value, label: value })
  }
  return options
})
const aiProviderModel = computed({
  get() {
    const config = modelConfigs.value[aiProvider.value]
    if (!config) return ''
    const model = config.default || config.models?.[0]?.id || ''
    return model ? `${aiProvider.value}:${model}` : ''
  },
  set(value) {
    const parsed = parseScenarioModel(value)
    if (!parsed) return
    const config = modelConfigs.value[parsed.provider]
    if (!config || !config.models.some((model) => model.id === parsed.model)) return
    aiProvider.value = parsed.provider
    config.default = parsed.model
  }
})
const removeProviderMessage = computed(() => {
  const type = removeProviderTarget.value
  if (!type) return ''
  const provider = aiProviders.value.find((item) => item.type === type)
  const name = providerName(type)
  if (pendingProviders.value[type] && !hasProviderKey(type)) {
    return t('「{name}」尚未保存，移除后不会写入配置。', { name })
  }
  if (provider?.hasEnvKey && !(savedApiKeys.value[type] || '').trim()) {
    return t('「{name}」的密钥来自环境变量 {envKey}，无法移除；确认后将丢弃未保存的修改，服务商仍会显示在列表中。', {
      name,
      envKey: provider.envKey
    })
  }
  if (provider?.hasEnvKey) {
    return t(
      '将删除「{name}」已保存的 API 密钥、自定义地址与模型目录，并移除引用它的备用模型；检测到环境变量 {envKey}，之后仍会使用环境变量中的密钥。',
      { name, envKey: provider.envKey }
    )
  }
  return t('将立即删除「{name}」的 API 密钥、自定义地址与模型目录，并移除引用它的备用模型。', { name })
})

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
  const found = aiProviders.value.find((provider) => provider.type === type)?.name
  return found ? t(found) : type
}

function hasProviderKey(type) {
  if ((savedApiKeys.value[type] || '').trim()) return true
  const provider = aiProviders.value.find((item) => item.type === type)
  return Boolean(provider?.hasApiKey || provider?.hasEnvKey)
}

function addProvider(provider) {
  pendingProviders.value = { ...pendingProviders.value, [provider.type]: true }
  expandedProviders.value = { ...expandedProviders.value, [provider.type]: true }
  if (!aiProvider.value || !hasProviderKey(aiProvider.value)) aiProvider.value = provider.type
  addProviderOpen.value = false
}

function requestRemoveProvider(provider) {
  removeProviderTarget.value = provider.type
}

function clearProviderState(type) {
  // 只丢弃待添加与展开状态；模型配置保留，避免服务商以环境变量密钥重新出现时卡片因缺少配置而报错
  const nextPending = { ...pendingProviders.value }
  delete nextPending[type]
  pendingProviders.value = nextPending
  const nextExpanded = { ...expandedProviders.value }
  delete nextExpanded[type]
  expandedProviders.value = nextExpanded
}

async function confirmRemoveProvider() {
  const type = removeProviderTarget.value
  removeProviderTarget.value = ''
  if (!type) return
  const provider = aiProviders.value.find((item) => item.type === type)
  if (!provider) return

  const hasStoredKey = Boolean((savedApiKeys.value[type] || '').trim())
  if (!hasStoredKey) {
    // 未保存的草稿或仅靠环境变量提供密钥：不删除持久化配置，仅还原卡片状态
    cancelProviderCard(provider)
    return
  }

  const nextApiKeys = { ...savedApiKeys.value }
  delete nextApiKeys[type]
  const nextBaseUrls = { ...savedBaseUrls.value }
  delete nextBaseUrls[type]
  const nextModels = { ...aiModels.value }
  delete nextModels[type]
  const nextFallbackModels = fallbackModels.value
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry && parseScenarioModel(entry)?.provider !== type)

  let nextAiProvider = aiProvider.value
  if (nextAiProvider === type) {
    nextAiProvider =
      aiProviders.value.find(
        (item) => item.type !== type && (nextApiKeys[item.type] || item.hasApiKey || item.hasEnvKey)
      )?.type || ''
  }

  providerSaving.value = { ...providerSaving.value, [type]: true }
  try {
    const success = await patchConfig({
      ai: {
        provider: nextAiProvider,
        keys: nextApiKeys,
        base_urls: nextBaseUrls,
        models: nextModels,
        fallback: {
          models: nextFallbackModels
        }
      }
    })
    if (!success) {
      showError(t('移除失败，请检查配置'))
      return
    }

    const nextDraftKeys = { ...aiApiKeys.value }
    delete nextDraftKeys[type]
    aiApiKeys.value = nextDraftKeys
    resetApiKeyVisibility(type)
    const nextDraftBaseUrls = { ...aiBaseUrls.value }
    delete nextDraftBaseUrls[type]
    aiBaseUrls.value = nextDraftBaseUrls
    savedApiKeys.value = nextApiKeys
    savedBaseUrls.value = nextBaseUrls
    aiModels.value = nextModels
    aiProvider.value = nextAiProvider
    fallbackModels.value = nextFallbackModels
    clearProviderState(type)
    await reloadConfig()

    const providers = await getAiProviders()
    if (Array.isArray(providers) && providers.length > 0) aiProviders.value = providers
    showSuccess(t('{name} 已移除', { name: t(provider.name) }))
  } catch (e) {
    showError(t('移除失败: {error}', { error: e.message }))
  } finally {
    providerSaving.value = { ...providerSaving.value, [type]: false }
  }
}

function isProviderExpanded(type) {
  return Boolean(expandedProviders.value[type])
}

function toggleProviderExpanded(type) {
  expandedProviders.value = { ...expandedProviders.value, [type]: !expandedProviders.value[type] }
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

function modelDefaultOptions(type) {
  const config = modelConfigs.value[type]
  if (!config) return []
  return config.models.filter((model) => model.id).map((model) => ({ value: model.id, label: model.name || model.id }))
}

function addFallbackModel() {
  if (fallbackModels.value.length >= 5) return
  fallbackModels.value = [...fallbackModels.value, '']
}

function removeFallbackModel(index) {
  fallbackModels.value = fallbackModels.value.filter((_, itemIndex) => itemIndex !== index)
}

function modelSourceHint(type) {
  const source = modelConfigSources.value[type]
  if (source === 'config') return t('正在使用已保存的模型目录')
  if (source === 'custom') return t('正在使用在线获取的模型目录')
  return t('未自定义模型，正在使用服务商内置模型目录')
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

function resetApiKeyVisibility(type) {
  const nextShow = { ...showApiKey.value }
  delete nextShow[type]
  showApiKey.value = nextShow
  const nextRevealed = { ...revealedApiKeys.value }
  delete nextRevealed[type]
  revealedApiKeys.value = nextRevealed
}

async function toggleShowApiKey(type) {
  if (showApiKey.value[type]) {
    const revealed = revealedApiKeys.value[type]
    if (revealed !== undefined && (aiApiKeys.value[type] || '') === revealed) {
      aiApiKeys.value = { ...aiApiKeys.value, [type]: SECRET_MASK }
    }
    resetApiKeyVisibility(type)
    return
  }

  const current = (aiApiKeys.value[type] || '').trim()
  if (isSecretMask(current)) {
    const plain = await getAiApiKey(type)
    if (plain) {
      revealedApiKeys.value = { ...revealedApiKeys.value, [type]: plain }
      aiApiKeys.value = { ...aiApiKeys.value, [type]: plain }
    }
  }
  showApiKey.value = { ...showApiKey.value, [type]: true }
}

onMounted(async () => {
  removeSettingsTabListener = onSettingsTab((tab) => {
    const resolved = resolveTabId(tab)
    if (!menuItems.some((item) => item.id === resolved)) return
    void flushAutoSave(false, autoSaveKind())
    tabHistory.value = []
    tabForwardHistory.value = []
    activeTab.value = resolved
  })

  platform.value = navigator.platform.toLowerCase()

  if (platform.value.includes('win')) {
    editorPresets.value = [
      { name: 'VS Code', path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe' },
      { name: 'Notepad++', path: 'C:\\Program Files\\Notepad++\\notepad++.exe' },
      { name: 'Sublime Text', path: 'C:\\Program Files\\Sublime Text\\sublime_text.exe' },
      {
        get name() {
          return t('记事本')
        },
        path: 'C:\\Windows\\System32\\notepad.exe'
      }
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
      { name: 'Sublime Text', path: '/usr/bin/subl' },
      { name: 'Vim', path: '/usr/bin/vim' },
      { name: 'Nano', path: '/usr/bin/nano' },
      { name: 'Gedit', path: '/usr/bin/gedit' }
    ]
  }

  const tabParam = route.query.tab
  const initialTab = resolveTabId(typeof tabParam === 'string' ? tabParam : '')
  if (initialTab && menuItems.some((item) => item.id === initialTab)) {
    activeTab.value = initialTab
  }

  const config = await getConfig()
  basePath.value = config.sql_generator.base_path || ''
  developerChName.value = config.sql_generator.developer.ch_name || ''
  developerEnName.value = config.sql_generator.developer.en_name || ''
  textEditApp.value = config.sql_generator.text_edit_app || ''
  autoUpdate.value = config.update.auto_update !== false
  autoStart.value = config.app.auto_start === true
  databaseSafeMode.value = config.database.safe_mode !== false
  databaseAuditEnabled.value = config.database.audit.enabled === true
  databaseAuditStrict.value = config.database.audit.strict === true
  databaseOperationLogEnabled.value = config.database.operation_log_enabled !== false
  databaseAuditRules.value = { ...DEFAULT_SQL_AUDIT_RULES, ...(config.database.audit.rules || {}) }
  closeAction.value = config.app.close_action || 'ask'
  updateCheckInterval.value = String(normalizeUpdateCheckInterval(config.update.check_interval))
  recentToolsLimit.value = String(normalizeRecentToolsLimit(config.app.recent_tools_limit))
  notifications.value = normalizeNotificationConfig(config.notifications)
  const clipboardConfig = normalizeClipboardHistoryConfig(config.clipboard_history)
  clipboardPersist.value = clipboardConfig.persist
  clipboardMaxEntries.value = clipboardConfig.max_entries
  theme.value = config.appearance.theme || getThemePreference()
  applyTheme(theme.value)
  themeStyle.value = normalizeThemeStyle(config.appearance.theme_style || getThemeStylePreference())
  applyThemeStyle(themeStyle.value)
  fontSize.value = normalizeFontSizePreference(config.appearance.font_size || getFontSizePreference())
  applyFontSize(fontSize.value)
  language.value = config.appearance.language || DEFAULT_LOCALE
  setLocale(language.value)
  aiProvider.value = config.ai.provider || 'bailian'
  aiApiKeys.value = { ...aiApiKeys.value, ...(config.ai.keys || {}) }
  aiBaseUrls.value = { ...(config.ai.base_urls || {}) }
  savedApiKeys.value = { ...aiApiKeys.value }
  savedBaseUrls.value = { ...aiBaseUrls.value }
  aiModels.value = config.ai.models && typeof config.ai.models === 'object' ? config.ai.models : {}
  fallbackEnabled.value = config.ai.fallback.enabled !== false
  fallbackModels.value = Array.isArray(config.ai.fallback.models) ? [...config.ai.fallback.models] : []
  databases.value = (config.sql_generator.databases || []).map((name) => ({ name, error: false }))
  databaseEditor.value = normalizeDatabaseEditorConfig(config.database.editor)
  scriptTypes.value = (config.sql_generator.script_types || []).map((st) => ({
    name: st.name,
    description: st.description || '',
    error: false
  }))

  if (config.app.shortcuts) {
    shortcuts.value = { ...shortcuts.value, ...config.app.shortcuts }
  }

  const proxy = config.network?.proxy || {}
  proxyMode.value = proxy.mode || 'system'
  proxyUrl.value = proxy.url || ''
  proxyBypass.value = proxy.bypass || DEFAULT_PROXY_BYPASS
  marketSources.value = { ...DEFAULT_MARKET_SOURCES, ...(config.network.market_sources || {}) }
  aiPersona.value = typeof config.ai.persona === 'string' ? config.ai.persona : ''
  aiTemperature.value =
    config.ai.temperature === null || config.ai.temperature === undefined ? '' : String(config.ai.temperature)
  const scenarioModels = config.ai.agent.scenario_models || {}
  scenarioPlanner.value = typeof scenarioModels.planner === 'string' ? scenarioModels.planner : ''
  scenarioCompression.value = typeof scenarioModels.compression === 'string' ? scenarioModels.compression : ''
  toolPolicy.value = normalizeToolPolicy(config.ai.agent.tool_policy)
  aiTimeout.value = String(normalizeAiTimeout(config.ai.timeout))
  aiCompressThreshold.value = String(normalizeAiCompressThreshold(config.ai.context.compress_threshold))
  aiCompressKeepRecent.value = String(normalizeAiCompressKeepRecent(config.ai.context.keep_recent))
  aiMaxAttachments.value = String(normalizeAiMaxAttachments(config.ai.attachments.max_count))
  aiMaxImageMb.value = String(normalizeAiMaxImageMb(config.ai.attachments.max_image_mb))
  aiMaxTextKb.value = String(normalizeAiMaxTextKb(config.ai.attachments.max_text_kb))
  agentMaxIterations.value = String(normalizeAiAgentMaxIterations(config.ai.agent.max_iterations))
  agentTimeoutMin.value = String(normalizeAiAgentTimeoutMin(config.ai.agent.timeout_min))
  agentPlanSteps.value = String(normalizeAiAgentPlanSteps(config.ai.agent.max_plan_steps))
  agentParallelTools.value = String(normalizeAiAgentParallelTools(config.ai.agent.max_parallel_tools))
  toolResultMaxKb.value = String(normalizeAiToolResultMaxKb(config.ai.tool_result.max_kb))
  toolResultRunKb.value = String(normalizeAiToolResultRunKb(config.ai.tool_result.run_kb))
  toolResultRetentionDays.value = String(normalizeAiToolResultRetentionDays(config.ai.tool_result.retention_days))
  databasePageSize.value = String(normalizeDatabasePageSize(config.database.page_size))
  databaseRefreshInterval.value = String(normalizeDatabaseRefreshInterval(config.database.refresh_interval))
  databaseTransferBatchSize.value = String(normalizeDatabaseTransferBatchSize(config.database.transfer_batch_size))
  databaseHistoryLimit.value = String(normalizeDatabaseHistoryLimit(config.database.history_limit))

  const providers = await getAiProviders()
  aiProviders.value = providers || []
  initModelConfigs(aiProviders.value)
  if (!visibleProviders.value.some((provider) => provider.type === aiProvider.value)) {
    aiProvider.value = visibleProviders.value[0]?.type || ''
  }
  expandedProviders.value = {}
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

  lastAutoStart = autoStart.value
  seedAutoSaveStates(AUTO_SAVE_KINDS)
  markAutoSaveReady()
})

onUnmounted(() => {
  removeSettingsTabListener?.()
  void flushAutoSave(false, autoSaveKind())
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

function getSqlGroupError() {
  databases.value.forEach((db) => (db.error = false))
  scriptTypes.value.forEach((st) => (st.error = false))

  const dbNames = []
  for (const db of databases.value) {
    const name = db.name.trim()
    if (!name) {
      db.error = true
      return t('数据库名称不能为空')
    }
    if (dbNames.includes(name)) {
      db.error = true
      return t('数据库名称 "{name}" 重复', { name })
    }
    dbNames.push(name)
  }

  const typeNames = []
  for (const st of scriptTypes.value) {
    const name = st.name.trim()
    if (!name) {
      st.error = true
      return t('脚本类型名称不能为空')
    }
    if (typeNames.includes(name)) {
      st.error = true
      return t('脚本类型名称 "{name}" 重复', { name })
    }
    typeNames.push(name)
  }

  return ''
}

function normalizedFallbackModels() {
  return fallbackModels.value.map((entry) => String(entry || '').trim()).filter(Boolean)
}

function getModelGroupError() {
  const entries = normalizedFallbackModels()
  if (entries.length > 5) return t('备用模型最多配置 5 个')
  const seen = new Set()
  for (const entry of entries) {
    const parsed = parseScenarioModel(entry)
    if (!parsed) return t('备用模型格式无效：{entry}（应为 provider:model）', { entry })
    if (!aiProviders.value.some((provider) => provider.type === parsed.provider)) {
      return t('备用模型包含未知服务商：{provider}', { provider: parsed.provider })
    }
    if (seen.has(entry)) return t('备用模型重复：{entry}', { entry })
    seen.add(entry)
  }
  return ''
}

function getAssistantGroupError() {
  if (scenarioPlanner.value.trim() && !parseScenarioModel(scenarioPlanner.value.trim())) {
    return t('任务规划模型格式无效（应为 provider:model）')
  }
  if (scenarioCompression.value.trim() && !parseScenarioModel(scenarioCompression.value.trim())) {
    return t('上下文压缩模型格式无效（应为 provider:model）')
  }
  if (aiTemperature.value !== '') {
    const temperature = Number(aiTemperature.value)
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      return t('温度必须在 0 到 2 之间，或留空使用默认值')
    }
  }
  return ''
}

function getNetworkGroupError() {
  if (proxyMode.value === 'manual') {
    if (!proxyUrl.value.trim()) return t('手动代理模式需要填写代理地址')
    if (!isProxyUrl(proxyUrl.value.trim())) {
      return t('代理地址必须是有效的 http:// 、https:// 或 socks5:// 地址')
    }
  }
  for (const [key, label] of [
    ['clawhub', t('ClawHub 地址')],
    ['mcp_registry', t('MCP 类型注册表')],
    ['update_feed', t('更新源')]
  ]) {
    const value = String(marketSources.value[key] || '').trim()
    if (value && !isHttpUrl(value)) return t('{label} 必须是有效的 http(s) 地址', { label: t(label) })
  }
  return ''
}

function getAutoSaveError(kind) {
  if (kind === 'sql') return getSqlGroupError()
  if (kind === 'model') return getModelGroupError()
  if (kind === 'assistant') return getAssistantGroupError()
  if (kind === 'network') return getNetworkGroupError()
  return ''
}

function buildAutoSavePayload(kind) {
  if (kind === 'general') {
    return {
      app: {
        auto_start: autoStart.value,
        close_action: closeAction.value,
        recent_tools_limit: normalizeRecentToolsLimit(recentToolsLimit.value)
      },
      update: {
        auto_update: autoUpdate.value,
        check_interval: normalizeUpdateCheckInterval(updateCheckInterval.value)
      },
      appearance: {
        theme: theme.value,
        theme_style: themeStyle.value,
        font_size: fontSize.value,
        language: language.value
      },
      notifications: { ...notifications.value },
      clipboard_history: {
        persist: clipboardPersist.value,
        max_entries: Number(clipboardMaxEntries.value)
      }
    }
  }
  if (kind === 'model') {
    return {
      ai: {
        provider: aiProvider.value,
        timeout: normalizeAiTimeout(aiTimeout.value),
        fallback: {
          enabled: fallbackEnabled.value,
          models: normalizedFallbackModels()
        }
      }
    }
  }
  if (kind === 'assistant') {
    return {
      ai: {
        persona: aiPersona.value.trim(),
        temperature: aiTemperature.value === '' ? null : Number(aiTemperature.value),
        context: {
          compress_threshold: normalizeAiCompressThreshold(aiCompressThreshold.value),
          keep_recent: normalizeAiCompressKeepRecent(aiCompressKeepRecent.value)
        },
        attachments: {
          max_count: normalizeAiMaxAttachments(aiMaxAttachments.value),
          max_image_mb: normalizeAiMaxImageMb(aiMaxImageMb.value),
          max_text_kb: normalizeAiMaxTextKb(aiMaxTextKb.value)
        },
        agent: {
          max_iterations: normalizeAiAgentMaxIterations(agentMaxIterations.value),
          timeout_min: normalizeAiAgentTimeoutMin(agentTimeoutMin.value),
          max_plan_steps: normalizeAiAgentPlanSteps(agentPlanSteps.value),
          max_parallel_tools: normalizeAiAgentParallelTools(agentParallelTools.value),
          scenario_models: {
            planner: scenarioPlanner.value.trim(),
            compression: scenarioCompression.value.trim()
          },
          tool_policy: normalizeToolPolicy(toolPolicy.value)
        },
        tool_result: {
          max_kb: normalizeAiToolResultMaxKb(toolResultMaxKb.value),
          run_kb: normalizeAiToolResultRunKb(toolResultRunKb.value),
          retention_days: normalizeAiToolResultRetentionDays(toolResultRetentionDays.value)
        }
      }
    }
  }
  if (kind === 'database') {
    return {
      database: {
        safe_mode: databaseSafeMode.value,
        audit: {
          enabled: databaseAuditEnabled.value,
          strict: databaseAuditStrict.value,
          rules: { ...databaseAuditRules.value }
        },
        operation_log_enabled: databaseOperationLogEnabled.value,
        page_size: normalizeDatabasePageSize(databasePageSize.value),
        refresh_interval: normalizeDatabaseRefreshInterval(databaseRefreshInterval.value),
        transfer_batch_size: normalizeDatabaseTransferBatchSize(databaseTransferBatchSize.value),
        history_limit: normalizeDatabaseHistoryLimit(databaseHistoryLimit.value),
        editor: { ...databaseEditor.value }
      }
    }
  }
  if (kind === 'sql') {
    return {
      sql_generator: {
        base_path: basePath.value,
        developer: {
          ch_name: developerChName.value,
          en_name: developerEnName.value
        },
        text_edit_app: textEditApp.value,
        databases: databases.value.map((db) => db.name.trim()).filter(Boolean),
        script_types: scriptTypes.value
          .map((st) => ({
            name: st.name.trim(),
            description: st.description.trim()
          }))
          .filter((st) => st.name)
      }
    }
  }
  if (kind === 'network') {
    return {
      network: {
        proxy: {
          mode: proxyMode.value,
          url: proxyUrl.value.trim(),
          bypass: proxyBypass.value.trim() || DEFAULT_PROXY_BYPASS
        },
        market_sources: {
          clawhub: marketSources.value.clawhub.trim(),
          mcp_registry: marketSources.value.mcp_registry.trim(),
          update_feed: marketSources.value.update_feed.trim()
        }
      }
    }
  }
  if (kind === 'shortcuts') {
    return { app: { shortcuts: { ...shortcuts.value } } }
  }
  return null
}

let lastAutoStart = null
let lastChatModelState = ''

const AUTO_SAVE_KINDS = ['general', 'model', 'assistant', 'database', 'sql', 'network', 'shortcuts']
const AUTO_SAVE_KIND_BY_TAB = {
  general: 'general',
  appearance: 'general',
  api: 'model',
  assistant: 'assistant',
  network: 'network',
  'database-client': 'database',
  'sql-generator': 'sql',
  shortcuts: 'shortcuts'
}

function autoSaveKind() {
  return AUTO_SAVE_KIND_BY_TAB[activeTab.value] || ''
}

const {
  schedule: scheduleAutoSave,
  flush: flushAutoSave,
  onFocusOut: onSettingsFocusOut,
  enqueue: enqueueAutoSave,
  markReady: markAutoSaveReady,
  isReady: isAutoSaveReady,
  seedSavedStates: seedAutoSaveStates,
  rememberSaved: rememberAutoSaveState
} = useAutoSaveConfig({
  getKind: autoSaveKind,
  buildPayload: buildAutoSavePayload,
  getError: getAutoSaveError,
  save: patchConfig,
  showError,
  onSaved: async (kind, payload) => {
    if (kind === 'general' && payload.app.auto_start !== lastAutoStart) {
      lastAutoStart = payload.app.auto_start
      await setAutoStart(payload.app.auto_start)
    }
    if (kind === 'shortcuts') await reloadMenu()
  }
})

async function persistChatModelSelection() {
  if (!isAutoSaveReady()) return
  await enqueueAutoSave(async () => {
    const value = aiProviderModel.value
    const parsed = parseScenarioModel(value)
    if (!parsed) return
    const config = modelConfigs.value[parsed.provider]
    if (!config) return
    const models = normalizeModelList(config.models)
    if (!models.some((model) => model.id === parsed.model)) return
    const stateKey = JSON.stringify([parsed.provider, parsed.model, models.map((model) => model.id)])
    if (lastChatModelState === stateKey) return

    const nextConfig = { default: parsed.model, models }
    const nextModels = { ...aiModels.value, [parsed.provider]: nextConfig }
    try {
      const success = await patchConfig({ ai: { provider: parsed.provider, models: nextModels } })
      if (!success) return
      aiModels.value = nextModels
      initialModelConfigs.value = {
        ...initialModelConfigs.value,
        [parsed.provider]: cloneModelConfig(nextConfig)
      }
      modelConfigSources.value = { ...modelConfigSources.value, [parsed.provider]: 'config' }
      lastChatModelState = stateKey
      rememberAutoSaveState('model')
    } catch (e) {
      showError(t('保存失败: {error}', { error: e.message }))
    }
  })
}

const autoSaveSignature = computed(() =>
  JSON.stringify([
    autoUpdate.value,
    autoStart.value,
    closeAction.value,
    updateCheckInterval.value,
    recentToolsLimit.value,
    notifications.value,
    clipboardPersist.value,
    clipboardMaxEntries.value,
    theme.value,
    themeStyle.value,
    fontSize.value,
    language.value,
    aiTimeout.value,
    fallbackEnabled.value,
    fallbackModels.value,
    aiPersona.value,
    aiTemperature.value,
    scenarioPlanner.value,
    scenarioCompression.value,
    aiCompressThreshold.value,
    aiCompressKeepRecent.value,
    aiMaxAttachments.value,
    aiMaxImageMb.value,
    aiMaxTextKb.value,
    agentMaxIterations.value,
    agentTimeoutMin.value,
    agentPlanSteps.value,
    agentParallelTools.value,
    toolResultMaxKb.value,
    toolResultRunKb.value,
    toolResultRetentionDays.value,
    toolPolicy.value,
    databasePageSize.value,
    databaseRefreshInterval.value,
    databaseTransferBatchSize.value,
    databaseHistoryLimit.value,
    databaseSafeMode.value,
    databaseAuditEnabled.value,
    databaseAuditStrict.value,
    databaseOperationLogEnabled.value,
    databaseAuditRules.value,
    databaseEditor.value,
    basePath.value,
    developerChName.value,
    developerEnName.value,
    textEditApp.value,
    databases.value,
    scriptTypes.value,
    proxyMode.value,
    proxyUrl.value,
    proxyBypass.value,
    marketSources.value,
    shortcuts.value
  ])
)

watch(language, (value) => setLocale(value))
watch(autoSaveSignature, () => scheduleAutoSave())
watch(aiProviderModel, () => {
  void persistChatModelSelection()
})

async function runNetworkTest() {
  const saved = await flushAutoSave(true, 'network')
  if (!saved) return
  const url = networkTestUrl.value.trim()
  if (!isHttpUrl(url)) {
    showError(t('请输入有效的 http(s) 地址'))
    return
  }
  networkTesting.value = true
  networkTestResult.value = null
  try {
    const result = await networkTest(url)
    networkTestResult.value = result.ok
      ? {
          ok: true,
          message: t('连接成功（HTTP {status}，{elapsed}ms）', { status: result.status, elapsed: result.elapsedMs })
        }
      : {
          ok: false,
          message: result.error || t('请求失败（HTTP {status}）', { status: result.status })
        }
  } finally {
    networkTesting.value = false
  }
}

function minimizeWindow() {
  windowMinimize()
}
function toggleMaximizeWindow() {
  windowToggleMaximize()
}

async function closeWindow() {
  await flushAutoSave(true)
  windowClose()
}

async function leaveSettings() {
  await flushAutoSave(true)
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
    const result = await validateApiKey(type, apiKey, {
      baseUrl: (aiBaseUrls.value[type] || '').trim()
    })
    const isValid = typeof result === 'object' && result !== null ? result.valid === true : Boolean(result)
    const detail = typeof result === 'object' && result !== null ? String(result.error || '').trim() : ''
    const status =
      typeof result === 'object' && result !== null && result.status
        ? t('（HTTP {status}）', { status: result.status })
        : ''
    apiKeyTestResult.value = {
      ...apiKeyTestResult.value,
      [type]: isValid
        ? { success: true, message: t('{name} 验证成功', { name: t(provider.name) }) }
        : {
            success: false,
            message: detail
              ? t('{name} 验证失败{status}：{detail}', { name: t(provider.name), status, detail })
              : t('{name} 验证失败，请检查密钥是否正确', { name: t(provider.name) })
          }
    }
  } catch (e) {
    apiKeyTestResult.value = {
      ...apiKeyTestResult.value,
      [type]: { success: false, message: t('验证失败: {error}', { error: e.message }) }
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
    setModelFetchState(type, { success: false, message: t('请先填写 API Key 或设置环境变量，再获取最新模型') })
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
        message: t('主进程仍在运行旧版本，请重启应用后再获取最新模型')
      })
      return
    }
    if (!result?.success) {
      setModelFetchState(type, {
        fetching: false,
        success: false,
        message:
          result?.error || t('{name} 模型获取失败，请检查 API Key、网络或服务商接口状态', { name: t(provider.name) })
      })
      return
    }

    const config = modelConfigs.value[type]
    const models = mergeRemoteModels(result.models, config.models)
    if (models.length === 0) {
      setModelFetchState(type, { fetching: false, success: false, message: t('未获取到可用模型') })
      return
    }

    const keepDefault = models.some((model) => model.id === config.default)
    config.models = models
    config.default = keepDefault ? config.default : result.defaultModel || models[0].id
    modelConfigSources.value = { ...modelConfigSources.value, [type]: 'custom' }
    clearExpandedModels(type)
    setModelFetchState(type, {
      fetching: false,
      success: true,
      message: t('已获取 {count} 个可用模型', { count: models.length })
    })
  } catch (e) {
    setModelFetchState(type, {
      fetching: false,
      success: false,
      message: t('获取 {name} 模型失败: {error}', { name: t(provider.name), error: e.message })
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
        message: result?.error || t('恢复内置模型失败')
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
    setModelFetchState(type, { fetching: false, success: true, message: t('已恢复内置模型列表') })
  } catch (e) {
    setModelFetchState(type, {
      fetching: false,
      success: false,
      message: t('恢复内置模型失败: {error}', { error: e.message })
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

  if (pendingProviders.value[type] && !hasStoredApiKey(type) && !provider.hasEnvKey) {
    showError(t('请先填写 API Key'))
    return
  }

  const baseUrl = (aiBaseUrls.value[type] || '').trim()
  if (!isValidBaseUrl(baseUrl)) {
    showError(t('{name} 的 API 地址必须是有效的 http(s) URL', { name: t(provider.name) }))
    return
  }

  const models = normalizeModelList(config.models)
  if (models.length === 0) {
    showError(t('请至少保留一个模型'))
    return
  }
  const duplicate = models.find((model, index) => models.findIndex((item) => item.id === model.id) !== index)
  if (duplicate) {
    showError(t('模型 ID "{id}" 重复', { id: duplicate.id }))
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
    const nextAiProvider = visibleProviders.value.some((item) => item.type === aiProvider.value)
      ? aiProvider.value
      : type
    aiProvider.value = nextAiProvider
    const success = await patchConfig({
      ai: {
        provider: nextAiProvider,
        keys: nextApiKeys,
        base_urls: nextBaseUrls,
        models: nextModels
      }
    })
    if (!success) {
      showError(t('保存失败，请检查配置'))
      return
    }

    savedApiKeys.value = nextApiKeys
    savedBaseUrls.value = nextBaseUrls
    aiModels.value = nextModels
    if (pendingProviders.value[type]) {
      const nextPending = { ...pendingProviders.value }
      delete nextPending[type]
      pendingProviders.value = nextPending
    }
    await reloadConfig()

    const providers = await getAiProviders()
    if (Array.isArray(providers) && providers.length > 0) aiProviders.value = providers

    const savedProvider = aiProviders.value.find((item) => item.type === type) || provider
    const { config: savedConfig, initial: savedInitial, source } = createProviderModelConfig(savedProvider)
    modelConfigs.value = { ...modelConfigs.value, [type]: savedConfig }
    initialModelConfigs.value = { ...initialModelConfigs.value, [type]: savedInitial }
    modelConfigSources.value = { ...modelConfigSources.value, [type]: source }
    clearExpandedModels(type)
    showSuccess(t('{name} 配置已保存', { name: t(provider.name) }))
  } catch (e) {
    showError(t('保存失败: {error}', { error: e.message }))
  } finally {
    providerSaving.value = { ...providerSaving.value, [type]: false }
  }
}

function cancelProviderCard(provider) {
  const type = provider.type

  aiApiKeys.value = { ...aiApiKeys.value, [type]: savedApiKeys.value[type] || '' }
  aiBaseUrls.value = { ...aiBaseUrls.value, [type]: savedBaseUrls.value[type] || '' }
  resetApiKeyVisibility(type)

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

  if (pendingProviders.value[type] && !hasProviderKey(type)) {
    const nextPending = { ...pendingProviders.value }
    delete nextPending[type]
    pendingProviders.value = nextPending
    expandedProviders.value = { ...expandedProviders.value, [type]: false }
    if (aiProvider.value === type) {
      aiProvider.value = aiProviders.value.find((item) => hasProviderKey(item.type))?.type || ''
    }
  }
}

function openProviderDocs(provider) {
  if (provider?.docsUrl) {
    openExternal(provider.docsUrl)
  }
}
</script>

<style scoped src="../styles/settings.css"></style>
