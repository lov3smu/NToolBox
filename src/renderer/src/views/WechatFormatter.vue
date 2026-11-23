<template>
  <PageLayout tool-path="/wechat-formatter" page-class="wechat-page-layout">
    <template #actions>
      <div class="segmented wx-view-switch">
        <button
          v-for="mode in viewModes"
          :key="mode.id"
          type="button"
          class="segmented-item"
          :class="{ active: viewMode === mode.id }"
          @click="viewMode = mode.id"
        >
          {{ mode.label }}
        </button>
      </div>

      <label class="wx-toggle" :class="{ disabled: viewMode !== 'split' }">
        <input v-model="syncScroll" type="checkbox" :disabled="viewMode !== 'split'" />
        <span>{{ t('同步滚动') }}</span>
      </label>

      <span class="toolbar-sep" />

      <div class="wx-format-group">
        <button type="button" class="btn-icon btn-sm wx-format-text" :title="t('一级标题')" @click="applyFormat('h1')">
          H1
        </button>
        <button type="button" class="btn-icon btn-sm wx-format-text" :title="t('二级标题')" @click="applyFormat('h2')">
          H2
        </button>
        <button type="button" class="btn-icon btn-sm wx-format-text" :title="t('三级标题')" @click="applyFormat('h3')">
          H3
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('粗体 (Ctrl+B)')" @click="applyFormat('bold')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('斜体 (Ctrl+I)')" @click="applyFormat('italic')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 4h-9M14 20H5M15 4 9 20" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('引用')" @click="applyFormat('quote')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M7 7h4v6H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM15 7h4v6h-4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM5 17h4M15 17h4"
            />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('无序列表')" @click="applyFormat('ul')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 6h12M9 12h12M9 18h12" />
            <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('有序列表')" @click="applyFormat('ol')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 6h11M10 12h11M10 18h11M4 5h1v4M3 9h3" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('行内代码 (Ctrl+E)')" @click="applyFormat('code')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('插入链接 (Ctrl+K)')" @click="applyFormat('link')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
            <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('代码块')" @click="applyFormat('codeblock')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="m8 10-2 2 2 2M16 10l2 2-2 2" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('插入表格')" @click="applyFormat('table')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M9 10v10M15 10v10" />
          </svg>
        </button>
      </div>

      <span class="toolbar-sep" />

      <button class="btn btn-secondary btn-sm" @click="styleVisible = true">{{ t('样式') }}</button>
      <button
        class="btn btn-secondary btn-sm"
        :class="{ 'is-active': outlineVisible }"
        @click="outlineVisible = !outlineVisible"
      >
        {{ t('大纲') }}
      </button>
      <button class="btn btn-secondary btn-sm" @click="openDrafts">{{ t('草稿') }}</button>
      <button class="btn btn-secondary btn-sm" @click="openAi">{{ t('AI 助手') }}</button>
      <button class="btn btn-secondary btn-sm" @click="triggerImage">{{ t('图片') }}</button>

      <span class="toolbar-sep" />

      <button class="btn btn-primary btn-sm" @click="copyArticle">{{ t('复制到公众号') }}</button>
      <button class="btn btn-secondary btn-sm" @click="copyMarkdown">{{ t('复制 Markdown') }}</button>
      <button class="btn btn-secondary btn-sm" @click="exportHtml">{{ t('导出 HTML') }}</button>
      <button class="btn btn-secondary btn-sm" @click="triggerImport">{{ t('导入') }}</button>
      <button class="btn btn-secondary btn-sm" @click="loadExample">{{ t('示例') }}</button>
      <button class="btn btn-secondary btn-sm" @click="clearVisible = true">{{ t('清空') }}</button>
    </template>

    <div class="wechat-page">
      <div class="wx-config-bar">
        <label class="wx-control">
          <span>{{ t('主题') }}</span>
          <select v-model="prefs.theme">
            <option v-for="theme in themes" :key="theme.id" :value="theme.id">{{ t(theme.name) }}</option>
          </select>
        </label>
        <label class="wx-control">
          <span>{{ t('字号') }}</span>
          <select v-model.number="prefs.fontSize">
            <option v-for="size in fontSizes" :key="size" :value="size">{{ size }}px</option>
          </select>
        </label>
        <label class="wx-control">
          <span>{{ t('行高') }}</span>
          <select v-model.number="prefs.lineHeight">
            <option v-for="lineHeight in lineHeights" :key="lineHeight" :value="lineHeight">
              {{ lineHeight.toFixed(2) }}
            </option>
          </select>
        </label>
        <label class="wx-control">
          <span>{{ t('字体') }}</span>
          <select v-model="prefs.font">
            <option v-for="font in fonts" :key="font.id" :value="font.id">{{ t(font.name) }}</option>
          </select>
        </label>
        <label class="wx-control">
          <span>{{ t('预览') }}</span>
          <select v-model="prefs.previewWidth">
            <option v-for="width in previewWidths" :key="width.id" :value="width.id">{{ t(width.name) }}</option>
          </select>
        </label>
        <label class="wx-control wx-accent-control" :title="t('自定义强调色')">
          <span>{{ t('强调色') }}</span>
          <input type="color" :value="prefs.accent || activeTheme.accent" @input="prefs.accent = $event.target.value" />
          <em>{{ prefs.accent || activeTheme.accent }}</em>
        </label>
        <button v-if="prefs.accent" type="button" class="wx-reset-accent" @click="prefs.accent = ''">
          {{ t('恢复主题色') }}
        </button>
        <button type="button" class="wx-style-entry" @click="styleVisible = true">{{ t('更多样式') }}</button>
        <span class="wx-config-hint">{{ t('样式全部内联，复制后可直接粘贴进公众号编辑器') }}</span>
      </div>

      <div
        ref="workbenchRef"
        class="wx-workbench"
        :class="[`mode-${viewMode}`, `split-${splitDirection}`]"
        :style="{ '--split-ratio': `${splitRatio}%` }"
      >
        <section v-show="viewMode !== 'preview'" class="wx-pane wx-editor-pane">
          <header class="wx-pane-header">
            <span class="wx-pane-title">Markdown</span>
            <span class="wx-pane-stats">{{
              t('{chars} 字 · {lines} 行', { chars: stats.chars, lines: stats.lines })
            }}</span>
            <span class="wx-pane-stats wx-cursor-stats">
              {{ t('第 {line} 行，第 {column} 列', { line: cursor.line, column: cursor.column }) }}
              <template v-if="cursor.selected"> · {{ t('选中 {count}', { count: cursor.selected }) }}</template>
            </span>
            <span v-if="savedTime" class="wx-save-status">{{ t('已自动保存 {time}', { time: savedTime }) }}</span>
          </header>
          <div class="wx-editor-body">
            <MarkdownEditor
              ref="editorRef"
              v-model="content"
              @scroll="onEditorScroll"
              @cursor="onCursor"
              @image="insertImageFile"
            />
          </div>
        </section>

        <SplitHandle
          v-if="viewMode === 'split'"
          :orientation="splitDirection === 'horizontal' ? 'vertical' : 'horizontal'"
          :resizing="splitResizing"
          :label="t('拖动调整编辑与预览大小')"
          @pointerdown="startSplitResize"
          @keydown="onSplitKeydown"
        />

        <section v-show="viewMode !== 'editor'" class="wx-pane wx-preview-pane">
          <header class="wx-pane-header">
            <span class="wx-pane-title">{{ t('公众号预览') }}</span>
            <span class="wx-pane-stats"
              >{{ t('约 {count} 分钟阅读', { count: stats.minutes }) }} · {{ t(activeTheme.name) }}</span
            >
            <span class="wx-pane-stats wx-width-badge">{{ widthLabel }}</span>
            <span class="wx-pane-spacer" />
            <span v-if="mermaidPending" class="wx-render-status">{{ t('图表渲染中…') }}</span>
          </header>

          <aside v-if="outlineVisible" class="wx-outline">
            <header class="wx-outline-header">
              <span>{{ t('文章大纲') }}</span>
              <button type="button" class="wx-close" @click="outlineVisible = false">×</button>
            </header>
            <div class="wx-outline-body">
              <button
                v-for="(heading, index) in headings"
                :key="`${heading.id}-${index}`"
                type="button"
                class="wx-outline-item"
                :class="{ 'level-1': heading.level === 1 }"
                :style="{ paddingLeft: `${(heading.level - 1) * 12 + 10}px` }"
                @click="scrollToHeading(heading.id)"
              >
                {{ heading.text || t('未命名标题') }}
              </button>
              <p v-if="headings.length === 0" class="wx-outline-empty">{{ t('暂无标题') }}</p>
            </div>
          </aside>

          <div ref="previewScrollRef" class="wx-preview-scroll" @click="onPreviewClick">
            <div class="wx-preview-card" :class="`width-${prefs.previewWidth}`">
              <div v-if="articleHtml" class="wx-article" v-html="articleHtml" />
              <div v-else class="wx-empty">{{ t('在左侧输入 Markdown，这里会实时生成公众号文章排版') }}</div>
            </div>
          </div>
        </section>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        class="wx-hidden-input"
        @change="onImportFile"
      />
      <input
        ref="imageInputRef"
        type="file"
        accept="image/*"
        multiple
        class="wx-hidden-input"
        @change="onImageChange"
      />
    </div>

    <Transition name="wx-fade">
      <div v-if="styleVisible" class="wx-overlay wx-drawer-overlay" @click.self="styleVisible = false">
        <aside class="wx-drawer">
          <header class="wx-drawer-header">
            <span>{{ t('样式设置') }}</span>
            <button type="button" class="wx-drawer-dismiss" @click="styleVisible = false">{{ t('关闭') }}</button>
          </header>
          <div class="wx-drawer-body">
            <section class="wx-field-group">
              <h3>{{ t('段落与标题') }}</h3>
              <label class="wx-field">
                <span>{{ t('段间距') }}</span>
                <select v-model.number="prefs.blockSpacing">
                  <option v-for="value in blockSpacings" :key="value" :value="value">{{ value.toFixed(2) }}×</option>
                </select>
              </label>
              <label class="wx-check">
                <input v-model="prefs.justify" type="checkbox" />
                <span>{{ t('正文两端对齐') }}</span>
              </label>
              <label class="wx-check">
                <input v-model="prefs.indent" type="checkbox" />
                <span>{{ t('正文首行缩进') }}</span>
              </label>
              <label class="wx-field">
                <span>{{ t('标题样式') }}</span>
                <select v-model="prefs.headingStyle">
                  <option v-for="item in headingStyles" :key="item.id" :value="item.id">{{ t(item.name) }}</option>
                </select>
              </label>
              <label class="wx-field">
                <span>{{ t('链接颜色') }}</span>
                <select v-model="prefs.linkColor">
                  <option v-for="item in linkColors" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </label>
              <label class="wx-field">
                <span>{{ t('引用背景') }}</span>
                <select v-model="prefs.quoteBg">
                  <option v-for="item in quoteBackgrounds" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </label>
            </section>

            <section class="wx-field-group">
              <h3>{{ t('代码块') }}</h3>
              <label class="wx-field">
                <span>{{ t('代码主题') }}</span>
                <select v-model="prefs.codeTheme">
                  <option v-for="item in codeThemes" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </label>
              <label class="wx-check">
                <input v-model="prefs.macCode" type="checkbox" />
                <span>{{ t('Mac 风格窗口栏') }}</span>
              </label>
              <label class="wx-check">
                <input v-model="prefs.lineNumbers" type="checkbox" />
                <span>{{ t('显示代码行号') }}</span>
              </label>
            </section>

            <section class="wx-field-group">
              <h3>{{ t('图片与图表') }}</h3>
              <label class="wx-field">
                <span>{{ t('图片图注') }}</span>
                <select v-model="prefs.legend">
                  <option v-for="item in legends" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </label>
              <label class="wx-field wx-field-stack">
                <span>{{ t('PlantUML 服务地址') }}</span>
                <input
                  v-model.lazy="prefs.plantUmlServer"
                  type="url"
                  placeholder="https://www.plantuml.com/plantuml/svg/"
                />
              </label>
              <p class="wx-field-hint">
                {{
                  t(
                    'PlantUML 图表与网络图片需要联网加载；本地图片以 Base64 内嵌，复制到公众号后若未显示，请改用图片链接。'
                  )
                }}
              </p>
            </section>

            <section class="wx-field-group">
              <h3>{{ t('高级') }}</h3>
              <label class="wx-field">
                <span>{{ t('预览宽度') }}</span>
                <select v-model="prefs.previewWidth">
                  <option v-for="item in previewWidths" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </label>
              <label class="wx-field wx-field-stack">
                <span>{{ t('自定义 CSS') }}</span>
                <textarea
                  v-model="prefs.customCss"
                  class="wx-css-input"
                  rows="8"
                  maxlength="20000"
                  placeholder=".wx-article h2 { color: #3b6cf6; }"
                />
              </label>
              <p class="wx-field-hint">
                {{ t('自定义样式会在排版后内联到匹配元素，不支持伪类、媒体查询与 @ 规则。') }}
              </p>
            </section>
          </div>
          <footer class="wx-drawer-footer">
            <button class="btn btn-secondary btn-sm" @click="resetStyles">{{ t('恢复默认样式') }}</button>
            <button class="btn btn-primary btn-sm" @click="styleVisible = false">{{ t('完成') }}</button>
          </footer>
        </aside>
      </div>
    </Transition>

    <Transition name="wx-fade">
      <div v-if="draftsVisible" class="wx-overlay wx-center-overlay" @click.self="draftsVisible = false">
        <div class="wx-modal wx-drafts-modal">
          <header class="wx-modal-header">
            <h2>{{ t('草稿箱') }}</h2>
            <button type="button" class="wx-close" @click="draftsVisible = false">×</button>
          </header>
          <div class="wx-modal-body">
            <div class="wx-drafts-toolbar">
              <span class="wx-field-hint">{{
                t('共 {count} 篇草稿，保存在本机数据库中。', { count: drafts.length })
              }}</span>
              <button class="btn btn-primary btn-sm" @click="saveDraft">{{ t('保存当前为新草稿') }}</button>
            </div>
            <ul v-if="drafts.length" class="wx-draft-list">
              <li v-for="draft in drafts" :key="draft.id" class="wx-draft-item">
                <div class="wx-draft-main">
                  <strong>{{ draft.title }}</strong>
                  <span>{{
                    t('{chars} 字 · {time}', { chars: draftChars(draft), time: draftTime(draft.updatedAt) })
                  }}</span>
                </div>
                <div class="wx-draft-actions">
                  <button class="btn btn-secondary btn-xs" @click="loadDraft(draft)">{{ t('载入') }}</button>
                  <button class="btn btn-danger btn-xs" @click="deleteDraft(draft.id)">{{ t('删除') }}</button>
                </div>
              </li>
            </ul>
            <p v-else class="wx-empty-line">{{ t('还没有草稿，点击右上角保存当前内容。') }}</p>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="wx-fade">
      <div v-if="aiVisible" class="wx-overlay wx-center-overlay">
        <div class="wx-modal wx-ai-modal">
          <header class="wx-modal-header">
            <h2>{{ t('AI 写作助手') }}</h2>
            <button type="button" class="wx-close" @click="closeAi">×</button>
          </header>
          <div class="wx-modal-body">
            <div class="wx-ai-row">
              <span class="wx-ai-label">{{ t('处理范围') }}</span>
              <div class="segmented wx-ai-seg">
                <button
                  type="button"
                  class="segmented-item"
                  :class="{ active: aiScope === 'selection' }"
                  @click="aiScope = 'selection'"
                >
                  {{ t('选中内容') }}
                </button>
                <button
                  type="button"
                  class="segmented-item"
                  :class="{ active: aiScope === 'full' }"
                  @click="aiScope = 'full'"
                >
                  {{ t('全文') }}
                </button>
              </div>
              <span class="wx-ai-model">{{ aiModelLabel }}</span>
            </div>

            <div class="wx-ai-actions">
              <button
                v-for="action in aiActions"
                :key="action.id"
                type="button"
                class="wx-chip"
                :class="{ active: aiAction === action.id }"
                @click="aiAction = action.id"
              >
                {{ t(action.label) }}
              </button>
            </div>

            <label v-if="aiAction === 'custom'" class="wx-field wx-field-stack">
              <span>{{ t('自定义指令') }}</span>
              <textarea v-model="aiInstruction" rows="3" :placeholder="t('例如：把内容改写成更口语化的风格')" />
            </label>
            <p v-else class="wx-ai-hint">{{ currentAiAction.instructionPreview || currentAiAction.instruction }}</p>

            <div class="wx-ai-result">
              <div class="wx-ai-result-head">
                <span>{{ t('AI 结果') }}</span>
                <span v-if="aiLoading" class="wx-ai-loading">{{ t('生成中…') }}</span>
              </div>
              <textarea v-model="aiResult" rows="10" :placeholder="t('生成结果会显示在这里，可直接编辑后应用')" />
            </div>
            <p v-if="aiError" class="wx-ai-error">{{ aiError }}</p>
          </div>
          <footer class="wx-modal-footer">
            <button class="btn btn-primary btn-sm wx-ai-run" :disabled="aiLoading" @click="runAi">
              {{ aiLoading ? t('生成中…') : t('开始生成') }}
            </button>
            <button class="btn btn-secondary btn-sm" :disabled="!aiResult.trim()" @click="copyAiResult">
              {{ t('复制') }}
            </button>
            <button class="btn btn-secondary btn-sm" :disabled="!aiResult.trim()" @click="insertAiResult">
              {{ t('插入') }}
            </button>
            <button class="btn btn-primary btn-sm" :disabled="!aiResult.trim()" @click="replaceWithAiResult">
              {{ t('替换{scope}', { scope: aiScope === 'selection' ? t('选中') : t('全文') }) }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />

    <MessageDialog
      :visible="clearVisible"
      type="confirm"
      :title="t('清空编辑内容')"
      :message="t('当前 Markdown 内容将被清空，此操作无法撤销。')"
      @confirm="clearContent"
      @cancel="clearVisible = false"
      @close="clearVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Toast from '@/components/Toast.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import { usePaneResize, useToast } from '@/composables'
import { chat, copyRichText, draftImport, draftList, draftRemove, draftSave, getConfig, openExternal } from '@/api'
import { copyToClipboard } from '@/utils/clipboard'
import { formatDateTime } from '@/utils/format'
import { renderWechatArticle } from '@/utils/wechatFormatter'
import { ensureDiagramsRendered } from '@/utils/wechatMarkdown'
import { getLocale, t } from '@/i18n'
import SplitHandle from '@/components/SplitHandle.vue'
import {
  CODE_THEMES,
  DEFAULT_WECHAT_PREFS,
  WECHAT_BLOCK_SPACINGS,
  WECHAT_FONTS,
  WECHAT_FONT_SIZES,
  WECHAT_HEADING_STYLES,
  WECHAT_LEGENDS,
  WECHAT_LINE_HEIGHTS,
  WECHAT_LINK_COLORS,
  WECHAT_PREVIEW_WIDTHS,
  WECHAT_QUOTE_BACKGROUNDS,
  WECHAT_THEMES,
  normalizeWechatPrefs,
  resolveWechatTheme
} from '@/utils/wechatThemes'

const ALERT_TITLES_EN = {
  提示: 'Note',
  信息: 'Info',
  技巧: 'Tip',
  重要: 'Important',
  警告: 'Warning',
  注意: 'Caution',
  摘要: 'Abstract',
  总结: 'Summary',
  太长不看: 'TL;DR',
  待办: 'Todo',
  成功: 'Success',
  完成: 'Done',
  问题: 'Question',
  帮助: 'Help',
  常见问题: 'FAQ',
  失败: 'Failure',
  缺失: 'Missing',
  危险: 'Danger',
  错误: 'Error',
  缺陷: 'Bug',
  示例: 'Example',
  引用: 'Quote',
  定理: 'Theorem',
  引理: 'Lemma',
  推论: 'Corollary',
  命题: 'Proposition',
  定义: 'Definition',
  公理: 'Axiom',
  公设: 'Postulate',
  假设: 'Assumption',
  证明: 'Proof',
  备注: 'Remark'
}

const DRAFT_KEY = 'ntb_wechat_draft'
const PREFS_KEY = 'ntb_wechat_prefs'
const DRAFTS_KEY = 'ntb_wechat_drafts'

const VIEW_MODES = [
  {
    id: 'split',
    get label() {
      return t('分栏')
    }
  },
  {
    id: 'editor',
    get label() {
      return t('编辑')
    }
  },
  {
    id: 'preview',
    get label() {
      return t('预览')
    }
  }
]

const AI_ACTIONS = [
  {
    id: 'polish',
    get label() {
      return t('润色')
    },
    instruction: '请润色以下 Markdown 内容，保持原有结构与 Markdown 语法，直接输出润色后的内容，不要解释。'
  },
  {
    id: 'title',
    get label() {
      return t('生成标题')
    },
    instruction: '请为以下 Markdown 文章生成 5 个适合公众号的标题，每行一个，不要编号，不要解释。'
  },
  {
    id: 'summary',
    get label() {
      return t('生成摘要')
    },
    instruction: '请为以下 Markdown 文章生成不超过 120 字的公众号摘要，直接输出摘要，不要解释。'
  },
  {
    id: 'continue',
    get label() {
      return t('续写')
    },
    instruction: '请基于以下 Markdown 内容自然续写 2-3 段，保持原有风格与 Markdown 语法，直接输出续写内容。'
  },
  {
    id: 'translate',
    get label() {
      return t('译为英文')
    },
    instruction: '请将以下 Markdown 内容翻译成英文，保留 Markdown 结构与代码块，直接输出译文。'
  },
  {
    id: 'custom',
    get label() {
      return t('自定义')
    },
    instruction: ''
  }
]

const EXAMPLE = [
  t('# 公众号文章排版工具'),
  '',
  t(
    '把 Markdown 变成可以直接粘贴到公众号的排版稿，**主题、字号、行高与强调色**都能实时调整。参考 [doocs/md](https://github.com/doocs/md) 的实现。'
  ),
  '',
  '[TOC]',
  '',
  t('## 为什么需要内联样式'),
  '',
  t('公众号编辑器会过滤外部样式表，因此这里把颜色、间距与边框全部写入元素的内联 `style`，复制后排版不会丢失。'),
  '',
  '> [!TIP]',
  t('> 点击右上角「复制到公众号」，再到公众号后台正文区域粘贴即可。'),
  '',
  t('## 引用与链接'),
  '',
  t('> 这是一段普通引用，用于演示引用背景色与内边距设置。'),
  '',
  '> [!WARNING]',
  t('> Mermaid 与 PlantUML 需要联网渲染；本地图片以 Base64 内嵌。'),
  '',
  t('## 数学公式'),
  '',
  t('行内公式 $E = mc^2$，块级公式：'),
  '',
  '$$',
  '\\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}',
  '$$',
  '',
  t('## 图表'),
  '',
  '```mermaid',
  'graph LR',
  t('  A[Markdown] --> B[渲染]'),
  t('  B --> C[复制到公众号]'),
  '```',
  '',
  t('## 代码高亮'),
  '',
  '```js',
  'export function formatTitle(title) {',
  '  return `## ${title}`',
  '}',
  '```',
  '',
  t('## 扩展语法'),
  '',
  t('==高亮==、++下划线++、~波浪线~、^上标^、~~删除线~~，以及注音：[漢字]^(かんじ)。'),
  '',
  t('- [x] 已完成的待办'),
  t('- [ ] 待完成的待办'),
  '',
  t('| 能力 | 说明 |'),
  '| --- | --- |',
  t('| 实时预览 | 编辑器与公众号样式同步 |'),
  t('| 主题切换 | 多套配色一键切换 |'),
  t('| 富文本复制 | 保留完整内联样式 |'),
  '',
  t('脚注示例[^1]。'),
  '',
  t('[^1]: 这是脚注内容，会自动追加到文章末尾。'),
  '',
  t('最后，把文章粘贴到公众号后按需微调即可。')
].join('\n')

const { toastVisible, toastMessage, toastType, showSuccess, showError, showInfo } = useToast()

const editorRef = ref(null)
const previewScrollRef = ref(null)
const fileInputRef = ref(null)
const imageInputRef = ref(null)
const clearVisible = ref(false)
const viewMode = ref('split')
const syncScroll = ref(true)
const content = ref('')
const articleHtml = ref('')
const articleText = ref('')
const headings = ref([])
const outlineVisible = ref(false)
const savedAt = ref(0)
const cursor = ref({ line: 1, column: 1, selected: 0, totalLines: 1 })
const styleVisible = ref(false)
const draftsVisible = ref(false)
const drafts = ref([])
const aiVisible = ref(false)
const aiScope = ref('selection')
const aiAction = ref('polish')
const aiInstruction = ref('')
const aiResult = ref('')
const aiError = ref('')
const aiLoading = ref(false)
const aiModelLabel = ref('')
const mermaidPending = ref(false)

const workbenchRef = ref(null)
const splitMedia = window.matchMedia('(max-width: 1100px)')
const splitDirection = ref(splitMedia.matches ? 'vertical' : 'horizontal')
const {
  size: splitRatio,
  resizing: splitResizing,
  startResize: startSplitResize,
  onKeydown: onSplitKeydown
} = usePaneResize({
  key: 'wechatSplitRatio',
  initial: 50,
  min: 20,
  max: 80,
  unit: 'percent',
  direction: () => splitDirection.value,
  container: () => workbenchRef.value
})

function syncSplitDirection() {
  splitDirection.value = splitMedia.matches ? 'vertical' : 'horizontal'
}

const themes = WECHAT_THEMES
const fontSizes = WECHAT_FONT_SIZES
const lineHeights = WECHAT_LINE_HEIGHTS
const fonts = WECHAT_FONTS
const viewModes = VIEW_MODES
const blockSpacings = WECHAT_BLOCK_SPACINGS
const headingStyles = WECHAT_HEADING_STYLES
const linkColors = WECHAT_LINK_COLORS
const quoteBackgrounds = WECHAT_QUOTE_BACKGROUNDS
const previewWidths = WECHAT_PREVIEW_WIDTHS
const legends = WECHAT_LEGENDS
const codeThemes = CODE_THEMES
// Keep raw instructions for the AI request; translate them only for display
const aiActions = AI_ACTIONS.map((action) => ({
  ...action,
  instructionPreview: action.instruction ? t(action.instruction) : ''
}))

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null')
    return normalizeWechatPrefs(saved)
  } catch {
    return normalizeWechatPrefs(null)
  }
}

