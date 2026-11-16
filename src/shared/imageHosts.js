export const IMAGE_HOST_HISTORY_LIMIT = 100
export const IMAGE_HOST_MAX_FILE_SIZE = 30 * 1024 * 1024

export const IMAGE_HOST_HISTORY_LIMIT_OPTIONS = Object.freeze(
  [50, 100, 200, 500].map((value) => ({
    value,
    label: `${value} 条${value === IMAGE_HOST_HISTORY_LIMIT ? '（默认）' : ''}`,
    hint: `最多保留最近 ${value} 条上传记录`
  }))
)

export const IMAGE_HOST_MAX_FILE_MB_OPTIONS = Object.freeze(
  [10, 20, 30, 50].map((value) => ({
    value,
    label: `${value} MB${value === 30 ? '（默认）' : ''}`,
    hint: `单张图片超过 ${value} MB 时拒绝上传`
  }))
)

export const IMAGE_HOST_MAX_FILE_MB = Math.round(IMAGE_HOST_MAX_FILE_SIZE / 1024 / 1024)

export function normalizeImageHostHistoryLimit(value) {
  if (value === null || value === undefined || value === '') return IMAGE_HOST_HISTORY_LIMIT
  const num = Number(value)
  if (!Number.isFinite(num)) return IMAGE_HOST_HISTORY_LIMIT
  return Math.min(2000, Math.max(10, Math.round(num)))
}

export function normalizeImageHostMaxFileMb(value) {
  if (value === null || value === undefined || value === '') return IMAGE_HOST_MAX_FILE_MB
  const num = Number(value)
  if (!Number.isFinite(num)) return IMAGE_HOST_MAX_FILE_MB
  return Math.min(200, Math.max(1, Math.round(num)))
}

export function getImageHostMaxFileSize(settings) {
  return normalizeImageHostMaxFileMb(settings?.maxFileMb) * 1024 * 1024
}

export const IMAGE_HOST_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif']

