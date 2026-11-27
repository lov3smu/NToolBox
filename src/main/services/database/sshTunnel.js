import { spawn } from 'child_process'
import fs from 'fs'
import net from 'net'
import { log } from '../../utils'

const tunnels = new Map()

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const attempt = () => {
      const socket = net.connect({ host: '127.0.0.1', port })
      socket.setTimeout(800)
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('timeout', () => {
        socket.destroy()
        retry()
      })
      socket.once('error', () => {
        socket.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() >= deadline) {
        resolve(false)
        return
      }
      setTimeout(attempt, 180)
    }
    attempt()
  })
}

function killProcess(child) {
  if (!child || child.killed || child.exitCode !== null) return
  try {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    } else {
      child.kill('SIGTERM')
    }
  } catch (error) {
    log.warn('关闭 SSH 隧道进程失败:', error.message)
  }
}

export async function createSshTunnel(key, config) {
  const ssh = config.ssh || {}
  const sshHost = String(ssh.host || '').trim()
  const sshUser = String(ssh.user || '').trim()
  if (!sshHost || !sshUser) throw new Error('SSH 隧道需要填写跳板机地址与用户名')

  const sshPort = Number(ssh.port) || 22
  const targetHost = String(config.host || '127.0.0.1').trim()
  const targetPort = Number(config.port) || 3306
  const keyPath = String(ssh.keyPath || '').trim()

  if (keyPath && !fs.existsSync(keyPath)) throw new Error(`SSH 私钥不存在: ${keyPath}`)

  const localPort = await getFreePort()
  const args = [
    '-N',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=10',
    '-p',
    String(sshPort),
    '-L',
    `127.0.0.1:${localPort}:${targetHost}:${targetPort}`
  ]
  if (keyPath) args.push('-i', keyPath, '-o', 'IdentitiesOnly=yes')
  args.push(`${sshUser}@${sshHost}`)

  const child = spawn('ssh', args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-2000)
  })

  const exited = new Promise((resolve) => {
    child.once('error', (error) => resolve(error))
    child.once('exit', (code) => resolve(code === null ? 'ssh 进程已退出' : `ssh 进程退出码 ${code}`))
  })

  const ready = await Promise.race([waitForPort(localPort, 12000).then((ok) => (ok ? null : '隧道连接超时')), exited])
  if (ready) {
    killProcess(child)
    if (ready instanceof Error && ready.code === 'ENOENT') {
      throw new Error('未找到 ssh 命令，请先安装 OpenSSH 客户端')
    }
    const detail = typeof ready === 'string' ? ready : ready.message
    throw new Error(`SSH 隧道建立失败: ${detail}${stderr ? ` (${stderr.trim()})` : ''}`)
  }

  const tunnel = {
    child,
    localPort,
    close: () => {
      killProcess(child)
      tunnels.delete(key)
    }
  }
  child.once('exit', () => tunnels.delete(key))
  tunnels.set(key, tunnel)
  log.info(`SSH 隧道已建立: ${key} -> ${sshUser}@${sshHost}:${sshPort} => ${targetHost}:${targetPort}`)
  return tunnel
}

export function closeSshTunnel(key) {
  const tunnel = tunnels.get(key)
  if (!tunnel) return
  tunnel.close()
}

export function closeAllSshTunnels() {
  for (const tunnel of tunnels.values()) tunnel.close()
  tunnels.clear()
}
