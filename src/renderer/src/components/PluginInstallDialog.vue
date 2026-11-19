<template>
  <Teleport to="body">
    <Transition name="plugin-dialog">
      <div v-if="visible" class="plugin-dialog-overlay" @click.self="requestClose">
        <section class="plugin-dialog" role="dialog" aria-modal="true" aria-labelledby="plugin-install-title">
          <header class="plugin-dialog-header">
            <div class="plugin-dialog-heading">
              <h2 id="plugin-install-title">{{ t('安装{kind}', { kind: installNoun }) }}</h2>
              <p>{{ installDescription }}</p>
            </div>
            <button
              type="button"
              class="plugin-dialog-close"
              :title="t('关闭')"
              :disabled="submitting"
              @click="requestClose"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div class="plugin-dialog-body">
            <input
              ref="inputRef"
              v-model="query"
              class="plugin-dialog-input"
              type="text"
              spellcheck="false"
              autocomplete="off"
              :placeholder="inputPlaceholder"
              :disabled="submitting"
              @keydown.enter.prevent="submit"
            />

            <div class="plugin-dialog-row">
              <button
                type="button"
                class="plugin-guide-toggle"
                :aria-expanded="guideOpen"
                @click="guideOpen = !guideOpen"
              >
                <svg
                  class="plugin-guide-chevron"
                  :class="{ open: guideOpen }"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
                {{ t('安装引导和示例') }}
              </button>

              <div class="plugin-source">
                <button
                  type="button"
                  class="plugin-source-trigger"
                  :class="{ open: sourceOpen }"
                  aria-haspopup="true"
                  :aria-expanded="sourceOpen"
                  @click="sourceOpen = !sourceOpen"
                >
                  <span class="plugin-source-label">{{ t('安装源') }}</span>
                  <span class="plugin-source-current">{{ t(sourceLabel) }}</span>
                  <svg
                    class="plugin-source-caret"
                    :class="{ open: sourceOpen }"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>
            </div>

            <Transition name="plugin-source-pop">
              <div v-if="sourceOpen" class="plugin-source-menu" role="radiogroup" :aria-label="t('选择安装源')">
                <RadioOption
                  v-model="sourceMode"
                  class="plugin-source-option"
                  variant="block"
                  name="plugin-source"
                  value="default"
                  @change="sourceOpen = false"
                >
                  <span class="plugin-source-option-body">
                    <span class="plugin-source-option-title">{{ t('默认安装源') }}</span>
                    <code>registry.npmjs.org</code>
                  </span>
                </RadioOption>
                <RadioOption
                  v-model="sourceMode"
                  class="plugin-source-option"
                  variant="block"
                  name="plugin-source"
                  value="mirror"
                  @change="sourceOpen = false"
                >
                  <span class="plugin-source-option-body">
                    <span class="plugin-source-option-title">{{ t('中国大陆镜像源') }}</span>
                    <code>registry.npmmirror.com</code>
                  </span>
                </RadioOption>
                <RadioOption
                  v-model="sourceMode"
                  class="plugin-source-option"
                  :class="{ active: sourceMode === 'custom' }"
                  variant="block"
                  name="plugin-source"
                  value="custom"
                >
                  <span class="plugin-source-option-body">
                    <span class="plugin-source-option-title">{{ t('自定义地址') }}</span>
                    <input
                      v-model="customRegistry"
                      class="plugin-source-custom"
                      type="url"
                      spellcheck="false"
                      autocomplete="off"
                      placeholder="https://npm.example.com/"
                      @focus="sourceMode = 'custom'"
                      @click.stop
                    />
                  </span>
                </RadioOption>
                <p class="plugin-source-hint">
                  {{
                    t(
                      '填写内网或私有 npm 源地址，以 http:// 或 https:// 开头。若为需要登录的源，请把凭据放在本机的 ~/.npmrc 里。'
                    )
                  }}
                </p>
                <p v-if="customRegistryError" class="plugin-source-error">{{ t(customRegistryError) }}</p>
              </div>
            </Transition>

            <div v-if="guideOpen" class="plugin-guide">
              <button
                v-for="example in examples"
                :key="example.value"
                type="button"
                class="plugin-guide-example"
                @click="useExample(example.value)"
              >
                <code>{{ example.value }}</code>
                <span>{{ t(example.hint) }}</span>
              </button>
              <p class="plugin-guide-note">{{ t(guideNote) }}</p>
            </div>

            <p v-if="error" class="plugin-dialog-error" role="alert">{{ error }}</p>
          </div>

          <footer class="plugin-dialog-footer">
            <button type="button" class="btn btn-secondary" :disabled="submitting" @click="requestClose">
              {{ t('取消') }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="!canSubmit" @click="submit">
              {{ submitting ? t('安装中…') : t('安装') }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { extensionsInstallSource, pluginsInstallSource } from '@/api'
import { t } from '@/i18n'
import RadioOption from '@/components/RadioOption.vue'

const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
const MIRROR_REGISTRY = 'https://registry.npmmirror.com'

const props = defineProps({
  visible: { type: Boolean, default: false },
  kind: { type: String, default: 'skill' }
})

const emit = defineEmits(['close', 'installed'])

const query = ref('')
const error = ref('')
const submitting = ref(false)
const guideOpen = ref(false)
const sourceOpen = ref(false)
const sourceMode = ref('default')
const customRegistry = ref('')
const inputRef = ref(null)

const isPlugin = computed(() => props.kind === 'plugin')

const examples = computed(() =>
  isPlugin.value
    ? [
        {
          value: 'plugin-name',
          get hint() {
            return t('npm 上的插件包名，可追加 @版本 或 @标签')
          }
        },
        {
          value: '@scope/plugin-name',
          get hint() {
            return t('带命名空间的 npm 插件包')
          }
        },
        {
          value: 'https://github.com/owner/repo',
          get hint() {
            return t('GitHub 仓库根地址，包内需包含 plugin.json')
          }
        },
        {
          value: '~/plugins/my-plugin',
          get hint() {
            return t('本机目录路径，目录内需包含 plugin.json')
          }
        }
      ]
    : [
        {
          value: 'skill-name',
          get hint() {
            return t('npm 上的技能包名，可追加 @版本 或 @标签')
          }
        },
        {
          value: '@scope/skill-name',
          get hint() {
            return t('带命名空间的 npm 技能包')
          }
        },
        {
          value: 'https://github.com/owner/repo',
          get hint() {
            return t('GitHub 仓库根地址，包内需包含 skill.json')
          }
        },
        {
          value: '~/skills/my-skill',
          get hint() {
            return t('本机目录路径，目录内需包含 skill.json')
          }
        }
      ]
)

const installNoun = computed(() => t(isPlugin.value ? '插件' : '技能'))

const installDescription = computed(() =>
  t(
    isPlugin.value
      ? t('输入插件包的 npm 包名、GitHub 仓库地址或本地目录路径。插件包内需包含 plugin.json。')
      : t('输入技能包的 npm 包名、GitHub 仓库地址或本地目录路径。')
  )
)

const inputPlaceholder = computed(() =>
  t(
    isPlugin.value
      ? t('例如 @scope/plugin-name 或 https://github.com/owner/repo')
      : t('例如 @scope/skill-name 或 https://github.com/owner/repo')
  )
)

const guideNote = computed(() =>
  t(
    isPlugin.value
      ? t('安装源仅用于 npm 包；插件可能包含技能与连接器，请只安装来自可信来源的插件。')
      : t('安装源仅用于 npm 包；技能可能包含脚本，请只安装来自可信来源的技能。')
  )
)

const sourceLabel = computed(() => {
  if (sourceMode.value === 'mirror') return t('中国大陆镜像源')
  if (sourceMode.value === 'custom') return t('自定义地址')
  return t('默认安装源')
})

const resolvedRegistry = computed(() => {
  if (sourceMode.value === 'mirror') return MIRROR_REGISTRY
  if (sourceMode.value === 'custom') return customRegistry.value.trim()
  return DEFAULT_REGISTRY
})

const customRegistryError = computed(() => {
  if (sourceMode.value !== 'custom') return ''
  const value = customRegistry.value.trim()
  if (!value) return t('请输入自定义安装源地址')
  if (!/^https?:\/\/[^\s/]+/i.test(value)) return t('安装源地址需以 http:// 或 https:// 开头')
  return ''
})

const canSubmit = computed(() => {
  if (submitting.value) return false
  if (!query.value.trim()) return false
  return !customRegistryError.value
})

watch(
  () => props.visible,
  (visible, wasVisible) => {
    if (!visible || wasVisible) return
    error.value = ''
    sourceOpen.value = false
    sourceMode.value = 'default'
    guideOpen.value = false
    nextTick(() => inputRef.value?.focus())
  },
  { immediate: true }
)

function requestClose() {
  if (submitting.value) return
  emit('close')
}

function useExample(value) {
  query.value = value
  guideOpen.value = false
  nextTick(() => inputRef.value?.focus())
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    const install = isPlugin.value ? pluginsInstallSource : extensionsInstallSource
    const result = await install({
      input: query.value.trim(),
      registry: resolvedRegistry.value
    })
    if (result?.success) {
      emit('installed', result)
      emit('close')
      query.value = ''
    } else {
      error.value = result?.error || t('安装{kind}失败', { kind: installNoun.value })
    }
  } finally {
    submitting.value = false
  }
}

function onDocumentKeyDown(event) {
  if (!props.visible || event.key !== 'Escape') return
  if (sourceOpen.value) {
    sourceOpen.value = false
    return
  }
  if (submitting.value) return
  event.preventDefault()
  emit('close')
}

onMounted(() => document.addEventListener('keydown', onDocumentKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeyDown))
</script>

<style scoped>
.plugin-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.plugin-dialog {
  width: min(560px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.plugin-dialog-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 22px 14px;
}

.plugin-dialog-heading {
  flex: 1;
  min-width: 0;
}

.plugin-dialog-heading h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 650;
  color: var(--text-primary);
}

.plugin-dialog-heading p {
  margin: 6px 0 0;
  font-size: var(--font-size-sm);
  line-height: 1.55;
  color: var(--text-secondary);
}

.plugin-dialog-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.plugin-dialog-close svg {
  width: 15px;
  height: 15px;
}

.plugin-dialog-close:hover {
  background: var(--shell-hover-bg);
  color: var(--text-primary);
}

.plugin-dialog-close:disabled {
  opacity: 0.45;
  cursor: default;
}

.plugin-dialog-body {
  padding: 0 22px;
  overflow-y: auto;
}

.plugin-dialog-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  box-sizing: border-box;
}