const prefs = ref(loadPrefs())
const activeTheme = computed(() => resolveWechatTheme(prefs.value))
const currentAiAction = computed(() => aiActions.find((action) => action.id === aiAction.value) || aiActions[0])
const widthLabel = computed(() =>
  t(previewWidths.find((item) => item.id === prefs.value.previewWidth)?.name || t('自适应'))
)

const stats = computed(() => {
  const text = content.value
  const chars = text.replace(/\s/g, '').length
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length
  const words = (text.match(/[A-Za-z0-9_]+/g) || []).length
  const units = cjk + words
  return {
    chars,
    lines: text ? text.split('\n').length : 1,
    minutes: units === 0 ? 0 : Math.max(1, Math.ceil(units / 300))
  }
})

const savedTime = computed(() => {
  if (!savedAt.value) return ''
  return new Date(savedAt.value).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
})

function articleLabels() {
  return {
    tocEmpty: t('暂无标题'),
    diagrams: {
      failed: t('Mermaid 图表渲染失败，请检查语法'),
      loading: t('Mermaid 图表加载中…')
    }
  }
}

let renderTimer = null
let saveTimer = null
let renderSeq = 0
let lastRender = null

// Swap the built-in alert titles / TOC empty state for the active locale
function withLocalizedArticleHtml(html, labels) {
  if (!html || getLocale() !== 'en-US') return html
  const container = document.createElement('div')
  container.innerHTML = html
  const tocEmpty = container.querySelector('[data-wx-toc-empty="1"]')
  if (tocEmpty) tocEmpty.textContent = labels.tocEmpty
  for (const title of container.querySelectorAll('[data-wx-alert-title]')) {
    // Titles keep the leading icon; only the built-in label after it follows the locale
    const match = /^(\S+\s)([\s\S]*)$/.exec(title.textContent || '')
    const label = match ? match[2] : ''
    if (label && Object.hasOwn(ALERT_TITLES_EN, label)) title.textContent = `${match[1]}${ALERT_TITLES_EN[label]}`
  }
  return container.innerHTML
}

