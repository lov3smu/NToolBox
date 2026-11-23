<template>
  <PageLayout tool-path="/chat">
    <div class="chat-layout">
      <SessionRail
        v-if="!chatSidebarCollapsed"
        v-model:editing-title="editingTitle"
        v-model:search="sessionSearch"
        :width="chatSidebarWidth"
        :workspace-groups="workspaceGroups"
        :collapsed-groups="collapsedGroups"
        :current-session-id="currentSessionId"
        :session-menu="sessionMenu"
        :workspace-menu="workspaceMenu"
        :editing-session-id="editingSessionId"
        :search-open="sessionSearchOpen"
        :workspace-open="workspaceSectionOpen"
        :rail-more-open="railMoreOpen"
        :show-archived="showArchived"
        :format-time="formatTime"
        @new-chat="createNewChat"
        @open-knowledge="openKnowledgePage"
        @open-market="router.push('/market')"
        @add-workspace="openWorkspaceDialog"
        @toggle-search="toggleSessionSearch"
        @toggle-workspace="workspaceSectionOpen = !workspaceSectionOpen"
        @toggle-group="toggleGroup"
        @select-session="selectSession"
        @session-menu="toggleSessionMenu"
        @workspace-menu="toggleWorkspaceMenu"
        @workspace-new-chat="createWorkspaceChat"
        @save-title="saveEditTitle"
        @cancel-title="cancelEditTitle"
        @toggle-rail-more="railMoreOpen = !railMoreOpen"
        @rail-more="onRailMore"
        @clear-menu="closeRailMenus"
        @collapse="collapseChatSidebar"
      />
      <SplitHandle
        v-if="!chatSidebarCollapsed"
        orientation="vertical"
        :resizing="chatSidebarResizing"
        :label="t('拖动调整会话列表宽度')"
        @pointerdown="startChatSidebarResize"
        @keydown="onChatSidebarKeydown"
      />
      <main class="chat-main">
        <div v-if="showKeyWarning" class="api-key-banner">
          <span>{{
            t('{provider} 尚未配置 API Key，AI 助手暂不可用', { provider: currentProvider?.name || t('当前服务商') })
          }}</span>
          <button class="btn btn-secondary btn-sm" @click="openSettings('api')">{{ t('去设置') }}</button>
        </div>
        <div class="chat-header">
          <button
            v-if="chatSidebarCollapsed"
            class="rail-restore"
            :title="t('展开会话侧栏')"
            @click="expandChatSidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
              <polyline points="9.5 10 12 12 9.5 14" />
            </svg>
          </button>
          <div class="chat-view-tabs" role="tablist" :aria-label="t('聊天视图切换')">
            <button
              type="button"
              role="tab"
              class="chat-view-tab"
              :class="{ active: chatTab === 'chat' }"
              :aria-selected="chatTab === 'chat'"
              @click="switchChatTab('chat')"
            >
              {{ t('对话') }}
              <span
                v-if="pendingApprovals.length"
                class="chat-tab-dot"
                :title="t('{count} 个操作等待授权', { count: pendingApprovals.length })"
              />
            </button>
            <button
              type="button"
              role="tab"
              class="chat-view-tab"
              :class="{ active: chatTab === 'traces' }"
              :aria-selected="chatTab === 'traces'"
              @click="switchChatTab('traces')"
            >
              {{ t('轨迹') }}
            </button>
            <button
              type="button"
              role="tab"
              class="chat-view-tab"
              :class="{ active: chatTab === 'memory' }"
              :aria-selected="chatTab === 'memory'"
              @click="switchChatTab('memory')"
            >
              {{ t('记忆') }}
            </button>
          </div>
          <button
            class="header-icon-btn"
            :class="{ active: contextPanelOpen }"
            :title="contextPanelOpen ? t('收起上下文面板') : t('展开上下文面板')"
            @click="toggleContextPanel"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
              <line x1="18" y1="9" x2="18.01" y2="9" />
              <line x1="18" y1="12" x2="18.01" y2="12" />
              <line x1="18" y1="15" x2="18.01" y2="15" />
            </svg>
          </button>
        </div>
        <div v-show="chatTab === 'chat'" class="messages-wrap">
          <MessageList
            ref="messageListRef"
            :messages="currentMessages"
            :starter-prompts="starterPrompts"
            :empty-label="emptyWorkspaceLabel"
            :rollback-busy="rollbackBusy"
            :format-tokens="formatTokens"
            @scroll="handleMessagesScroll"
            @use-starter="useStarter"
            @respond-approval="respondApproval"
            @open-trace="openRunTrace"
            @copy="copyMessage"
            @rollback="requestRollback"
          />
          <aside v-if="currentMessages.length" ref="questionRail" class="question-rail">
            <div ref="questionList" class="question-list">
              <button
                v-for="question in questions"
                :key="question.index"
                type="button"
                class="question-mark"
                :aria-label="question.text"
                @click="jumpToQuestion(question.index)"
                @mouseenter="showQuestionTip(question, $event)"
                @mouseleave="hideQuestionTip"
                @focus="showQuestionTip(question, $event)"
                @blur="hideQuestionTip"
              />
            </div>
            <div v-if="hoveredQuestion" class="question-tip" :style="{ top: `${questionTipTop}px` }">
              {{ hoveredQuestion.text }}
            </div>
            <button
              type="button"
              class="scroll-latest"
              :class="{ active: !atBottom }"
              :disabled="atBottom"
              :title="t('滚到最后')"
              :aria-label="t('滚到最后')"
              @click="scrollToLatest"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="6 13 12 19 18 13" />
              </svg>
            </button>
          </aside>
        </div>
        <RunTracePanel
          v-if="chatTab === 'traces'"
          :key="tracePanelKey"
          :focus-run-id="traceFocusId"
          :conversation-id="currentSession?.id || ''"
        />
        <MemoryPanel
          v-if="chatTab === 'memory'"
          :workspace="currentSession?.workspace || ''"
          @bind-workspace="pickWorkspace"
          @open-knowledge="openKnowledgePage"
        />
        <Transition name="dock-slide">
          <div
            v-if="chatTab === 'chat' && pendingApprovals.length"
            class="approval-dock"
            role="alertdialog"
            :aria-label="t('等待授权的操作')"
          >
            <div class="approval-dock-head">
              <span class="approval-dock-badge">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
                {{ t('等待授权') }}
              </span>
              <span class="approval-dock-copy">
                {{
                  t('AI 需要确认 {count} 个{risk}操作后才能继续', {
                    count: pendingApprovals.length,
                    risk: pendingApprovals[0]?.risk === 'destructive' ? t('高危') : t('写')
                  })
                }}
              </span>
            </div>
            <div class="approval-dock-list">
              <ChatApprovalCard
                v-for="approval in pendingApprovals"
                :key="approval.approvalId"
                :approval="approval"
                compact
                @respond="respondApproval"
              />
            </div>
          </div>
        </Transition>
        <div v-show="chatTab === 'chat'" class="composer-area">
          <div class="composer">
            <div v-if="attachments.length" class="composer-attachments">
              <div v-for="att in attachments" :key="att.id" class="attachment-chip">
                <img v-if="att.kind === 'image'" :src="att.dataUrl" :alt="att.name" />
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span class="attachment-name">{{ att.name }}</span>
                <button class="attachment-remove" :title="t('移除')" @click="removeAttachment(att.id)">×</button>
              </div>
            </div>
            <textarea
              ref="inputRef"
              v-model="inputText"
              class="composer-input"
              :placeholder="composerPlaceholder"
              :disabled="!hasCurrentApiKey"
              @input="resizeInput"
              @keydown="onComposerKeydown"
            />
            <div class="composer-toolbar">
              <div class="toolbar-left">
                <div class="plus-wrap">
                  <button class="composer-icon-btn plus-btn" :title="t('快捷指令')" @click.stop="toggleCommandMenu">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <div v-if="commandMenuOpen" v-clamp-viewport class="plus-menu command-menu" @click.stop>
                    <button type="button" @click="insertCommandTemplate(t('目标：'))">{{ t('目标') }}</button>
                    <button type="button" @click="insertCommandTemplate(t('计划：'))">{{ t('计划') }}</button>
                  </div>
                </div>
                <div class="plus-wrap">
                  <button
                    class="composer-icon-btn"
                    :title="t('添加附件')"
                    @click.stop="attachMenuOpen = !attachMenuOpen"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path
                        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
                      />
                    </svg>
                  </button>
                  <div v-if="attachMenuOpen" v-clamp-viewport class="plus-menu" @click.stop>
                    <button
                      :disabled="!modelSupportsImage"
                      :title="modelSupportsImage ? t('添加图片') : t('当前模型未启用图片输入')"
                      @click="chooseImages"
                    >
                      {{ t('添加图片') }}
                    </button>
                    <button @click="chooseFiles">{{ t('添加文件') }}</button>
                  </div>
                </div>
                <label class="composer-select" :title="t('工具审批模式')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="8 12 11 15 16 9" />
                  </svg>
                  <select v-model="approvalMode">
                    <option value="all">{{ t('写操作前询问') }}</option>
                    <option value="high-risk">{{ t('仅高危操作询问') }}</option>
                    <option value="auto">{{ t('自动执行') }}</option>
                    <option value="chat">{{ t('仅对话') }}</option>
                  </select>
                  <svg
                    class="chevron"
                    viewBox="0 0 24 24"
                    width="11"
                    height="11"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </label>
              </div>
              <div class="toolbar-right">
                <div class="model-picker-wrap">
                  <button
                    v-if="selectableProviders.length > 0"
                    type="button"
                    class="model-chip"
                    :class="{ open: modelMenuOpen }"
                    :title="t('选择模型与推理等级')"
                    @click.stop="toggleModelMenu"
                  >
                    <span class="model-chip-name">{{ selectedModelInfo?.name || selectedModel || t('选择模型') }}</span>
                    <span v-if="modelSupportsThinking" class="model-chip-level">{{ reasoningLevelLabel }}</span>
                    <svg
                      class="chevron"
                      :class="{ open: modelMenuOpen }"
                      viewBox="0 0 24 24"
                      width="11"
                      height="11"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <span v-else class="model-chip disabled" :title="t('请先在设置 > 模型中配置 API Key 与模型')">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
                    </svg>
                    {{ t('未配置模型') }}
                  </span>
                  <div v-if="modelMenuOpen" v-clamp-viewport class="model-menu" @click.stop>
                    <template v-if="modelMenuView === 'root'">
                      <button type="button" class="model-menu-row" @click="modelMenuView = 'models'">
                        <span class="model-menu-key">{{ t('模型') }}</span>
                        <span class="model-menu-value">
                          <span class="model-menu-value-text">{{ selectedModelInfo?.name || t('未选择') }}</span>
                          <svg
                            viewBox="0 0 24 24"
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </button>
                      <button
                        v-if="modelSupportsThinking"
                        type="button"
                        class="model-menu-row"
                        @click="modelMenuView = 'levels'"
                      >
                        <span class="model-menu-key">{{ t('推理等级') }}</span>
                        <span class="model-menu-value">
                          <span class="model-menu-value-text">{{ reasoningLevelLabel }}</span>
                          <svg
                            viewBox="0 0 24 24"
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </button>
                    </template>
                    <template v-else-if="modelMenuView === 'models'">
                      <div class="model-menu-head">
                        <button
                          type="button"
                          class="model-menu-back"
                          :title="t('返回')"
                          @click="modelMenuView = 'root'"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <span>{{ t('选择模型') }}</span>
                      </div>
                      <div class="model-menu-list">
                        <div v-for="provider in selectableProviders" :key="provider.type" class="model-menu-group">
                          <div class="model-menu-group-title">{{ t(provider.name) }}</div>
                          <button
                            v-for="model in provider.models || []"
                            :key="`${provider.type}::${model.id}`"
                            type="button"
                            class="model-menu-option"
                            :class="{
                              active: provider.type === selectedProvider && model.id === selectedModel
                            }"
                            @click="chooseModel(provider.type, model.id)"
                          >
                            <span class="model-menu-option-name">{{ model.name }}</span>
                            <span
                              v-if="provider.type === selectedProvider && model.id === selectedModel"
                              class="model-menu-dot"
                              :title="t('当前选中')"
                              :aria-label="t('当前选中')"
                            />
                          </button>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div class="model-menu-head">
                        <button
                          type="button"
                          class="model-menu-back"
                          :title="t('返回')"
                          @click="modelMenuView = 'root'"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <span>{{ t('推理等级') }}</span>
                      </div>
                      <div class="model-menu-list">
                        <button
                          v-for="level in reasoningLevels"
                          :key="level.value"
                          type="button"
                          class="model-menu-option"
                          :class="{ active: thinkingMode === level.value }"
                          @click="chooseReasoningLevel(level.value)"
                        >
                          <span class="model-menu-option-name">
                            {{ t(level.label) }}
                            <span class="model-menu-option-hint">{{ t(level.hint) }}</span>
                          </span>
                          <svg
                            v-if="thinkingMode === level.value"
                            class="model-menu-check"
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.4"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
                <button
                  v-if="!loading"
                  class="send-circle"
                  :disabled="!canSend"
                  :title="t('发送')"
                  @click="sendMessage"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="6 11 12 5 18 11" />
                  </svg>
                </button>
                <button v-else class="send-circle stop" :title="t('停止')" @click="stopResponse">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div class="composer-meta">
            <div class="composer-workspace">
              <button
                v-if="!currentSession?.workspace"
                type="button"
                class="composer-workspace-pick"
                :title="t('为当前会话绑定工作区，绑定后不可更换')"
                @click="pickWorkspace"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <line x1="12" y1="10.5" x2="12" y2="15.5" />
                  <line x1="9.5" y1="13" x2="14.5" y2="13" />
                </svg>
                <span>{{ t('选择工作区') }}</span>
              </button>
              <WorkspaceHoverCard
                v-else
                inline
                :name="workspaceLabel(currentSession.workspace)"
                :path="currentSession.workspace"
                :description="workspaceDescription(currentSession.workspace)"
                :icon="workspaceIconId(currentSession.workspace)"
                :color="workspaceIconColor(currentSession.workspace)"
              >
                <span class="composer-workspace-bound">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    :style="
                      workspaceIconColor(currentSession.workspace)
                        ? { color: workspaceIconColor(currentSession.workspace) }
                        : null
                    "
                  >
                    <path :d="workspaceIconPath(currentSession.workspace)" />
                  </svg>
                  <span class="composer-workspace-name">{{ workspaceLabel(currentSession.workspace) }}</span>
                  <span class="composer-workspace-tag">{{ t('已绑定') }}</span>
                </span>
              </WorkspaceHoverCard>
            </div>
            <div v-if="currentMessages.length" class="chat-stats">
              <button
                class="stat-chip"
                :class="{ open: usageDetail === 'context' }"
                :aria-expanded="usageDetail === 'context'"
                :title="t('点击查看上下文详情')"
                @click.stop="toggleUsageDetail('context')"
              >
                <span class="stat-ring" :class="contextState" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <circle class="ring-track" cx="12" cy="12" r="9" />
                    <circle class="ring-value" cx="12" cy="12" r="9" :style="contextRingStyle" />
                  </svg>
                </span>
                <span class="stat-text"
                  >{{ t('上下文') }} <b>{{ contextPercent }}%</b></span
                >
              </button>
              <button
                class="stat-chip"
                :class="{ open: usageDetail === 'rate' }"
                :disabled="!hasRateData"
                :aria-expanded="usageDetail === 'rate'"
                :title="hasRateData ? t('点击查看速率详情') : t('暂无速率数据')"
                @click.stop="toggleUsageDetail('rate')"
              >
                <span class="stat-text"
                  >{{ t('速率') }} <b>{{ rateDisplay }}</b></span
                >
              </button>
              <button
                class="stat-chip"
                :class="{ open: usageDetail === 'total' }"
                :disabled="!hasUsageData"
                :aria-expanded="usageDetail === 'total'"
                :title="hasUsageData ? t('点击查看 token 用量详情') : t('暂无用量数据')"
                @click.stop="toggleUsageDetail('total')"
              >
                <span class="stat-text"
                  >{{ t('累计') }} <b>{{ totalDisplay }}</b></span
                >
              </button>
              <button
                class="stat-chip"
                :class="{ open: usageDetail === 'cache' }"
                :disabled="!hasCacheData"
                :aria-expanded="usageDetail === 'cache'"
                :title="hasCacheData ? t('点击查看缓存命中详情') : t('暂无缓存数据')"
                @click.stop="toggleUsageDetail('cache')"
              >
                <span class="stat-text"
                  >{{ t('缓存命中') }} <b>{{ cacheDisplay }}</b></span
                >
              </button>

              <div v-if="usageDetail" v-clamp-viewport class="usage-pop" @click.stop>
                <template v-if="usageDetail === 'context'">
                  <div class="usage-pop-title">{{ t('上下文使用') }}</div>
                  <div class="usage-pop-grid">
                    <span>{{ t('窗口大小') }}</span
                    ><b>{{ formatTokens(contextWindowSize) }} tokens</b> <span>{{ t('已用') }}</span
                    ><b>{{ formatTokens(contextTokens) }} tokens</b> <span>{{ t('剩余') }}</span
                    ><b>{{ formatTokens(remainingContextTokens) }} tokens</b> <span>{{ t('占比') }}</span
                    ><b :class="contextState">{{ contextPercent }}%</b>
                  </div>
                  <div v-if="currentSession?.context" class="usage-pop-note">
                    {{
                      t('已压缩 {before} → {after} tokens', {
                        before: formatTokens(currentSession.context.beforeTokens),
                        after: formatTokens(currentSession.context.afterTokens)
                      })
                    }}
                  </div>
                </template>
                <template v-else-if="usageDetail === 'rate'">
                  <div class="usage-pop-title">{{ t('Token 速率') }}</div>
                  <div class="usage-pop-grid">
                    <span>{{ t('生成速率') }}</span
                    ><b>{{ sessionTokenRate }} t/s</b> <span>{{ t('输出 tokens') }}</span
                    ><b>{{ formatTokens(sessionCompletionTokens) }}</b> <span>{{ t('生成耗时') }}</span
                    ><b>{{ generationMs ? formatDuration(generationMs) : '--' }}</b> <span>{{ t('请求次数') }}</span
                    ><b>{{ t('{count} 次', { count: sessionCallCount }) }}</b>
                  </div>
                  <div v-if="!generationMs" class="usage-pop-note">
                    {{ t('旧会话缺少计时数据，速率从下一条回复开始统计') }}
                  </div>
                </template>
                <template v-else-if="usageDetail === 'total'">
                  <div class="usage-pop-title">{{ t('Token 用量') }}</div>
                  <div class="usage-pop-grid">
                    <span>{{ t('输入') }}</span
                    ><b>{{ formatTokens(sessionPromptTokens) }}</b> <span>{{ t('输出') }}</span
                    ><b>{{ formatTokens(sessionCompletionTokens) }}</b> <span>{{ t('合计') }}</span
                    ><b>{{ formatTokens(sessionTokenTotal) }}</b> <span>{{ t('请求次数') }}</span
                    ><b>{{ t('{count} 次', { count: sessionCallCount }) }}</b>
                  </div>
                  <div v-if="sessionUsageEstimated" class="usage-pop-note">{{ t('部分用量为本地估算值') }}</div>
                </template>
                <template v-else>
                  <div class="usage-pop-title">{{ t('缓存命中') }}</div>
                  <div class="usage-pop-grid">
                    <span>{{ t('命中率') }}</span
                    ><b>{{ cacheHitPercent }}%</b> <span>{{ t('命中 tokens') }}</span
                    ><b>{{ formatTokens(sessionCachedTokens) }}</b> <span>{{ t('提示 tokens') }}</span
                    ><b>{{ formatTokens(sessionPromptTokens) }}</b> <span>{{ t('未命中') }}</span
                    ><b>{{ formatTokens(unCachedTokens) }}</b>
                  </div>
                  <div class="usage-pop-note">{{ t('命中率基于服务商返回的缓存用量，未返回时显示 0%') }}</div>
                </template>
              </div>
            </div>
          </div>
        </div>
        <input ref="imageInput" type="file" accept="image/*" multiple class="hidden-file" @change="onImagePicked" />
        <input ref="fileInput" type="file" multiple class="hidden-file" @change="onFilePicked" />
      </main>
      <div v-if="contextPanelOpen" class="context-scrim" @click="toggleContextPanel" />
      <template v-if="contextPanelOpen">
        <div class="context-resize-handle" @mousedown="startContextResize" />
        <aside class="context-panel" :style="{ width: `${contextPanelWidth}px` }">
          <div class="context-head">
            <div class="context-head-title">
              <span class="context-head-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 5h16M4 12h10M4 19h7" />
                  <circle cx="18" cy="12" r="2" />
                  <circle cx="15" cy="19" r="2" />
                </svg>
              </span>
              <span>{{ t('上下文') }}</span>
            </div>
            <button class="context-close" :title="t('收起面板')" @click="toggleContextPanel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div v-if="!currentSession" class="context-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
            <p>{{ t('创建会话后查看上下文') }}</p>
          </div>

          <div v-else class="context-scroll">
            <section class="ctx-overview">
              <div class="ctx-updated">
                <span class="ctx-live-dot" :class="{ active: loading }" />
                {{ t('更新于 {time}', { time: formatDateTime(currentSession.updatedAt) }) }}
              </div>
              <div class="ctx-overview-title">{{ currentSession.title || t('新会话') }}</div>
              <div class="ctx-overview-desc">
                {{ currentSession.workspace ? t('工作区协作会话') : t('尚未绑定工作区') }} ·
                {{ currentProvider?.name || t('未选择服务商') }}
              </div>
              <div class="ctx-metrics">
                <div>
                  <strong>{{ turnCount }}</strong>
                  <span>{{ t('轮对话') }}</span>
                </div>
                <div>
                  <strong>{{ sessionToolRuns.length }}</strong>
                  <span>{{ t('次工具') }}</span>
                </div>
                <div>
                  <strong>{{ formatTokens(sessionTokenTotal) }}</strong>
                  <span>tokens</span>
                </div>
              </div>
            </section>

            <section class="ctx-section" :class="{ 'is-collapsed': isSectionCollapsed('env') }">
              <button
                type="button"
                class="ctx-section-head"
                :aria-expanded="!isSectionCollapsed('env')"
                @click="toggleSectionCollapsed('env')"
              >
                <span class="ctx-section-title">{{ t('环境信息') }}</span>
                <span v-if="currentSession.workspace" class="ctx-link is-static">{{ t('已绑定') }}</span>
                <svg class="ctx-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div v-show="!isSectionCollapsed('env')">
                <div v-if="!currentSession.workspace" class="ctx-empty-row">
                  <span>{{ t('未绑定工作区，可在输入框下方选择') }}</span>
                </div>
                <div v-else class="ctx-env">
                  <div class="env-row">
                    <span class="env-key">{{ t('工作区') }}</span>
                    <button class="env-value link" :title="currentSession.workspace" @click="openWorkspaceRoot">
                      {{ workspaceLabel(currentSession.workspace) }}
                    </button>
                  </div>
                  <div v-if="workspaceDescription(currentSession.workspace)" class="env-row">
                    <span class="env-key">{{ t('描述') }}</span>
                    <span class="env-value">{{ workspaceDescription(currentSession.workspace) }}</span>
                  </div>
                  <div class="env-row">
                    <span class="env-key">{{ t('目录') }}</span>
                    <span class="env-value mono" :title="currentSession.workspace">{{ currentSession.workspace }}</span>
                  </div>
                  <div class="env-row">
                    <span class="env-key">{{ t('版本') }}</span>
                    <span class="env-value">
                      <template v-if="workspaceInfo?.isGit">
                        <span class="env-branch">{{ workspaceInfo.branch || 'detached' }}</span>
                        <span v-if="workspaceInfo.ahead" class="env-ahead">↑{{ workspaceInfo.ahead }}</span>
                        <span v-if="workspaceInfo.behind" class="env-behind">↓{{ workspaceInfo.behind }}</span>
                      </template>
                      <span v-else class="env-muted">{{
                        workspaceInfoLoading ? t('读取中...') : t('非 Git 仓库')
                      }}</span>
                    </span>
                  </div>
                  <div class="env-row">
                    <span class="env-key">{{ t('变更') }}</span>
                    <span class="env-value">
                      <span v-if="workspaceInfo && workspaceInfo.isGit" class="env-change">
                        <span :class="['env-change-dot', { clean: !workspaceInfo.changes }]" />
                        {{
                          workspaceInfo.changes ? t('{count} 个文件', { count: workspaceInfo.changes }) : t('无变更')
                        }}
                      </span>
                      <span v-else class="env-muted">--</span>
                    </span>
                  </div>
                  <div v-if="workspaceInfo?.lastCommit" class="env-row">
                    <span class="env-key">{{ t('提交') }}</span>
                    <span class="env-value" :title="workspaceInfo.lastCommit.subject">
                      {{ workspaceInfo.lastCommit.subject }}
                    </span>
                  </div>
                  <div v-if="workspaceInfo?.error" class="ctx-alert">{{ workspaceInfo.error }}</div>
                </div>
              </div>
            </section>

            <section class="ctx-section" :class="{ 'is-collapsed': isSectionCollapsed('subagents') }">
              <button
                type="button"
                class="ctx-section-head"
                :aria-expanded="!isSectionCollapsed('subagents')"
                @click="toggleSectionCollapsed('subagents')"
              >
                <span class="ctx-section-title">{{ t('子智能体') }}</span>
                <span class="ctx-count">{{ workspaceSubagents.length }}</span>
                <svg class="ctx-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div v-show="!isSectionCollapsed('subagents')">
                <div v-if="workspaceSubagents.length === 0" class="ctx-empty-row">
                  {{ t('暂无子智能体任务') }}
                </div>
                <div v-else class="ctx-list">
                  <div
                    v-for="run in visibleItems(workspaceSubagents, 'subagents', 4)"
                    :key="run.key"
                    class="ctx-run"
                    :class="run.status"
                  >
                    <span class="ctx-run-dot" />
                    <div class="ctx-run-main">
                      <span class="ctx-run-name">{{ run.task }}</span>
                      <span class="ctx-run-meta">
                        {{ run.statusText }}{{ run.duration ? ` · ${formatDuration(run.duration)}` : '' }}
                      </span>
                    </div>
                  </div>
                  <button v-if="workspaceSubagents.length > 4" class="ctx-more" @click="toggleSection('subagents')">
                    {{
                      expandedSections.subagents
                        ? t('收起')
                        : t('查看更多 ({count})', { count: workspaceSubagents.length - 4 })
                    }}
                  </button>
                </div>
              </div>
            </section>

            <section class="ctx-section" :class="{ 'is-collapsed': isSectionCollapsed('runs') }">
              <button
                type="button"
                class="ctx-section-head"
                :aria-expanded="!isSectionCollapsed('runs')"
                @click="toggleSectionCollapsed('runs')"
              >
                <span class="ctx-section-title">{{ t('后台进程') }}</span>
                <span class="ctx-count">{{ workspaceToolRuns.length }}</span>
                <svg class="ctx-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div v-show="!isSectionCollapsed('runs')">
                <div v-if="workspaceToolRuns.length === 0" class="ctx-empty-row">{{ t('暂无工具执行记录') }}</div>
                <div v-else class="ctx-list">
                  <div
                    v-for="run in visibleItems(workspaceToolRuns, 'runs', 4)"
                    :key="run.key"
                    class="ctx-run"
                    :class="run.status"
                  >
                    <span class="ctx-run-dot" />
                    <div class="ctx-run-main">
                      <span class="ctx-run-name">{{ run.name }}</span>
                      <span class="ctx-run-meta">
                        {{ run.statusText }}{{ run.duration ? ` · ${formatDuration(run.duration)}` : '' }}
                      </span>
                    </div>
                  </div>
                  <button v-if="workspaceToolRuns.length > 4" class="ctx-more" @click="toggleSection('runs')">
                    {{
                      expandedSections.runs
                        ? t('收起')
                        : t('查看更多 ({count})', { count: workspaceToolRuns.length - 4 })
                    }}
                  </button>
                </div>
              </div>
            </section>

            <section class="ctx-section" :class="{ 'is-collapsed': isSectionCollapsed('artifacts') }">
              <button
                type="button"
                class="ctx-section-head"
                :aria-expanded="!isSectionCollapsed('artifacts')"
                @click="toggleSectionCollapsed('artifacts')"
              >
                <span class="ctx-section-title">{{ t('产出') }}</span>
                <span class="ctx-count">{{ workspaceArtifacts.length }}</span>
                <svg class="ctx-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div v-show="!isSectionCollapsed('artifacts')">
                <div v-if="workspaceArtifacts.length === 0" class="ctx-empty-row">
                  {{ t('AI 写入的文件会显示在这里') }}
                </div>
                <div v-else class="ctx-list">
                  <button
                    v-for="item in visibleItems(workspaceArtifacts, 'artifacts', 4)"
                    :key="item.key"
                    class="ctx-file"
                    :title="item.target || item.path"
                    @click="openSource(item)"
                  >
                    <span class="ctx-file-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </span>
                    <span class="ctx-file-copy">
                      <span class="ctx-file-name">{{ item.label }}</span>
                      <span class="ctx-file-path">{{ item.detail }}</span>
                    </span>
                  </button>
                  <button v-if="workspaceArtifacts.length > 4" class="ctx-more" @click="toggleSection('artifacts')">
                    {{
                      expandedSections.artifacts
                        ? t('收起')
                        : t('查看更多 ({count})', { count: workspaceArtifacts.length - 4 })
                    }}
                  </button>
                </div>
              </div>
            </section>

            <section class="ctx-section" :class="{ 'is-collapsed': isSectionCollapsed('web') }">
              <button
                type="button"
                class="ctx-section-head"
                :aria-expanded="!isSectionCollapsed('web')"
                @click="toggleSectionCollapsed('web')"
              >
                <span class="ctx-section-title">{{ t('网页查阅') }}</span>
                <span class="ctx-count">{{ workspaceWebPages.length }}</span>
                <svg class="ctx-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div v-show="!isSectionCollapsed('web')">
                <div v-if="workspaceWebPages.length === 0" class="ctx-empty-row">
                  {{ t('AI 阅读的网页会显示在这里') }}
                </div>
                <div v-else class="ctx-list">
                  <button
                    v-for="item in visibleItems(workspaceWebPages, 'web', 4)"
                    :key="item.key"
                    class="ctx-web"
                    :title="item.url"
                    @click="openSource(item)"
                  >
                    <span class="ctx-web-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="9" />
                        <path
                          d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z"
                        />
                      </svg>
                    </span>
                    <span class="ctx-web-copy">
                      <span class="ctx-web-title">{{ item.label }}</span>
                      <span class="ctx-web-host">{{ item.detail }}</span>
                    </span>
                  </button>
                  <button v-if="workspaceWebPages.length > 4" class="ctx-more" @click="toggleSection('web')">
                    {{
                      expandedSections.web
                        ? t('收起')
                        : t('查看更多 ({count})', { count: workspaceWebPages.length - 4 })
                    }}
                  </button>
                </div>
              </div>
            </section>

            <section class="ctx-section" :class="{ 'is-collapsed': isSectionCollapsed('sources') }">
              <button
                type="button"
                class="ctx-section-head"
                :aria-expanded="!isSectionCollapsed('sources')"
                @click="toggleSectionCollapsed('sources')"
              >
                <span class="ctx-section-title">{{ t('来源') }}</span>
                <span class="ctx-count">{{ workspaceSources.length }}</span>
                <svg class="ctx-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div v-show="!isSectionCollapsed('sources')">
                <div v-if="workspaceSources.length === 0" class="ctx-empty-row">{{ t('暂无引用来源') }}</div>
                <div v-else class="ctx-list">
                  <button
                    v-for="item in visibleItems(workspaceSources, 'sources', 5)"
                    :key="item.key"
                    class="ctx-source"
                    :class="{ disabled: !item.target }"
                    :title="item.detail || item.label"
                    @click="openSource(item)"
                  >
                    <span class="ctx-source-type">{{ sourceTypeLabel(item.type) }}</span>
                    <span class="ctx-source-copy">
                      <span class="ctx-source-name">{{ item.label }}</span>
                      <span class="ctx-source-detail">{{ item.detail }}</span>
                    </span>
                  </button>
                  <button v-if="workspaceSources.length > 5" class="ctx-more" @click="toggleSection('sources')">
                    {{
                      expandedSections.sources
                        ? t('收起')
                        : t('查看更多 ({count})', { count: workspaceSources.length - 5 })
                    }}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div class="context-foot">{{ t('上下文仅保存在本机') }}</div>
        </aside>
      </template>
    </div>
    <Teleport to="body">
      <div
        v-if="sessionMenu"
        v-clamp-viewport
        class="session-menu"
        :style="{ left: `${sessionMenu.x}px`, top: `${sessionMenu.y}px` }"
        @click.stop
      >
        <button @click="handleSessionAction('pin')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 17v5" />
            <path d="M9 10.8V4h6v6.8l2 2.7V16H7v-2.5z" />
          </svg>
          <span>{{ menuSession?.pinned ? t('取消置顶') : t('置顶会话') }}</span>
        </button>
        <button @click="handleSessionAction('rename')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>{{ t('重命名') }}</span>
        </button>
        <button @click="handleSessionAction('fork')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <span>{{ t('分叉会话') }}</span>
        </button>
        <div class="session-menu-divider" />
        <button @click="handleSessionAction('copyId')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{{ t('复制 Session ID') }}</span>
        </button>
        <button
          :disabled="!menuSession?.workspace"
          :title="menuSession?.workspace ? t('在文件夹显示') : t('当前会话未关联工作区')"
          @click="handleSessionAction('reveal')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span>{{ t('在文件夹显示') }}</span>
        </button>
        <div class="session-menu-divider" />
        <button @click="handleSessionAction('archive')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
          <span>{{ menuSession?.archived ? t('取消归档') : t('归档会话') }}</span>
        </button>
        <button class="danger" @click="handleSessionAction('delete')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          <span>{{ t('删除会话') }}</span>
        </button>
      </div>
      <div
        v-if="workspaceMenu"
        v-clamp-viewport
        class="session-menu"
        :style="{ left: `${workspaceMenu.x}px`, top: `${workspaceMenu.y}px` }"
        @click.stop
      >
        <button @click="handleWorkspaceAction('pin')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 17v5" />
            <path d="M9 10.8V4h6v6.8l2 2.7V16H7v-2.5z" />
          </svg>
          <span>{{ workspaceMenuMeta?.pinned ? t('取消置顶') : t('置顶工作区') }}</span>
        </button>
        <button @click="handleWorkspaceAction('edit')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>{{ t('修改工作区') }}</span>
        </button>
        <div class="session-menu-divider" />
        <button @click="handleWorkspaceAction('archive')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
          <span>{{ workspaceMenuMeta?.archived ? t('取消归档') : t('归档工作区') }}</span>
        </button>
        <button class="danger" @click="handleWorkspaceAction('delete')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          <span>{{ t('删除工作区') }}</span>
        </button>
      </div>
    </Teleport>
    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
    <MessageDialog
      :visible="Boolean(deleteTarget)"
      type="confirm"
      :title="t('删除会话')"
      :message="t('确定删除「{name}」吗？该操作无法撤销。', { name: deleteTarget?.title || t('新会话') })"
      @confirm="confirmDeleteSession"
      @cancel="deleteTarget = null"
      @close="deleteTarget = null"
    />
    <MessageDialog
      :visible="Boolean(workspaceDeleteTarget)"
      type="confirm"
      :title="t('删除工作区')"
      :message="
        t('确定删除「{name}」吗？其中的会话会移至「未指定工作区」。', {
          name: workspaceDeleteTarget?.name || t('工作区')
        })
      "
      @confirm="confirmDeleteWorkspace"
      @cancel="workspaceDeleteTarget = null"
      @close="workspaceDeleteTarget = null"
    />
    <MessageDialog
      :visible="Boolean(rollbackTarget)"
      type="confirm"
      :title="t('撤销本次修改')"
      :message="
        t('将把本次运行的 {count} 个文件恢复到修改前的状态，确定继续吗？', {
          count: rollbackTarget?.fileChanges?.length || 0
        })
      "
      @confirm="confirmRollback"
      @cancel="rollbackTarget = null"
      @close="rollbackTarget = null"
    />
    <Teleport to="body">
      <div v-if="workspaceDialogOpen" class="workspace-dialog-overlay">
        <div
          class="workspace-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="workspaceEditPath ? t('修改工作区') : t('添加工作区')"
        >
          <div class="workspace-dialog-head">
            <span class="workspace-dialog-title">{{ workspaceEditPath ? t('修改工作区') : t('添加工作区') }}</span>
            <button class="workspace-dialog-close" :title="t('关闭')" @click="closeWorkspaceDialog">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="workspace-dialog-body">
            <div class="workspace-field">
              <span class="workspace-field-label">{{ t('项目目录') }} <span class="workspace-required">*</span></span>
              <div class="workspace-dir-row">
                <input
                  class="input-field workspace-dir-input"
                  :value="workspaceForm.path"
                  readonly
                  :placeholder="t('选择工作区对应的项目目录')"
                />
                <button
                  v-if="!workspaceEditPath"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  @click="chooseWorkspaceDirectory"
                >
                  {{ t('选择目录') }}
                </button>
              </div>
            </div>
            <div class="workspace-field">
              <span class="workspace-field-label">{{ t('工作区名称') }} <span class="workspace-required">*</span></span>
              <input
                v-model="workspaceForm.name"
                class="input-field"
                maxlength="40"
                :placeholder="t('例如：订单服务')"
                spellcheck="false"
              />
            </div>
            <div class="workspace-field">
              <span class="workspace-field-label">{{ t('工作区描述') }}</span>
              <textarea
                v-model="workspaceForm.description"
                class="input-field workspace-desc"
                rows="2"
                maxlength="120"
                :placeholder="t('一句话说明这个工作区的用途（可选）')"
              ></textarea>
            </div>
            <div class="workspace-field">
              <span class="workspace-field-label">{{ t('图标') }}</span>
              <div class="workspace-icon-grid">
                <button
                  v-for="icon in WORKSPACE_ICONS"
                  :key="icon.id"
                  type="button"
                  class="workspace-icon-option"
                  :class="{ active: workspaceForm.icon === icon.id }"
                  :title="icon.id"
                  @click="workspaceForm.icon = icon.id"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path :d="icon.d" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="workspace-field">
              <span class="workspace-field-label">{{ t('图标颜色') }}</span>
              <div class="workspace-color-row">
                <button
                  v-for="color in WORKSPACE_COLORS"
                  :key="color"
                  type="button"
                  class="workspace-color-option"
                  :class="{ active: workspaceForm.color === color }"
                  :style="{ '--swatch-color': color }"
                  :title="color"
                  @click="workspaceForm.color = color"
                />
              </div>
            </div>
            <p v-if="workspaceFormError" class="workspace-form-error">{{ workspaceFormError }}</p>
          </div>
          <div class="workspace-dialog-actions">
            <button type="button" class="btn btn-secondary" @click="closeWorkspaceDialog">{{ t('取消') }}</button>
            <button type="button" class="btn btn-primary" @click="submitWorkspace">
              {{ workspaceEditPath ? t('保存') : t('创建') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'Chat' })
