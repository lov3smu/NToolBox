import { TextDecoder } from 'util'
import { log } from '../../../utils'
import { t } from '../../i18n.js'
import { createRequest } from '../../network.js'
import {
  RETRY_DEFAULTS,
  isRetryableNetworkCode,
  isRetryableStatus,
  withRetry,
  computeRetryDelay,
  waitForDelay
} from '../retry.js'

class BaseProvider {
  constructor(config) {
    this.apiKey = config.apiKey
    this.name = config.name
    this.models = config.models || []
    this.defaultModel = config.defaultModel
    this.defaultHostname = config.hostname
    this.defaultPath = config.path
    this.defaultModelsPath = config.modelsPath || ''
    this.defaultProtocol = 'https:'
    this.defaultPort = 443
    this.validateModel = config.validateModel || this.defaultModel
    this.thinkingStyle = config.thinkingStyle || ''
    this.streamUsage = config.streamUsage === true
    this.temperatureFixed = config.temperatureFixed === true
    // 部分网关（如 OpenCode）的模型列表接口公开，只能通过实际对话校验密钥
    this.validateWithChat = config.validateWithChat === true
    this.timeout = config.timeout || 60000
    this.connectionTimeout = config.connectionTimeout || 10000
    this.maxRetries = Number.isInteger(config.maxRetries) ? Math.max(0, config.maxRetries) : RETRY_DEFAULTS.retries
    this.setBaseUrl(config.baseUrl || '')
  }

  resetBaseUrl() {
    this.baseUrl = ''
    this.protocol = this.defaultProtocol
    this.hostname = this.defaultHostname
    this.port = this.defaultPort
    this.path = this.defaultPath
    this.modelsPath = this.defaultModelsPath
  }

  setBaseUrl(baseUrl) {
    const value = typeof baseUrl === 'string' ? baseUrl.trim() : ''
    if (!value) {
      this.resetBaseUrl()
      return true
    }

    let parsed
    try {
      parsed = new URL(value)
    } catch {
      log.warn(`${this.name} API 地址格式无效: ${value}`)
      this.resetBaseUrl()
      return false
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      log.warn(`${this.name} API 地址仅支持 http/https: ${value}`)
      this.resetBaseUrl()
      return false
    }

    const basePath = parsed.pathname.replace(/\/+$/, '')
    this.baseUrl = value
    this.protocol = parsed.protocol
    this.hostname = parsed.hostname
    this.port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
    this.path = `${basePath}/chat/completions`
    this.modelsPath = `${basePath}/models`
    return true
  }

  getModels() {
    return this.models
  }

  getDefaultModel() {
    return this.defaultModel
  }

  getModelInfo(modelId) {
    return this.models.find((model) => model && model.id === modelId) || null
  }

  validateConfig() {
    if (!this.apiKey || this.apiKey.trim() === '') {
      return { valid: false, error: t('API Key 未配置') }
    }
    return { valid: true }
  }

