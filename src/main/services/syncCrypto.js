import crypto from 'node:crypto'
import { SYNC_FORMAT, SYNC_VERSION } from '../../shared/syncBundle.js'

const SALT_LENGTH = 16
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, KEY_LENGTH)
}

export function encryptSnapshotText(body, passphrase) {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = deriveKey(passphrase, salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()])
  return JSON.stringify({
    type: SYNC_FORMAT,
    version: SYNC_VERSION,
    encrypted: true,
    cipher: {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64')
    }
  })
}

export function isEncryptedSnapshot(payload) {
  return Boolean(payload) && typeof payload === 'object' && payload.encrypted === true
}

export function decryptSnapshotText(payload, passphrase) {
  if (!isEncryptedSnapshot(payload) || !passphrase) return null
  const cipher = payload.cipher
  if (!cipher || typeof cipher.salt !== 'string' || typeof cipher.iv !== 'string') return null
  try {
    const salt = Buffer.from(cipher.salt, 'base64')
    const iv = Buffer.from(cipher.iv, 'base64')
    const tag = Buffer.from(cipher.tag || '', 'base64')
    if (salt.length !== SALT_LENGTH || iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null
    const key = deriveKey(passphrase, salt)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const data = Buffer.concat([decipher.update(Buffer.from(cipher.data || '', 'base64')), decipher.final()])
    return data.toString('utf8')
  } catch {
    return null
  }
}