import {
  selectDirectory,
  workspaceInfo as fetchWorkspaceInfo,
  workspaceOpen as openWorkspacePath,
  runTraceStats as fetchRunTraceStats,
  memoryClearProject,
  openExternal,
  openSettings,
  getAiProviders,
  platform as hostPlatform
} from '@/api'
import { useChatSessions, useChatStream, useChatUsage, useConfig, usePaneResize, useToast } from '@/composables'
import { copyToClipboard } from '@/utils'
import { formatAccelerator, matchesAccelerator, parseAccelerator } from '@/utils/shortcut'
import { DEFAULT_SHORTCUT_ACTIONS } from '@shared/shortcutActions'
import { t } from '@/i18n'
import { joinPath } from '@/utils/path'
import { WORKSPACE_ICONS } from '@/utils/workspaceIcons'
import {
  normalizeAiCompressKeepRecent,
  normalizeAiCompressThreshold,
  normalizeAiMaxAttachments,
  normalizeAiMaxImageMb,
  normalizeAiMaxTextKb,
  normalizeToolPolicy
} from '@shared/aiBehavior'
import Toast from '@/components/Toast.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import ChatApprovalCard from '@/components/ChatApprovalCard.vue'
import WorkspaceHoverCard from '@/components/WorkspaceHoverCard.vue'
import RunTracePanel from '@/components/RunTracePanel.vue'
import MemoryPanel from '@/components/MemoryPanel.vue'
import SessionRail from './chat/SessionRail.vue'
import MessageList from './chat/MessageList.vue'
import SplitHandle from '@/components/SplitHandle.vue'
import PageLayout from '@/layouts/PageLayout.vue'