export const IMAGE_HOST_LINK_FORMATS = [
  { value: 'url', label: 'URL' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' }
]

export const IMAGE_HOST_PROVIDERS = [
  {
    id: 'github',
    name: 'GitHub',
    description: '把图片提交到 GitHub 仓库，可配合 jsDelivr 等 CDN 加速访问',
    docsUrl: 'https://github.com/settings/tokens',
    docsLabel: '获取 Token',
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        type: 'password',
        required: true,
        placeholder: 'ghp_xxxxxxxxxxxxxxxx',
        hint: '需要勾选 repo 权限（经典 Token）或 Contents 读写权限'
      },
      {
        key: 'repo',
        label: '仓库',
        type: 'text',
        required: true,
        placeholder: 'owner/repo'
      },
      {
        key: 'branch',
        label: '分支',
        type: 'text',
        default: 'main',
        placeholder: 'main'
      },
      {
        key: 'path',
        label: '存储路径',
        type: 'text',
        default: 'images',
        placeholder: 'images/2026'
      },
      {
        key: 'customUrl',
        label: '自定义域名',
        type: 'text',
        placeholder: 'https://cdn.jsdelivr.net/gh/owner/repo@main',
        hint: '留空时使用 GitHub 返回的 raw 地址；私有仓库建议填写 CDN 域名'
      }
    ]
  },
  {
    id: 'gitee',
    name: 'Gitee',
    description: '把图片提交到 Gitee 仓库，国内访问速度更稳定',
    docsUrl: 'https://gitee.com/profile/personal_access_tokens',
    docsLabel: '获取 Token',
    fields: [
      {
        key: 'token',
        label: '私人令牌',
        type: 'password',
        required: true,
        placeholder: 'xxxxxxxxxxxxxxxx',
        hint: '需要 projects 权限'
      },
      {
        key: 'repo',
        label: '仓库',
        type: 'text',
        required: true,
        placeholder: 'owner/repo'
      },
      {
        key: 'branch',
        label: '分支',
        type: 'text',
        default: 'master',
        placeholder: 'master'
      },
      {
        key: 'path',
        label: '存储路径',
        type: 'text',
        default: 'images',
        placeholder: 'images'
      },
      {
        key: 'customUrl',
        label: '自定义域名',
        type: 'text',
        placeholder: 'https://cdn.example.com',
        hint: '留空时使用 Gitee raw 地址'
      }
    ]
  },
  {
    id: 'smms',
    name: 'SM.MS',
    description: '免费图床，注册后获取 API Token 即可使用',
    docsUrl: 'https://sm.ms/home/apitoken',
    docsLabel: '获取 Token',
    fields: [
      {
        key: 'token',
        label: 'API Token',
        type: 'password',
        required: true,
        placeholder: '请输入 SM.MS Token'
      }
    ]
  },
  {
    id: 'imgur',
    name: 'Imgur',
    description: '海外免费图床，使用 Client ID 匿名上传',
    docsUrl: 'https://api.imgur.com/oauth2/addclient',
    docsLabel: '获取 Client ID',
    fields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'password',
        required: true,
        placeholder: '请输入 Imgur Client ID'
      }
    ]
  },
  {
    id: 'qiniu',
    name: '七牛云',
    description: '对象存储 + CDN，需要绑定自定义访问域名',
    docsUrl: 'https://portal.qiniu.com/user/key',
    docsLabel: '获取密钥',
    fields: [
      { key: 'accessKey', label: 'AccessKey', type: 'password', required: true, placeholder: '请输入 AccessKey' },
      { key: 'secretKey', label: 'SecretKey', type: 'password', required: true, placeholder: '请输入 SecretKey' },
      { key: 'bucket', label: '空间名称', type: 'text', required: true, placeholder: 'my-bucket' },
      {
        key: 'domain',
        label: '访问域名',
        type: 'text',
        required: true,
        placeholder: 'https://cdn.example.com',
        hint: '七牛云空间必须配置可公开访问的域名'
      },
      {
        key: 'zone',
        label: '存储区域',
        type: 'select',
        default: 'z0',
        options: [
          { value: 'z0', label: '华东' },
          { value: 'z1', label: '华北' },
          { value: 'z2', label: '华南' },
          { value: 'na0', label: '北美' },
          { value: 'as0', label: '东南亚' }
        ]
      },
      { key: 'path', label: '存储路径', type: 'text', default: 'images', placeholder: 'images' }
    ]
  },
  {
    id: 'aliyun',
    name: '阿里云 OSS',
    description: '阿里云对象存储，支持自定义 CDN 域名',
    docsUrl: 'https://ram.console.aliyun.com/manage/ak',
    docsLabel: '获取 AccessKey',
    fields: [
      { key: 'accessKeyId', label: 'AccessKey ID', type: 'password', required: true, placeholder: 'LTAI...' },
      {
        key: 'accessKeySecret',
        label: 'AccessKey Secret',
        type: 'password',
        required: true,
        placeholder: '请输入 AccessKey Secret'
      },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-bucket' },
      {
        key: 'region',
        label: '区域 Endpoint',
        type: 'text',
        required: true,
        default: 'oss-cn-hangzhou',
        placeholder: 'oss-cn-hangzhou',
        hint: '可填 oss-cn-hangzhou，或完整域名 oss-cn-hangzhou.aliyuncs.com'
      },
      { key: 'path', label: '存储路径', type: 'text', default: 'images', placeholder: 'images' },
      {
        key: 'customUrl',
        label: '自定义域名',
        type: 'text',
        placeholder: 'https://cdn.example.com',
        hint: '留空时使用 Bucket 默认访问域名'
      }
    ]
  },
  {
    id: 'tencent',
    name: '腾讯云 COS',
    description: '腾讯云对象存储，支持自定义 CDN 域名',
    docsUrl: 'https://console.cloud.tencent.com/cam/capi',
    docsLabel: '获取密钥',
    fields: [
      { key: 'secretId', label: 'SecretId', type: 'password', required: true, placeholder: 'AKID...' },
      { key: 'secretKey', label: 'SecretKey', type: 'password', required: true, placeholder: '请输入 SecretKey' },
      {
        key: 'bucket',
        label: 'Bucket',
        type: 'text',
        required: true,
        placeholder: 'my-bucket-1250000000',
        hint: 'Bucket 名称需要包含 APPID 后缀'
      },
      {
        key: 'region',
        label: '地域',
        type: 'text',
        required: true,
        default: 'ap-guangzhou',
        placeholder: 'ap-guangzhou'
      },
      { key: 'path', label: '存储路径', type: 'text', default: 'images', placeholder: 'images' },
      {
        key: 'customUrl',
        label: '自定义域名',
        type: 'text',
        placeholder: 'https://cdn.example.com',
        hint: '留空时使用 COS 默认访问域名'
      }
    ]
  },
  {
    id: 's3',
    name: 'S3 / MinIO',
    description: '兼容 Amazon S3 协议的对象存储，也支持 MinIO、Cloudflare R2 等',
    docsUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/RESTAPI.html',
    docsLabel: '查看文档',
    fields: [
      {
        key: 'endpoint',
        label: 'Endpoint',
        type: 'text',
        required: true,
        placeholder: 'https://s3.us-east-1.amazonaws.com',
        hint: 'MinIO 可填写 http://127.0.0.1:9000'
      },
      { key: 'region', label: 'Region', type: 'text', required: true, default: 'us-east-1', placeholder: 'us-east-1' },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-bucket' },
      { key: 'accessKey', label: 'Access Key', type: 'password', required: true, placeholder: '请输入 Access Key' },
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true, placeholder: '请输入 Secret Key' },
      {
        key: 'forcePathStyle',
        label: 'Path Style 访问',
        type: 'switch',
        default: true,
        hint: 'MinIO 等自建服务通常开启；AWS S3 可关闭'
      },
      { key: 'path', label: '存储路径', type: 'text', default: 'images', placeholder: 'images' },
      {
        key: 'customUrl',
        label: '自定义域名',
        type: 'text',
        placeholder: 'https://cdn.example.com',
        hint: '留空时使用 Endpoint 拼接的地址'
      }
    ]
  },
  {
    id: 'webdav',
    name: 'WebDAV',
    description: '上传到坚果云、Nextcloud 等 WebDAV 服务',
    fields: [
      {
        key: 'url',
        label: 'WebDAV 地址',
        type: 'text',
        required: true,
        placeholder: 'https://dav.example.com/dav'
      },
      { key: 'username', label: '用户名', type: 'text', placeholder: '可选' },
      { key: 'password', label: '密码', type: 'password', placeholder: '可选' },
      { key: 'path', label: '存储路径', type: 'text', default: 'images', placeholder: 'images' },
      {
        key: 'publicUrl',
        label: '公开访问地址',
        type: 'text',
        placeholder: 'https://files.example.com/images',
        hint: '留空时使用 WebDAV 地址；请填写可公开访问的外链地址'
      }
    ]
  },
  {
    id: 'custom',
    name: '自定义 HTTP',
    description: '上传到自建接口，按 JSON 路径解析返回的图片地址',
    fields: [
      {
        key: 'url',
        label: '上传接口',
        type: 'text',
        required: true,
        placeholder: 'https://example.com/api/upload'
      },
      { key: 'field', label: '文件字段名', type: 'text', default: 'file', placeholder: 'file' },
      {
        key: 'headers',
        label: '请求头（JSON）',
        type: 'textarea',
        default: '',
        placeholder: '{"Authorization":"Bearer xxx"}',
        hint: '可选；Content-Type 由程序自动设置'
      },
      {
        key: 'responsePath',
        label: '图片地址 JSON 路径',
        type: 'text',
        default: 'data.url',
        placeholder: 'data.url',
        hint: '例如 data.url、data[0].src；留空时把响应文本当作地址'
      },
      {
        key: 'urlPrefix',
        label: '地址前缀',
        type: 'text',
        default: '',
        placeholder: 'https://cdn.example.com',
        hint: '当接口返回相对地址时自动拼接'
      }
    ]
  }
]

