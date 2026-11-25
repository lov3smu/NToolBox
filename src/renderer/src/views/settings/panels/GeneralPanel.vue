<template>
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
          <SettingSelect v-model="closeAction" :options="closeActionOptions" :placeholder="t('选择关闭行为')" />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('通知') }}</h3>
    </div>
    <div class="setting-section-body">
      <div v-for="item in notificationItems" :key="item.key" class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t(item.label) }}</span>
          <span class="setting-row-desc">{{ t(item.hint) }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="notifications[item.key]"
            :options="notificationChannelOptions"
            :placeholder="t('选择通知方式')"
          />
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

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('团队托管配置') }}</h3>
      <span class="setting-section-desc">
        {{ t('由团队统一管理 AI 策略、数据库安全与扩展来源；托管字段会强制覆盖本机修改') }}
      </span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('托管状态') }}</span>
          <span class="setting-row-desc">
            <template v-if="managedProfileInfo.active">
              {{ t('已启用：{name}', { name: managedProfileInfo.name }) }}
              <template v-if="managedProfileInfo.owner">
                {{ t('（维护者：{owner}）', { owner: managedProfileInfo.owner }) }}
              </template>
            </template>
            <template v-else>{{ t('未启用，所有设置由本机管理') }}</template>
          </span>
        </div>
        <div class="setting-row-control">
          <button class="btn btn-secondary" :disabled="managedProfileBusy" @click="pickManagedProfile">
            {{ managedProfileInfo.active ? t('更新配置') : t('导入配置') }}
          </button>
        </div>
      </div>
      <div v-if="managedProfileInfo.active" class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('托管范围') }}</span>
          <span class="setting-row-desc">
            {{ t('来源：{source}', { source: managedProfileSourceLabel }) }}
            <template v-if="managedProfileInfo.updatedAt">
              · {{ t('更新时间：{time}', { time: managedProfileInfo.updatedAt }) }}
            </template>
          </span>
          <div class="managed-profile-tags">
            <span v-for="tag in managedProfileTags" :key="tag" class="managed-profile-tag">{{ tag }}</span>
          </div>
        </div>
        <div class="setting-row-control">
          <button
            v-if="managedProfileInfo.source?.kind === 'url'"
            class="btn btn-secondary"
            :disabled="managedProfileBusy"
            @click="refreshManagedProfile"
          >
            {{ t('立即同步') }}
          </button>
          <button class="btn btn-secondary" :disabled="managedProfileBusy" @click="requestClearManagedProfile">
            {{ t('取消托管') }}
          </button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('从 URL 获取') }}</span>
          <span class="setting-row-desc">{{ t('填写团队发布的托管配置地址（http 或 https），获取后预览再应用') }}</span>
        </div>
        <div class="setting-row-control">
          <div class="path-input-group">
            <AppInput
              v-model="managedProfileUrl"
              type="text"
              placeholder="https://example.com/ntoolbox-managed.json"
              spellcheck="false"
            />
            <button class="btn btn-secondary" :disabled="managedProfileBusy" @click="previewManagedProfileFromUrl">
              {{ t('获取') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('配置迁移') }}</h3>
      <span class="setting-section-desc">{{ t('导出或恢复全部设置，导出文件不包含密钥与密码') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('导出配置') }}</span>
          <span class="setting-row-desc">{{ t('将当前设置保存为 JSON 文件，便于备份或在其他设备恢复') }}</span>
        </div>
        <div class="setting-row-control">
          <button class="btn btn-secondary" :disabled="configTransferBusy" @click="exportSettingsConfig">
            {{ t('导出') }}
          </button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('导入配置') }}</span>
          <span class="setting-row-desc">{{ t('从 JSON 文件恢复设置，将覆盖当前全部配置') }}</span>
        </div>
        <div class="setting-row-control">
          <button class="btn btn-secondary" :disabled="configTransferBusy" @click="pickSettingsConfigImport">
            {{ t('导入') }}
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('跨设备同步') }}</h3>
      <span class="setting-section-desc">
        {{ t('通过共享文件夹在多台设备间同步非敏感设置；密钥、数据库连接与 MCP 凭据不会写入同步文件') }}
      </span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('同步文件夹') }}</span>
          <span class="setting-row-desc">
            {{ syncInfo.directory || t('未选择，可放在任意云盘或文件同步目录中') }}
          </span>
        </div>
        <div class="setting-row-control">
          <button class="btn btn-secondary" :disabled="syncBusy" @click="pickSyncDirectory">
            {{ syncInfo.configured ? t('更换文件夹') : t('选择文件夹') }}
          </button>
          <button v-if="syncInfo.configured" class="btn btn-secondary" :disabled="syncBusy" @click="stopSync">
            {{ t('停止同步') }}
          </button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('立即同步') }}</span>
          <span class="setting-row-desc">
            {{ syncRemoteHint || syncSummary || t('按分区修改时间合并：较新的修改优先；首次同步以共享文件为准') }}
          </span>
        </div>
        <div class="setting-row-control">
          <button class="btn btn-secondary" :disabled="syncBusy || !syncInfo.configured" @click="runSyncNow">
            {{ syncBusy ? t('同步中…') : t('立即同步') }}
          </button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('自动同步') }}</span>
          <span class="setting-row-desc">{{ t('开启后，应用启动及运行期间每 10 分钟自动同步一次') }}</span>
        </div>
        <div class="setting-row-control">
          <input
            type="checkbox"
            class="switch"
            :checked="syncInfo.autoSync"
            :disabled="syncBusy || !syncInfo.configured"
            @change="setSyncAutoSyncEnabled($event.target.checked)"
          />
        </div>
      </div>
      <div class="setting-row is-block">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('同步范围') }}</span>
          <span class="setting-row-desc">{{ t('未勾选的分区不会写入共享文件，应用远端数据时也会跳过') }}</span>
          <div class="sync-section-grid">
            <label v-for="item in syncSectionItems" :key="item.id" class="sync-section-item">
              <input
                type="checkbox"
                :checked="item.enabled"
                :disabled="syncBusy || !syncInfo.configured"
                @change="toggleSyncSection(item.id, $event.target.checked)"
              />
              <span>{{ item.label }}</span>
            </label>
          </div>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('设备名称') }}</span>
          <span class="setting-row-desc">{{ t('写入共享文件时用于标识本机，便于识别最近写入设备') }}</span>
        </div>
        <div class="setting-row-control">
          <div class="path-input-group">
            <AppInput v-model="syncDeviceNameDraft" type="text" :placeholder="t('输入设备名称')" spellcheck="false" />
            <button class="btn btn-secondary" :disabled="syncBusy" @click="saveSyncDeviceName">
              {{ t('保存') }}
            </button>
          </div>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('同步口令') }}</span>
          <span class="setting-row-desc">
            {{
              syncInfo.passphraseSet
                ? t('已设置：共享文件将使用口令加密，其他设备需填写相同口令')
                : t('可选：设置后共享文件以 AES-256 加密，口令只保存在本机')
            }}
          </span>
        </div>
        <div class="setting-row-control">
          <div class="path-input-group">
            <AppInput
              v-model="syncPassphraseDraft"
              type="password"
              :placeholder="t('输入同步口令')"
              spellcheck="false"
            />
            <button class="btn btn-secondary" :disabled="syncBusy" @click="saveSyncPassphrase">
              {{ t('保存') }}
            </button>
            <button
              v-if="syncInfo.passphraseSet"
              class="btn btn-secondary"
              :disabled="syncBusy"
              @click="clearSyncPassphrase"
            >
              {{ t('清除') }}
            </button>
          </div>
        </div>
      </div>
      <div v-if="managedProfileInfo.active" class="setting-row is-block">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('托管配置优先') }}</span>
          <span class="setting-row-desc">{{ t('团队托管字段始终以托管值为准，同步结果不会覆盖这些字段') }}</span>
        </div>
      </div>
    </div>
  </section>

  <MessageDialog
    :visible="syncConfirm.visible"
    type="confirm"
    :title="t('立即同步')"
    :message="syncConfirmMessage"
    @confirm="confirmSyncNow"
    @cancel="cancelSyncConfirm"
    @close="cancelSyncConfirm"
  />

  <MessageDialog
    :visible="syncForceConfirm.visible"
    type="confirm"
    :title="t('覆盖共享文件')"
    :message="syncForceMessage"
    @confirm="confirmForceSync"
    @cancel="cancelSyncForceConfirm"
    @close="cancelSyncForceConfirm"
  />

  <MessageDialog
    :visible="configImportConfirm.visible"
    type="confirm"
    :title="t('导入配置')"
    :message="configImportMessage"
    @confirm="confirmSettingsConfigImport"
    @cancel="cancelSettingsConfigImport"
    @close="cancelSettingsConfigImport"
  />

  <MessageDialog
    :visible="managedProfileConfirm.visible"
    type="confirm"
    :title="managedProfileConfirm.mode === 'clear' ? t('取消团队托管') : t('应用团队托管配置')"
    :message="managedProfileConfirmMessage"
    @confirm="confirmManagedProfileAction"
    @cancel="cancelManagedProfileConfirm"
    @close="cancelManagedProfileConfirm"
  />
