import BaseProvider from './BaseProvider.js'

class GoogleProvider extends BaseProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: 'Google',
      apiKey,
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/openai/chat/completions',
      modelsPath: '/v1beta/openai/models',
      validateModel: 'gemini-3.8-flash',
      models: [
        {
          id: 'gemini-3.8-flash',
          name: 'Gemini 3.8 Flash',
          contextWindow: 1000000,
          maxOutput: 65536,
          inputTypes: ['text', 'image']
        },
        {
          id: 'gemini-4-argon',
          name: 'Gemini 4 Argon',
          contextWindow: 1000000,
          maxOutput: 65536,
          inputTypes: ['text', 'image']
        },
        {
          id: 'gemini-4-hydrogen',
          name: 'Gemini 4 Hydrogen',
          contextWindow: 1000000,
          maxOutput: 65536,
          inputTypes: ['text', 'image']
        },
        {
          id: 'gemini-4-carbon',
          name: 'Gemini 4 Carbon',
          contextWindow: 1000000,
          maxOutput: 65536,
          inputTypes: ['text', 'image']
        },
        {
          id: 'gemini-3.7-flash',
          name: 'Gemini 3.7 Flash',
          contextWindow: 1000000,
          maxOutput: 65536,
          inputTypes: ['text', 'image']
        },
        {
          id: 'gemini-3.1-pro',
          name: 'Gemini 3.1 Pro',
          contextWindow: 1000000,
          maxOutput: 65536,
          inputTypes: ['text', 'image']
        }
      ],
      defaultModel: 'gemini-3.8-flash',
      timeout,
      connectionTimeout
    })
  }
}

export default GoogleProvider
