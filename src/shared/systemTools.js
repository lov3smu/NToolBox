export const PORT_SOURCES = Object.freeze(['ss', 'netstat', 'netstat-win', 'lsof'])

export const PORT_LIST_LIMIT = 1000

export const SSL_DEFAULT_PORT = 443

export function parsePortAddress(value) {
  if (typeof value !== 'string' || !value) return null
  const trimmed = value.trim()
  const separator = trimmed.lastIndexOf(':')
  if (separator === -1) return null
  const rawAddress = trimmed.slice(0, separator)
  const rawPort = trimmed.slice(separator + 1)
  if (!/^\d+$/.test(rawPort)) return null
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null
  const address = rawAddress.replace(/^\[|\]$/g, '').replace(/%[a-z0-9]+$/i, '') || '*'
  return { address, port }
}

export function normalizePortEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const protocol = raw.protocol === 'udp' ? 'udp' : raw.protocol === 'tcp' ? 'tcp' : ''
  if (!protocol) return null
  const port = Number(raw.port)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null
  const address = typeof raw.address === 'string' && raw.address.trim() ? raw.address.trim().slice(0, 120) : '*'
  const pidValue = Number(raw.pid)
  const pid = Number.isInteger(pidValue) && pidValue > 0 ? pidValue : null
  const process = typeof raw.process === 'string' ? raw.process.trim().slice(0, 120) : ''
  return { protocol, address, port, pid, process }
}