const THINKING_PREFS_KEY = 'chat_thinking_prefs'
const ARTIFACT_ACTIONS = new Set(['write', 'append', 'mkdir', 'copy', 'move'])
const WORKSPACE_META_KEY = 'chat_workspace_meta'
const CONTEXT_STATE_KEY = 'chat_context_state'
const DEFAULT_WORKSPACE_ICON = 'folder'
const WORKSPACE_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#64748b',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#84cc16',
  '#14b8a6',
  '#0ea5e9',
  '#6366f1',
  '#a855f7'
]

const { config } = useConfig()
const compressThreshold = computed(
  () => normalizeAiCompressThreshold(config.value?.ai.context.compress_threshold) / 100
)
const compressKeepRecent = computed(() => normalizeAiCompressKeepRecent(config.value?.ai.context.keep_recent))
const maxAttachments = computed(() => normalizeAiMaxAttachments(config.value?.ai.attachments.max_count))
const maxImageBytes = computed(() => normalizeAiMaxImageMb(config.value?.ai.attachments.max_image_mb) * 1024 * 1024)
const maxTextFileBytes = computed(() => normalizeAiMaxTextKb(config.value?.ai.attachments.max_text_kb) * 1024)
const chatSendShortcut = computed(() => config.value?.app?.shortcuts?.chat_send || DEFAULT_SHORTCUT_ACTIONS.chat_send)
const composerPlaceholder = computed(() => {
  const parsed = parseAccelerator(chatSendShortcut.value)
  const isPlainEnter = parsed && parsed.key === 'enter' && !parsed.mod && !parsed.ctrl && !parsed.alt && !parsed.shift
  if (isPlainEnter) return t('Enter 发送 · Shift+Enter 换行 · 支持图片与文本文件')
  return t('{shortcut} 发送 · Enter 换行 · 支持图片与文本文件', {
    shortcut: formatAccelerator(chatSendShortcut.value, hostPlatform === 'darwin')
  })
})
const route = useRoute()
const router = useRouter()
const { toastVisible, toastMessage, toastType, showSuccess, showError } = useToast()

