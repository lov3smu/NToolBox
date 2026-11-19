import BaseProvider from './BaseProvider.js'
import { getThinkingStyle } from '../thinking.js'

class BailianProvider extends BaseProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: '百炼',
      apiKey,
      hostname: 'dashscope.aliyuncs.com',
      path: '/compatible-mode/v1/chat/completions',
      modelsPath: '/compatible-mode/v1/models',
      validateModel: 'qwen3.8-flash',
      models: [
        { id: 'qwen3.8-max', name: 'qwen3.8-max', contextWindow: 1000000 },
        { id: 'qwen3.7-plus', name: 'qwen3.7-plus', contextWindow: 1000000 },
        { id: 'qwen3.8-flash', name: 'qwen3.8-flash', contextWindow: 1000000 }
      ],
      defaultModel: 'qwen3.8-max',
      thinkingStyle: getThinkingStyle('bailian'),
      streamUsage: true,
      timeout,
      connectionTimeout
    })
  }
}

export default BailianProvider