  // 子类可扩展 options（如会话 id）覆盖请求头
  getHeaders(extra = {}, apiKey = this.apiKey) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extra
    }
  }

  buildRequestBody(messages, tools, options) {
    const model = options.model || this.defaultModel
    const body = {
      model,
      messages,
      stream: Boolean(options.stream)
    }
    if (options.stream && this.streamUsage) {
      body.stream_options = { include_usage: true }
    }
    if (Array.isArray(tools) && tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }
    const modelMaxOutput = this.getModelInfo(model)?.maxOutput
    let maxTokens = options.max_tokens
    if (!maxTokens && modelMaxOutput) maxTokens = modelMaxOutput
    if (maxTokens && modelMaxOutput && maxTokens > modelMaxOutput) maxTokens = modelMaxOutput
    if (maxTokens) body.max_tokens = maxTokens
    if (options.temperature !== undefined && !this.temperatureFixed) {
      body.temperature = options.temperature
    }
    this.applyThinkingOptions(body, options)
    return body
  }

  applyThinkingOptions(body, options) {
    const thinking = options.thinking
    if (this.thinkingStyle === 'minimax') {
      this.applyMinimaxThinking(body, thinking)
      return
    }
    if (thinking === undefined || thinking === null) return
    if (this.thinkingStyle === 'enable_thinking') {
      body.enable_thinking = Boolean(thinking)
    } else if (this.thinkingStyle === 'thinking') {
      body.thinking = { type: thinking ? 'enabled' : 'disabled' }
    } else if (this.thinkingStyle === 'zhipu') {
      this.applyZhipuThinking(body, thinking)
    } else if (this.thinkingStyle === 'moonshot') {
      if (!/kimi-k3/i.test(String(body.model || ''))) return
      body.reasoning_effort = thinking ? 'high' : 'low'
    }
  }

  applyZhipuThinking(body, thinking) {
    const model = String(body.model || '')
    if (/^glm-5\.3/i.test(model)) {
      // GLM-5.3 始终思考，仅接受 type=enabled；用 reasoning_effort 区分快慢
      body.thinking = { type: 'enabled' }
      body.reasoning_effort = thinking ? 'high' : 'low'
      return
    }
    if (!/^glm-(5|4\.7)/i.test(model)) return
    body.thinking = { type: thinking ? 'enabled' : 'disabled' }
  }

  applyMinimaxThinking(body, thinking) {
    if (!/^MiniMax-M3/i.test(String(body.model || ''))) return
    // 不返回 reasoning_split 时接口不输出 reasoning_content
    body.reasoning_split = true
    if (thinking === undefined || thinking === null) return

    const isFlash = /^MiniMax-M3\.1-Flash/i.test(String(body.model || ''))
    if (isFlash) {
      // M3.1-Flash 不支持 thinking.type=disabled
      body.thinking = { type: 'adaptive' }
      body.reasoning_effort = thinking ? 'high' : 'low'
      return
    }
    body.thinking = { type: thinking ? 'adaptive' : 'disabled' }
  }

  parseResponse(responseData) {
    const message = responseData.choices?.[0]?.message
    return {
      success: true,
      content: message?.content || '',
      thinking: message?.reasoning_content || message?.reasoning || '',
      tool_calls: message?.tool_calls,
      model: responseData.model,
      usage: responseData.usage
    }
  }

  async chat(messages, tools, options = {}) {
    const requestBody = this.buildRequestBody(messages, tools, options)

    log.debug(`[${this.name}] chat 请求，消息数: ${messages.length}`)

    const result = await this.makeRequest(this.hostname, this.port, this.path, requestBody, {
      retries: options.retries,
      baseDelay: options.retryBaseDelay,
      maxDelay: options.retryMaxDelay,
      shouldStop: options.shouldStop,
      onRetry: options.onRetry,
      conversationId: options.conversationId
    })

    if (!result.success) return result

    const responseData = result.data
    log.debug(`[${this.name}] chat 响应完成`)

    return this.parseResponse(responseData)
  }

  async chatStream(messages, tools, options = {}, onChunk) {
    const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false
    const retries = Number.isInteger(options.retries) ? Math.max(0, options.retries) : this.maxRetries

    for (let attempt = 0; ; attempt += 1) {
      let emitted = false
      const guardedChunk =
        typeof onChunk === 'function'
          ? (event) => {
              emitted = true
              onChunk(event)
            }
          : undefined

      let result
      try {
        result = await this.chatStreamOnce(messages, tools, options, guardedChunk)
      } catch (error) {
        result = {
          success: false,
          cancelled: Boolean(error?.cancelled),
          error: typeof error?.error === 'string' ? error.error : error?.message || String(error),
          status: error?.status,
          retryable: error?.retryable === true,
          content: typeof error?.content === 'string' ? error.content : '',
          thinking: typeof error?.thinking === 'string' ? error.thinking : ''
        }
      }

      if (result && emitted) result.emitted = true
      if (!result || result.success || result.cancelled || result.emitted || result.retryable !== true) {
        return result
      }
      if (attempt >= retries || shouldStop()) return result

      const delay = computeRetryDelay(attempt + 1, options.retryBaseDelay, options.retryMaxDelay)
      if (typeof options.onRetry === 'function') {
        options.onRetry({ attempt: attempt + 1, retries, delay, error: result.error || '' })
      }
      if (typeof onChunk === 'function') {
        onChunk({
          kind: 'status',
          text: t('模型请求失败（{p0}），{p1} 秒后重试（{p2}/{p3}）', {
            p0: result.error || t('未知错误'),
            p1: Math.round(delay / 1000),
            p2: attempt + 1,
            p3: retries
          })
        })
      }
      const canContinue = await waitForDelay(delay, shouldStop)
      if (!canContinue) {
        return { ...result, success: false, cancelled: true, error: t('已停止') }
      }
    }
  }

  chatStreamOnce(messages, tools, options = {}, onChunk) {
    return new Promise((resolve, reject) => {
      const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false

      if (shouldStop()) {
        resolve({ success: false, cancelled: true, content: '', thinking: '', error: t('已停止') })
        return
      }

      const requestBody = this.buildRequestBody(messages, tools, { ...options, stream: true })

      log.debug(`[${this.name}] chatStream 请求，消息数: ${messages.length}`)

      let fullContent = ''
      let fullThinking = ''
      let streamUsage = null
      const toolCalls = []
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let settled = false
      let streamTimeout = null
      let keepAliveCheck = null
      let stopWatcher = null
      let req = null

      const clearTimers = () => {
        if (streamTimeout) clearTimeout(streamTimeout)
        if (keepAliveCheck) clearInterval(keepAliveCheck)
        if (stopWatcher) clearInterval(stopWatcher)
      }

      const finish = (payload) => {
        if (settled) return
        settled = true
        clearTimers()
        resolve({ content: fullContent, thinking: fullThinking, ...payload })
      }

      const fail = (payload) => {
        if (settled) return
        settled = true
        clearTimers()
        reject({ content: fullContent, thinking: fullThinking, ...payload })
      }

      const stop = () => {
        if (settled) return
        finish({
          success: false,
          cancelled: true,
          content: fullContent,
          thinking: fullThinking,
          usage: streamUsage,
          error: t('已停止')
        })
        req?.cancel()
      }

      req = createRequest(
        this.protocol,
        {
          hostname: this.hostname,
          port: this.port,
          path: this.path,
          method: 'POST',
          headers: this.getHeaders({}, this.apiKey, options)
        },
        (res) => {
          let lastDataTime = Date.now()

          streamTimeout = setTimeout(() => {
            log.error(`${this.name} 流式响应超时（无数据传输）`)
            fail({
              success: false,
              error: t('响应超时（{p0}秒），请稍后重试', { p0: this.timeout / 1000 }),
              retryable: true
            })
            req.cancel()
          }, this.timeout)

          keepAliveCheck = setInterval(() => {
            if (Date.now() - lastDataTime > this.timeout) {
              log.error(`${this.name} 流式连接中断`)
              fail({ success: false, error: t('连接中断，请稍后重试'), retryable: true })
              req.cancel()
            }
          }, 5000)

          if (res.statusCode !== 200) {
            let errorBody = ''
            res.on('data', (chunk) => {
              if (errorBody.length >= 8192) return
              errorBody += decoder.decode(chunk, { stream: true })
            })
            res.on('end', () => {
              const text = errorBody.trim()
              const message =
                extractErrorMessage(parseJsonSafe(text)) ||
                text.slice(0, 300) ||
                t('请求失败: {p0}', { p0: res.statusCode })
              log.error(`${this.name} 流式请求失败: ${res.statusCode} ${message}`)
              fail({
                success: false,
                error: message,
                status: res.statusCode,
                errorBody: text.slice(0, 2000),
                retryable: isRetryableStatus(res.statusCode)
              })
            })
            return
          }

          res.on('data', (chunk) => {
            if (shouldStop()) {
              stop()
              return
            }

            lastDataTime = Date.now()
            buffer += decoder.decode(chunk, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue

                try {
                  const json = JSON.parse(data)
                  if (json.usage) streamUsage = json.usage
                  const delta = json.choices?.[0]?.delta

                  const reasoning = delta?.reasoning_content || delta?.reasoning
                  if (typeof reasoning === 'string' && reasoning) {
                    fullThinking += reasoning
                    if (onChunk) onChunk({ kind: 'thinking', text: reasoning })
                  }

                  if (delta?.content) {
                    fullContent += delta.content
                    if (onChunk) onChunk({ kind: 'content', text: delta.content })
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
                } catch {
                  // 忽略解析错误
                }
              }
            }
          })

          res.on('end', () => {
            if (settled) return

            if (shouldStop()) {
              stop()
              return
            }

            const validToolCalls = toolCalls.filter((tc) => tc && tc.function?.name)

            finish({
              success: true,
              content: fullContent,
              thinking: fullThinking,
              tool_calls: validToolCalls.length > 0 ? validToolCalls : undefined,
              usage: streamUsage
            })
          })
        }
      )

      req.on('error', (e) => {
        if (settled) return

        log.error(`${this.name} 流式请求网络错误:`, e)

        let errorMessage = t('网络请求失败: {p0}', { p0: e.message })
        if (e.code === 'ENOTFOUND') {
          errorMessage = t('无法连接到服务器 ({p0})，请检查网络连接', { p0: this.hostname })
        } else if (e.code === 'ECONNREFUSED') {
          errorMessage = t('连接被拒绝，服务器可能不可用')
        } else if (e.code === 'ETIMEDOUT' || e.code === 'ESOCKETTIMEDOUT') {
          errorMessage = t('连接超时，请检查网络或稍后重试')
        }

        fail({ success: false, error: errorMessage, code: e.code, retryable: isRetryableNetworkCode(e.code) })
      })

      stopWatcher = setInterval(() => {
        if (shouldStop()) stop()
      }, 300)

      req.write(JSON.stringify(requestBody))
      req.end()
    })
  }

  async validateApiKey() {
    if (!this.validateWithChat && this.modelsPath) {
      const result = await this.requestModels()
      if (result.success) return { valid: true, status: 200, error: '' }
      if (result.status !== 404 && result.status !== 405) {
        return { valid: false, status: result.status || 0, error: result.error || '' }
      }
    }

    const requestBody = {
      model: this.validateModel,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }

    const result = await this.makeRequest(this.hostname, this.port, this.path, requestBody)
    if (result.success) return { valid: true, status: 200, error: '' }
    return { valid: false, status: result.status || 0, error: result.error || '' }
  }

  async listRemoteModels(apiKey = this.apiKey) {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, models: [], error: t('API Key 未配置') }
    }
    if (!this.modelsPath) {
      return { success: false, models: [], error: t('{p0} 不支持在线获取模型列表', { p0: this.name }) }
    }

    const result = await this.requestModels(apiKey.trim())
    if (!result.success) return { ...result, models: [] }

    const models = parseModelList(result.data)
    if (models.length === 0) {
      return { success: false, models: [], error: t('服务商未返回可用的对话模型') }
    }
    return { success: true, models, error: null }
  }

  requestModels(apiKey = this.apiKey) {
    return new Promise((resolve) => {
      const req = createRequest(
        this.protocol,
        {
          hostname: this.hostname,
          port: this.port,
          path: this.modelsPath,
          method: 'GET',
          headers: this.getHeaders({ Accept: 'application/json' }, apiKey)
        },
        (res) => {
          const decoder = new TextDecoder('utf-8')
          let data = ''
          res.on('data', (chunk) => {
            data += decoder.decode(chunk, { stream: true })
          })
          res.on('end', () => {
            data += decoder.decode()
            clearTimeout(timer)
            let payload
            try {
              payload = JSON.parse(data)
            } catch {
              payload = null
            }

            if (res.statusCode !== 200) {
              const error = extractErrorMessage(payload) || t('请求失败: {p0}', { p0: res.statusCode })
              log.warn(`${this.name} 模型列表请求失败: ${res.statusCode} ${error}`)
              resolve({ success: false, error, status: res.statusCode })
              return
            }

            if (!payload) {
              resolve({ success: false, error: t('解析模型列表失败'), status: res.statusCode })
              return
            }

            resolve({ success: true, data: payload, status: res.statusCode })
          })
        }
      )

      const timer = setTimeout(() => {
        req.cancel()
        resolve({ success: false, error: t('获取模型列表超时'), status: 0 })
      }, this.connectionTimeout)

      req.on('error', (e) => {
        clearTimeout(timer)
        let errorMessage = t('网络请求失败: {p0}', { p0: e.message })
        if (e.code === 'ENOTFOUND') errorMessage = t('无法连接到服务器 ({p0})，请检查网络连接', { p0: this.hostname })
        if (e.code === 'ECONNREFUSED') errorMessage = t('连接被拒绝，服务器可能不可用')
        resolve({ success: false, error: errorMessage, status: 0 })
      })
      req.end()
    })
  }

  async makeRequest(hostname, port, path, requestBody, retryOptions = {}) {
    return withRetry(() => this.makeRequestOnce(hostname, port, path, requestBody, retryOptions), {
      retries: Number.isInteger(retryOptions.retries) ? retryOptions.retries : this.maxRetries,
      baseDelay: retryOptions.baseDelay,
      maxDelay: retryOptions.maxDelay,
      shouldStop: retryOptions.shouldStop,
      onRetry: retryOptions.onRetry
    })
  }

  async makeRequestOnce(hostname, port, path, requestBody, options = {}) {
    return new Promise((resolve) => {
      const req = createRequest(
        this.protocol,
        {
          hostname,
          port: port || this.port || 443,
          path,
          method: 'POST',
          headers: this.getHeaders({}, this.apiKey, options)
        },
        (res) => {
          const decoder = new TextDecoder('utf-8')
          let data = ''
          res.on('data', (chunk) => {
            data += decoder.decode(chunk, { stream: true })
          })
          res.on('end', () => {
            data += decoder.decode()
            clearTimeout(timeoutTimer)
            const responseData = parseJsonSafe(data)
            if (res.statusCode !== 200) {
              const text = data.trim()
              const message =
                extractErrorMessage(responseData) || text.slice(0, 300) || t('请求失败: {p0}', { p0: res.statusCode })
              log.error(`${this.name} API 错误: ${res.statusCode} ${message}`)
              resolve({
                success: false,
                error: message,
                status: res.statusCode,
                errorBody: text.slice(0, 2000),
                retryable: isRetryableStatus(res.statusCode)
              })
              return
            }
            if (!responseData) {
              log.error('解析响应失败:', data.slice(0, 200))
              resolve({ success: false, error: t('解析响应失败'), status: res.statusCode })
              return
            }
            resolve({ success: true, data: responseData })
          })
        }
      )

      const timeoutTimer = setTimeout(() => {
        req.cancel()
        log.error(`${this.name} API 请求超时`)
        resolve({
          success: false,
          error: t('请求超时（{p0}秒），请检查网络连接或稍后重试', { p0: this.timeout / 1000 }),
          retryable: true
        })
      }, this.timeout)

      req.on('error', (e) => {
        clearTimeout(timeoutTimer)
        log.error(`${this.name} API 请求失败:`, e)

        let errorMessage = t('网络请求失败: {p0}', { p0: e.message })
        if (e.code === 'ENOTFOUND') {
          errorMessage = t('无法连接到服务器 ({p0})，请检查网络连接', { p0: hostname })
        } else if (e.code === 'ECONNREFUSED') {
          errorMessage = t('连接被拒绝，服务器可能不可用')
        } else if (e.code === 'ETIMEDOUT' || e.code === 'ESOCKETTIMEDOUT') {
          errorMessage = t('连接超时，请检查网络或稍后重试')
        }

        resolve({ success: false, error: errorMessage, retryable: isRetryableNetworkCode(e.code) })
      })

      req.write(JSON.stringify(requestBody))
      req.end()
    })
  }
}

