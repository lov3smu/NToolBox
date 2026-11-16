import crypto from 'crypto'
import { netFetch } from '../network.js'
import { buildObjectKey, encodeKeyPath, joinUrl, resolveJsonPath, toAbsoluteUrl } from './utils.js'

const REQUEST_TIMEOUT = 60000

function hmacSha1(key, value, encoding = 'base64') {
  return crypto.createHmac('sha1', key).update(value).digest(encoding)
}

function hmacSha1Hex(key, value) {
  return crypto.createHmac('sha1', key).update(value).digest('hex')
}

function sha1Hex(value) {
  return crypto.createHash('sha1').update(value).digest('hex')
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function md5Base64(value) {
  return crypto.createHash('md5').update(value).digest('base64')
}

function requestError(response, data, text, label = '上传失败') {
  const message =
    (data && (data.message || data.msg || data.error?.message || data.error || data.error_description)) ||
    String(text || '')
      .replace(/\s+/g, ' ')
      .slice(0, 200)
  const detail = typeof message === 'string' && message.trim() ? `：${message.trim()}` : ''
  return new Error(`${label}（HTTP ${response.status}）${detail}`)
}

async function performFetch(url, options, fetchImpl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('请求超时，请检查网络或图床配置', { cause: error })
    }
    throw new Error(`网络请求失败：${error?.message || '未知错误'}`, { cause: error })
  } finally {
    clearTimeout(timer)
  }
}

async function readResponseBody(response) {
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  return { data, text }
}

async function expectJson(url, options, fetchImpl) {
  const response = await performFetch(url, options, fetchImpl)
  const { data, text } = await readResponseBody(response)
  if (!response.ok) throw requestError(response, data, text)
  return data
}

function normalizeRepo(repo) {
  const parts = String(repo || '')
    .trim()
    .split('/')
    .filter(Boolean)
  if (parts.length < 2) throw new Error('仓库格式应为 owner/repo')
  return { owner: parts[0], repo: parts[1] }
}

function basicAuth(username, password) {
  if (!username && !password) return ''
  return `Basic ${Buffer.from(`${username || ''}:${password || ''}`).toString('base64')}`
}

function formFile(file) {
  return new Blob([new Uint8Array(file.buffer)], { type: file.mime || 'application/octet-stream' })
}

function makeFormData(fieldName, file) {
  const form = new FormData()
  form.append(fieldName || 'file', formFile(file), file.name || 'image')
  return form
}

async function uploadGithub(file, settings, key, fetchImpl) {
  const { owner, repo } = normalizeRepo(settings.repo)
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo
  )}/contents/${encodeKeyPath(key)}`
  const branch = settings.branch?.trim() || 'main'
  const data = await expectJson(
    apiUrl,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${settings.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'NToolBox'
      },
      body: JSON.stringify({
        message: `upload ${file.name}`,
        content: file.buffer.toString('base64'),
        branch
      })
    },
    fetchImpl
  )

  if (settings.customUrl?.trim()) {
    return joinUrl(settings.customUrl, key)
  }
  return (
    data?.content?.download_url ||
    `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodeKeyPath(key)}`
  )
}

async function uploadGitee(file, settings, key, fetchImpl) {
  const { owner, repo } = normalizeRepo(settings.repo)
  const branch = settings.branch?.trim() || 'master'
  const body = new URLSearchParams({
    access_token: settings.token,
    content: file.buffer.toString('base64'),
    message: `upload ${file.name}`,
    branch
  })
  const apiUrl = `https://gitee.com/api/v5/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo
  )}/contents/${encodeKeyPath(key)}`
  const data = await expectJson(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    },
    fetchImpl
  )

  if (settings.customUrl?.trim()) {
    return joinUrl(settings.customUrl, key)
  }
  return (
    data?.content?.download_url ||
    `https://gitee.com/${owner}/${repo}/raw/${encodeURIComponent(branch)}/${encodeKeyPath(key)}`
  )
}

async function uploadSmms(file, settings, _key, fetchImpl) {
  const response = await performFetch(
    'https://sm.ms/api/v2/upload',
    {
      method: 'POST',
      headers: { Authorization: settings.token },
      body: makeFormData('smfile', file)
    },
    fetchImpl
  )
  const { data, text } = await readResponseBody(response)

  if (data?.success && data?.data?.url) return data.data.url
  if (data?.code === 'image_repeated' && data?.images) return data.images
  throw requestError(response, data, text)
}

async function uploadImgur(file, settings, _key, fetchImpl) {
  const data = await expectJson(
    'https://api.imgur.com/3/image',
    {
      method: 'POST',
      headers: { Authorization: `Client-ID ${settings.clientId}` },
      body: makeFormData('image', file)
    },
    fetchImpl
  )
  if (!data?.success || !data?.data?.link) {
    throw new Error(data?.data?.error || 'Imgur 上传失败')
  }
  return data.data.link
}

