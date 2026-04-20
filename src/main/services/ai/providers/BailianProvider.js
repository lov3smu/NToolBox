import BaseProvider from './BaseProvider.js'

class BailianProvider extends BaseProvider {
  constructor(apiKey) {
    super({
      name: '百炼',
      apiKey,
      models: [
        { id: 'qwen-plus', name: 'Qwen-Plus (推荐)' },
        { id: 'qwen-turbo', name: 'Qwen-Turbo (快速)' },
        { id: 'qwen-max', name: 'Qwen-Max (最强)' },
        { id: 'qwen-coder-plus', name: 'Qwen-Coder-Plus (编程)' },
        { id: 'qwen2.5-72b-instruct', name: 'Qwen2.5-72B' },
        { id: 'qwen2.5-32b-instruct', name: 'Qwen2.5-32B' }
      ],
      defaultModel: 'qwen-plus'
    })
    this.hostname = 'dashscope.aliyuncs.com'
    this.path = '/compatible-mode/v1/chat/completions'
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
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    return result.success
  }
}

export default BailianProvider