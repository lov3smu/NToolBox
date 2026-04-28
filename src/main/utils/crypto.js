import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import log from './logger'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const ENCRYPTED_PREFIX = 'enc:'

let encryptionKey = null

function getKeyPath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, '.dbkey')
}

async function generateAndSaveKey() {
  const key = crypto.randomBytes(KEY_LENGTH)
  const keyPath = getKeyPath()
  await fs.promises.writeFile(keyPath, key.toString('base64'), 'utf8')
  return key
}

async function loadOrGenerateKey() {
  try {
    const keyPath = getKeyPath()
    const keyBase64 = await fs.promises.readFile(keyPath, 'utf8')
    const key = Buffer.from(keyBase64.trim(), 'base64')
    if (key.length !== KEY_LENGTH) {
      log.warn('加密密钥长度不正确，重新生成')
      return await generateAndSaveKey()
    }
    return key
  } catch (error) {
    if (error.code === 'ENOENT') {
      log.info('加密密钥不存在，生成新密钥')
      return await generateAndSaveKey()
    }
    log.error('加载加密密钥失败:', error)
    throw error
  }
}

export async function initCrypto() {
  encryptionKey = await loadOrGenerateKey()
  log.info('加密模块初始化完成')
}

export function encrypt(plaintext) {
  if (!encryptionKey) {
    throw new Error('加密模块未初始化')
  }
  if (!plaintext || typeof plaintext !== 'string') {
    return ''
  }
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    const authTag = cipher.getAuthTag()
    
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64')
    ])
    
    return ENCRYPTED_PREFIX + combined.toString('base64')
  } catch (error) {
    log.error('加密失败:', error)
    throw error
  }
}

export function decrypt(ciphertext) {
  if (!encryptionKey) {
    throw new Error('加密模块未初始化')
  }
  if (!ciphertext || typeof ciphertext !== 'string') {
    return ''
  }
  
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    return ciphertext
  }
  
  try {
    const encryptedData = ciphertext.slice(ENCRYPTED_PREFIX.length)
    const combined = Buffer.from(encryptedData, 'base64')
    
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
    
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    log.error('解密失败:', error)
    return ''
  }
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)
}

export function encryptDbPassword(password) {
  if (!password) return ''
  if (isEncrypted(password)) return password
  return encrypt(password)
}

export function decryptDbPassword(password) {
  if (!password) return ''
  if (!isEncrypted(password)) return password
  return decrypt(password)
}