import { IMAGE_HOST_PROVIDERS } from './imageHosts.js'

export const SECRET_MASK = '********'

export function isSecretMask(value) {
  return value === SECRET_MASK
}

export function maskSecret(value) {
  return typeof value === 'string' && value.trim() ? SECRET_MASK : ''
}

function isPasswordField(field) {
  return field?.type === 'password'
}

export function maskAiApiKeys(keys) {
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return {}
  const result = {}
  for (const [name, value] of Object.entries(keys)) result[name] = maskSecret(value)
  return result
}

export function maskImageHostSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return settings
  const result = JSON.parse(JSON.stringify(settings))
  if (!result.providers || typeof result.providers !== 'object') return result
  for (const provider of IMAGE_HOST_PROVIDERS) {
    const values = result.providers[provider.id]
    if (!values || typeof values !== 'object') continue
    for (const field of provider.fields) {
      if (!isPasswordField(field)) continue
      values[field.key] = maskSecret(values[field.key])
    }
  }
  return result
}

export function maskConfigForRenderer(config) {
  if (!config || typeof config !== 'object') return config
  return {
    ...config,
    ai: {
      ...config.ai,
      keys: maskAiApiKeys(config.ai?.keys)
    },
    image_hosting: maskImageHostSettings(config.image_hosting)
  }
}

export function restoreMaskedAiApiKeys(input, stored) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const result = { ...input }
  for (const [name, value] of Object.entries(result)) {
    if (!isSecretMask(value)) continue
    result[name] = typeof stored?.[name] === 'string' ? stored[name] : ''
  }
  return result
}

export function restoreMaskedImageHostSettings(input, stored) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const result = JSON.parse(JSON.stringify(input))
  const providers = result.providers
  if (!providers || typeof providers !== 'object') return result
  for (const provider of IMAGE_HOST_PROVIDERS) {
    const values = providers[provider.id]
    if (!values || typeof values !== 'object') continue
    for (const field of provider.fields) {
      if (!isPasswordField(field) || !isSecretMask(values[field.key])) continue
      const storedValue = stored?.providers?.[provider.id]?.[field.key]
      values[field.key] = typeof storedValue === 'string' ? storedValue : ''
    }
  }
  return result
}

export function transformImageHostSecrets(settings, transform) {
  if (!settings || typeof settings !== 'object') return settings
  const providers = settings.providers
  if (!providers || typeof providers !== 'object') return settings
  for (const provider of IMAGE_HOST_PROVIDERS) {
    const values = providers[provider.id]
    if (!values || typeof values !== 'object') continue
    for (const field of provider.fields) {
      if (!isPasswordField(field)) continue
      const value = values[field.key]
      if (typeof value === 'string' && value) values[field.key] = transform(value)
    }
  }
  return settings
}
