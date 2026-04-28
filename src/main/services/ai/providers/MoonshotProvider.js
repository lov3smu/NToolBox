import BaseProvider from './BaseProvider.js'

class MoonshotProvider extends BaseProvider {
  constructor(apiKey, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: 'Moonshot',
      apiKey,
      hostname: 'api.moonshot.cn',
      path: '/v1/chat/completions',
      validateModel: 'moonshot-v1-8k',
      models: [
        { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K' },
        { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K' },
        { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K' }
      ],
      defaultModel: 'moonshot-v1-8k',
      timeout,
      connectionTimeout
    })
  }
}

export default MoonshotProvider