const workspaceMeta = ref({})
const workspaceMenu = ref(null)
const workspaceDeleteTarget = ref(null)
const workspaceEditPath = ref('')
const workspaceDialogOpen = ref(false)
const workspaceForm = ref({
  path: '',
  name: '',
  description: '',
  icon: DEFAULT_WORKSPACE_ICON,
  color: WORKSPACE_COLORS[0]
})
const workspaceFormError = ref('')
const inputText = ref('')
const messageListRef = ref(null)
const messagesContainer = computed(() => messageListRef.value?.messagesContainer || null)
const questionRail = ref(null)
const questionList = ref(null)
const atBottom = ref(true)
const hoveredQuestion = ref(null)
const questionTipTop = ref(0)
const inputRef = ref(null)
const imageInput = ref(null)
const fileInput = ref(null)
const {
  size: chatSidebarWidth,
  resizing: chatSidebarResizing,
  startResize: startChatSidebarResize,
  onKeydown: onChatSidebarKeydown
} = usePaneResize({
  key: 'chatSidebarWidth',
  initial: 240,
  min: 224,
  max: () => Math.min(460, Math.max(240, window.innerWidth - 520))
})
let groupsInitialized = false
const providers = ref([])
const selectedProvider = ref('')
const selectedModel = ref('')
const models = ref([])
const contextPanelState = ref({})
const storedContextWidth = Number(localStorage.getItem('chatContextWidth'))
const contextPanelWidth = ref(
  Number.isFinite(storedContextWidth) && storedContextWidth >= 240 ? storedContextWidth : 300
)
const isResizingContext = ref(false)
const workspaceInfo = ref(null)
const workspaceInfoLoading = ref(false)
let workspaceRequest = 0
const runStats = ref({ total: 0, byWorkspace: {} })
const starterPrompts = [
  {
    get title() {
      return t('梳理工作区')
    },
    get hint() {
      return t('查看目录结构与关键文件')
    },
    icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    get prompt() {
      return t('请先查看当前工作区的目录结构和关键文件，概括项目用途、技术栈与主要模块。')
    }
  },
  {
    get title() {
      return t('解释代码')
    },
    get hint() {
      return t('逐段说明实现逻辑')
    },
    icon: 'M8 6l-5 6 5 6M16 6l5 6-5 6',
    get prompt() {
      return t('请解释我接下来粘贴的代码，讲清整体流程、关键函数和潜在问题。')
    }
  },
  {
    get title() {
      return t('生成文件')
    },
    get hint() {
      return t('直接写入工作区')
    },
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
    get prompt() {
      return t('请在工作区创建 examples/demo.md，写入一份结构清晰的示例文档。')
    }
  },
  {
    get title() {
      return t('查阅网页')
    },
    get hint() {
      return t('读取链接并整理要点')
    },
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9S14.5 18.5 12 21',
    get prompt() {
      return t('请查阅一个与我问题相关的最新官方文档链接，并总结关键要点。')
    }
  }
]
const attachments = ref([])
const attachMenuOpen = ref(false)
const commandMenuOpen = ref(false)
const commandMenuFromSlash = ref(false)
const modelMenuOpen = ref(false)
const modelMenuView = ref('root')
const approvalMode = ref('all')
const thinkingMode = ref('auto')
const reasoningLevels = [
  {
    value: 'auto',
    get label() {
      return t('自动')
    },
    get hint() {
      return t('由模型决定')
    }
  },
  {
    value: 'on',
    get label() {
      return t('高')
    },
    get hint() {
      return t('深度思考')
    }
  },
  {
    value: 'off',
    get label() {
      return t('低')
    },
    get hint() {
      return t('快速响应')
    }
  }
]
const thinkingPrefs = ref(loadThinkingPrefs())