</template>

<script setup>
import { computed, inject } from 'vue'
import { t } from '@/i18n'
import { formatDateTime } from '@/utils/format'
import AppInput from '@/components/AppInput.vue'
import SettingSelect from '@/components/settings/SettingSelect.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import { SETTINGS_CONTEXT } from '../settingsContext'

const {
  autoStart,
  autoUpdate,
  cancelManagedProfileConfirm,
  cancelSettingsConfigImport,
  cancelSyncConfirm,
  cancelSyncForceConfirm,
  clearSyncPassphrase,
  clipboardLimitOptions,
  clipboardMaxEntriesModel,
  clipboardPersist,
  closeAction,
  closeActionOptions,
  configImportConfirm,
  configImportMessage,
  configTransferBusy,
  confirmManagedProfileAction,
  confirmSyncNow,
  confirmForceSync,
  confirmSettingsConfigImport,
  exportSettingsConfig,
  language,
  languageOptions,
  managedProfileBusy,
  managedProfileConfirm,
  managedProfileConfirmMessage,
  managedProfileInfo,
  managedProfileSourceLabel,
  managedProfileTags,
  managedProfileUrl,
  notificationChannelOptions,
  notificationItems,
  notifications,
  pickManagedProfile,
  pickSettingsConfigImport,
  pickSyncDirectory,
  previewManagedProfileFromUrl,
  refreshManagedProfile,
  requestClearManagedProfile,
  runSyncNow,
  saveSyncDeviceName,
  saveSyncPassphrase,
  setSyncAutoSyncEnabled,
  stopSync,
  syncBusy,
  syncConfirm,
  syncConfirmMessage,
  syncDeviceNameDraft,
  syncForceConfirm,
  syncForceMessage,
  syncInfo,
  syncPassphraseDraft,
  syncRemoteHint,
  syncSectionItems,
  toggleSyncSection,
  updateCheckInterval,
  updateCheckIntervalOptions
} = inject(SETTINGS_CONTEXT)

const syncSummary = computed(() => {
  const info = syncInfo.value
  if (!info.configured) return ''
  const result = info.lastResult
  const parts = []
  if (info.lastSyncAt) parts.push(t('上次同步：{time}', { time: formatDateTime(info.lastSyncAt, 'datetime') }))
  if (result) {
    parts.push(
      t('应用 {applied} 项 · 推送 {pushed} 项', {
        applied: result.applied?.length || 0,
        pushed: result.pushed?.length || 0
      })
    )
    if (result.conflicts?.length) parts.push(t('{count} 项冲突已合并', { count: result.conflicts.length }))
    if (result.remoteDevice) parts.push(t('最近写入设备：{device}', { device: result.remoteDevice }))
  }
  return parts.join(' · ')
})
</script>