function renderNow() {
  if (!content.value.trim()) {
    articleHtml.value = ''
    articleText.value = ''
    headings.value = []
    lastRender = null
    mermaidPending.value = false
    return
  }
  const labels = articleLabels()
  const result = renderWechatArticle(content.value, prefs.value, labels)
  articleHtml.value = withLocalizedArticleHtml(result.html, labels)
  articleText.value = result.text
  headings.value = result.headings || []
  lastRender = result
  mermaidPending.value = result.diagrams.length > 0
}

async function renderDiagrams() {
  const result = lastRender
  const seq = ++renderSeq
  if (!result || result.diagrams.length === 0) {
    mermaidPending.value = false
    return
  }
  const changed = await ensureDiagramsRendered(result.diagrams, result.dark)
  if (seq !== renderSeq) return
  if (changed) renderNow()
  mermaidPending.value = false
}

function scheduleRender() {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    renderNow()
    renderDiagrams()
  }, 140)
}

watch([content, prefs], scheduleRender, { deep: true })

let draftReady = false

watch(content, () => {
  if (!draftReady) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const result = await draftSave('wechat', {
      id: 'current',
      title: draftTitle(),
      content: content.value
    })
    if (result?.success) savedAt.value = Date.now()
  }, 500)
})

watch(
  prefs,
  (value) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(value))
    } catch {
      // 忽略本地存储失败
    }
  },
  { deep: true }
)

