import BaseProvider from './BaseProvider.js'

class BailianProvider extends BaseProvider {
  constructor(apiKey, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: '百炼',
      apiKey,
      hostname: 'dashscope.aliyuncs.com',
      path: '/compatible-mode/v1/chat/completions',
      modelsPath: '/compatible-mode/v1/models',
      validateModel: 'qwen3.8-flash',
      models: [
        { id: 'qwen3.8-max', name: 'qwen3.8-max' },
        { id: 'qwen3.7-plus', name: 'qwen3.7-plus' },
        { id: 'qwen3.8-flash', name: 'qwen3.8-flash' }
      ],
      defaultModel: 'qwen3.8-max',
      thinkingStyle: 'enable_thinking',
      streamUsage: true,
      timeout,
      connectionTimeout
    })
  }
}

export default BailianProvider
