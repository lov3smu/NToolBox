import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const PREFIX = 'enc:'

export function parseKey(text) {
  const key = Buffer.from(String(text || '').trim(), 'base64')
  return key.length === KEY_LENGTH ? key : null
}

export function isEncryptedValue(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

// 返回明文；密钥不匹配或密文损坏时返回 null
export function decryptWithKey(key, ciphertext) {
  if (!key || !isEncryptedValue(ciphertext)) return null
  try {
    const combined = Buffer.from(ciphertext.slice(PREFIX.length), 'base64')
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH), undefined, 'utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

export function findEncryptedValue(node) {
  if (typeof node === 'string') return isEncryptedValue(node) ? node : null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findEncryptedValue(item)
      if (found) return found
    }
    return null
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      const found = findEncryptedValue(value)
      if (found) return found
    }
  }
  return null
}