export function normalizePortList(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const items = []
  for (const entry of raw) {
    const normalized = normalizePortEntry(entry)
    if (!normalized) continue
    const key = `${normalized.protocol}|${normalized.address}|${normalized.port}|${normalized.pid ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(normalized)
    if (items.length >= PORT_LIST_LIMIT) break
  }
  return items.sort((left, right) => left.port - right.port || left.protocol.localeCompare(right.protocol))
}

function protocolOf(value) {
  const lower = String(value || '').toLowerCase()
  if (lower.startsWith('tcp')) return 'tcp'
  if (lower.startsWith('udp')) return 'udp'
  return ''
}

function parseSsLine(line) {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 5) return null
  const protocol = protocolOf(parts[0])
  if (!protocol) return null
  const state = parts[1]
  if (protocol === 'tcp' && state !== 'LISTEN') return null
  const parsed = parsePortAddress(parts[4])
  if (!parsed) return null
  const processMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/)
  return {
    protocol,
    address: parsed.address,
    port: parsed.port,
    pid: processMatch ? Number(processMatch[2]) : null,
    process: processMatch ? processMatch[1] : ''
  }
}

function parseNetstatLine(line) {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 4) return null
  const protocol = protocolOf(parts[0])
  if (!protocol) return null
  const parsed = parsePortAddress(parts[3])
  if (!parsed) return null
  const pidMatch = line.match(/(\d+)\/([^\s]+)\s*$/)
  if (protocol === 'tcp' && !/\bLISTEN\b/.test(line)) return null
  return {
    protocol,
    address: parsed.address,
    port: parsed.port,
    pid: pidMatch ? Number(pidMatch[1]) : null,
    process: pidMatch ? pidMatch[2] : ''
  }
}

export function parseNetstatWindows(text, processNames = {}) {
  if (typeof text !== 'string') return []
  const items = []
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 4) continue
    const protocol = protocolOf(parts[0])
    if (!protocol) continue
    const parsed = parsePortAddress(parts[1])
    if (!parsed) continue
    const pidValue = Number(parts[parts.length - 1])
    const pid = Number.isInteger(pidValue) && pidValue > 0 ? pidValue : null
    if (protocol === 'tcp' && !/LISTENING/i.test(parts[3])) continue
    items.push({
      protocol,
      address: parsed.address,
      port: parsed.port,
      pid,
      process: (pid && processNames[pid]) || ''
    })
  }
  return normalizePortList(items)
}

export function parseTasklist(text) {
  const names = {}
  if (typeof text !== 'string') return names
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^"([^"]+)","(\d+)"/)
    if (match) names[Number(match[2])] = match[1]
  }
  return names
}

function parseLsofLine(line) {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 9) return null
  const pid = Number(parts[1])
  if (!Number.isInteger(pid) || pid <= 0) return null
  const protocolIndex = parts.findIndex((part, index) => index >= 7 && (part === 'TCP' || part === 'UDP'))
  if (protocolIndex === -1) return null
  const protocol = parts[protocolIndex] === 'UDP' ? 'udp' : 'tcp'
  if (protocol === 'tcp' && !/\(LISTEN\)/.test(line)) return null
  const parsed = parsePortAddress(parts[protocolIndex + 1])
  if (!parsed) return null
  return {
    protocol,
    address: parsed.address,
    port: parsed.port,
    pid,
    process: parts[0]
  }
}

export function parseListeningPorts(text, source) {
  if (typeof text !== 'string') return []
  const items = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    let entry = null
    if (source === 'ss') entry = parseSsLine(line)
    else if (source === 'netstat') entry = parseNetstatLine(line)
    else if (source === 'lsof') entry = parseLsofLine(line)
    if (entry) items.push(entry)
  }
  return normalizePortList(items)
}

export function normalizeSslTarget(raw) {
  let host = ''
  let port = SSL_DEFAULT_PORT
  let servername = ''

  if (typeof raw === 'string') {
    host = raw.trim()
  } else if (raw && typeof raw === 'object') {
    host = typeof raw.host === 'string' ? raw.host.trim() : ''
    if (raw.port !== undefined && raw.port !== '') {
      const value = Number(raw.port)
      if (!Number.isInteger(value) || value <= 0 || value > 65535) return null
      port = value
    }
    servername = typeof raw.servername === 'string' ? raw.servername.trim() : ''
  }

  if (!host || host.length > 500) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) {
    let parsed
    try {
      parsed = new URL(host)
    } catch {
      return null
    }
    if (!/^https?:$/.test(parsed.protocol)) return null
    host = parsed.hostname
    if (parsed.port) port = Number(parsed.port)
  } else if ((host.match(/:/g) || []).length === 1 || host.startsWith('[')) {
    const parsed = parsePortAddress(host)
    if (!parsed) return null
    host = parsed.address
    port = parsed.port
  }

  host = host.replace(/^\[|\]$/g, '')
  if (!host || !/^[a-z0-9._:-]+$/i.test(host)) return null
  if (servername && (servername.length > 253 || !/^[a-z0-9._-]+$/i.test(servername))) return null
  return { host, port, servername }
}

export function normalizeCertificateInfo(raw) {
  if (!raw || typeof raw !== 'object') return { success: false, error: 'invalid-input' }
  if (!raw.success) {
    return {
      success: false,
      error: typeof raw.error === 'string' ? raw.error.slice(0, 300) : 'request-failed'
    }
  }
  const daysRemaining = Number(raw.daysRemaining)
  const chainLength = Number(raw.chainLength)
  return {
    success: true,
    host: typeof raw.host === 'string' ? raw.host.slice(0, 255) : '',
    port: Number.isInteger(Number(raw.port)) ? Number(raw.port) : SSL_DEFAULT_PORT,
    protocol: typeof raw.protocol === 'string' ? raw.protocol.slice(0, 40) : '',
    authorized: Boolean(raw.authorized),
    authorizationError: typeof raw.authorizationError === 'string' ? raw.authorizationError.slice(0, 300) : '',
    subject: typeof raw.subject === 'string' ? raw.subject.slice(0, 500) : '',
    issuer: typeof raw.issuer === 'string' ? raw.issuer.slice(0, 500) : '',
    validFrom: typeof raw.validFrom === 'string' ? raw.validFrom.slice(0, 60) : '',
    validTo: typeof raw.validTo === 'string' ? raw.validTo.slice(0, 60) : '',
    daysRemaining: Number.isFinite(daysRemaining) ? Math.trunc(daysRemaining) : null,
    serialNumber: typeof raw.serialNumber === 'string' ? raw.serialNumber.slice(0, 120) : '',
    fingerprint256: typeof raw.fingerprint256 === 'string' ? raw.fingerprint256.slice(0, 200) : '',
    subjectAltName: typeof raw.subjectAltName === 'string' ? raw.subjectAltName.slice(0, 2000) : '',
    chainLength: Number.isFinite(chainLength) ? Math.max(1, Math.trunc(chainLength)) : 1
  }
}
