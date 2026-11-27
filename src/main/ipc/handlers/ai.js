import { validateApiKey, getProviderModels, getAiProviderCatalog } from '../../services/agent/chat.js'
import { getConfig } from '../../services/config.js'
import { cancelInlineAi, runInlineAi } from '../../services/ai/inline.js'
import { IPC_CHANNELS } from '../../../shared/ipc'

export function registerAiHandlers(handle) {
  handle(IPC_CHANNELS.validateApiKey, async (_event, providerType, apiKey, extraConfig) => {
    return await validateApiKey(providerType, apiKey, extraConfig)
  })

  handle(IPC_CHANNELS.getAiApiKey, async (_event, providerType) => {
    if (typeof providerType !== 'string' || !providerType) return ''
    const value = getConfig().ai?.keys?.[providerType]
    return typeof value === 'string' ? value : ''
  })

  handle(IPC_CHANNELS.getAiProviders, async () => {
    return getAiProviderCatalog()
  })

  handle(IPC_CHANNELS.getProviderModels, async (_event, providerType, options) => {
    return getProviderModels(providerType, options)
  })

  handle(IPC_CHANNELS.inlineAi, async (_event, payload) => {
    return await runInlineAi(payload)
  })

  handle(IPC_CHANNELS.cancelInlineAi, async (_event, requestId) => {
    return cancelInlineAi(requestId)
  })
}
