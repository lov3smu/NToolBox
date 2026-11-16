import BaseProvider from './BaseProvider.js'
import { getThinkingStyle } from '../thinking.js'

class VolcengineProvider extends BaseProvider {
  constructor({ apiKey, endpointId, timeout, connectionTimeout } = {}) {
    super({
      name: '火山方舟',
      apiKey,
      hostname: 'ark.cn-beijing.volces.com',
      path: '/api/v3/chat/completions',
      modelsPath: '/api/v3/models',
      validateModel: endpointId || 'doubao-seed-evolving',
      models: [
        { id: 'doubao-seed-evolving', name: 'doubao-seed-evolving', contextWindow: 1048576 },
        { id: 'doubao-seed-2.1-pro', name: 'doubao-seed-2.1-pro', contextWindow: 1048576 },
        { id: 'doubao-seed-2.0-pro', name: 'doubao-seed-2.0-pro', contextWindow: 262144 }
      ],
      defaultModel: endpointId || 'doubao-seed-evolving',
      thinkingStyle: getThinkingStyle('volcengine'),
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
