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
        { id: 'glm-5.3', name: 'glm-5.3', contextWindow: 1000000 },
        { id: 'glm-5.2', name: 'glm-5.2', contextWindow: 1000000 },
        { id: 'glm-5', name: 'glm-5', contextWindow: 204800 },
        { id: 'glm-4.7', name: 'glm-4.7', contextWindow: 204800 },
        { id: 'glm-4.7-flash', name: 'glm-4.7-flash', contextWindow: 204800 }
      ],
      defaultModel: 'glm-5.3',
      thinkingStyle: 'zhipu',
      timeout,
      connectionTimeout
    })
  }
}

export default ZhipuProvider
