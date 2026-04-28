import https from 'https'
import { log } from '../../../utils'

class BaseProvider {
  constructor(config) {
    this.apiKey = config.apiKey
    this.name = config.name
    this.models = config.models || []
    this.defaultModel = config.defaultModel
    this.hostname = config.hostname
    this.path = config.path
    this.validateModel = config.validateModel || this.defaultModel
    this.timeout = config.timeout || 60000
    this.connectionTimeout = config.connectionTimeout || 10000
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

  buildRequestBody(messages, tools, options) {
    const model = options.model || this.defaultModel
    const body = {
      model,
      messages,
      tools,
      tool_choice: 'auto',
      stream: options.stream || false
    }
    if (options.max_tokens) body.max_tokens = options.max_tokens
    if (options.temperature !== undefined) body.temperature = options.temperature
    return body
  }

  parseResponse(responseData) {
    const message = responseData.choices?.[0]?.message
    return {
      success: true,
      content: message?.content || '',
      tool_calls: message?.tool_calls,
      model: responseData.model,
      usage: responseData.usage
    }
  }

  async chat(messages, tools, options = {}) {
    const requestBody = this.buildRequestBody(messages, tools, options)
    
    console.log(`=== ${this.name} 发送请求 ===`)
    console.log('请求体:', JSON.stringify(requestBody, null, 2))

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    
    if (!result.success) return result

    const responseData = result.data
    console.log(`=== ${this.name} 响应 ===`)
    console.log(JSON.stringify(responseData, null, 2))

    return this.parseResponse(responseData)
  }

  chatStream(messages, tools, options = {}, onChunk) {
    return new Promise((resolve, reject) => {
      const requestBody = this.buildRequestBody(messages, tools, { ...options, stream: true })
      
      console.log(`=== ${this.name} 流式请求 ===`)
      console.log('请求体:', JSON.stringify(requestBody, null, 2))

      const req = https.request(
        {
          hostname: this.hostname,
          port: 443,
          path: this.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        },
        (res) => {
          let fullContent = ''
          const toolCalls = []
          let buffer = ''
          let lastDataTime = Date.now()
          
          const streamTimeout = setTimeout(() => {
            req.destroy()
            log.error(`${this.name} 流式响应超时（无数据传输）`)
            reject({ success: false, error: `响应超时（${this.timeout/1000}秒），请稍后重试` })
          }, this.timeout)

          const keepAliveCheck = setInterval(() => {
            if (Date.now() - lastDataTime > this.timeout) {
              clearInterval(keepAliveCheck)
              clearTimeout(streamTimeout)
              req.destroy()
              log.error(`${this.name} 流式连接中断`)
              reject({ success: false, error: `连接中断，请稍后重试` })
            }
          }, 5000)

          res.on('data', (chunk) => {
            lastDataTime = Date.now()
            buffer += chunk.toString()
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue
                
                try {
                  const json = JSON.parse(data)
                  const delta = json.choices?.[0]?.delta
                  
                  if (delta?.content) {
                    fullContent += delta.content
                    if (onChunk) onChunk(delta.content)
                  }
                  
                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index || 0
                      const existing = toolCalls[idx]
                      
                      if (!existing) {
                        toolCalls[idx] = {
                          id: tc.id || '',
                          type: tc.type || 'function',
                          function: {
                            name: tc.function?.name || '',
                            arguments: tc.function?.arguments || ''
                          }
                        }
                      } else {
                        if (tc.id) existing.id = tc.id
                        if (tc.function?.name) existing.function.name = tc.function.name
                        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
                      }
                    }
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          })

          res.on('end', () => {
            clearTimeout(streamTimeout)
            clearInterval(keepAliveCheck)
            
            if (res.statusCode !== 200) {
              log.error(`${this.name} 流式请求失败: ${res.statusCode}`)
              reject({ success: false, error: `请求失败: ${res.statusCode}` })
              return
            }
            
            const validToolCalls = toolCalls.filter(tc => tc && tc.function?.name)
            
            resolve({
              success: true,
              content: fullContent,
              tool_calls: validToolCalls.length > 0 ? validToolCalls : undefined
            })
          })
        }
      )

      req.on('error', (e) => {
        log.error(`${this.name} 流式请求网络错误:`, e)
        
        let errorMessage = `网络请求失败: ${e.message}`
        if (e.code === 'ENOTFOUND') {
          errorMessage = `无法连接到服务器 (${this.hostname})，请检查网络连接`
        } else if (e.code === 'ECONNREFUSED') {
          errorMessage = `连接被拒绝，服务器可能不可用`
        } else if (e.code === 'ETIMEDOUT' || e.code === 'ESOCKETTIMEDOUT') {
          errorMessage = `连接超时，请检查网络或稍后重试`
        }
        
        reject({ success: false, error: errorMessage })
      })

      req.write(JSON.stringify(requestBody))
      req.end()
    })
  }

  async validateApiKey() {
    const requestBody = {
      model: this.validateModel,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }

    const result = await this.makeRequest(this.hostname, 443, this.path, requestBody)
    return result.success
  }

  async makeRequest(hostname, port, path, requestBody) {
    return new Promise((resolve) => {
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
            clearTimeout(timeoutTimer)
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

      const timeoutTimer = setTimeout(() => {
        req.destroy()
        log.error(`${this.name} API 请求超时`)
        resolve({ success: false, error: `请求超时（${this.timeout/1000}秒），请检查网络连接或稍后重试` })
      }, this.timeout)

      req.on('error', (e) => {
        clearTimeout(timeoutTimer)
        log.error(`${this.name} API 请求失败:`, e)
        
        let errorMessage = `网络请求失败: ${e.message}`
        if (e.code === 'ENOTFOUND') {
          errorMessage = `无法连接到服务器 (${hostname})，请检查网络连接`
        } else if (e.code === 'ECONNREFUSED') {
          errorMessage = `连接被拒绝，服务器可能不可用`
        } else if (e.code === 'ETIMEDOUT' || e.code === 'ESOCKETTIMEDOUT') {
          errorMessage = `连接超时，请检查网络或稍后重试`
        }
        
        resolve({ success: false, error: errorMessage })
      })

      req.write(JSON.stringify(requestBody))
      req.end()
    })
  }
}

export default BaseProvider