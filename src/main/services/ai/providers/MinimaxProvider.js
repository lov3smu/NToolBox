import BaseProvider from './BaseProvider.js'

class MinimaxProvider extends BaseProvider {
  constructor(apiKey, groupId, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: 'MiniMax',
      apiKey,
      hostname: 'api.minimaxi.com',
      path: '/v1/chat/completions',
      modelsPath: '/v1/models',
      validateModel: 'MiniMax-M2.7-highspeed',
      models: [
        { id: 'MiniMax-M3.1-Flash', name: 'MiniMax-M3.1-Flash' },
        { id: 'MiniMax-M3', name: 'MiniMax-M3' },
        { id: 'MiniMax-M2.7', name: 'MiniMax-M2.7' },
        { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7-highspeed' }
      ],
      defaultModel: 'MiniMax-M3',
      timeout,
      connectionTimeout
    })
    this.groupId = groupId
  }
}

export default MinimaxProvider