function qiniuUploadToken(accessKey, secretKey, policy) {
  const encodedPolicy = Buffer.from(JSON.stringify(policy), 'utf8').toString('base64url')
  const encodedSign = hmacSha1(secretKey, encodedPolicy, 'base64url')
  return `${accessKey}:${encodedSign}:${encodedPolicy}`
}

async function uploadQiniu(file, settings, key, fetchImpl) {
  const uploadHosts = {
    z0: 'https://upload.qiniup.com',
    z1: 'https://upload-z1.qiniup.com',
    z2: 'https://upload-z2.qiniup.com',
    na0: 'https://upload-na0.qiniup.com',
    as0: 'https://upload-as0.qiniup.com'
  }
  const host = uploadHosts[settings.zone] || uploadHosts.z0
  const token = qiniuUploadToken(settings.accessKey, settings.secretKey, {
    scope: `${settings.bucket}:${key}`,
    deadline: Math.floor(Date.now() / 1000) + 3600
  })
  const form = new FormData()
  form.append('token', token)
  form.append('key', key)
  form.append('file', formFile(file), file.name || 'image')

  const data = await expectJson(host, { method: 'POST', body: form }, fetchImpl)
  if (data?.error) throw new Error(data.error)
  return joinUrl(settings.domain, data?.key || key)
}

function aliyunOssHost(settings) {
  const region = String(settings.region || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
  const endpoint = region.includes('.') ? region : `${region}.aliyuncs.com`
  return `${settings.bucket}.${endpoint}`
}

async function uploadAliyun(file, settings, key, fetchImpl) {
  const host = aliyunOssHost(settings)
  const date = new Date().toUTCString()
  const contentType = file.mime || 'application/octet-stream'
  const contentMd5 = md5Base64(file.buffer)
  const stringToSign = `PUT\n${contentMd5}\n${contentType}\n${date}\n/${settings.bucket}/${key}`
  const signature = hmacSha1(settings.accessKeySecret, stringToSign)

  const response = await performFetch(
    `https://${host}/${encodeKeyPath(key)}`,
    {
      method: 'PUT',
      headers: {
        Date: date,
        'Content-Type': contentType,
        'Content-MD5': contentMd5,
        Authorization: `OSS ${settings.accessKeyId}:${signature}`
      },
      body: file.buffer
    },
    fetchImpl
  )

  if (!response.ok) {
    const { data, text } = await readResponseBody(response)
    throw requestError(response, data, text)
  }
  if (settings.customUrl?.trim()) return joinUrl(settings.customUrl, key)
  return `https://${host}/${encodeKeyPath(key)}`
}

function tencentCosAuthorization({ secretId, secretKey, method, host, path }) {
  const now = Math.floor(Date.now() / 1000)
  const keyTime = `${now};${now + 3600}`
  const signKey = hmacSha1Hex(secretKey, keyTime)
  const httpString = `${method.toLowerCase()}\n${path}\n\nhost=${host}\n`
  const stringToSign = `sha1\n${keyTime}\n${sha1Hex(httpString)}\n`
  const signature = hmacSha1Hex(signKey, stringToSign)
  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`
}

async function uploadTencent(file, settings, key, fetchImpl) {
  const host = `${settings.bucket}.cos.${settings.region}.myqcloud.com`
  const encodedKey = encodeKeyPath(key)
  const requestPath = `/${encodedKey}`
  const authorization = tencentCosAuthorization({
    secretId: settings.secretId,
    secretKey: settings.secretKey,
    method: 'PUT',
    host,
    path: requestPath
  })

  const response = await performFetch(
    `https://${host}${requestPath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        'Content-Type': file.mime || 'application/octet-stream'
      },
      body: file.buffer
    },
    fetchImpl
  )

  if (!response.ok) {
    const { data, text } = await readResponseBody(response)
    throw requestError(response, data, text)
  }
  if (settings.customUrl?.trim()) return joinUrl(settings.customUrl, key)
  return `https://${host}${requestPath}`
}

