import BaseProvider from './BaseProvider.js'

class MinimaxProvider extends BaseProvider {
  constructor(apiKey, groupId, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: 'MiniMax',
      apiKey,
      hostname: 'api.minimax.cn',
      path: '/v1/chat/completions',
      modelsPath: '/v1/models',
      validateModel: 'MiniMax-M3',
      models: [
        { id: 'MiniMax-M3.1-Flash', name: 'MiniMax-M3.1-Flash', contextWindow: 1000000 },
        { id: 'MiniMax-M3', name: 'MiniMax-M3', contextWindow: 1000000 }
      ],
      defaultModel: 'MiniMax-M3',
      thinkingStyle: 'minimax',
      timeout,
      connectionTimeout
    })
    this.groupId = groupId
  }
}

export default MinimaxProvider
