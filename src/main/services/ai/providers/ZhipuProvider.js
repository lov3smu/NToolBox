import BaseProvider from './BaseProvider.js'

class ZhipuProvider extends BaseProvider {
  constructor(apiKey, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: '智谱AI',
      apiKey,
      hostname: 'open.bigmodel.cn',
      path: '/api/paas/v4/chat/completions',
      validateModel: 'glm-4-flash',
      models: [
        { id: 'glm-4-plus', name: 'GLM-4-Plus (推荐)' },
        { id: 'glm-4-0520', name: 'GLM-4-0520' },
        { id: 'glm-4', name: 'GLM-4' },
        { id: 'glm-4-air', name: 'GLM-4-Air (快速)' },
        { id: 'glm-4-airx', name: 'GLM-4-AirX' },
        { id: 'glm-4-flash', name: 'GLM-4-Flash (免费)' },
        { id: 'glm-3-turbo', name: 'GLM-3-Turbo' }
      ],
      defaultModel: 'glm-4-flash',
      timeout,
      connectionTimeout
    })
  }
}

export default ZhipuProvider