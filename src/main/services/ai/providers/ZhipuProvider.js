import BaseProvider from './BaseProvider.js'

class ZhipuProvider extends BaseProvider {
  constructor(apiKey, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: '智谱AI',
      apiKey,
      hostname: 'open.bigmodel.cn',
      path: '/api/paas/v4/chat/completions',
      modelsPath: '/api/paas/v4/models',
      validateModel: 'glm-4.7-flash',
      models: [
        { id: 'glm-5.3', name: 'glm-5.3' },
        { id: 'glm-5.2', name: 'glm-5.2' },
        { id: 'glm-5', name: 'glm-5' },
        { id: 'glm-4.7', name: 'glm-4.7' },
        { id: 'glm-4.7-flash', name: 'glm-4.7-flash' }
      ],
      defaultModel: 'glm-5.3',
      thinkingStyle: 'thinking',
      timeout,
      connectionTimeout
    })
  }
}

export default ZhipuProvider
