import BaseProvider from './BaseProvider.js'

class DeepSeekProvider extends BaseProvider {
  constructor(apiKey, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: 'DeepSeek',
      apiKey,
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      modelsPath: '/models',
      validateModel: 'deepseek-flash',
      models: [
        { id: 'deepseek-v4-pro', name: 'deepseek-v4-pro' },
        { id: 'deepseek-flash', name: 'deepseek-flash' }
      ],
      defaultModel: 'deepseek-v4-pro',
      thinkingStyle: 'thinking',
      timeout,
      connectionTimeout
    })
  }
}

export default DeepSeekProvider
