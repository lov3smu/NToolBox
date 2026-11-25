import {
  AUTO_PRIORITY,
  PROVIDER_INFO,
  createProvider,
  getProviderEnvApiKey,
  resolveProviderDefaultModel,
  resolveProviderRuntimeConfig
} from './index.js'

const MAX_AUTO_TARGETS = 3
const MAX_TARGETS = 5

export function normalizeFallbackTarget(value) {
  if (typeof value !== 'string') return null
  const separator = value.indexOf(':')
  if (separator <= 0) return null
  const provider = value.slice(0, separator).trim().toLowerCase()
  const model = value.slice(separator + 1).trim()
  if (!provider || !model) return null
  return { provider, model }
}

export function resolveFallbackTargets(config, primaryType, primaryModel) {
  if (!config || config.ai?.fallback?.enabled === false) return []

  const targets = []
  const seen = new Set()
  const push = (type, model) => {
    if (!type || !model) return
    const key = `${type}:${model}`
    if (key === `${primaryType}:${primaryModel}` || seen.has(key)) return
    seen.add(key)
    targets.push({ provider: type, model })
  }

  const configured = Array.isArray(config.ai?.fallback?.models) ? config.ai?.fallback?.models : []
  if (configured.length > 0) {
    for (const item of configured) {
      const target = normalizeFallbackTarget(item)
      if (target) push(target.provider, target.model)
    }
    return targets.slice(0, MAX_TARGETS)
  }

  const apiKeys = config.ai?.keys || {}
  for (const type of AUTO_PRIORITY) {
    if (type === primaryType || !PROVIDER_INFO[type]) continue
    const storedKey = typeof apiKeys[type] === 'string' ? apiKeys[type].trim() : ''
    if (!storedKey && !getProviderEnvApiKey(type)) continue
    push(type, resolveProviderDefaultModel(type, config.ai?.models))
    if (targets.length >= MAX_AUTO_TARGETS) break
  }
  return targets
}

export function createFallbackProviders(config, primaryType, primaryModel) {
  const providers = []
  for (const target of resolveFallbackTargets(config, primaryType, primaryModel)) {
    if (!PROVIDER_INFO[target.provider]) continue
    const runtime = resolveProviderRuntimeConfig(target.provider, config)
    if (!runtime.apiKey && PROVIDER_INFO[target.provider].requiresApiKey !== false) continue
    const provider = createProvider(target.provider, runtime)
    if (!provider || !provider.validateConfig().valid) continue
    const model = target.model || provider.getDefaultModel()
    if (!model) continue
    providers.push({
      provider,
      model,
      type: target.provider,
      name: PROVIDER_INFO[target.provider].name
    })
  }
  return providers
}
