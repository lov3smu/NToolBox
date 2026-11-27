import { t } from '../i18n.js'

export const connections = new Map()
export const transactions = new Map()
export const runningQueries = new Map()

export function getEntry(name) {
  const entry = connections.get(name)
  if (!entry) {
    throw new Error(t('连接不存在，请先创建连接'))
  }
  return entry
}

export function getActiveConnections() {
  return Array.from(connections.keys())
}

export function isConnectionActive(name) {
  return connections.has(name)
}

export function isTransactionActive(name) {
  return transactions.has(name)
}
