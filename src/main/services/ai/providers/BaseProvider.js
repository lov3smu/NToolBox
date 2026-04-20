import https from 'https'
import { log } from '../../../utils'

class BaseProvider {
  constructor(config) {
    this.apiKey = config.apiKey
    this.name = config.name
    this.models = config.models || []
    this.defaultModel = config.defaultModel
  }

  getModels() {
    return this.models
  }

  getDefaultModel() {
    return this.defaultModel
  }

  validateConfig() {
    if (!this.apiKey || this.apiKey.trim() === '') {
      return { valid: false, error: 'API Key 未配置' }
    }
    return { valid: true }
  }

  async chat(messages, tools, options = {}) {
    throw new Error('chat method must be implemented by subclass')
  }

  async validateApiKey() {
    throw new Error('validateApiKey method must be implemented by subclass')
  }

  async makeRequest(hostname, port, path, requestBody) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname,
          port: port || 443,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            try {
              const responseData = JSON.parse(data)
              if (res.statusCode !== 200) {
                log.error(`${this.name} API 错误:`, responseData)
                resolve({
                  success: false,
                  error: responseData.error?.message || `请求失败: ${res.statusCode}`
                })
                return
              }
              resolve({ success: true, data: responseData })
            } catch (e) {
              log.error('解析响应失败:', e)
              resolve({ success: false, error: '解析响应失败' })
            }
          })
        }
      )

      req.on('error', (e) => {
        log.error(`${this.name} API 请求失败:`, e)
        resolve({ success: false, error: `网络请求失败: ${e.message}` })
      })

      req.write(JSON.stringify(requestBody))
      req.end()
    })
  }
}

export default BaseProvider