export const IMAGE_HOST_PROVIDER_IDS = IMAGE_HOST_PROVIDERS.map((provider) => provider.id)

export const DEFAULT_IMAGE_HOST_PROVIDER = IMAGE_HOST_PROVIDER_IDS[0]

export function getProviderMeta(providerId) {
  return IMAGE_HOST_PROVIDERS.find((provider) => provider.id === providerId) || null
}

export function createDefaultProviderSettings(providerId) {
  const meta = getProviderMeta(providerId)
  if (!meta) return {}
  const settings = {}
  for (const field of meta.fields) {
    settings[field.key] = field.default ?? ''
  }
  return settings
}

export function createDefaultImageHostSettings() {
  const providers = {}
  for (const provider of IMAGE_HOST_PROVIDERS) {
    providers[provider.id] = createDefaultProviderSettings(provider.id)
  }
  return {
    active: DEFAULT_IMAGE_HOST_PROVIDER,
    linkFormat: 'url',
    rename: true,
    historyLimit: IMAGE_HOST_HISTORY_LIMIT,
    maxFileMb: IMAGE_HOST_MAX_FILE_MB,
    providers
  }
}

function toSafeString(value, maxLength = 4096) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function normalizeProviderSettings(providerId, raw) {
  const settings = createDefaultProviderSettings(providerId)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return settings

  const meta = getProviderMeta(providerId)
  if (!meta) return settings

  for (const field of meta.fields) {
    const value = raw[field.key]
    if (field.type === 'switch') {
      if (typeof value === 'boolean') settings[field.key] = value
      continue
    }
    if (typeof value === 'string') {
      settings[field.key] = toSafeString(value, field.type === 'textarea' ? 8192 : 4096)
    }
  }
  return settings
}

