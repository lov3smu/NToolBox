import BaseProvider from './BaseProvider.js'

class ZhipuProvider extends BaseProvider {
  constructor(apiKey) {
    super({
      name: '智谱AI',
      apiKey,
      models: [
        { id: 'glm-4-plus', name: 'GLM-4-Plus (推荐)' },
        { id: 'glm-4-0520', name: 'GLM-4-0520' },
        { id: 'glm-4', name: 'GLM-4' },
        { id: 'glm-4-air', name: 'GLM-4-Air (快速)' },
        { id: 'glm-4-airx', name: 'GLM-4-AirX' },
        { id: 'glm-4-flash', name: 'GLM-4-Flash (免费)' },
        { id: 'glm-3-turbo', name: 'GLM-3-Turbo' }
      ],
      defaultModel: 'glm-4-flash'
    })
    this.hostname = 'open.bigmodel.cn'
    this.path = '/api/paas/v4/chat/completions'
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
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    return result.success
  }
}

export default ZhipuProvider