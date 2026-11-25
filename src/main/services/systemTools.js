import { execFile } from 'node:child_process'
import { isIP } from 'node:net'
import tls from 'node:tls'
import {
  normalizeCertificateInfo,
  normalizePortList,
  normalizeSslTarget,
  parseListeningPorts,
  parseNetstatWindows,
  parseTasklist
} from '../../shared/systemTools.js'

const COMMAND_TIMEOUT_MS = 6000
const SSL_TIMEOUT_MS = 10000
const MAX_OUTPUT = 8 * 1024 * 1024

function runCommand(file, args, timeout = COMMAND_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, maxBuffer: MAX_OUTPUT, windowsHide: true }, (error, stdout) => {
      if (error?.code === 'ENOENT') {
        resolve(null)
        return
      }
      resolve(typeof stdout === 'string' ? stdout : '')
    })
  })
}

async function collectPosixPorts() {
  const attempts = [
    { command: 'ss', args: ['-tulpn'], source: 'ss' },
    { command: 'netstat', args: ['-tulpn'], source: 'netstat' }
  ]
  for (const attempt of attempts) {
    const output = await runCommand(attempt.command, attempt.args)
    if (output === null) continue
    const items = parseListeningPorts(output, attempt.source)
    if (items.length) return { items, source: attempt.source }
  }
  return { items: [], source: '' }
}

async function collectLsofPorts() {
  const tcp = await runCommand('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'])
  const udp = await runCommand('lsof', ['-nP', '-iUDP'])
  const items = normalizePortList([
    ...parseListeningPorts(tcp || '', 'lsof'),
    ...parseListeningPorts(udp || '', 'lsof')
  ])
  return { items, source: items.length ? 'lsof' : '' }
}

async function collectWindowsPorts() {
  const output = await runCommand('netstat', ['-ano'])
  if (output === null) return { items: [], source: '' }
  const tasklist = (await runCommand('tasklist', ['/fo', 'csv', '/nh'])) || ''
  const items = parseNetstatWindows(output, parseTasklist(tasklist))
  return { items, source: items.length ? 'netstat' : '' }
}

export async function listListeningPorts() {
  try {
    const result =
      process.platform === 'win32'
        ? await collectWindowsPorts()
        : process.platform === 'darwin'
          ? await collectLsofPorts()
          : await collectPosixPorts()
    if (!result.source && !result.items.length) {
      return { success: false, error: 'command-unavailable', items: [] }
    }
    return { success: true, items: result.items, source: result.source, platform: process.platform }
  } catch {
    return { success: false, error: 'command-failed', items: [] }
  }
}

function certificateName(name) {
  if (!name || typeof name !== 'object') return ''
  const parts = [name.CN, name.O, name.C].filter((value) => typeof value === 'string' && value.trim())
  return parts.join(' · ')
}

function chainLengthOf(certificate) {
  let length = 1
  const seen = new Set()
  let current = certificate?.issuerCertificate
  while (current && typeof current === 'object' && length < 10) {
    const key = current.fingerprint256 || current.serialNumber
    if (!key || seen.has(key)) break
    seen.add(key)
    length += 1
    current = current.issuerCertificate
  }
  return length
}

function sslErrorCode(error) {
  const code = String(error?.code || '')
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns-not-found'
  if (code === 'ECONNREFUSED') return 'connection-refused'
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') return 'timeout'
  if (code === 'ECONNRESET') return 'connection-reset'
  if (
    code.startsWith('CERT_') ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
  ) {
    return 'certificate-invalid'
  }
  return 'request-failed'
}

export function checkCertificate(input) {
  const target = normalizeSslTarget(input)
  if (!target) return Promise.resolve({ success: false, error: 'invalid-target' })

  return new Promise((resolve) => {
    let settled = false
    const socket = tls.connect(
      {
        host: target.host,
        port: target.port,
        servername: target.servername || (isIP(target.host) ? undefined : target.host),
        rejectUnauthorized: false,
        timeout: SSL_TIMEOUT_MS
      },
      () => {
        try {
          const certificate = socket.getPeerCertificate(true)
          if (!certificate || !certificate.valid_to) {
            finish({ success: false, error: 'no-certificate' })
            return
          }
          const validTo = new Date(certificate.valid_to).getTime()
          finish(
            normalizeCertificateInfo({
              success: true,
              host: target.host,
              port: target.port,
              protocol: socket.getProtocol() || '',
              authorized: socket.authorized,
              authorizationError: socket.authorizationError ? String(socket.authorizationError) : '',
              subject: certificateName(certificate.subject),
              issuer: certificateName(certificate.issuer),
              validFrom: Number.isFinite(new Date(certificate.valid_from).getTime())
                ? new Date(certificate.valid_from).toISOString()
                : '',
              validTo: Number.isFinite(validTo) ? new Date(validTo).toISOString() : '',
              daysRemaining: Number.isFinite(validTo) ? Math.floor((validTo - Date.now()) / 86400000) : null,
              serialNumber: certificate.serialNumber || '',
              fingerprint256: certificate.fingerprint256 || '',
              subjectAltName: certificate.subjectaltname || '',
              chainLength: chainLengthOf(certificate)
            })
          )
        } catch {
          finish({ success: false, error: 'read-failed' })
        }
      }
    )

    function finish(result) {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    socket.on('timeout', () => finish({ success: false, error: 'timeout' }))
    socket.on('error', (error) => finish({ success: false, error: sslErrorCode(error) }))
  })
}
