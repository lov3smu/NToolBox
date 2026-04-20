import BaseProvider from './BaseProvider.js'

class DeepSeekProvider extends BaseProvider {
  constructor(apiKey) {
    super({
      name: 'DeepSeek',
      apiKey,
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek-Chat (推荐)' },
        { id: 'deepseek-coder', name: 'DeepSeek-Coder (编程)' },
        { id: 'deepseek-reasoner', name: 'DeepSeek-Reasoner (推理)' }
      ],
      defaultModel: 'deepseek-chat'
    })
    this.hostname = 'api.deepseek.com'
    this.path = '/v1/chat/completions'
  }

  async chat(messages, tools, options = {}) {
    const model = options.model || this.defaultModel
    
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
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    return result.success
  }
}

export default DeepSeekProvider