import fs from 'fs'
import os from 'os'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { log } from '../utils'
import { isPathWithinBase } from '../utils/sanitize'
import { getUserSkillsDirectory, initSkills, installSkill } from './skills.js'
import { getPluginDirectory, installPluginBundle } from './plugins.js'
import { netFetch } from './network.js'

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
export const MIRROR_REGISTRY = 'https://registry.npmmirror.com'

const METADATA_MAX_BYTES = 5 * 1024 * 1024
const ARCHIVE_MAX_BYTES = 40 * 1024 * 1024
const EXTRACTED_MAX_BYTES = 120 * 1024 * 1024
const MAX_ENTRIES = 5000
const NPM_NAME_RE = /^(?:(@[a-z0-9][a-z0-9._~-]*)\/)?([a-z0-9][a-z0-9._~-]*)$/

export function normalizeRegistry(value) {
  const raw = String(value || '').trim() || DEFAULT_REGISTRY
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('安装源地址格式无效，请以 http:// 或 https:// 开头')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('安装源地址必须以 http:// 或 https:// 开头')
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

export function parsePluginSource(rawInput) {
  const raw = String(rawInput || '').trim()
  if (!raw) {
    throw new Error('请输入插件包名、GitHub 仓库地址或本地目录路径')
  }

  if (raw.startsWith('file://')) {
    try {
      return { kind: 'local', path: fileURLToPath(raw) }
    } catch {
      throw new Error('本地目录路径无效')
    }
  }

  if (raw === '~' || raw.startsWith('~/') || raw.startsWith('~\\')) {
    return { kind: 'local', path: raw === '~' ? os.homedir() : path.join(os.homedir(), raw.slice(2)) }
  }

  if (path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) {
    return { kind: 'local', path: raw }
  }

  if (/^https?:\/\//i.test(raw)) {
    let url
    try {
      url = new URL(raw)
    } catch {
      throw new Error('插件地址格式无效')
    }
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
      throw new Error('仅支持 GitHub 仓库地址，或 npm 包名与本地目录')
    }
    const segments = url.pathname.split('/').filter(Boolean)
    const owner = segments[0] || ''
    const repo = (segments[1] || '').replace(/\.git$/i, '')
    if (!owner || !repo) {
      throw new Error('GitHub 地址格式无效，请填写仓库根地址，例如 https://github.com/owner/repo')
    }
    if (segments.length > 2) {
      throw new Error('请填写仓库根地址，不要包含子目录')
    }
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
      throw new Error('GitHub 仓库地址无效')
    }
    return { kind: 'github', owner, repo }
  }

  let name = raw
  let version = ''
  if (raw.startsWith('@')) {
    const slash = raw.indexOf('/')
    const at = slash === -1 ? -1 : raw.indexOf('@', slash + 1)
    if (at !== -1) {
      name = raw.slice(0, at)
      version = raw.slice(at + 1)
    }
  } else {
    const at = raw.indexOf('@')
    if (at > 0) {
      name = raw.slice(0, at)
      version = raw.slice(at + 1)
    }
  }

  if (!NPM_NAME_RE.test(name)) {
    throw new Error('无法识别插件来源，请输入 npm 包名、GitHub 仓库地址或本地目录路径')
  }
  if (version && !/^[a-zA-Z0-9][a-zA-Z0-9._~^<>=-]*$/.test(version)) {
    throw new Error('版本号格式无效')
  }

  return { kind: 'npm', name, version }
}