function buildS3Request({ method, endpoint, region, bucket, key, accessKey, secretKey, payload, forcePathStyle }) {
  const endpointUrl = new URL(/^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`)
  const host = forcePathStyle ? endpointUrl.host : `${bucket}.${endpointUrl.host}`
  const encodedKey = encodeKeyPath(key)
  const canonicalUri = forcePathStyle ? `/${bucket}${encodedKey ? `/${encodedKey}` : ''}` : `/${encodedKey}`

  const payloadHash = sha256Hex(payload || Buffer.alloc(0))
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const scope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`

  const dateKey = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest()
  const regionKey = crypto.createHmac('sha256', dateKey).update(region).digest()
  const serviceKey = crypto.createHmac('sha256', regionKey).update('s3').digest()
  const signingKey = crypto.createHmac('sha256', serviceKey).update('aws4_request').digest()
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  return {
    url: `${endpointUrl.origin}${canonicalUri}`,
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  }
}

async function uploadS3(file, settings, key, fetchImpl) {
  const request = buildS3Request({
    method: 'PUT',
    endpoint: settings.endpoint,
    region: settings.region,
    bucket: settings.bucket,
    key,
    accessKey: settings.accessKey,
    secretKey: settings.secretKey,
    payload: file.buffer,
    forcePathStyle: settings.forcePathStyle !== false
  })

  const response = await performFetch(
    request.url,
    {
      method: 'PUT',
      headers: { ...request.headers, 'Content-Type': file.mime || 'application/octet-stream' },
      body: file.buffer
    },
    fetchImpl
  )

  if (!response.ok) {
    const { data, text } = await readResponseBody(response)
    throw requestError(response, data, text)
  }
  if (settings.customUrl?.trim()) return joinUrl(settings.customUrl, key)
  return request.url
}

async function uploadWebdav(file, settings, key, fetchImpl) {
  const uploadUrl = joinUrl(settings.url, key)
  const headers = { 'Content-Type': file.mime || 'application/octet-stream' }
  const auth = basicAuth(settings.username, settings.password)
  if (auth) headers.Authorization = auth

  const response = await performFetch(uploadUrl, { method: 'PUT', headers, body: file.buffer }, fetchImpl)
  if (![200, 201, 204].includes(response.status)) {
    const { data, text } = await readResponseBody(response)
    throw requestError(response, data, text)
  }
  return joinUrl(settings.publicUrl || settings.url, key)
}

function parseCustomHeaders(raw) {
  if (!raw || !String(raw).trim()) return {}
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('请求头必须是有效的 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请求头必须是 JSON 对象')
  }
  const headers = {}
  const blocked = new Set(['content-type', 'content-length', 'host', 'connection'])
  for (const [key, value] of Object.entries(parsed)) {
    if (blocked.has(key.toLowerCase())) continue
    if (value === null || value === undefined) continue
    headers[key] = String(value)
  }
  return headers
}

