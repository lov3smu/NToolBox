import BaseProvider from './BaseProvider.js'
import { ZEN_CATALOG } from '../catalogs/zen.js'

class OpencodeProvider extends BaseProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: 'OpenCode',
      apiKey,
      hostname: 'opencode.ai',
      path: '/inference/openai/v1/chat/completions',
      modelsPath: '/inference/openai/v1/models',
      validateModel: 'glm-5.3-flash',
      validateWithChat: true,
      models: ZEN_CATALOG.models,
      defaultModel: ZEN_CATALOG.defaultModel,
      timeout,
      connectionTimeout
    })
  }
}

export default OpencodeProvider