const {
  sessions,
  currentSessionId,
  currentSession,
  sessionSearch,
  sessionSearchOpen,
  workspaceSectionOpen,
  showArchived,
  sessionMenu,
  menuSession,
  deleteTarget,
  railMoreOpen,
  collapsedGroups,
  chatSidebarCollapsed,
  contextPanelOpen,
  editingSessionId,
  editingTitle,
  pendingStream,
  suppressAutoScroll,
  viewState,
  loadViewState,
  persistViewState,
  loadSessions,
  saveSessions,
  persistPendingStream,
  saveDraft,
  clearDraft,
  scheduleDraftSave,
  applyDraft,
  saveScroll,
  scheduleScrollSave,
  restoreScroll,
  generateId,
  collapseChatSidebar,
  expandChatSidebar,
  toggleSessionSearch,
  toggleGroup,
  openGroupForSession,
  toggleSessionMenu,
  handleSessionAction,
  onRailMore,
  markStreamInterrupted,
  finishMessageTiming,
  recoverStreamState,
  createNewChat,
  selectSession,
  confirmDeleteSession,
  saveEditTitle,
  cancelEditTitle
} = useChatSessions({
  inputText,
  messagesContainer,
  atBottom,
  selectedProvider,
  selectedModel,
  applyProviderModels,
  resizeInput,
  openMemoryPage,
  copyToClipboard,
  openWorkspacePath,
  showSuccess,
  showError
})
const currentMessages = computed(() => currentSession?.value?.messages || [])
const emptyWorkspaceLabel = computed(() => {
  const workspace = currentSession.value?.workspace
  return workspace ? workspaceLabel(workspace) : ''
})
const pendingApprovals = computed(() => {
  const list = []
  for (const message of currentMessages.value) {
    for (const approval of message.approvals || []) {
      if (approval.status === 'pending') list.push(approval)
    }
  }
  return list
})

