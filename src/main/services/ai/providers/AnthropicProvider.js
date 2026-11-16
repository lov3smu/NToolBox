import BaseProvider from './BaseProvider.js'

class AnthropicProvider extends BaseProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: 'Anthropic',
      apiKey,
      hostname: 'api.anthropic.com',
      path: '/v1/chat/completions',
      modelsPath: '/v1/models',
      validateModel: 'claude-haiku-5-5',
      models: [
        {
          id: 'claude-sonnet-5-5',
          name: 'Claude Sonnet 5.5',
          contextWindow: 1000000,
          maxOutput: 128000,
          inputTypes: ['text', 'image']
        },
        {
          id: 'claude-opus-5-5',
          name: 'Claude Opus 5.5',
          contextWindow: 1000000,
          maxOutput: 128000,
          inputTypes: ['text', 'image']
        },
        {
          id: 'claude-fable-5-1',
          name: 'Claude Fable 5.1',
          contextWindow: 1000000,
          maxOutput: 128000,
          inputTypes: ['text', 'image']
        },
        {
          id: 'claude-haiku-5-5',
          name: 'Claude Haiku 5.5',
          contextWindow: 1000000,
          maxOutput: 128000,
          inputTypes: ['text', 'image']
        }
      ],
      defaultModel: 'claude-sonnet-5-5',
      temperatureFixed: true,
      timeout,
      connectionTimeout
    })
  }

  getHeaders(extra = {}, apiKey = this.apiKey) {
    return {
      ...super.getHeaders(extra, apiKey),
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  }
}

export default AnthropicProvider
