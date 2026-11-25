import BaseProvider from './BaseProvider.js'
import { t } from '../../i18n.js'

// 本地服务走 OpenAI 兼容接口，无需 API Key，也不参与内置模型目录
class LocalProvider extends BaseProvider {
  constructor(config) {
    super({
      requiresApiKey: false,
      protocol: 'http:',
      models: [],
      defaultModel: '',
      validateModel: '',
      ...config
    })
  }

  validateConfig() {
    return { valid: true }
  }

  endpoint() {
    return this.baseUrl || `${this.protocol}//${this.hostname}:${this.port}`
  }

  async validateApiKey() {
    const result = await super.validateApiKey()
    if (result.valid || result.status !== 0) return result
    return { ...result, error: t('无法连接本地服务（{p0}），请确认服务已启动', { p0: this.endpoint() }) }
  }

  async listRemoteModels(apiKey = this.apiKey) {
    const result = await super.listRemoteModels(apiKey)
    if (!result.success && /CONNECTION_REFUSED|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(result.error || '')) {
      return { ...result, error: t('无法连接本地服务（{p0}），请确认服务已启动', { p0: this.endpoint() }) }
    }
    return result
  }
}

class OllamaProvider extends LocalProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: 'Ollama',
      apiKey,
      hostname: '127.0.0.1',
      port: 11434,
      path: '/v1/chat/completions',
      modelsPath: '/v1/models',
      timeout,
      connectionTimeout
    })
  }
}

class LmStudioProvider extends LocalProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: 'LM Studio',
      apiKey,
      hostname: '127.0.0.1',
      port: 1234,
      path: '/v1/chat/completions',
      modelsPath: '/v1/models',
      timeout,
      connectionTimeout
    })
  }
}

export { OllamaProvider, LmStudioProvider }