function onCursor(info) {
  cursor.value = info
}

function applyFormat(action) {
  const editor = editorRef.value
  if (!editor) return

  switch (action) {
    case 'h1':
      editor.toggleLineMark('# ', /^#{1,6}\s+/)
      break
    case 'h2':
      editor.toggleLineMark('## ', /^#{1,6}\s+/)
      break
    case 'h3':
      editor.toggleLineMark('### ', /^#{1,6}\s+/)
      break
    case 'bold':
      editor.wrapSelection('**', '**', t('粗体'))
      break
    case 'italic':
      editor.wrapSelection('*', '*', t('斜体'))
      break
    case 'quote':
      editor.toggleLineMark('> ', /^>\s?/)
      break
    case 'ul':
      editor.toggleLineMark('- ', /^[-*+]\s+/)
      break
    case 'ol':
      editor.toggleLineMark('1. ', /^\d+[.)]\s+/)
      break
    case 'code':
      editor.wrapSelection('`', '`', t('代码'))
      break
    case 'link':
      editor.insertLink()
      break
    case 'codeblock':
      editor.insertCodeBlock()
      break
    case 'table':
      editor.insertTable()
      break
    default:
      break
  }
}

function onEditorScroll(ratio) {
  if (!syncScroll.value || viewMode.value !== 'split') return
  const el = previewScrollRef.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  if (max > 0) el.scrollTop = ratio * max
}

function findHeading(id) {
  const container = previewScrollRef.value
  if (!container || !id) return null
  return Array.from(container.querySelectorAll('[id]')).find((element) => element.id === id) || null
}

function scrollToHeading(id) {
  const container = previewScrollRef.value
  const target = findHeading(id)
  if (!container || !target) return
  const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 12
  container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

function onPreviewClick(event) {
  const anchor = event.target.closest('a')
  if (!anchor) return
  const href = anchor.getAttribute('href') || ''
  if (!href) return
  event.preventDefault()
  if (href.startsWith('#')) {
    scrollToHeading(href.slice(1))
    return
  }
  if (/^https?:\/\//i.test(href)) openExternal(href)
}

async function copyArticle() {
  if (!content.value.trim()) {
    showInfo(t('当前没有可复制的内容'))
    return
  }

  renderNow()
  await renderDiagrams()

  const ok = await copyRichText(articleHtml.value, articleText.value)
  if (ok) {
    showSuccess(t('已复制公众号文章排版，可直接粘贴到公众号编辑器'))
    return
  }

  const fallback = await copyToClipboard(articleText.value)
  if (fallback) showSuccess(t('已复制纯文本（富文本复制不可用）'))
  else showError(t('复制失败'))
}

async function copyMarkdown() {
  if (!content.value.trim()) {
    showInfo(t('当前没有可复制的内容'))
    return
  }
  const ok = await copyToClipboard(content.value)
  if (ok) showSuccess(t('已复制 Markdown'))
  else showError(t('复制失败'))
}

function downloadFile(value, filename, type) {
  const blob = new Blob([value], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function exportHtml() {
  if (!content.value.trim()) {
    showInfo(t('当前没有可导出的内容'))
    return
  }

  renderNow()
  await renderDiagrams()

  const documentHtml = [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${t('公众号文章排版')}</title>`,
    '</head>',
    '<body style="margin:0;padding:24px;background:#f3f4f6;">',
    articleHtml.value,
    '</body>',
    '</html>'
  ].join('\n')

  downloadFile(documentHtml, `wechat-article-${formatDateTime(Date.now(), 'date')}.html`, 'text/html;charset=utf-8')
  showSuccess(t('已导出 HTML 文件'))
}

function triggerImport() {
  fileInputRef.value?.click()
}

function onImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    content.value = String(reader.result || '')
    showSuccess(t('已导入 {name}', { name: file.name }))
  }
  reader.onerror = () => showError(t('读取文件失败'))
  reader.readAsText(file)
}

function triggerImage() {
  imageInputRef.value?.click()
}

function onImageChange(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  for (const file of files) insertImageFile(file)
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('decode failed'))
    image.src = source
  })
}

async function compressImage(file) {
  const dataUrl = await readAsDataUrl(file)
  if (file.size <= 600 * 1024) return dataUrl

  const image = await loadImage(dataUrl)
  const max = 1600
  const scale = Math.min(1, max / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return dataUrl
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  if (file.type === 'image/png') return canvas.toDataURL('image/png')
  return canvas.toDataURL('image/jpeg', 0.86)
}

async function insertImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return
  try {
    const dataUrl = await compressImage(file)
    const alt = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || t('图片')
    editorRef.value?.insertText(`\n![${alt}](${dataUrl})\n`)
    showSuccess(t('已插入图片'))
  } catch {
    showError(t('图片读取失败'))
  }
}

function loadExample() {
  content.value = EXAMPLE
  showInfo(t('已加载示例内容'))
}

function clearContent() {
  clearVisible.value = false
  content.value = ''
  showSuccess(t('已清空编辑内容'))
}

function loadDrafts() {
  draftList('wechat-draft', { limit: 50 })
    .then((page) => {
      drafts.value = Array.isArray(page?.items) ? page.items : []
    })
    .catch(() => {
      drafts.value = []
    })
}

function draftTitle() {
  const heading = content.value.match(/^#{1,6}\s+(.+)$/m)
  if (heading) return heading[1].trim().slice(0, 48)
  const line = content.value
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean)
  return (line || t('未命名草稿')).slice(0, 48)
}

function draftChars(draft) {
  return draft.content.replace(/\s/g, '').length
}

function draftTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function openDrafts() {
  loadDrafts()
  draftsVisible.value = true
}

function saveDraft() {
  if (!content.value.trim()) {
    showInfo(t('当前没有可保存的内容'))
    return
  }
  const draft = {
    id: `d_${Date.now()}`,
    title: draftTitle(),
    content: content.value,
    updatedAt: Date.now()
  }
  drafts.value.unshift(draft)
  if (drafts.value.length > 30) drafts.value.length = 30
  void draftSave('wechat-draft', draft)
  showSuccess(t('已保存到草稿箱'))
}

function loadDraft(draft) {
  content.value = draft.content
  draftsVisible.value = false
  showInfo(t('已载入草稿：{title}', { title: draft.title }))
}

function deleteDraft(id) {
  drafts.value = drafts.value.filter((draft) => draft.id !== id)
  void draftRemove('wechat-draft', id)
}

function resetStyles() {
  prefs.value = normalizeWechatPrefs({ ...DEFAULT_WECHAT_PREFS })
  showInfo(t('已恢复默认样式'))
}

function openAi() {
  aiVisible.value = true
  aiResult.value = ''
  aiError.value = ''
  aiInstruction.value = ''
  const selection = editorRef.value?.getSelection?.() || ''
  aiScope.value = selection ? 'selection' : 'full'
  loadAiModelLabel()
}

function closeAi() {
  aiVisible.value = false
}

async function loadAiModelLabel() {
  try {
    const config = await getConfig()
    const provider = config?.ai.provider || ''
    const entry = config?.ai.models?.[provider]
    const model = entry?.default || entry?.models?.[0]?.name || entry?.models?.[0]?.id || ''
    aiModelLabel.value = [provider, model].filter(Boolean).join(' · ')
  } catch {
    aiModelLabel.value = ''
  }
}

async function runAi() {
  const action = currentAiAction.value
  const selection = aiScope.value === 'selection' ? editorRef.value?.getSelection?.() || '' : ''
  const source = aiScope.value === 'selection' ? selection : content.value
  if (!source.trim()) {
    showInfo(aiScope.value === 'selection' ? t('请先在编辑器中选中一段内容') : t('当前没有可处理的内容'))
    return
  }
  const instruction = aiAction.value === 'custom' ? aiInstruction.value.trim() : action.instruction
  if (!instruction) {
    showInfo(t('请输入自定义指令'))
    return
  }

  aiLoading.value = true
  aiError.value = ''
  aiResult.value = ''

  try {
    const config = await getConfig()
    const provider = config?.ai.provider || ''
    const entry = config?.ai.models?.[provider]
    const model = entry?.default || entry?.models?.[0]?.id || ''
    const response = await chat([{ role: 'user', content: `${instruction}\n\n${source}` }], {
      provider,
      model,
      toolsEnabled: false
    })
    if (response && response.success) {
      aiResult.value = String(response.content || '').trim()
      if (!aiResult.value) aiError.value = t('AI 返回了空结果')
    } else {
      aiError.value = response?.error || t('AI 请求失败，请检查设置中的 API Key 与模型配置')
    }
  } catch (error) {
    aiError.value = error?.message || t('AI 请求失败')
  } finally {
    aiLoading.value = false
  }
}

async function copyAiResult() {
  if (!aiResult.value.trim()) return
  const ok = await copyToClipboard(aiResult.value)
  if (ok) showSuccess(t('已复制 AI 结果'))
  else showError(t('复制失败'))
}

function insertAiResult() {
  if (!aiResult.value.trim()) return
  editorRef.value?.insertText(`${aiResult.value}\n`)
  closeAi()
  showSuccess(t('已插入 AI 结果'))
}

function replaceWithAiResult() {
  if (!aiResult.value.trim()) return
  if (aiScope.value === 'selection') {
    editorRef.value?.insertText(aiResult.value)
  } else {
    content.value = aiResult.value
  }
  closeAi()
  showSuccess(t('已应用 AI 结果'))
}

function readLegacyDrafts() {
  try {
    const content = localStorage.getItem(DRAFT_KEY)
    const raw = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]')
    return {
      content,
      drafts: Array.isArray(raw)
        ? raw.filter((draft) => draft && typeof draft.content === 'string' && typeof draft.id === 'string')
        : []
    }
  } catch {
    return { content: null, drafts: [] }
  }
}

onMounted(async () => {
  splitMedia.addEventListener('change', syncSplitDirection)
  const legacy = readLegacyDrafts()
  let saved = null
  try {
    if (legacy.content !== null) {
      await draftImport('wechat', [{ id: 'current', content: legacy.content, updatedAt: Date.now() }])
      localStorage.removeItem(DRAFT_KEY)
    }
    if (legacy.drafts.length) {
      await draftImport('wechat-draft', legacy.drafts)
      localStorage.removeItem(DRAFTS_KEY)
    }
    const page = await draftList('wechat', { limit: 1 })
    saved = page?.items?.[0]?.content ?? null
  } catch {
    // 读取失败时回退到旧本地草稿或示例内容
  }
  content.value = saved ?? legacy.content ?? EXAMPLE
  draftReady = true
  loadDrafts()
  renderNow()
  renderDiagrams()
  nextTick(() => editorRef.value?.focus())
})

onUnmounted(() => {
  splitMedia.removeEventListener('change', syncSplitDirection)
  clearTimeout(renderTimer)
  clearTimeout(saveTimer)
  renderSeq += 1
})
</script>

<style scoped>
.wechat-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 20px;
}

.wx-config-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.wx-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
  white-space: nowrap;
}

.wx-control select {
  min-width: 74px;
}

.wx-accent-control input[type='color'] {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: none;
  cursor: pointer;
}

.wx-accent-control em {
  font-style: normal;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.wx-reset-accent,
.wx-style-entry {
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0;
  font-size: var(--font-size-dense);
  color: var(--accent-color);
  cursor: pointer;
}

.wx-config-hint {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.wx-view-switch {
  flex-shrink: 0;
}

.wx-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.wx-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wx-toggle input {
  margin: 0;
}

.wx-format-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.wx-format-text {
  width: auto;
  min-width: 30px;
  padding: 0 6px;
  font-size: calc(11px * var(--font-scale));
  font-weight: 700;
}

.btn.is-active {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.08);
}

.wx-workbench {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.wx-workbench.mode-split.split-horizontal {
  flex-direction: row;
}

.wx-workbench.mode-split.split-vertical {
  flex-direction: column;
}

.wx-pane {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.wx-workbench.mode-split.split-horizontal .wx-editor-pane {
  flex: 0 0 auto;
  width: var(--split-ratio);
}

.wx-workbench.mode-split.split-vertical .wx-editor-pane {
  flex: 0 0 auto;
  height: var(--split-ratio);
}

.wx-preview-pane {
  position: relative;
}

.wx-pane-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.wx-pane-title {
  font-size: var(--font-size-dense);
  font-weight: 650;
  color: var(--text-primary);
}

.wx-pane-stats,
.wx-save-status,
.wx-render-status {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.wx-cursor-stats {
  overflow: hidden;
  text-overflow: ellipsis;
}

.wx-save-status {
  margin-left: auto;
}

.wx-render-status {
  color: var(--accent-color);
}

.wx-pane-spacer {
  flex: 1;
}

.wx-width-badge {
  padding: 1px 8px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
}

.wx-editor-body {
  flex: 1;
  min-height: 0;
}

.wx-preview-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
  background:
    radial-gradient(circle at 1px 1px, var(--border-color) 1px, transparent 0) 0 0 / 16px 16px,
    var(--surface-muted);
}

.wx-preview-card {
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition: max-width 0.2s ease;
}

.wx-preview-card.width-mobile {
  max-width: 375px;
}

.wx-preview-card.width-auto {
  max-width: 677px;
}

.wx-preview-card.width-wide {
  max-width: 840px;
}

.wx-preview-card.width-wide :deep(.wx-article > section) {
  max-width: 840px !important;
}

.wx-article :deep(a) {
  cursor: pointer;
}

.wx-empty {
  padding: 60px 20px;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  background: var(--surface);
}

.wx-hidden-input {
  display: none;
}

.wx-outline {
  position: absolute;
  top: 42px;
  left: 12px;
  z-index: 6;
  width: 230px;
  max-height: calc(100% - 56px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.wx-outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-size-dense);
  font-weight: 600;
  color: var(--text-primary);
}

.wx-outline-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}

.wx-outline-item {
  display: block;
  width: 100%;
  border: none;
  border-radius: 5px;
  background: none;
  padding: 5px 8px;
  text-align: left;
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wx-outline-item:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.wx-outline-item.level-1 {
  font-weight: 600;
  color: var(--text-primary);
}

.wx-outline-empty {
  margin: 16px 0;
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.wx-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--overlay-bg);
  display: flex;
}

.wx-drawer-overlay {
  justify-content: flex-end;
  inset: 40px 0 0 0;
}

.wx-center-overlay {
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.wx-drawer {
  width: 380px;
  max-width: 94vw;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
}

.wx-drawer-header,
.wx-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
  font-size: var(--font-size-md);
  font-weight: 650;
  color: var(--text-primary);
}

.wx-modal-header h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 650;
}

.wx-close {
  border: none;
  background: none;
  padding: 0 4px;
  font-size: calc(20px * var(--font-scale));
  line-height: 1;
  color: var(--text-tertiary);
  cursor: pointer;
}

.wx-close:hover {
  color: var(--text-primary);
}

.wx-drawer-dismiss {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  padding: 3px 12px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

.wx-drawer-dismiss:hover {
  color: var(--text-primary);
  background: var(--surface);
}

.wx-drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px;
}

.wx-drawer-footer,
.wx-modal-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.wx-field-group {
  margin-bottom: 20px;
}

.wx-field-group h3 {
  margin: 0 0 10px;
  font-size: var(--font-size-xs);
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.wx-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
}

.wx-field > span {
  flex-shrink: 0;
  white-space: nowrap;
}

.wx-field select {
  min-width: 140px;
}

.wx-field-stack {
  flex-direction: column;
  align-items: stretch;
}

.wx-field-stack input,
.wx-field-stack textarea {
  width: 100%;
}

.wx-css-input {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  line-height: 1.6;
  resize: vertical;
}

.wx-field-hint {
  margin: 6px 0 0;
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--text-tertiary);
}

.wx-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
  cursor: pointer;
}

.wx-check input {
  margin: 0;
}

.wx-modal {
  width: min(720px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.wx-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.wx-drafts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.wx-draft-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wx-draft-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.wx-draft-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wx-draft-main strong {
  font-size: var(--font-size-dense);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wx-draft-main span {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.wx-draft-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.wx-empty-line {
  margin: 30px 0;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.wx-ai-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.wx-ai-label {
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
}

.wx-ai-model {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wx-ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.wx-chip {
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface);
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
  cursor: pointer;
}

.wx-chip.active {
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
  font-weight: 600;
}

.wx-ai-hint {
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--text-tertiary);
}

.wx-ai-result {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wx-ai-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-dense);
  color: var(--text-secondary);
}

.wx-ai-loading {
  color: var(--accent-color);
}

.wx-ai-result textarea {
  width: 100%;
  resize: vertical;
  line-height: 1.7;
}

.wx-ai-error {
  margin: 10px 0 0;
  font-size: var(--font-size-dense);
  color: var(--error-color);
}

.wx-ai-run {
  margin-right: auto;
}

.wx-fade-enter-active,
.wx-fade-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}

.wx-fade-enter-active .wx-drawer,
.wx-fade-leave-active .wx-drawer {
  transition: transform var(--motion-slow) var(--motion-ease);
}

.wx-fade-enter-active .wx-modal,
.wx-fade-leave-active .wx-modal {
  transition:
    transform var(--motion-panel) var(--motion-ease),
    opacity var(--motion-panel) var(--motion-ease);
}

.wx-fade-enter-from,
.wx-fade-leave-to {
  opacity: 0;
}

.wx-fade-enter-from .wx-drawer,
.wx-fade-leave-to .wx-drawer {
  transform: translateX(16px);
}

.wx-fade-enter-from .wx-modal {
  transform: scale(0.97);
  opacity: 0;
}

.wx-fade-leave-to .wx-modal {
  transform: scale(0.98);
  opacity: 0;
}

@media (max-width: 1100px) {
  .wx-config-hint {
    display: none;
  }
}

@media (max-width: 900px) {
  .wechat-page {
    padding: 12px 16px 20px;
  }

  .wx-cursor-stats {
    display: none;
  }
}
</style>