.plugin-dialog-input::placeholder {
  color: var(--text-tertiary);
}

.plugin-dialog-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.plugin-dialog-input:disabled {
  opacity: 0.65;
}

.plugin-dialog-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.plugin-guide-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: color 0.12s;
}

.plugin-guide-toggle:hover {
  color: var(--text-primary);
}

.plugin-guide-chevron {
  width: 12px;
  height: 12px;
  transition: transform 0.18s;
}

.plugin-guide-chevron.open {
  transform: rotate(90deg);
}

.plugin-source {
  position: relative;
}

.plugin-source-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s;
}

.plugin-source-trigger:hover,
.plugin-source-trigger.open {
  border-color: var(--border-color);
  background: var(--surface-muted);
  color: var(--text-primary);
}

.plugin-source-label {
  color: var(--text-tertiary);
}

.plugin-source-current {
  font-weight: 600;
}

.plugin-source-caret {
  width: 11px;
  height: 11px;
  transition: transform 0.18s;
}

.plugin-source-caret.open {
  transform: rotate(180deg);
}

.plugin-source-menu {
  margin-top: 8px;
  padding: 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plugin-source-option {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 8px 9px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}

.plugin-source-option:hover,
.plugin-source-option.active {
  background: var(--surface-hover);
}

.plugin-source-option-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.plugin-source-option-title {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.plugin-source-option-body code {
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.plugin-source-custom {
  width: 100%;
  height: 30px;
  margin-top: 2px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-xs);
  box-sizing: border-box;
}

.plugin-source-custom:focus {
  outline: none;
  border-color: var(--accent-color);
}

.plugin-source-hint {
  margin: 4px 9px 6px;
  font-size: var(--font-size-xs);
  line-height: 1.55;
  color: var(--text-tertiary);
}

.plugin-source-error {
  margin: 0 9px 6px;
  font-size: var(--font-size-xs);
  color: var(--error-dark);
}

.plugin-guide {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.plugin-guide-example {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: background 0.12s;
}

.plugin-guide-example:hover {
  background: var(--surface-hover);
}

.plugin-guide-example code {
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-xs);
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.plugin-guide-example span {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.plugin-guide-note {
  margin: 6px 1px 0;
  font-size: var(--font-size-xs);
  line-height: 1.55;
  color: var(--text-tertiary);
}

.plugin-dialog-error {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.plugin-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 22px 18px;
}

.plugin-dialog-footer .btn {
  min-width: 76px;
}

.plugin-source-pop-enter-active,
.plugin-source-pop-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
  transform-origin: top;
}

.plugin-source-pop-enter-from,
.plugin-source-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.plugin-dialog-enter-active,
.plugin-dialog-leave-active {
  transition: opacity 0.16s ease;
}

.plugin-dialog-enter-active .plugin-dialog,
.plugin-dialog-leave-active .plugin-dialog {
  transition:
    transform 0.16s ease,
    opacity 0.16s ease;
}

.plugin-dialog-enter-from,
.plugin-dialog-leave-to {
  opacity: 0;
}

.plugin-dialog-enter-from .plugin-dialog,
.plugin-dialog-leave-to .plugin-dialog {
  transform: scale(0.97) translateY(4px);
  opacity: 0;
}
</style>
