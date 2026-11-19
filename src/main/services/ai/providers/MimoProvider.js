import BaseProvider from './BaseProvider.js'
import { getThinkingStyle } from '../thinking.js'

class MimoProvider extends BaseProvider {
  constructor({ apiKey, timeout, connectionTimeout } = {}) {
    super({
      name: '小米 MiMo',
      apiKey,
      hostname: 'api.xiaomimimo.com',
      path: '/v1/chat/completions',
      modelsPath: '/v1/models',
      validateModel: 'mimo-v2.6-flash',
      models: [
        {
          id: 'mimo-v2.6-pro',
          name: 'MiMo V2.6 Pro',
          contextWindow: 1048576,
          maxOutput: 131072,
          inputTypes: ['text', 'image']
        },
        {
          id: 'mimo-v2.6-flash',
          name: 'MiMo V2.6 Flash',
          contextWindow: 1048576,
          maxOutput: 131072,
          inputTypes: ['text', 'image']
        },
        {
          id: 'mimo-v2.6-pro-ultraspeed',
          name: 'MiMo V2.6 Pro UltraSpeed',
          contextWindow: 1048576,
          maxOutput: 131072,
          inputTypes: ['text', 'image']
        }
      ],
      defaultModel: 'mimo-v2.6-pro',
      thinkingStyle: getThinkingStyle('mimo'),
      // 深度思考下不支持自定义 temperature/top_p，统一省略让平台使用推荐值
      temperatureFixed: true,
      timeout,
      connectionTimeout
    })
  }
}

export default MimoProvider
