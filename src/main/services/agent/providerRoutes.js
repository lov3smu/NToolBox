import { log } from '../../utils'
import { getConfig } from '../config.js'
import { getProvider, resolveProviderRuntimeConfig } from '../ai/index.js'
import { normalizeScenarioModels, parseScenarioModel } from '../../../shared/aiBehavior.js'

export function getProviderConfig(providerTypeArg) {
  const config = getConfig()
  const providerType = providerTypeArg || config.ai.provider || 'bailian'
  return {
    providerType,
    providerConfig: resolveProviderRuntimeConfig(providerType, config)
  }
}

export function resolveScenarioRoute(key) {
  const config = getConfig()
  const parsed = parseScenarioModel(normalizeScenarioModels(config.ai.agent.scenario_models)[key])
  if (!parsed) return null

  const provider = getProvider(parsed.provider, resolveProviderRuntimeConfig(parsed.provider, config))
  if (!provider) return null

  const validation = provider.validateConfig()
  if (!validation.valid) {
    log.warn(`分场景模型 ${parsed.provider}:${parsed.model} 不可用：${validation.error}`)
    return null
  }
  return { provider, model: parsed.model, type: parsed.provider }
}
