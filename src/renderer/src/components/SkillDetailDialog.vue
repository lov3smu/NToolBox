<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible && skill" class="skill-dialog-overlay" @click.self="$emit('close')">
        <div class="skill-dialog">
          <header class="skill-dialog-header">
            <span class="skill-dialog-icon" v-html="getSkillIcon(skill.icon, skill.category)" />
            <div class="skill-dialog-heading">
              <div class="skill-dialog-title-row">
                <h2>{{ skill.name }}</h2>
                <span v-if="skill.version" class="skill-dialog-version">v{{ skill.version }}</span>
                <span v-if="badgeText" class="skill-badge" :class="badgeTone">{{ badgeText }}</span>
              </div>
              <p>{{ skill.description }}</p>
            </div>
            <button type="button" class="skill-dialog-close" title="关闭" @click="$emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div class="skill-dialog-body">
            <div class="skill-dialog-meta">
              <div class="meta-item">
                <span class="meta-label">作者</span>
                <span class="meta-value">{{ skill.author || '未知' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">分类</span>
                <span class="meta-value">{{ getCategoryLabel(skill.category) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">来源</span>
                <span class="meta-value">{{ sourceLabel(skill) }}</span>
              </div>
              <div v-if="skill.changelog" class="meta-item">
                <span class="meta-label">更新说明</span>
                <span class="meta-value">{{ skill.changelog }}</span>
              </div>
            </div>

            <div v-if="skill.tags?.length" class="skill-dialog-tags">
              <span v-for="tag in skill.tags" :key="tag" class="skill-tag">{{ tag }}</span>
            </div>

            <section v-if="parameterEntries.length" class="skill-dialog-section">
              <h3>参数</h3>
              <div class="parameter-list">
                <div v-for="[name, schema] in parameterEntries" :key="name" class="parameter-item">
                  <div class="parameter-name">
                    <code>{{ name }}</code>
                    <span v-if="requiredParams.has(name)" class="parameter-required">必填</span>
                  </div>
                  <p>{{ schema.description || schema.type || '无描述' }}</p>
                </div>
              </div>
            </section>

            <section v-if="skill.examples?.length" class="skill-dialog-section">
              <h3>示例</h3>
              <div class="example-list">
                <pre v-for="(example, index) in skill.examples" :key="index" class="example-item">{{
                  formatExample(example)
                }}</pre>
              </div>
            </section>

            <section v-if="skill.path" class="skill-dialog-section">
              <h3>安装位置</h3>
              <code class="skill-dialog-path">{{ skill.path }}</code>
            </section>
          </div>

          <footer class="skill-dialog-footer">
            <button type="button" class="btn btn-secondary" @click="$emit('close')">关闭</button>
            <slot name="actions" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { getSkillIcon } from '@/utils/skillIcons'
import { formatExample, getCategoryLabel } from '@/utils/skillMeta'

const props = defineProps({
  visible: { type: Boolean, default: false },
  skill: { type: Object, default: null },
  badgeText: { type: String, default: '' },
  badgeTone: { type: String, default: 'info' }
})

defineEmits(['close'])

const parameterEntries = computed(() => Object.entries(props.skill?.parameters?.properties || {}))
const requiredParams = computed(() => new Set(props.skill?.parameters?.required || []))

function sourceLabel(skill) {
  if (skill.source === 'clawhub') return 'ClawHub 在线市场'
  if (skill.source === 'bundled') return '内置扩展'
  if (skill.builtin) return '内置技能'
  return '本地扩展'
}
</script>

<style scoped>
.skill-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.skill-dialog {
  width: min(680px, 100%);
  max-height: min(760px, 90vh);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.skill-dialog-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--border-color);
}

.skill-dialog-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  color: var(--accent-color);
}

.skill-dialog-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.skill-dialog-heading {
  flex: 1;
  min-width: 0;
}

.skill-dialog-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-dialog-title-row h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 650;
  color: var(--text-primary);
}

.skill-dialog-version {
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.skill-dialog-heading p {
  margin: 6px 0 0;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--text-secondary);
}

.skill-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.skill-badge.success {
  color: var(--success-color);
  background: rgba(var(--success-rgb, 34, 197, 94), 0.12);
}

.skill-badge.warning {
  color: var(--warning-color);
  background: rgba(var(--warning-rgb, 245, 158, 11), 0.14);
}

.skill-badge.info {
  color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.12);
}

.skill-dialog-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.skill-dialog-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.skill-dialog-close svg {
  width: 16px;
  height: 16px;
}

.skill-dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 22px;
}

.skill-dialog-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.meta-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.meta-value {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  word-break: break-word;
}

.skill-dialog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}

.skill-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.skill-dialog-section {
  margin-top: 20px;
}

.skill-dialog-section h3 {
  margin: 0 0 10px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.parameter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.parameter-item {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.parameter-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.parameter-name code {
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-sm);
  color: var(--accent-color);
}

.parameter-required {
  font-size: var(--font-size-xs);
  color: var(--warning-color);
}

.parameter-item p {
  margin: 4px 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.example-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-item {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.skill-dialog-path {
  display: block;
  padding: 9px 12px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  word-break: break-all;
}

.skill-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}

.fade-enter-active .skill-dialog,
.fade-leave-active .skill-dialog {
  transition:
    transform var(--motion-panel) var(--motion-ease),
    opacity var(--motion-panel) var(--motion-ease);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .skill-dialog,
.fade-leave-to .skill-dialog {
  transform: scale(0.97) translateY(4px);
  opacity: 0;
}
</style>
