import BaseProvider from './BaseProvider.js'

class VolcengineProvider extends BaseProvider {
  constructor(apiKey, endpointId) {
    super({
      name: '火山方舟',
      apiKey,
      models: [
        { id: 'doubao-pro-32k', name: 'Doubao-Pro-32K (推荐)' },
        { id: 'doubao-pro-128k', name: 'Doubao-Pro-128K' },
        { id: 'doubao-lite-32k', name: 'Doubao-Lite-32K (快速)' },
        { id: 'doubao-lite-128k', name: 'Doubao-Lite-128K' }
      ],
      defaultModel: endpointId || 'doubao-pro-32k'
    })
    this.endpointId = endpointId
    this.hostname = 'ark.cn-beijing.volces.com'
    this.path = '/api/v3/chat/completions'
  }

  async chat(messages, tools, options = {}) {
    const model = options.model || this.endpointId || this.defaultModel
    
    const requestBody = {
      model,
      messages,
      tools,
      tool_choice: 'auto'
    }

    if (options.max_tokens) requestBody.max_tokens = options.max_tokens
    if (options.temperature !== undefined) requestBody.temperature = options.temperature

    console.log(`=== ${this.name} 发送请求 ===`)
    console.log('请求体:', JSON.stringify(requestBody, null, 2))

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    
    if (!result.success) return result

    const responseData = result.data
    console.log(`=== ${this.name} 响应 ===`)
    console.log(JSON.stringify(responseData, null, 2))

    const message = responseData.choices?.[0]?.message
    
    return {
      success: true,
      content: message?.content || '',
      tool_calls: message?.tool_calls,
      model: responseData.model,
      usage: responseData.usage
    }
  }

  async validateApiKey() {
    const requestBody = {
      model: this.endpointId || 'doubao-pro-32k',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    return result.success
  }
}

export default VolcengineProvider