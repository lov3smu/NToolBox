import BaseProvider from './BaseProvider.js'

class VolcengineProvider extends BaseProvider {
  constructor(apiKey, endpointId, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: '火山方舟',
      apiKey,
      hostname: 'ark.cn-beijing.volces.com',
      path: '/api/v3/chat/completions',
      modelsPath: '/api/v3/models',
      validateModel: endpointId || 'doubao-seed-evolving',
      models: [
        { id: 'doubao-seed-evolving', name: 'doubao-seed-evolving' },
        { id: 'doubao-seed-2.1-pro', name: 'doubao-seed-2.1-pro' },
        { id: 'doubao-seed-2.0-pro', name: 'doubao-seed-2.0-pro' }
      ],
      defaultModel: endpointId || 'doubao-seed-evolving',
      thinkingStyle: 'thinking',
      timeout,
      connectionTimeout
    })
    this.endpointId = endpointId
  }

  buildRequestBody(messages, tools, options) {
    return super.buildRequestBody(messages, tools, {
      ...options,
      model: options.model || this.defaultModel || this.endpointId
    })
  }
}

export default VolcengineProvider
