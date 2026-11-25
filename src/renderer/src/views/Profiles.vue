<template>
  <PageLayout tool-path="/profiles">
    <template #actions>
      <button class="btn btn-secondary btn-sm" :disabled="loading" @click="reload">
        <AppIcon name="refresh" />
        {{ loading ? t('加载中...') : t('刷新') }}
      </button>
      <button class="btn btn-primary btn-sm" @click="startNewProject">{{ t('新建项目') }}</button>
    </template>

    <div class="page-body profiles-page">
      <div v-if="errorText" class="profiles-error">{{ errorText }}</div>
      <div class="profiles-grid">
        <section class="panel profiles-list-pane">
          <div class="panel-header">
            <span class="panel-title">{{ t('项目') }}</span>
            <span class="panel-hint">{{ projects.length }}/{{ PROFILE_LIMITS.projects }}</span>
          </div>
          <div class="panel-body profiles-list">
            <div v-if="!projects.length" class="profiles-empty">
              {{ loading ? t('正在加载项目...') : t('暂无项目，点击右上角新建') }}
            </div>
            <article
              v-for="project in projects"
              :key="project.id"
              class="profiles-card"
              :class="{ active: form.id === project.id }"
              @click="selectProject(project.id)"
            >
              <div class="profiles-card-head">
                <span class="profiles-card-name" :title="project.name">{{ project.name }}</span>
                <span v-if="project.id === activeProjectId" class="profiles-chip ok">{{ t('当前') }}</span>
              </div>
              <div v-if="project.description" class="profiles-card-desc">{{ project.description }}</div>
              <div class="profiles-card-meta">{{ t('{p0} 个环境', { p0: project.environments.length }) }}</div>
              <div class="profiles-card-actions">
                <button
                  v-if="project.id !== activeProjectId"
                  class="btn btn-secondary btn-sm"
                  @click.stop="activate(project)"
                >
                  {{ t('设为当前') }}
                </button>
                <button class="btn btn-secondary btn-sm" @click.stop="askDeleteProject(project)">
                  {{ t('删除') }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="panel profiles-editor-pane">
          <div class="panel-header">
            <span class="panel-title">{{ form.id ? t('编辑项目') : t('新建项目') }}</span>
            <span class="panel-hint">{{ form.id ? t('修改') : t('新') }}</span>
          </div>
          <div class="panel-body profiles-editor">
            <div class="profiles-fields">
              <label class="profiles-field">
                <span class="field-label">{{ t('项目名称') }}</span>
                <AppInput
                  v-model="form.name"
                  :placeholder="t('例如：内部 API')"
                  :maxlength="PROFILE_LIMITS.nameLength"
                />
              </label>
              <label class="profiles-field">
                <span class="field-label">{{ t('项目说明') }}</span>
                <AppInput
                  v-model="form.description"
                  :placeholder="t('可选，便于区分用途')"
                  :maxlength="PROFILE_LIMITS.descriptionLength"
                />
              </label>
            </div>

            <div class="profiles-section">
              <div class="profiles-section-head">
                <span class="profiles-section-title">{{ t('环境') }}</span>
                <button type="button" class="btn btn-secondary btn-sm" @click="addEnvironment">
                  {{ t('添加环境') }}
                </button>
              </div>
              <div class="profiles-env-tabs">
                <button
                  v-for="environment in form.environments"
                  :key="environment.id"
                  type="button"
                  class="profiles-env-tab"
                  :class="{ active: environment.id === editingEnvId }"
                  :aria-pressed="environment.id === editingEnvId"
                  @click="openEnvironment(environment)"
                >
                  {{ environment.name || t('未命名环境') }}
                </button>
                <span v-if="!form.environments.length" class="profiles-hint">{{ t('还未添加环境') }}</span>
              </div>

              <template v-if="editingEnvironment">
                <div class="profiles-fields">
                  <label class="profiles-field">
                    <span class="field-label">{{ t('环境名称') }}</span>
                    <AppInput
                      v-model="environmentName"
                      :placeholder="t('例如：生产')"
                      :maxlength="PROFILE_LIMITS.nameLength"
                    />
                  </label>
                  <div class="profiles-field">
                    <span class="field-label">{{ t('默认环境') }}</span>
                    <span class="profiles-hint">{{ t('该项目的环境会作为默认环境，可随时切换') }}</span>
                  </div>
                </div>
                <label class="profiles-field">
                  <span class="field-label">{{ t('环境变量') }}</span>
                  <AppTextarea
                    v-model="variablesText"
                    class="profiles-vars"
                    :placeholder="t('baseUrl=https://api.example.com')"
                    spellcheck="false"
                  />
                </label>
                <div class="profiles-hint-row">
                  <span class="profiles-hint">{{ envHint }}</span>
                  <span class="devt-spacer" />
                  <span v-if="envLineError" class="devt-error">{{ envLineError }}</span>
                  <button type="button" class="btn btn-secondary btn-sm" @click="removeEnvironment">
                    {{ t('删除环境') }}
                  </button>
                </div>
              </template>
            </div>

            <div class="profiles-form-actions">
              <button class="btn btn-secondary" @click="startNewProject">{{ t('清空表单') }}</button>
              <button class="btn btn-primary" :disabled="saving" @click="saveProject">
                {{ saving ? t('保存中...') : form.id ? t('保存修改') : t('创建项目') }}
              </button>
            </div>
          </div>
        </section>

        <section class="panel profiles-cred-pane">
          <div class="panel-header">
            <span class="panel-title">{{ t('凭据别名') }}</span>
            <span class="panel-hint">{{ credentials.length }}/{{ PROFILE_LIMITS.credentials }}</span>
          </div>
          <div class="panel-body profiles-cred">
            <div v-if="vaultLocked" class="profiles-locked">
              <p>{{ t('凭据库未解锁，保存或编辑别名前请先在密码管理器中解锁。') }}</p>
              <button class="btn btn-secondary btn-sm" @click="goPasswordManager">
                {{ t('前往密码管理器') }}
              </button>
            </div>
            <template v-else>
              <div class="profiles-fields">
                <label class="profiles-field">
                  <span class="field-label">{{ t('别名') }}</span>
                  <AppInput
                    v-model="credForm.alias"
                    :placeholder="t('例如：api_token')"
                    :maxlength="PROFILE_LIMITS.aliasLength"
                    spellcheck="false"
                  />
                </label>
                <label class="profiles-field">
                  <span class="field-label">{{ t('密码条目') }}</span>
                  <AppSelect v-model="credForm.entryId" :options="entryOptions" :placeholder="t('未选择条目')" />
                </label>
              </div>
              <label class="profiles-field">
                <span class="field-label">{{ t('备注') }}</span>
                <AppInput
                  v-model="credForm.hint"
                  :placeholder="t('可选，例如：生产环境 Token')"
                  :maxlength="PROFILE_LIMITS.hintLength"
                />
              </label>
              <div class="profiles-form-actions">
                <button v-if="credForm.editing" class="btn btn-secondary" @click="resetCredForm">
                  {{ t('取消编辑') }}
                </button>
                <button class="btn btn-primary" :disabled="credSaving" @click="saveCredential">
                  {{ credForm.editing ? t('更新别名') : t('保存别名') }}
                </button>
              </div>
            </template>

            <div class="profiles-cred-list">
              <div v-if="!credentials.length" class="profiles-empty">{{ t('暂无凭据别名，可在上方创建') }}</div>
              <div v-for="credential in credentials" :key="credential.alias" class="profiles-cred-item">
                <div class="profiles-cred-head">
                  <code class="profiles-cred-alias">secret:{{ credential.alias }}</code>
                  <span v-if="!vaultLocked && !credential.entryTitle" class="profiles-chip warn">
                    {{ t('条目不可用') }}
                  </span>
                  <span class="devt-spacer" />
                  <CopyButton
                    :text="`{{secret:${credential.alias}}}`"
                    :title="t('复制占位符')"
                    variant="secondary"
                    size="sm"
                  />
                  <button class="btn btn-secondary btn-sm" @click="editCredential(credential)">
                    {{ t('编辑') }}
                  </button>
                  <button class="btn btn-secondary btn-sm" @click="askDeleteCredential(credential)">
                    {{ t('删除') }}
                  </button>
                </div>
                <div class="profiles-cred-meta">
                  {{ vaultLocked ? t('解锁后可查看条目') : credential.entryTitle || t('密码条目不可用') }}
                  <template v-if="credential.hint"> · {{ credential.hint }}</template>
                </div>
              </div>
            </div>
            <p class="profiles-hint">{{ usageHint }}</p>
          </div>
        </section>
      </div>
    </div>

    <MessageDialog
      :visible="projectDeleteVisible"
      type="confirm"
      :title="t('删除项目')"
      :message="t('将删除项目「{p0}」，其中的环境变量也会一并删除。', { p0: pendingProject?.name || '' })"
      @confirm="confirmDeleteProject"
      @cancel="projectDeleteVisible = false"
      @close="projectDeleteVisible = false"
    />
    <MessageDialog
      :visible="credentialDeleteVisible"
      type="confirm"
      :title="t('删除凭据')"
      :message="t('将删除凭据别名「{p0}」，密码条目本身不受影响。', { p0: pendingCredential?.alias || '' })"
      @confirm="confirmDeleteCredential"
      @cancel="credentialDeleteVisible = false"
      @close="credentialDeleteVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageLayout from '@/layouts/PageLayout.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
import AppSelect from '@/components/AppSelect.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import CopyButton from '@/components/CopyButton.vue'
import { useToast } from '@/composables'
import { t } from '@/i18n'
import {
  passwordVaultState,
  profilesActivateProject,
  profilesDeleteCredential,
  profilesDeleteProject,
  profilesList,
  profilesSaveCredential,
  profilesSaveProject
} from '@/api'
import { createProfileId, PROFILE_LIMITS } from '@shared/profiles'
import { formatHttpEnvironmentLines, parseHttpEnvironmentLines } from '@shared/httpCollections'

const router = useRouter()
const { showSuccess, showWarning } = useToast()

const projects = ref([])
const credentials = ref([])
const activeProjectId = ref('')
const vaultLocked = ref(true)
const vaultEntries = ref([])
const loading = ref(false)
const saving = ref(false)
const credSaving = ref(false)
const errorText = ref('')
const form = ref(blankProject())
const editingEnvId = ref('')
const environmentName = ref('')
const variablesText = ref('')
const envLineError = ref('')
const credForm = ref(blankCredential())
const projectDeleteVisible = ref(false)
const pendingProject = ref(null)
const credentialDeleteVisible = ref(false)
const pendingCredential = ref(null)

const editingEnvironment = computed(
  () => form.value.environments.find((environment) => environment.id === editingEnvId.value) || null
)

const envHint = computed(() => t('每行一条 KEY=VALUE；值中可用 {{secret:别名}} 引用凭据中心的密钥'))
const usageHint = computed(() => t('在 HTTP 客户端或计划任务中使用 {{secret:别名}}，发送前由主进程替换为真实密码。'))

const entryOptions = computed(() =>
  vaultEntries.value.map((entry) => ({
    value: entry.id,
    label: entry.title,
    description: entry.username || ''
  }))
)

watch([environmentName, variablesText], () => {
  const environment = editingEnvironment.value
  if (!environment) return
  environment.name = environmentName.value.slice(0, PROFILE_LIMITS.nameLength)
  const parsed = parseHttpEnvironmentLines(variablesText.value)
  if (parsed.ok) {
    environment.variables = parsed.variables
    envLineError.value = ''
  } else {
    envLineError.value = t('第 {p0} 行格式无效，应为 KEY=VALUE', { p0: parsed.errors.join('、') })
  }
})

function blankProject() {
  return { id: '', name: '', description: '', environments: [], activeEnvironmentId: '' }
}

function blankCredential() {
  return { alias: '', entryId: '', hint: '', editing: false }
}

function cloneProject(project) {
  return JSON.parse(
    JSON.stringify({
      id: project.id,
      name: project.name,
      description: project.description,
      environments: project.environments,
      activeEnvironmentId: project.activeEnvironmentId
    })
  )
}

function applyState(result) {
  projects.value = Array.isArray(result.projects) ? result.projects : []
  activeProjectId.value = result.activeProjectId || ''
  credentials.value = Array.isArray(result.credentials) ? result.credentials : []
  if (typeof result.vaultLocked === 'boolean') vaultLocked.value = result.vaultLocked
}

function openEnvironment(environment) {
  editingEnvId.value = environment.id
  environmentName.value = environment.name
  variablesText.value = formatHttpEnvironmentLines(environment.variables)
  envLineError.value = ''
  form.value.activeEnvironmentId = environment.id
}

function selectProject(id) {
  const project = projects.value.find((item) => item.id === id)
  if (!project) return
  form.value = cloneProject(project)
  const environment =
    form.value.environments.find((item) => item.id === form.value.activeEnvironmentId) ||
    form.value.environments[0] ||
    null
  if (environment) openEnvironment(environment)
  else {
    editingEnvId.value = ''
    environmentName.value = ''
    variablesText.value = ''
    envLineError.value = ''
  }
}

function startNewProject() {
  form.value = blankProject()
  editingEnvId.value = ''
  environmentName.value = ''
  variablesText.value = ''
  envLineError.value = ''
}

function addEnvironment() {
  if (form.value.environments.length >= PROFILE_LIMITS.environmentsPerProject) {
    showWarning(t('最多添加 {p0} 个环境', { p0: PROFILE_LIMITS.environmentsPerProject }))
    return
  }
  const environment = {
    id: createProfileId('env'),
    name: t('环境 {p0}', { p0: form.value.environments.length + 1 }),
    variables: {}
  }
  form.value.environments.push(environment)
  openEnvironment(environment)
}

function removeEnvironment() {
  const id = editingEnvId.value
  if (!id) return
  form.value.environments = form.value.environments.filter((environment) => environment.id !== id)
  const next = form.value.environments[0] || null
  if (form.value.activeEnvironmentId === id) form.value.activeEnvironmentId = next?.id || ''
  if (next) openEnvironment(next)
  else {
    editingEnvId.value = ''
    environmentName.value = ''
    variablesText.value = ''
    envLineError.value = ''
  }
}

async function reload() {
  loading.value = true
  errorText.value = ''
  const result = await profilesList()
  loading.value = false
  if (!result?.success) {
    errorText.value = result?.error || t('加载项目环境失败')
    return
  }
  applyState(result)
  const vault = await passwordVaultState()
  vaultEntries.value = vault?.locked ? [] : Array.isArray(vault?.entries) ? vault.entries : []
  const target =
    projects.value.find((project) => project.id === form.value.id) ||
    projects.value.find((project) => project.id === activeProjectId.value) ||
    projects.value[0]
  if (target) selectProject(target.id)
  else startNewProject()
}

async function saveProject() {
  if (saving.value) return
  if (!form.value.name.trim()) {
    showWarning(t('请填写项目名称'))
    return
  }
  saving.value = true
  const environments = form.value.environments.map((environment, index) => ({
    id: environment.id,
    name: environment.name.trim() || t('环境 {p0}', { p0: index + 1 }),
    variables: environment.variables
  }))
  const result = await profilesSaveProject({
    id: form.value.id,
    name: form.value.name,
    description: form.value.description,
    environments,
    activeEnvironmentId: editingEnvId.value || form.value.activeEnvironmentId
  })
  saving.value = false
  if (!result?.success) {
    showWarning(result?.error || t('保存项目失败'))
    return
  }
  applyState(result)
  if (result.id) selectProject(result.id)
  showSuccess(t('项目已保存'))
}

async function activate(project) {
  const result = await profilesActivateProject(project.id)
  if (!result?.success) {
    showWarning(result?.error || t('切换当前项目失败'))
    return
  }
  applyState(result)
  showSuccess(t('已切换当前项目'))
}

function askDeleteProject(project) {
  pendingProject.value = project
  projectDeleteVisible.value = true
}

async function confirmDeleteProject() {
  projectDeleteVisible.value = false
  const project = pendingProject.value
  pendingProject.value = null
  if (!project) return
  const result = await profilesDeleteProject(project.id)
  if (!result?.success) {
    showWarning(result?.error || t('删除项目失败'))
    return
  }
  const removedCurrent = form.value.id === project.id
  applyState(result)
  if (removedCurrent) {
    const next = projects.value[0]
    if (next) selectProject(next.id)
    else startNewProject()
  }
  showSuccess(t('已删除项目「{p0}」', { p0: project.name }))
}

function resetCredForm() {
  credForm.value = blankCredential()
}

function editCredential(credential) {
  credForm.value = {
    alias: credential.alias,
    entryId: credential.entryId,
    hint: credential.hint,
    editing: true
  }
}

async function saveCredential() {
  if (credSaving.value) return
  if (!credForm.value.alias.trim()) {
    showWarning(t('请填写凭据别名'))
    return
  }
  if (!credForm.value.entryId) {
    showWarning(t('请选择要关联的密码条目'))
    return
  }
  credSaving.value = true
  const result = await profilesSaveCredential({
    alias: credForm.value.alias,
    entryId: credForm.value.entryId,
    hint: credForm.value.hint
  })
  credSaving.value = false
  if (!result?.success) {
    showWarning(result?.error || t('保存凭据失败'))
    return
  }
  applyState(result)
  resetCredForm()
  showSuccess(t('凭据已保存'))
}

function askDeleteCredential(credential) {
  pendingCredential.value = credential
  credentialDeleteVisible.value = true
}

async function confirmDeleteCredential() {
  credentialDeleteVisible.value = false
  const credential = pendingCredential.value
  pendingCredential.value = null
  if (!credential) return
  const result = await profilesDeleteCredential(credential.alias)
  if (!result?.success) {
    showWarning(result?.error || t('删除凭据失败'))
    return
  }
  applyState(result)
  if (credForm.value.editing && credForm.value.alias === credential.alias) resetCredForm()
  showSuccess(t('已删除凭据「{p0}」', { p0: credential.alias }))
}

function goPasswordManager() {
  router.push('/password-manager').catch(() => {})
}

onMounted(reload)
</script>

<style scoped>
.profiles-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profiles-error {
  padding: 8px 10px;
  border: 1px solid rgba(var(--error-rgb), 0.25);
  border-radius: var(--radius-sm);
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error-color);
  font-size: var(--font-size-dense);
}