const NON_CHAT_MODEL_PATTERN =
  /embed|bge-|gte-|rerank|tts|asr|speech|whisper|cosyvoice|sambert|paraformer|wanx|stable-diffusion|flux|image|video|\baudio\b|music|voice|ocr/i

function extractErrorMessage(payload) {
  if (!payload) return ''
  if (typeof payload.error === 'string') return payload.error
  return payload.error?.message || payload.message || payload.msg || ''
}

function parseJsonSafe(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeModelItem(item) {
  if (!item || typeof item !== 'object') return null
  if (item.domain && !/llm|vlm|language|chat/i.test(String(item.domain))) return null

  const id = String(item.id || item.model || item.model_id || item.modelId || item.ModelId || '').trim()
  if (!id || NON_CHAT_MODEL_PATTERN.test(id)) return null

  const name = String(item.name || item.display_name || item.displayName || '').trim()
  const model = { id, name: name && name !== id ? name : id }

  const contextWindow = Number(item.limit?.context ?? item.max_input_tokens)
  if (Number.isFinite(contextWindow) && contextWindow > 0) model.contextWindow = Math.floor(contextWindow)
  const maxOutput = Number(item.limit?.output ?? item.max_tokens ?? item.max_output_tokens)
  if (Number.isFinite(maxOutput) && maxOutput > 0) model.maxOutput = Math.floor(maxOutput)

  const inputs = item.modalities?.input
  if (Array.isArray(inputs)) {
    const hasImage = inputs.some((type) => /^image\//i.test(String(type)))
    model.inputTypes = hasImage ? ['text', 'image'] : ['text']
  }

  return model
}

function parseModelList(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.data ||
      payload?.models ||
      payload?.model_list ||
      payload?.Result?.Models ||
      payload?.result?.models ||
      []

  if (!Array.isArray(list)) return []

  const seen = new Set()
  const models = []
  for (const item of list) {
    const model = normalizeModelItem(item)
    if (!model || seen.has(model.id)) continue
    seen.add(model.id)
    models.push(model)
  }
  return models
}

export default BaseProvider
