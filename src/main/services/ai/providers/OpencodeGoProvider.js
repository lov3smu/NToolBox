import { randomUUID } from 'crypto'
import BaseProvider from './BaseProvider.js'
import { GO_CATALOG } from '../catalogs/go.js'

class OpencodeGoProvider extends BaseProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: 'OpenCode Go',
      apiKey,
      hostname: 'opencode.ai',
      path: '/inference/go/openai/v1/chat/completions',
      modelsPath: '/inference/go/openai/v1/models',
      validateModel: 'glm-5.3-flash',
      validateWithChat: true,
      models: GO_CATALOG.models,
      defaultModel: GO_CATALOG.defaultModel,
      timeout,
      connectionTimeout
    })
    // Go 网关要求携带稳定的会话 ID，缺失时所有请求都会 400 MissingSessionID
    this.sessionId = `ses_${randomUUID().replace(/-/g, '')}`
  }

  getHeaders(extra = {}, apiKey = this.apiKey, options = {}) {
    const conversationId = typeof options?.conversationId === 'string' ? options.conversationId.trim() : ''
    const sessionId = conversationId ? `ses_${conversationId.replace(/-/g, '')}` : this.sessionId
    return super.getHeaders({ 'x-opencode-session': sessionId, ...extra }, apiKey)
  }
}

export default OpencodeGoProvider