.profiles-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr) minmax(300px, 360px);
  gap: 12px;
  align-items: stretch;
}

.profiles-list-pane,
.profiles-editor-pane,
.profiles-cred-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.profiles-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profiles-empty {
  padding: 24px 12px;
  color: var(--text-tertiary);
  font-size: var(--font-size-dense);
  text-align: center;
}

.profiles-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
}

.profiles-card.active {
  border-color: var(--accent-color);
  background: var(--surface-hover);
}

.profiles-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.profiles-card-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-dense);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profiles-card-desc {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  word-break: break-word;
}

.profiles-card-meta {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.profiles-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.profiles-chip {
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.profiles-chip.ok {
  border: 1px solid rgba(var(--success-rgb), 0.35);
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
}

.profiles-chip.warn {
  border: 1px solid rgba(var(--warning-rgb), 0.4);
  background: rgba(var(--warning-rgb), 0.12);
  color: var(--warning-dark);
}

.profiles-editor,
.profiles-cred {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profiles-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.profiles-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.profiles-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profiles-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.profiles-section-title {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}

.profiles-env-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.profiles-env-tab {
  height: var(--control-height-sm);
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.profiles-env-tab:hover {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.profiles-env-tab:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.profiles-env-tab.active {
  border-color: var(--accent-color);
  background: var(--accent-color);
  color: var(--btn-primary-text);
}

.profiles-vars {
  min-height: 130px;
  font-family: var(--font-mono);
}

.profiles-hint {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.profiles-hint-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.profiles-form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.profiles-locked {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: var(--font-size-dense);
}

.profiles-locked p {
  margin: 0;
  line-height: 1.6;
}

.profiles-cred-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profiles-cred-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.profiles-cred-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.profiles-cred-alias {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-dense);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profiles-cred-meta {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .profiles-grid {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .profiles-cred-pane {
    grid-column: 1 / -1;
    max-height: 360px;
  }
}

@media (max-width: 900px) {
  .profiles-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
  }

  .profiles-list {
    max-height: 280px;
  }

  .profiles-cred-pane {
    max-height: none;
  }
}

@media (max-width: 720px) {
  .profiles-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
