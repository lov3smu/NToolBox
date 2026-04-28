import BaseProvider from './BaseProvider.js'

class BailianProvider extends BaseProvider {
  constructor(apiKey, timeout = 60000, connectionTimeout = 10000) {
    super({
      name: '百炼',
      apiKey,
      hostname: 'dashscope.aliyuncs.com',
      path: '/compatible-mode/v1/chat/completions',
      validateModel: 'qwen-turbo',
      models: [
        { id: 'qwen-plus', name: 'Qwen-Plus (推荐)' },
        { id: 'qwen-turbo', name: 'Qwen-Turbo (快速)' },
        { id: 'qwen-max', name: 'Qwen-Max (最强)' },
        { id: 'qwen-coder-plus', name: 'Qwen-Coder-Plus (编程)' },
        { id: 'qwen2.5-72b-instruct', name: 'Qwen2.5-72B' },
        { id: 'qwen2.5-32b-instruct', name: 'Qwen2.5-32B' }
      ],
      defaultModel: 'qwen-plus',
      timeout,
      connectionTimeout
    })
  }
}

export default BailianProvider