export function sanitizeArchivePath(name) {
  const normalized = String(name || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return ''
  const parts = normalized.split('/').filter((part) => part && part !== '.')
  if (!parts.length || parts.some((part) => part === '..')) return ''
  return parts.join('/')
}

function readTarString(block, offset, length) {
  const limit = Math.min(offset + length, block.length)
  let end = offset
  while (end < limit && block[end] !== 0) end += 1
  return block.toString('utf8', offset, end)
}

function parsePaxRecords(data) {
  const records = {}
  const text = data.toString('utf8')
  let index = 0
  while (index < text.length) {
    const space = text.indexOf(' ', index)
    if (space === -1) break
    const length = Number.parseInt(text.slice(index, space), 10)
    if (!Number.isFinite(length) || length <= 0) break
    const record = text.slice(space + 1, index + length - 1)
    const equal = record.indexOf('=')
    if (equal > 0) records[record.slice(0, equal)] = record.slice(equal + 1)
    index += length
  }
  return records
}

export function extractTarGz(buffer) {
  let tar
  try {
    tar = zlib.gunzipSync(buffer, { maxOutputLength: EXTRACTED_MAX_BYTES })
  } catch {
    throw new Error('插件压缩包解压失败，请确认插件源有效')
  }

  const entries = []
  let offset = 0
  let totalBytes = 0
  let pendingPath = ''

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break

    const flag = String.fromCharCode(header[156] || 48)
    const size = Number.parseInt(readTarString(header, 124, 12).trim() || '0', 8)
    if (!Number.isFinite(size) || size < 0) {
      throw new Error('插件压缩包格式无效')
    }
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    if (dataEnd > tar.length) {
      throw new Error('插件压缩包格式无效')
    }
    const data = tar.subarray(dataStart, dataEnd)

    if (flag === 'x') {
      const pax = parsePaxRecords(data)
      if (pax.path) pendingPath = pax.path
    } else if (flag === 'L') {
      pendingPath = readTarString(data, 0, data.length)
    } else if (flag === '0' || flag === '\u0000') {
      const prefix = readTarString(header, 345, 155)
      const name =
        pendingPath || (prefix ? `${prefix}/${readTarString(header, 0, 100)}` : readTarString(header, 0, 100))
      pendingPath = ''
      const safePath = sanitizeArchivePath(name)
      if (safePath) {
        entries.push({ path: safePath, data })
        totalBytes += size
        if (entries.length > MAX_ENTRIES || totalBytes > EXTRACTED_MAX_BYTES) {
          throw new Error('插件包内容过大，已中止安装')
        }
      }
    } else {
      pendingPath = ''
    }

    offset = dataStart + Math.ceil(size / 512) * 512
  }

  if (!entries.length) {
    throw new Error('插件压缩包为空')
  }
  return entries
}

export function findManifestRoot(entries, manifestName) {
  const candidates = entries
    .map((entry) => entry.path)
    .filter((entryPath) => entryPath === manifestName || entryPath.endsWith(`/${manifestName}`))
    .map((entryPath) => (entryPath === manifestName ? '' : entryPath.slice(0, -`/${manifestName}`.length)))

  if (!candidates.length) {
    throw new Error(`插件包中未找到 ${manifestName}，请确认该插件适配 NToolBox`)
  }

  const depth = (dir) => (dir ? dir.split('/').length : 0)
  const minDepth = Math.min(...candidates.map(depth))
  const shallowest = candidates.filter((dir) => depth(dir) === minDepth)
  if (shallowest.length > 1) {
    throw new Error(`插件包中包含多个 ${manifestName}，无法确定安装目录`)
  }
  return shallowest[0]
}

export function findPluginRoot(entries) {
  return findManifestRoot(entries, 'skill.json')
}