const questions = computed(() =>
  currentMessages.value.reduce((list, message, index) => {
    if (message.role === 'user') {
      list.push({ index, text: questionText(message) })
    }
    return list
  }, [])
)
const turnCount = computed(() => currentMessages.value.filter((message) => message.role === 'user').length)
const filteredSessions = computed(() => {
  const keyword = sessionSearch.value.trim().toLowerCase()
  const list = showArchived.value
    ? sessions.value
    : sessions.value.filter((session) => {
        if (session.archived) return false
        return !(session.workspace && workspaceMeta.value[session.workspace]?.archived)
      })
  if (!keyword) return list
  return list.filter((session) => {
    const title = String(session.title || '').toLowerCase()
    const workspace = String(session.workspace || '').toLowerCase()
    return title.includes(keyword) || workspace.includes(keyword)
  })
})
function isSessionActive(session) {
  if (pendingStream.value?.sessionId === session.id) return true
  return (session.messages || []).some((message) => message.isStreaming)
}
const workspaceGroups = computed(() => {
  const groups = new Map()
  for (const session of filteredSessions.value) {
    const workspace = typeof session.workspace === 'string' ? session.workspace : ''
    const key = workspace || '__none__'
    if (!groups.has(key)) {
      groups.set(key, { key, path: workspace, sessions: [] })
    }
    groups.get(key).sessions.push(session)
  }
  const keyword = sessionSearch.value.trim().toLowerCase()
  if (!keyword) {
    for (const path of Object.keys(workspaceMeta.value)) {
      if (!path || groups.has(path)) continue
      if (!showArchived.value && workspaceMeta.value[path]?.archived) continue
      groups.set(path, { key: path, path, sessions: [] })
    }
  }
  for (const group of groups.values()) {
    const meta = group.path ? workspaceMeta.value[group.path] : null
    group.label = meta?.name || (group.path ? workspaceName(group.path) : t('未指定工作区'))
    group.description = meta?.description || ''
    group.icon = meta?.icon || ''
    group.color = meta?.color || ''
    group.hasMeta = Boolean(meta)
    group.pinned = meta?.pinned === true
    group.archived = meta?.archived === true
    group.activeCount = group.sessions.filter((session) => isSessionActive(session)).length
    group.unreadCount = group.sessions.filter((session) => session.unread === true).length
    group.taskCount = group.path ? runStats.value.byWorkspace[group.path] || 0 : 0
    const sessionTimes = group.sessions.map((session) => Number(session.createdAt) || 0).filter(Boolean)
    group.createdAt = Number(meta?.createdAt) || (sessionTimes.length ? Math.min(...sessionTimes) : 0)
    group.sessions.sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true))
  }
  return [...groups.values()].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (!a.path !== !b.path) return a.path ? 1 : -1
    return b.createdAt - a.createdAt
  })
})
const workspaceMenuMeta = computed(() =>
  workspaceMenu.value ? workspaceMeta.value[workspaceMenu.value.path] || null : null
)
function collectToolRuns(sessionList) {
  const runs = []
  for (const session of sessionList) {
    const sessionRuns = []
    ;(session.messages || []).forEach((message, messageIndex) => {
      for (const [stepIndex, step] of (message.steps || []).entries()) {
        if (!step || !step.name) continue
        sessionRuns.push({
          ...step,
          key: `${session.id}-${messageIndex}-${step.id || stepIndex}`,
          statusText:
            step.statusText ||
            (step.status === 'running' ? t('执行中') : step.status === 'error' ? t('失败') : t('完成'))
        })
      }
    })
    runs.push(...sessionRuns.reverse())
  }
  return runs
}
function collectArtifacts(runs, workspace) {
  const artifacts = new Map()
  for (const run of runs) {
    const meta = run.metadata && typeof run.metadata === 'object' ? run.metadata : null
    const action = meta?.action || ''
    let relative = meta && ARTIFACT_ACTIONS.has(action) ? meta.destination || meta.path : ''
    if (!relative) {
      const match = String(run.result || '').match(/(?:已写入|已追加|已创建目录|已复制|已移动)：([^（\n]+)/)
      if (!match) continue
      relative = match[1].split('->').pop().trim()
    }
    if (!relative || relative === '.') continue
    const parts = relative.split(/[\\/]+/).filter(Boolean)
    if (parts.length === 0) continue
    const key = parts.join('/')
    if (artifacts.has(key)) continue
    artifacts.set(key, {
      key: `file:${key}`,
      type: 'file',
      label: parts[parts.length - 1],
      detail: key,
      path: relative,
      target: workspace ? joinPath(workspace, parts) : ''
    })
  }
  return [...artifacts.values()]
}
function collectWebPages(runs) {
  const pages = new Map()
  for (const run of runs) {
    const meta = run.metadata && typeof run.metadata === 'object' ? run.metadata : null
    const args = parseToolArgs(run.arguments)
    const url = meta?.finalUrl || meta?.url || (run.name === 'web-fetch' ? args.url : '')
    if (!url || typeof url !== 'string') continue
    if (pages.has(url)) continue
    const host = hostnameOf(url)
    pages.set(url, {
      key: `web:${url}`,
      type: 'web',
      label: meta?.title || host || url,
      detail: host || url,
      url,
      target: url
    })
  }
  return [...pages.values()]
}
const sessionToolRuns = computed(() => (currentSession.value ? collectToolRuns([currentSession.value]) : []))
const activeWorkspace = computed(() => currentSession.value?.workspace || '')
const activeWorkspaceKey = computed(() => activeWorkspace.value || '__none__')
const workspaceSessions = computed(() =>
  sessions.value.filter((session) => (session.workspace || '') === activeWorkspace.value)
)
const workspaceToolRuns = computed(() => collectToolRuns(workspaceSessions.value))
const workspaceSubagents = computed(() =>
  workspaceToolRuns.value
    .filter((run) => run.name === 'subagent')
    .map((run) => {
      const args = parseToolArgs(run.arguments)
      const task = typeof args.task === 'string' ? args.task.trim() : ''
      return {
        key: run.key,
        status: run.status || 'done',
        statusText: run.statusText,
        task:
          task ||
          String(run.result || '')
            .trim()
            .slice(0, 80) ||
          t('子智能体任务'),
        duration: run.duration
      }
    })
)
const workspaceArtifacts = computed(() => collectArtifacts(workspaceToolRuns.value, activeWorkspace.value))
const workspaceWebPages = computed(() => collectWebPages(workspaceToolRuns.value))
function collectSources(webPages, artifacts, sessionList) {
  const sources = [...webPages]
  const seen = new Set(sources.map((item) => item.key))
  for (const item of artifacts) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    sources.push(item)
  }
  for (const session of sessionList) {
    ;(session.messages || []).forEach((message, messageIndex) => {
      for (const [index, attachment] of (message.attachments || []).entries()) {
        const key = `attachment:${session.id}-${messageIndex}-${index}`
        if (seen.has(key)) continue
        seen.add(key)
        sources.push({
          key,
          type: 'attachment',
          label: attachment.name || t('附件'),
          detail: attachment.kind === 'image' ? t('图片附件') : t('文本附件'),
          target: ''
        })
      }
    })
  }
  return sources
}
const workspaceSources = computed(() =>
  collectSources(workspaceWebPages.value, workspaceArtifacts.value, workspaceSessions.value)
)
const expandedSections = computed(() => contextPanelState.value[activeWorkspaceKey.value]?.expanded || {})
const collapsedSections = computed(() => contextPanelState.value[activeWorkspaceKey.value]?.collapsed || {})
const currentProvider = computed(() => providers.value.find((p) => p.type === selectedProvider.value))
const hasCurrentApiKey = computed(() => Boolean(currentProvider.value?.hasApiKey))
const showKeyWarning = computed(() => providers.value.length > 0 && !hasCurrentApiKey.value)
const selectableProviders = computed(() =>
  providers.value.filter((provider) => provider.hasApiKey && (provider.models || []).length > 0)
)
const selectedModelInfo = computed(() => models.value.find((model) => model.id === selectedModel.value))
const reasoningLevelLabel = computed(() =>
  t(reasoningLevels.find((level) => level.value === thinkingMode.value)?.label || t('自动'))
)
const modelSupportsImage = computed(() => {
  const inputTypes = selectedModelInfo.value?.inputTypes
  return !Array.isArray(inputTypes) || inputTypes.length === 0 || inputTypes.includes('image')
})
const modelSupportsThinking = computed(() => Boolean(selectedModelInfo.value?.thinking))
const canSend = computed(
  () => !loading.value && hasCurrentApiKey.value && (Boolean(inputText.value.trim()) || attachments.value.length > 0)
)
const {
  usageDetail,
  sessionTokenTotal,
  sessionUsageEstimated,
  contextWindowSize,
  contextTokens,
  contextPercent,
  contextState,
  remainingContextTokens,
  contextRingStyle,
  sessionPromptTokens,
  sessionCompletionTokens,
  sessionCachedTokens,
  sessionCallCount,
  unCachedTokens,
  cacheHitPercent,
  generationMs,
  sessionTokenRate,
  hasUsageData,
  hasRateData,
  hasCacheData,
  rateDisplay,
  totalDisplay,
  cacheDisplay,
  toggleUsageDetail,
  formatTokens
} = useChatUsage({ currentSession, selectedModelInfo })

const {
  loading,
  chatTab,
  traceFocusId,
  tracePanelKey,
  rollbackTarget,
  rollbackBusy,
  currentRequestId,
  respondApproval,
  requestRollback,
  switchChatTab,
  openRunTrace,
  confirmRollback,
  resumePendingStream,
  sendMessage,
  stopResponse
} = useChatStream({
  sessions,
  currentSessionId,
  currentSession,
  inputText,
  attachments,
  hasCurrentApiKey,
  currentProvider,
  selectedProvider,
  selectedModel,
  modelSupportsThinking,
  thinkingMode,
  approvalMode,
  compressThreshold,
  compressKeepRecent,
  contextPanelOpen,
  contextWindowSize,
  pendingStream,
  persistPendingStream,
  saveSessions,
  markStreamInterrupted,
  clearDraft,
  createNewChat,
  finishMessageTiming,
  scrollToBottom,
  refreshWorkspaceInfo,
  refreshRunStats,
  resizeInput,
  showSuccess,
  showError,
  toggleContextPanel
})

function onComposerKeydown(e) {
  if (!matchesAccelerator(e, chatSendShortcut.value)) return
  e.preventDefault()
  sendMessage(e)
}

function loadThinkingPrefs() {
  try {
    return JSON.parse(localStorage.getItem(THINKING_PREFS_KEY)) || {}
  } catch {
    return {}
  }
}

function applyProviderModels(type, preferredModel = '') {
  const provider = providers.value.find((p) => p.type === type)
  if (!provider) {
    models.value = []
    selectedModel.value = ''
    return
  }

  models.value = provider.models || []
  const hasPreferred = models.value.some((model) => model.id === preferredModel)
  selectedModel.value = hasPreferred ? preferredModel : provider.defaultModel || models.value[0]?.id || ''
}

async function loadProviders() {
  const catalog = await getAiProviders()
  providers.value = catalog || []
  if (providers.value.length === 0) {
    models.value = []
    selectedModel.value = ''
    return
  }

  const usable = providers.value.filter((p) => p.hasApiKey && (p.models || []).length > 0)
  const defaultType = config.value?.ai.provider || ''
  const requestedType = selectedProvider.value || currentSession.value?.provider || ''
  const pool = usable.length > 0 ? usable : providers.value
  const provider = pool.find((p) => p.type === requestedType) || pool.find((p) => p.type === defaultType) || pool[0]
  selectedProvider.value = provider.type

  let preferredModel = ''
  if (requestedType === provider.type) {
    preferredModel = selectedModel.value
  } else if (currentSession.value?.model) {
    preferredModel = currentSession.value.model
  }
  applyProviderModels(provider.type, preferredModel)
}

function toggleModelMenu() {
  if (selectableProviders.value.length === 0) return
  modelMenuOpen.value = !modelMenuOpen.value
  if (modelMenuOpen.value) modelMenuView.value = 'root'
}

function closeModelMenu() {
  modelMenuOpen.value = false
}

function chooseModel(type, modelId) {
  if (!type || !modelId) return
  if (type !== selectedProvider.value) {
    selectedProvider.value = type
    applyProviderModels(type, modelId)
  } else if (models.value.some((model) => model.id === modelId)) {
    selectedModel.value = modelId
  }
  closeModelMenu()
}

