import BaseProvider from './BaseProvider.js'

class VolcengineProvider extends BaseProvider {
  constructor(apiKey, endpointId, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: '火山方舟',
      apiKey,
      hostname: 'ark.cn-beijing.volces.com',
      path: '/api/v3/chat/completions',
      validateModel: endpointId || 'doubao-pro-32k',
      models: [
        { id: 'doubao-pro-32k', name: 'Doubao-Pro-32K (推荐)' },
        { id: 'doubao-pro-128k', name: 'Doubao-Pro-128K' },
        { id: 'doubao-lite-32k', name: 'Doubao-Lite-32K (快速)' },
        { id: 'doubao-lite-128k', name: 'Doubao-Lite-128K' }
      ],
      defaultModel: endpointId || 'doubao-pro-32k',
      timeout,
      connectionTimeout
    })
    this.endpointId = endpointId
  }

  buildRequestBody(messages, tools, options) {
    const model = options.model || this.endpointId || this.defaultModel
    const body = {
      model,
      messages,
      tools,
      tool_choice: 'auto'
    }
    if (options.max_tokens) body.max_tokens = options.max_tokens
    if (options.temperature !== undefined) body.temperature = options.temperature
    return body
  }
}

export default VolcengineProvider