async function uploadCustom(file, settings, _key, fetchImpl) {
  if (!/^https?:\/\//i.test(settings.url)) throw new Error('上传接口必须是 http(s) 地址')
  const headers = parseCustomHeaders(settings.headers)
  const response = await performFetch(
    settings.url,
    {
      method: 'POST',
      headers,
      body: makeFormData(settings.field || 'file', file)
    },
    fetchImpl
  )
  const { data, text } = await readResponseBody(response)

  if (!response.ok) throw requestError(response, data, text)

  let candidate
  if (settings.responsePath) {
    if (!data) throw new Error('接口响应不是有效的 JSON，无法按 JSON 路径解析')
    candidate = resolveJsonPath(data, settings.responsePath)
  } else if (data) {
    candidate =
      data.url || data.link || data.data?.url || data.data?.link || data.data?.[0]?.url || data.data?.[0]?.src || ''
  } else {
    candidate = String(text || '').trim()
  }

  if (typeof candidate !== 'string' || !candidate.trim()) {
    throw new Error(`响应中未找到图片地址${settings.responsePath ? `（${settings.responsePath}）` : ''}`)
  }

  const url = toAbsoluteUrl(candidate, settings.urlPrefix)
  if (!/^https?:\/\//i.test(url)) throw new Error('接口返回的图片地址不是有效的 http(s) 链接')
  return url
}

const UPLOADERS = {
  github: uploadGithub,
  gitee: uploadGitee,
  smms: uploadSmms,
  imgur: uploadImgur,
  qiniu: uploadQiniu,
  aliyun: uploadAliyun,
  tencent: uploadTencent,
  s3: uploadS3,
  webdav: uploadWebdav,
  custom: uploadCustom
}

export async function uploadToProvider({ providerId, settings, file, fetchImpl = netFetch }) {
  const uploader = UPLOADERS[providerId]
  if (!uploader) throw new Error('不支持的图床类型')
  if (!file?.buffer?.length) throw new Error('图片内容为空')

  const key = buildObjectKey(file.filePath || file.name, settings)
  const url = await uploader(file, settings, key, fetchImpl)
  if (!url) throw new Error('图床未返回图片地址')
  return { url, key }
}

async function testGithub(settings, fetchImpl) {
  const { owner, repo } = normalizeRepo(settings.repo)
  await expectJson(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${settings.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'NToolBox'
      }
    },
    fetchImpl
  )
  return '仓库可访问，Token 有效'
}

async function testGitee(settings, fetchImpl) {
  const { owner, repo } = normalizeRepo(settings.repo)
  const url = `https://gitee.com/api/v5/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo
  )}?access_token=${encodeURIComponent(settings.token)}`
  await expectJson(url, {}, fetchImpl)
  return '仓库可访问，私人令牌有效'
}

async function testSmms(settings, fetchImpl) {
  const data = await expectJson(
    'https://sm.ms/api/v2/profile',
    { method: 'POST', headers: { Authorization: settings.token } },
    fetchImpl
  )
  if (!data?.success) throw new Error(data?.message || 'Token 校验失败')
  return `Token 有效${data.data?.username ? `（${data.data.username}）` : ''}`
}

async function testImgur(settings, fetchImpl) {
  const data = await expectJson(
    'https://api.imgur.com/3/credits',
    { headers: { Authorization: `Client-ID ${settings.clientId}` } },
    fetchImpl
  )
  if (!data?.success) throw new Error(data?.data?.error || 'Client ID 校验失败')
  return 'Client ID 有效'
}

async function testQiniu() {
  return '配置格式校验通过，上传时会自动验证密钥'
}

async function testAliyun(settings, fetchImpl) {
  const host = aliyunOssHost(settings)
  const date = new Date().toUTCString()
  const stringToSign = `GET\n\n\n${date}\n/${settings.bucket}/`
  const signature = hmacSha1(settings.accessKeySecret, stringToSign)
  const response = await performFetch(
    `https://${host}/?max-keys=0`,
    {
      headers: {
        Date: date,
        Authorization: `OSS ${settings.accessKeyId}:${signature}`
      }
    },
    fetchImpl
  )
  if (!response.ok) {
    const { data, text } = await readResponseBody(response)
    throw requestError(response, data, text, 'OSS 连接失败')
  }
  return 'Bucket 可访问，密钥有效'
}

async function testTencent(settings, fetchImpl) {
  const host = `${settings.bucket}.cos.${settings.region}.myqcloud.com`
  const authorization = tencentCosAuthorization({
    secretId: settings.secretId,
    secretKey: settings.secretKey,
    method: 'HEAD',
    host,
    path: '/'
  })
  const response = await performFetch(
    `https://${host}/`,
    { method: 'HEAD', headers: { Authorization: authorization } },
    fetchImpl
  )
  if (!response.ok) throw new Error(`COS 连接失败（HTTP ${response.status}）`)
  return 'Bucket 可访问，密钥有效'
}

async function testS3(settings, fetchImpl) {
  const request = buildS3Request({
    method: 'HEAD',
    endpoint: settings.endpoint,
    region: settings.region,
    bucket: settings.bucket,
    key: '',
    accessKey: settings.accessKey,
    secretKey: settings.secretKey,
    payload: Buffer.alloc(0),
    forcePathStyle: settings.forcePathStyle !== false
  })
  const response = await performFetch(request.url, { method: 'HEAD', headers: request.headers }, fetchImpl)
  if (!response.ok) throw new Error(`Bucket 连接失败（HTTP ${response.status}）`)
  return 'Bucket 可访问，密钥有效'
}

async function testWebdav(settings, fetchImpl) {
  const headers = { Depth: '0', 'Content-Type': 'application/xml' }
  const auth = basicAuth(settings.username, settings.password)
  if (auth) headers.Authorization = auth
  const response = await performFetch(
    settings.url,
    {
      method: 'PROPFIND',
      headers,
      body: '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><displayname/></prop></propfind>'
    },
    fetchImpl
  )
  if (![200, 207].includes(response.status)) {
    const { data, text } = await readResponseBody(response)
    throw requestError(response, data, text, 'WebDAV 连接失败')
  }
  return 'WebDAV 服务可访问'
}

async function testCustom(settings) {
  if (!/^https?:\/\//i.test(settings.url)) throw new Error('上传接口必须是 http(s) 地址')
  parseCustomHeaders(settings.headers)
  return '配置格式校验通过'
}

const TESTERS = {
  github: testGithub,
  gitee: testGitee,
  smms: testSmms,
  imgur: testImgur,
  qiniu: testQiniu,
  aliyun: testAliyun,
  tencent: testTencent,
  s3: testS3,
  webdav: testWebdav,
  custom: testCustom
}

export async function testProvider({ providerId, settings, fetchImpl = netFetch }) {
  const tester = TESTERS[providerId]
  if (!tester) throw new Error('不支持的图床类型')
  const message = await tester(settings, fetchImpl)
  return { success: true, message }
}