function chooseReasoningLevel(value) {
  thinkingMode.value = value
  closeModelMenu()
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return t('刚刚')
  if (diff < 3600000) return t('{count}分钟前', { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('{count}小时前', { count: Math.floor(diff / 3600000) })
  return date.toLocaleDateString()
}

function formatDateTime(timestamp) {
  if (!timestamp) return '--'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '--'
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

function workspaceName(value) {
  if (!value || typeof value !== 'string') return ''
  const parts = value.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] || value
}

function workspaceMetaOf(value) {
  if (!value || typeof value !== 'string') return null
  return workspaceMeta.value[value] || null
}

function workspaceLabel(value) {
  return workspaceMetaOf(value)?.name || workspaceName(value)
}

function workspaceIconId(value) {
  return workspaceMetaOf(value)?.icon || DEFAULT_WORKSPACE_ICON
}

function workspaceIconPath(value) {
  return WORKSPACE_ICONS.find((item) => item.id === workspaceIconId(value))?.d || ''
}

function workspaceIconColor(value) {
  return workspaceMetaOf(value)?.color || ''
}

function workspaceDescription(value) {
  return workspaceMetaOf(value)?.description || ''
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function parseToolArgs(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function sourceTypeLabel(type) {
  if (type === 'web') return t('网页')
  if (type === 'file') return t('文件')
  if (type === 'attachment') return t('附件')
  return t('来源')
}

function visibleItems(list, key, limit) {
  return expandedSections.value[key] ? list : list.slice(0, limit)
}

function isSectionCollapsed(key) {
  return collapsedSections.value[key] === true
}

function setContextState(patch) {
  const key = activeWorkspaceKey.value
  contextPanelState.value = {
    ...contextPanelState.value,
    [key]: { ...(contextPanelState.value[key] || {}), ...patch }
  }
  persistContextState()
}

function toggleSection(key) {
  const expanded = { ...expandedSections.value }
  expanded[key] = !expanded[key]
  setContextState({ expanded })
}

function toggleSectionCollapsed(key) {
  const collapsed = { ...collapsedSections.value }
  collapsed[key] = !collapsed[key]
  setContextState({ collapsed })
}

function loadContextState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTEXT_STATE_KEY))
    contextPanelState.value = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    contextPanelState.value = {}
  }
}

function persistContextState() {
  try {
    localStorage.setItem(CONTEXT_STATE_KEY, JSON.stringify(contextPanelState.value))
  } catch {
    // 本地存储不可用时仅保留当前会话内的状态
  }
}

function toggleContextPanel() {
  contextPanelOpen.value = !contextPanelOpen.value
  persistViewState()
}

async function refreshWorkspaceInfo() {
  const workspace = currentSession.value?.workspace || ''
  const token = ++workspaceRequest
  if (!workspace) {
    workspaceInfo.value = null
    workspaceInfoLoading.value = false
    return
  }
  workspaceInfoLoading.value = true
  const info = await fetchWorkspaceInfo(workspace)
  if (token !== workspaceRequest) return
  workspaceInfoLoading.value = false
  workspaceInfo.value = info?.success
    ? info
    : {
        success: false,
        path: workspace,
        name: workspaceName(workspace),
        error: info?.error || t('无法读取工作区信息')
      }
}

async function refreshRunStats() {
  const data = await fetchRunTraceStats()
  if (!data || typeof data !== 'object') return
  runStats.value = {
    total: Number(data.total) || 0,
    byWorkspace: data.byWorkspace && typeof data.byWorkspace === 'object' ? data.byWorkspace : {}
  }
}

function openMemoryPage() {
  switchChatTab('memory')
}

function openKnowledgePage() {
  router.push('/memory')
}

async function pickWorkspace() {
  if (currentSession.value?.workspace) return
  if (!currentSessionId.value) createNewChat()
  const directory = await selectDirectory()
  if (!directory) return
  const session = currentSession.value
  if (!session || session.workspace) return
  session.workspace = directory
  session.updatedAt = Date.now()
  saveSessions(session.id)
  persistViewState()
  await refreshWorkspaceInfo()
  showSuccess(t('已绑定工作区 {name}', { name: workspaceLabel(directory) }))
}

function loadWorkspaceMeta() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORKSPACE_META_KEY))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    const next = {}
    for (const [path, meta] of Object.entries(parsed)) {
      if (typeof path !== 'string' || !path || !meta || typeof meta !== 'object') continue
      next[path] = {
        name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : workspaceName(path),
        description: typeof meta.description === 'string' ? meta.description : '',
        icon: WORKSPACE_ICONS.some((item) => item.id === meta.icon) ? meta.icon : DEFAULT_WORKSPACE_ICON,
        color:
          typeof meta.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(meta.color) ? meta.color : WORKSPACE_COLORS[0],
        createdAt: Number(meta.createdAt) || 0,
        pinned: meta.pinned === true,
        archived: meta.archived === true
      }
    }
    workspaceMeta.value = next
  } catch {
    workspaceMeta.value = {}
  }
}

function persistWorkspaceMeta() {
  try {
    localStorage.setItem(WORKSPACE_META_KEY, JSON.stringify(workspaceMeta.value))
  } catch {
    showError(t('工作区信息保存失败'))
  }
}

function openWorkspaceDialog() {
  workspaceEditPath.value = ''
  workspaceForm.value = {
    path: '',
    name: '',
    description: '',
    icon: DEFAULT_WORKSPACE_ICON,
    color: WORKSPACE_COLORS[0]
  }
  workspaceFormError.value = ''
  workspaceDialogOpen.value = true
}

function closeWorkspaceDialog() {
  workspaceEditPath.value = ''
  workspaceDialogOpen.value = false
}

function closeRailMenus() {
  sessionMenu.value = null
  workspaceMenu.value = null
}

function toggleWorkspaceMenu(path, event) {
  event.stopPropagation()
  if (workspaceMenu.value?.path === path) {
    workspaceMenu.value = null
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  const menuWidth = 190
  const menuHeight = 190
  const x = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
  const y =
    rect.bottom + menuHeight + 8 <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - menuHeight - 4)
  workspaceMenu.value = { path, x, y }
}

function updateWorkspaceMeta(path, patch) {
  const meta = workspaceMeta.value[path]
  if (!meta) return
  workspaceMeta.value = { ...workspaceMeta.value, [path]: { ...meta, ...patch } }
  persistWorkspaceMeta()
}

function toggleWorkspacePin(path) {
  const meta = workspaceMeta.value[path]
  if (!meta) return
  updateWorkspaceMeta(path, { pinned: !meta.pinned })
  showSuccess(meta.pinned ? t('已取消置顶') : t('工作区已置顶'))
}

function toggleWorkspaceArchive(path) {
  const meta = workspaceMeta.value[path]
  if (!meta) return
  const archiving = !meta.archived
  updateWorkspaceMeta(path, { archived: archiving })
  if (archiving && !showArchived.value && (currentSession.value?.workspace || '') === path) {
    const next = filteredSessions.value[0]
    if (next) selectSession(next.id)
    else {
      viewState.value.activeSessionId = ''
      currentSessionId.value = ''
      applyDraft('')
      persistViewState()
    }
  }
  showSuccess(archiving ? t('工作区已归档') : t('已取消归档'))
}

function editWorkspace(path) {
  const meta = workspaceMeta.value[path]
  if (!meta) return
  workspaceEditPath.value = path
  workspaceForm.value = {
    path,
    name: meta.name,
    description: meta.description,
    icon: meta.icon,
    color: meta.color
  }
  workspaceFormError.value = ''
  workspaceDialogOpen.value = true
}

function requestDeleteWorkspace(path) {
  const meta = workspaceMeta.value[path]
  if (!meta) return
  workspaceDeleteTarget.value = { path, name: meta.name }
}

async function confirmDeleteWorkspace() {
  const target = workspaceDeleteTarget.value
  workspaceDeleteTarget.value = null
  if (!target) return
  const nextMeta = { ...workspaceMeta.value }
  delete nextMeta[target.path]
  workspaceMeta.value = nextMeta
  persistWorkspaceMeta()
  if (contextPanelState.value[target.path]) {
    const nextState = { ...contextPanelState.value }
    delete nextState[target.path]
    contextPanelState.value = nextState
    persistContextState()
  }
  let changed = false
  for (const session of sessions.value) {
    if (session.workspace === target.path) {
      session.workspace = ''
      changed = true
    }
  }
  if (changed) saveSessions()
  const cleared = await memoryClearProject(target.path)
  if (cleared?.success === false) {
    showError(cleared.error || t('工作区已删除，但项目记忆清空失败'))
    return
  }
  showSuccess(
    cleared?.removed > 0
      ? t('已删除工作区 {name}，并清空项目记忆', { name: target.name })
      : t('已删除工作区 {name}', { name: target.name })
  )
}

function handleWorkspaceAction(action) {
  const path = workspaceMenu.value?.path
  if (!path) return
  workspaceMenu.value = null
  if (action === 'pin') toggleWorkspacePin(path)
  else if (action === 'edit') editWorkspace(path)
  else if (action === 'archive') toggleWorkspaceArchive(path)
  else if (action === 'delete') requestDeleteWorkspace(path)
}

function createWorkspaceChat(path) {
  createNewChat(path)
  if (collapsedGroups.value[path]) {
    collapsedGroups.value = { ...collapsedGroups.value, [path]: false }
  }
}

async function chooseWorkspaceDirectory() {
  const directory = await selectDirectory()
  if (!directory) return
  workspaceForm.value.path = directory
  if (!workspaceForm.value.name.trim()) workspaceForm.value.name = workspaceName(directory)
  workspaceFormError.value = ''
}

function submitWorkspace() {
  const path = workspaceForm.value.path.trim()
  const name = workspaceForm.value.name.trim()
  if (!path) {
    workspaceFormError.value = t('请选择项目目录')
    return
  }
  if (!name) {
    workspaceFormError.value = t('请填写工作区名称')
    return
  }
  const editing = Boolean(workspaceEditPath.value)
  const existing = editing ? workspaceMeta.value[path] : null
  if (!editing && workspaceMeta.value[path]) {
    workspaceFormError.value = t('该目录已添加为工作区')
    return
  }
  workspaceMeta.value = {
    ...workspaceMeta.value,
    [path]: {
      name,
      description: workspaceForm.value.description.trim(),
      icon: workspaceForm.value.icon,
      color: workspaceForm.value.color,
      createdAt: existing?.createdAt || Date.now(),
      pinned: existing?.pinned === true,
      archived: existing?.archived === true
    }
  }
  persistWorkspaceMeta()
  workspaceDialogOpen.value = false
  workspaceEditPath.value = ''
  if (editing) {
    showSuccess(t('工作区 {name} 已更新', { name }))
    return
  }
  createNewChat(path)
  if (collapsedGroups.value[path]) {
    collapsedGroups.value = { ...collapsedGroups.value, [path]: false }
  }
  showSuccess(t('已添加工作区 {name}，并创建了新会话', { name }))
}

function onWorkspaceDialogKey(event) {
  if (event.key === 'Escape') closeWorkspaceDialog()
}

watch(workspaceDialogOpen, (open) => {
  if (open) window.addEventListener('keydown', onWorkspaceDialogKey)
  else window.removeEventListener('keydown', onWorkspaceDialogKey)
})

async function openWorkspaceRoot() {
  const workspace = currentSession.value?.workspace || ''
  if (!workspace) {
    await pickWorkspace()
    return
  }
  const result = await openWorkspacePath(workspace, workspace)
  if (result && result.success === false) showError(result.error || t('无法打开工作区'))
}

