import BaseProvider from './BaseProvider.js'

class MoonshotProvider extends BaseProvider {
  constructor(apiKey, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: 'Kimi',
      apiKey,
      hostname: 'api.moonshot.cn',
      path: '/v1/chat/completions',
      modelsPath: '/v1/models',
      validateModel: 'kimi-k3',
      models: [
        { id: 'kimi-k3.1-pro', name: 'kimi-k3.1-pro', contextWindow: 1000000 },
        { id: 'kimi-k3.1-pro-highspeed', name: 'kimi-k3.1-pro-highspeed', contextWindow: 1000000 },
        { id: 'kimi-k3', name: 'kimi-k3', contextWindow: 1000000 }
      ],
      defaultModel: 'kimi-k3.1-pro',
      thinkingStyle: 'moonshot',
      temperatureFixed: true,
      timeout,
      connectionTimeout
    })
  }
}

export default MoonshotProvider