export function normalizeImageHostSettings(raw) {
  const defaults = createDefaultImageHostSettings()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults

  const providers = {}
  const rawProviders = raw.providers && typeof raw.providers === 'object' ? raw.providers : {}
  for (const provider of IMAGE_HOST_PROVIDERS) {
    providers[provider.id] = normalizeProviderSettings(provider.id, rawProviders[provider.id])
  }

  return {
    active: IMAGE_HOST_PROVIDER_IDS.includes(raw.active) ? raw.active : DEFAULT_IMAGE_HOST_PROVIDER,
    linkFormat: IMAGE_HOST_LINK_FORMATS.some((format) => format.value === raw.linkFormat) ? raw.linkFormat : 'url',
    rename: typeof raw.rename === 'boolean' ? raw.rename : true,
    historyLimit: normalizeImageHostHistoryLimit(raw.historyLimit),
    maxFileMb: normalizeImageHostMaxFileMb(raw.maxFileMb),
    providers
  }
}

export function normalizeImageHostHistory(raw, limit = IMAGE_HOST_HISTORY_LIMIT) {
  if (!Array.isArray(raw)) return []
  const result = []
  const seen = new Set()

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.url !== 'string' || !/^https?:\/\//i.test(item.url)) continue
    if (seen.has(item.url)) continue
    seen.add(item.url)

    const uploadedAt = Number(item.uploadedAt)
    const provider = IMAGE_HOST_PROVIDER_IDS.includes(item.provider) ? item.provider : ''
    result.push({
      id: toSafeString(item.id, 128) || `${uploadedAt || Date.now()}-${result.length}`,
      name: toSafeString(item.name, 256) || 'image',
      url: item.url.slice(0, 4096),
      provider,
      providerName: toSafeString(item.providerName, 64) || getProviderMeta(provider)?.name || '',
      size: Number.isFinite(item.size) && item.size >= 0 ? item.size : 0,
      uploadedAt: Number.isFinite(uploadedAt) ? uploadedAt : 0
    })
    if (result.length >= limit) break
  }

  return result
}

export function normalizeImageHostConfig(raw) {
  const settings = normalizeImageHostSettings(raw)
  return {
    ...settings,
    history: normalizeImageHostHistory(raw?.history, settings.historyLimit)
  }
}

export function getMissingRequiredFields(providerId, providerSettings) {
  const meta = getProviderMeta(providerId)
  if (!meta) return []
  const settings = providerSettings && typeof providerSettings === 'object' ? providerSettings : {}
  return meta.fields.filter((field) => {
    if (!field.required) return false
    const value = settings[field.key]
    return typeof value !== 'string' || !value.trim()
  })
}

export function isProviderConfigured(providerId, providerSettings) {
  return getMissingRequiredFields(providerId, providerSettings).length === 0
}

function escapeAlt(value) {
  return String(value || 'image')
    .replace(/[[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function formatImageLink(url, format = 'url', alt = 'image') {
  if (!url) return ''
  if (format === 'markdown') {
    return `![${escapeAlt(alt)}](${url})`
  }
  if (format === 'html') {
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(escapeAlt(alt))}" />`
  }
  return url
}
