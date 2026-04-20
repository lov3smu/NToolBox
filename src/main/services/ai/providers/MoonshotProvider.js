import BaseProvider from './BaseProvider.js'

class MoonshotProvider extends BaseProvider {
  constructor(apiKey) {
    super({
      name: 'Moonshot',
      apiKey,
      models: [
        { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K' },
        { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K' },
        { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K' }
      ],
      defaultModel: 'moonshot-v1-8k'
    })
    this.hostname = 'api.moonshot.cn'
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
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    return result.success
  }
}

export default MoonshotProvider