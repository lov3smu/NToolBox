import BaseProvider from './BaseProvider.js'

class MinimaxProvider extends BaseProvider {
  constructor(apiKey, groupId) {
    super({
      name: 'Minimax',
      apiKey,
      models: [
        { id: 'abab6.5s-chat', name: 'ABAB 6.5S (快速)' },
        { id: 'abab6.5g-chat', name: 'ABAB 6.5G' },
        { id: 'abab6.5-chat', name: 'ABAB 6.5' },
        { id: 'abab5.5-chat', name: 'ABAB 5.5' },
        { id: 'abab5.5s-chat', name: 'ABAB 5.5S' }
      ],
      defaultModel: 'abab6.5s-chat'
    })
    this.groupId = groupId
    this.hostname = 'api.minimax.chat'
    this.path = groupId ? `/v1/chat/completions?GroupId=${groupId}` : '/v1/chat/completions'
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
      model: 'abab6.5s-chat',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    return result.success
  }
}

export default MinimaxProvider