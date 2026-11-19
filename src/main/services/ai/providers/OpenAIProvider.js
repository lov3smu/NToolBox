import BaseProvider from './BaseProvider.js'

class OpenAIProvider extends BaseProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: 'OpenAI',
      apiKey,
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      modelsPath: '/v1/models',
      validateModel: 'gpt-6-luna',
      models: [
        {
          id: 'gpt-6-sol',
          name: 'GPT-6 Sol',
          contextWindow: 1050000,
          maxOutput: 128000,
          inputTypes: ['text', 'image']
        },
        {
          id: 'gpt-6-luna',
          name: 'GPT-6 Luna',
          contextWindow: 1050000,
          maxOutput: 128000,
          inputTypes: ['text', 'image']
        }
      ],
      defaultModel: 'gpt-6-sol',
      temperatureFixed: true,
      timeout,
      connectionTimeout
    })
  }

  buildRequestBody(messages, tools, options) {
    const body = super.buildRequestBody(messages, tools, options)
    // GPT-6 只接受 max_completion_tokens，且仅 reasoning_effort=none 支持函数工具
    if (body.max_tokens) {
      body.max_completion_tokens = body.max_tokens
      delete body.max_tokens
    }
    if (/^gpt-6/i.test(String(body.model || '')) && Array.isArray(tools) && tools.length > 0) {
      body.reasoning_effort = 'none'
    }
    return body
  }
}

export default OpenAIProvider