async function openSource(item) {
  if (!item?.target) return
  if (item.type === 'web') {
    const opened = await openExternal(item.target)
    if (!opened) showError(t('无法打开链接'))
    return
  }
  const workspace = currentSession.value?.workspace || ''
  if (!workspace || item.type !== 'file') return
  const result = await openWorkspacePath(workspace, item.target)
  if (result && result.success === false) showError(result.error || t('无法打开文件'))
}

function useStarter(prompt) {
  inputText.value = prompt
  nextTick(() => {
    resizeInput()
    inputRef.value?.focus()
  })
}

function startContextResize(event) {
  if (event.button !== 0) return
  event.preventDefault()
  isResizingContext.value = true
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'

  const layout = document.querySelector('.chat-layout')
  const handleMove = (moveEvent) => {
    if (!layout) return
    const rect = layout.getBoundingClientRect()
    const maxWidth = Math.min(480, Math.max(260, rect.width - 560))
    const next = Math.min(Math.max(rect.right - moveEvent.clientX, 260), maxWidth)
    contextPanelWidth.value = Math.round(next)
  }
  const handleEnd = () => {
    isResizingContext.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    localStorage.setItem('chatContextWidth', String(contextPanelWidth.value))
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleEnd)
  }

  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', handleEnd)
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function questionText(message) {
  const text = (message.content || '').trim()
  if (text) return text
  const attachments = message.attachments || []
  if (attachments.length === 0) return t('空消息')
  return attachments
    .map((attachment) =>
      attachment.kind === 'image'
        ? t('[图片] {name}', { name: attachment.name })
        : t('[文件] {name}', { name: attachment.name })
    )
    .join('\n')
}

function handleMessagesScroll() {
  const container = messagesContainer.value
  if (!container) return
  atBottom.value = container.scrollHeight - container.scrollTop - container.clientHeight < 32
  scheduleScrollSave()
}

function jumpToQuestion(index) {
  const container = messagesContainer.value
  if (!container) return
  const target = container.querySelector(`[data-message-index="${index}"]`)
  if (!target) return
  const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8
  container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
}

function scrollToLatest() {
  const container = messagesContainer.value
  if (!container) return
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
}

function showQuestionTip(question, event) {
  const rail = questionRail.value
  if (!rail) return
  const railRect = rail.getBoundingClientRect()
  const markerRect = event.currentTarget.getBoundingClientRect()
  const center = markerRect.top - railRect.top + markerRect.height / 2
  hoveredQuestion.value = question
  questionTipTop.value = Math.round(Math.min(Math.max(center, 44), railRect.height - 44))
}

function hideQuestionTip() {
  hoveredQuestion.value = null
}

function formatDuration(ms) {
  if (!ms) return ''
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

async function copyMessage(content) {
  const success = await copyToClipboard(content)
  if (success) {
    showSuccess(t('已复制到剪贴板'))
  } else {
    showError(t('复制失败'))
  }
}

function resizeInput() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`
}

function chooseImages() {
  attachMenuOpen.value = false
  imageInput.value?.click()
}

function chooseFiles() {
  attachMenuOpen.value = false
  fileInput.value?.click()
}

function toggleCommandMenu() {
  commandMenuFromSlash.value = false
  commandMenuOpen.value = !commandMenuOpen.value
}

function insertCommandTemplate(template) {
  const rest = inputText.value.startsWith('/') ? inputText.value.slice(1) : inputText.value
  inputText.value = `${template}${rest}`
  commandMenuOpen.value = false
  commandMenuFromSlash.value = false
  nextTick(() => {
    resizeInput()
    const el = inputRef.value
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  })
}

function onImagePicked(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  addFiles(files, 'image')
}

function onFilePicked(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  addFiles(files, 'file')
}

function removeAttachment(id) {
  attachments.value = attachments.value.filter((att) => att.id !== id)
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error(t('读取失败')))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function prepareImage(file) {
  const dataUrl = await readAsDataUrl(file)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl

  const image = await loadImage(dataUrl)
  const maxEdge = 1024
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  if (scale === 1 && file.size <= 1024 * 1024) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

async function addFiles(files, kindHint) {
  const attachmentLimit = maxAttachments.value
  const imageLimit = maxImageBytes.value
  const textLimit = maxTextFileBytes.value
  for (const file of files) {
    if (attachments.value.length >= attachmentLimit) {
      showError(t('最多添加 {count} 个附件', { count: attachmentLimit }))
      break
    }

    const isImage = kindHint === 'image' || file.type.startsWith('image/')
    if (isImage) {
      if (!modelSupportsImage.value) {
        showError(
          t('{model} 未启用图片输入，可在设置 > 模型中开启', { model: selectedModelInfo.value?.name || t('当前模型') })
        )
        continue
      }
      if (file.size > imageLimit) {
        showError(t('{name} 超过 {size}MB，已跳过', { name: file.name, size: Math.round(imageLimit / 1024 / 1024) }))
        continue
      }
      try {
        const dataUrl = await prepareImage(file)
        attachments.value.push({ id: generateId(), kind: 'image', name: file.name, size: file.size, dataUrl })
      } catch {
        showError(t('无法读取图片 {name}', { name: file.name }))
      }
    } else {
      if (file.size > textLimit) {
        showError(t('{name} 超过 {size}KB，已跳过', { name: file.name, size: Math.round(textLimit / 1024) }))
        continue
      }
      try {
        const content = await file.text()
        attachments.value.push({ id: generateId(), kind: 'file', name: file.name, size: file.size, content })
      } catch {
        showError(t('无法读取文件 {name}', { name: file.name }))
      }
    }
  }
  await nextTick()
  resizeInput()
}

function closePlusMenu() {
  attachMenuOpen.value = false
  commandMenuOpen.value = false
  commandMenuFromSlash.value = false
}

function handleOutsideClick() {
  closePlusMenu()
  closeModelMenu()
  railMoreOpen.value = false
  sessionMenu.value = null
  workspaceMenu.value = null
  usageDetail.value = ''
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') return
  if (deleteTarget.value) {
    deleteTarget.value = null
    return
  }
  if (workspaceDeleteTarget.value) {
    workspaceDeleteTarget.value = null
    return
  }
  if (editingSessionId.value) return
  if (
    !attachMenuOpen.value &&
    !commandMenuOpen.value &&
    !modelMenuOpen.value &&
    !railMoreOpen.value &&
    !sessionMenu.value &&
    !workspaceMenu.value &&
    !usageDetail.value
  ) {
    return
  }
  handleOutsideClick()
}

function consumeRoutePrompt() {
  const prompt = typeof route.query.prompt === 'string' ? route.query.prompt : ''
  if (!prompt) return
  inputText.value = prompt
  router.replace({ path: route.path })
  nextTick(() => {
    inputRef.value?.focus()
    resizeInput()
  })
}

onMounted(async () => {
  loadViewState()
  await loadSessions()
  loadWorkspaceMeta()
  loadContextState()
  recoverStreamState()
  refreshWorkspaceInfo()
  refreshRunStats()
  applyDraft(currentSessionId.value)
  consumeRoutePrompt()
  suppressAutoScroll.value = true
  loadProviders()
  document.addEventListener('click', handleOutsideClick)
  document.addEventListener('keydown', handleGlobalKeydown)
  await nextTick()
  restoreScroll()
  suppressAutoScroll.value = false
  resizeInput()
  resumePendingStream()
})

watch(
  () => route.query.prompt,
  (prompt) => {
    if (typeof prompt === 'string' && prompt) consumeRoutePrompt()
  }
)

watch(
  () => [config.value?.ai.provider, config.value?.ai.keys, config.value?.ai.models],
  () => loadProviders(),
  { deep: true }
)

watch(selectedModel, (model) => {
  thinkingMode.value = thinkingPrefs.value[model] || 'auto'
})

watch(thinkingMode, (mode) => {
  if (!selectedModel.value) return
  thinkingPrefs.value = { ...thinkingPrefs.value, [selectedModel.value]: mode }
  try {
    localStorage.setItem(THINKING_PREFS_KEY, JSON.stringify(thinkingPrefs.value))
  } catch {
    // 本地存储不可用时仅保留当前会话内的选择
  }
})

watch(
  () => config.value?.ai.agent.tool_policy,
  (value) => {
    if (value !== undefined) approvalMode.value = normalizeToolPolicy(value)
  },
  { immediate: true }
)

onActivated(() => {
  refreshWorkspaceInfo()
  refreshRunStats()
})

onDeactivated(() => {
  handleOutsideClick()
})

onUnmounted(() => {
  saveDraft()
  saveScroll()
  if (currentRequestId.value) saveSessions(currentSessionId.value)
  document.removeEventListener('click', handleOutsideClick)
  document.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('keydown', onWorkspaceDialogKey)
})

watch(
  currentMessages,
  () => {
    if (suppressAutoScroll.value) return
    scrollToBottom()
  },
  { deep: true }
)

watch(inputText, (value) => {
  if (value === '/') {
    commandMenuFromSlash.value = true
    commandMenuOpen.value = true
    return
  }
  if (commandMenuFromSlash.value && !value.startsWith('/')) {
    commandMenuOpen.value = false
    commandMenuFromSlash.value = false
  }
})

watch(inputText, () => {
  scheduleDraftSave()
})

watch(showArchived, () => {
  persistViewState()
})

watch(
  collapsedGroups,
  () => {
    persistViewState()
  },
  { deep: true }
)

watch(currentSessionId, (id) => {
  hoveredQuestion.value = null
  atBottom.value = true
  if (!groupsInitialized) {
    groupsInitialized = true
    const session = sessions.value.find((item) => item.id === id)
    const activeKey = session?.workspace || '__none__'
    const saved = viewState.value.collapsedGroups || {}
    const next = {}
    for (const item of sessions.value) {
      const key = item.workspace || '__none__'
      if (!(key in next)) next[key] = key in saved ? saved[key] === true : key !== activeKey
    }
    collapsedGroups.value = next
  } else {
    openGroupForSession(id)
  }
  if (id) {
    viewState.value.activeSessionId = id
    persistViewState()
  }
})

watch(
  () => currentSession.value?.workspace,
  () => {
    refreshWorkspaceInfo()
  }
)

watch(
  () => questions.value.length,
  () => {
    nextTick(() => {
      if (questionList.value) questionList.value.scrollTop = questionList.value.scrollHeight
    })
  }
)
</script>

<style src="../styles/chat.css"></style>
