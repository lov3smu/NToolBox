<template>
  <div class="network-section">
    <div class="form-inline-group">
      <label class="checkbox-label-inline">
        <input v-model="connection.ssh.enabled" type="checkbox" />
        <span>{{ t('SSH 隧道') }}</span>
      </label>
      <div class="setting-hint">{{ t('通过跳板机转发连接，使用系统 OpenSSH 客户端与密钥登录') }}</div>
    </div>
    <div v-if="connection.ssh.enabled" class="network-subfields">
      <div class="form-inline-group">
        <label class="form-label-inline">{{ t('跳板机地址') }}</label>
        <input v-model="connection.ssh.host" type="text" class="input-field-inline" placeholder="ssh.example.com" />
      </div>
      <div class="form-inline-group">
        <label class="form-label-inline">{{ t('SSH 端口') }}</label>
        <input v-model.number="connection.ssh.port" type="number" class="input-field-inline input-port" />
      </div>
      <div class="form-inline-group">
        <label class="form-label-inline">{{ t('SSH 用户名') }}</label>
        <input v-model="connection.ssh.user" type="text" class="input-field-inline" placeholder="root" />
      </div>
      <div class="form-inline-group">
        <label class="form-label-inline">{{ t('私钥路径') }}</label>
        <input
          v-model="connection.ssh.keyPath"
          type="text"
          class="input-field-inline"
          :placeholder="t('留空使用默认密钥或 ssh-agent')"
        />
      </div>
    </div>
    <div class="form-inline-group">
      <label class="checkbox-label-inline">
        <input v-model="connection.ssl.enabled" type="checkbox" />
        <span>{{ t('启用 SSL') }}</span>
      </label>
    </div>
    <div v-if="connection.ssl.enabled" class="network-subfields">
      <div class="form-inline-group">
        <label class="checkbox-label-inline">
          <input v-model="connection.ssl.verify" type="checkbox" />
          <span>{{ t('校验服务器证书') }}</span>
        </label>
        <div class="setting-hint">{{ t('关闭校验可连接自签名证书，但不再验证服务器身份') }}</div>
      </div>
      <div class="form-inline-group">
        <label class="form-label-inline">{{ t('CA 证书路径') }}</label>
        <input
          v-model="connection.ssl.caPath"
          type="text"
          class="input-field-inline"
          :placeholder="t('留空使用系统信任库')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
const connection = defineModel({ type: Object, required: true })
</script>

<style scoped>
.network-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.network-subfields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 10px;
  border-left: 2px solid var(--border-color);
}
</style>