function readNpmToken(registry) {
  try {
    const npmrcPath = path.join(os.homedir(), '.npmrc')
    if (!fs.existsSync(npmrcPath)) return ''
    const url = new URL(registry)
    const base = `${url.host}${url.pathname}`.replace(/\/+$/, '')
    const keys = new Set([`//${base}/:_authToken`, `//${base}:_authToken`])
    for (const line of fs.readFileSync(npmrcPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue
      const equal = trimmed.indexOf('=')
      if (equal === -1) continue
      if (!keys.has(trimmed.slice(0, equal).trim())) continue
      return trimmed
        .slice(equal + 1)
        .trim()
        .replace(/^"(.*)"$/, '$1')
    }
  } catch {
    // 凭据只用于请求头，读取失败时按公开源处理
  }
  return ''
}

async function fetchResponse(target, { headers = {}, timeout = 30000, notFound = '' } = {}) {
  let response
  try {
    response = await netFetch(target, {
      headers: { 'user-agent': 'NToolBox', ...headers },
      redirect: 'follow',
      signal: globalThis.AbortSignal.timeout(timeout)
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error('连接安装源超时，请检查网络或更换安装源', { cause: error })
    }
    throw new Error(`无法连接安装源：${error.message}`, { cause: error })
  }

  if (response.status === 404 && notFound) throw new Error(notFound)
  if (!response.ok) throw new Error(`安装源返回 HTTP ${response.status}`)
  return response
}

async function fetchText(target, options = {}) {
  const response = await fetchResponse(target, options)
  const text = await response.text()
  if (Buffer.byteLength(text) > METADATA_MAX_BYTES) {
    throw new Error('插件元数据超过大小限制')
  }
  return text
}

async function fetchBuffer(target, options = {}) {
  const response = await fetchResponse(target, options)
  const declared = Number(response.headers.get('content-length')) || 0
  if (declared > ARCHIVE_MAX_BYTES) {
    throw new Error('插件包超过 40MB 大小限制')
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > ARCHIVE_MAX_BYTES) {
    throw new Error('插件包超过 40MB 大小限制')
  }
  if (!buffer.length) {
    throw new Error('插件包下载为空')
  }
  return buffer
}

async function downloadNpmPackage(source, registry) {
  const headers = { accept: 'application/vnd.npm.install-v1+json, application/json' }
  const token = readNpmToken(registry)
  if (token) headers.authorization = `Bearer ${token}`

  const metadataUrl = `${registry}/${source.name.replace('/', '%2f')}`
  const text = await fetchText(metadataUrl, {
    headers,
    notFound: `在安装源中未找到插件 ${source.name}`
  })

  let metadata
  try {
    metadata = JSON.parse(text)
  } catch {
    throw new Error('安装源返回的插件信息无法解析')
  }

  let version
  if (source.version) {
    version = metadata.versions?.[source.version] ? source.version : metadata['dist-tags']?.[source.version] || ''
  } else {
    version = metadata['dist-tags']?.latest || ''
  }

  const manifest = version ? metadata.versions?.[version] : null
  if (!manifest?.dist?.tarball) {
    throw new Error(
      source.version ? `安装源中未找到 ${source.name}@${source.version}` : `插件 ${source.name} 没有可安装的版本`
    )
  }

  let tarballUrl
  try {
    tarballUrl = new URL(manifest.dist.tarball)
  } catch {
    throw new Error('插件下载地址无效')
  }
  if (tarballUrl.protocol !== 'http:' && tarballUrl.protocol !== 'https:') {
    throw new Error('插件下载地址无效')
  }

  const tarballHeaders = {}
  if (token && tarballUrl.host === new URL(registry).host) {
    tarballHeaders.authorization = `Bearer ${token}`
  }
  const buffer = await fetchBuffer(tarballUrl, { headers: tarballHeaders, timeout: 120000 })
  return { buffer, label: `npm:${source.name}@${version}` }
}

async function downloadGitHubRepository(source) {
  const archiveUrl = `https://github.com/${source.owner}/${source.repo}/archive/HEAD.tar.gz`
  const buffer = await fetchBuffer(archiveUrl, {
    headers: { accept: 'application/x-gzip, application/octet-stream' },
    timeout: 120000,
    notFound: `GitHub 仓库不存在或无法访问：${source.owner}/${source.repo}`
  })
  return { buffer, label: `github:${source.owner}/${source.repo}` }
}

async function writeArchiveEntries(entries, root) {
  for (const entry of entries) {
    const target = path.resolve(root, entry.path)
    if (!isPathWithinBase(target, root)) {
      throw new Error('插件包包含非法路径，已中止安装')
    }
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.writeFile(target, entry.data)
  }
}

export async function installPluginSource(input, { registry } = {}) {
  let source
  try {
    source = parsePluginSource(input)
  } catch (error) {
    return { success: false, error: error.message }
  }

  if (source.kind === 'local') {
    try {
      const stat = await fs.promises.stat(source.path)
      if (!stat.isDirectory()) return { success: false, error: '本地插件路径必须是一个目录' }
    } catch {
      return { success: false, error: `本地目录不存在：${source.path}` }
    }
    if (isPathWithinBase(source.path, getUserSkillsDirectory())) {
      return { success: false, error: '该目录已在扩展安装目录中，无需重复安装' }
    }
    await initSkills()
    return await installSkill(source.path, { overwrite: true })
  }

  let registryUrl
  try {
    registryUrl = normalizeRegistry(registry)
  } catch (error) {
    return { success: false, error: error.message }
  }

  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ntoolbox-plugin-'))
  try {
    await initSkills()
    const archive =
      source.kind === 'npm' ? await downloadNpmPackage(source, registryUrl) : await downloadGitHubRepository(source)
    const entries = extractTarGz(archive.buffer)
    const pluginRoot = findPluginRoot(entries)
    await writeArchiveEntries(entries, tempRoot)

    const skillPath = pluginRoot ? path.join(tempRoot, pluginRoot) : tempRoot
    const result = await installSkill(skillPath, { overwrite: true })
    if (result.success) {
      log.info(`已从第三方源安装 Skill: ${result.name}（${archive.label}）`)
      return { ...result, source: archive.label }
    }
    return result
  } catch (error) {
    log.error('安装第三方插件失败:', error.message)
    return { success: false, error: error.message }
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {})
  }
}

export async function installPluginBundleSource(input, { registry } = {}) {
  let source
  try {
    source = parsePluginSource(input)
  } catch (error) {
    return { success: false, error: error.message }
  }

  if (source.kind === 'local') {
    try {
      const stat = await fs.promises.stat(source.path)
      if (!stat.isDirectory()) return { success: false, error: '本地插件路径必须是一个目录' }
    } catch {
      return { success: false, error: `本地目录不存在：${source.path}` }
    }
    if (!fs.existsSync(path.join(source.path, 'plugin.json'))) {
      return { success: false, error: '该目录缺少 plugin.json 定义文件，可能不是插件包' }
    }
    if (
      isPathWithinBase(source.path, getPluginDirectory()) ||
      isPathWithinBase(source.path, getUserSkillsDirectory())
    ) {
      return { success: false, error: '该目录已在扩展安装目录中，无需重复安装' }
    }
    return await installPluginBundle(source.path, { source: 'local' })
  }

  let registryUrl
  try {
    registryUrl = normalizeRegistry(registry)
  } catch (error) {
    return { success: false, error: error.message }
  }

  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ntoolbox-plugin-bundle-'))
  try {
    const archive =
      source.kind === 'npm' ? await downloadNpmPackage(source, registryUrl) : await downloadGitHubRepository(source)
    const entries = extractTarGz(archive.buffer)
    const pluginRoot = findManifestRoot(entries, 'plugin.json')
    await writeArchiveEntries(entries, tempRoot)

    const pluginPath = pluginRoot ? path.join(tempRoot, pluginRoot) : tempRoot
    const result = await installPluginBundle(pluginPath, { source: archive.label })
    if (result.success) {
      log.info(`已从第三方源安装插件: ${result.name}（${archive.label}）`)
    }
    return result
  } catch (error) {
    log.error('安装第三方插件包失败:', error.message)
    return { success: false, error: error.message }
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {})
  }
}
