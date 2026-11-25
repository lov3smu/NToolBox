export const TEMPLATE_CATEGORIES = Object.freeze([
  { id: 'docs', name: '通用文档' },
  { id: 'config', name: '开发配置' },
  { id: 'data', name: '数据示例' }
])

const markdownReadme = `# 项目名称

一句话说明这个项目解决什么问题。

## 功能

- 功能一
- 功能二
- 功能三

## 快速开始

\`\`\`bash
npm install
npm run dev
\`\`\`

## 配置

| 配置项 | 说明 | 默认值 |
| --- | --- | --- |
| \`PORT\` | 服务端口 | \`5173\` |

## 目录结构

\`\`\`text
src/
├── main/
├── renderer/
└── shared/
\`\`\`
`

const markdownReview = `# 技术方案评审：{{主题}}

## 背景

说明当前痛点与触发这次改动的原因。

## 目标

- 目标一（可衡量）
- 目标二

## 非目标

- 明确本次不处理的范围

## 方案

1. 改动点
2. 数据流 / 调用链
3. 兼容性与回滚方式

## 风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 风险一 | 中 | 灰度 + 开关 |

## 排期

- 评审：待定
- 开发：待定
- 上线：待定
`

const markdownWeekly = `# 本周工作（{{date}}）

## 已完成

- 事项一：结果与数据
- 事项二：结果与数据

## 进行中

- 事项三：当前进度 60%，预计周三完成

## 风险与阻塞

- 无

## 下周计划

- 事项四
- 事项五
`

const markdownApi = `# {{接口名称}}

\`GET /api/v1/resource\`

## 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`page\` | number | 否 | 页码，默认 1 |
| \`size\` | number | 否 | 每页条数，默认 20 |

## 响应示例

\`\`\`json
{
  "code": 0,
  "data": {
    "items": [],
    "total": 0
  }
}
\`\`\`

## 错误码

| 状态码 | 说明 |
| --- | --- |
| 400 | 参数错误 |
| 401 | 未登录 |
`

const markdownCommit = `# 提交信息规范

\`type(scope): subject\`

- \`feat\`：新功能
- \`fix\`：修复缺陷
- \`refactor\`：重构（不改变行为）
- \`docs\`：文档
- \`test\`：测试
- \`chore\`：构建与杂项

## 示例

\`\`\`text
feat(database): 支持结果集编辑回写
fix(chat): 修复停止按钮不生效
\`\`\`

标题不超过 50 字符，正文说明动机与影响，不写「修改了一些东西」这类描述。
`

const htmlEmail = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>通知邮件</title>
  </head>
  <body style="margin:0;padding:24px;background:#f5f6f8;font-family:system-ui,sans-serif;color:#1f2937">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px">
            <tr>
              <td>
                <h1 style="margin:0 0 12px;font-size:20px">通知标题</h1>
                <p style="margin:0 0 16px;line-height:1.6">这里是正文，一段简短说明。</p>
                <a href="https://example.com" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;border-radius:6px;text-decoration:none">查看详情</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

const jsonApiSample = `{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      { "id": 1, "name": "示例一", "enabled": true },
      { "id": 2, "name": "示例二", "enabled": false }
    ],
    "page": 1,
    "size": 20,
    "total": 2
  }
}
`

const yamlActions = `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint:check
      - run: npm run test
      - run: npm run build
`

const sqlTable = `-- 建表模板：按业务替换字段与索引
CREATE TABLE example_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL DEFAULT '',
  status TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status_created (status, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 分页查询
SELECT id, name, status, created_at
FROM example_item
WHERE status = 1
ORDER BY id DESC
LIMIT 20 OFFSET 0;
`

export const BUILTIN_TEMPLATES = Object.freeze([
  {
    id: 'readme',
    name: 'README 骨架',
    description: '项目说明、快速开始、配置与目录结构',
    category: 'docs',
    targetPath: '/markdown-editor',
    tags: ['readme', '文档', '开源'],
    content: markdownReadme
  },
  {
    id: 'tech-review',
    name: '技术方案评审',
    description: '背景、目标、方案、风险与排期的评审文档',
    category: 'docs',
    targetPath: '/markdown-editor',
    tags: ['评审', '方案', '设计'],
    content: markdownReview
  },
  {
    id: 'weekly-report',
    name: '周报',
    description: '已完成、进行中、风险与下周计划',
    category: 'docs',
    targetPath: '/markdown-editor',
    tags: ['周报', '汇报'],
    content: markdownWeekly
  },
  {
    id: 'api-doc',
    name: '接口文档',
    description: '请求参数、响应示例与错误码',
    category: 'docs',
    targetPath: '/markdown-editor',
    tags: ['接口', 'API', '文档'],
    content: markdownApi
  },
  {
    id: 'commit-message',
    name: '提交信息规范',
    description: 'Conventional Commits 类型与示例',
    category: 'docs',
    targetPath: '/markdown-editor',
    tags: ['git', 'commit', '规范'],
    content: markdownCommit
  },
  {
    id: 'html-email',
    name: 'HTML 邮件骨架',
    description: '内联样式的居中卡片邮件模板',
    category: 'docs',
    targetPath: '/html-viewer',
    tags: ['html', '邮件'],
    content: htmlEmail
  },
  {
    id: 'github-actions',
    name: 'GitHub Actions 工作流',
    description: '安装依赖、检查、测试与构建',
    category: 'config',
    targetPath: '/yaml-editor',
    tags: ['ci', 'github', 'yaml'],
    content: yamlActions
  },
  {
    id: 'api-response',
    name: 'API 响应样例',
    description: '带分页字段的标准响应结构',
    category: 'data',
    targetPath: '/json-parser',
    tags: ['json', 'api', '响应'],
    content: jsonApiSample
  },
  {
    id: 'mysql-table',
    name: 'MySQL 建表与分页查询',
    description: 'InnoDB 建表语句与常用分页查询',
    category: 'data',
    targetPath: null,
    tags: ['sql', 'mysql', '建表'],
    content: sqlTable
  }
])

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([^{}\n]+?)\s*\}\}/g

export function extractTemplateVariables(content) {
  if (typeof content !== 'string') return []
  const seen = new Set()
  const names = []
  for (const match of content.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const name = match[1].trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

export function fillTemplate(content, values = {}) {
  if (typeof content !== 'string') return ''
  const source = values && typeof values === 'object' ? values : {}
  return content.replace(TEMPLATE_VARIABLE_PATTERN, (match, raw) => {
    const name = raw.trim()
    const value = source[name]
    return typeof value === 'string' && value.trim() ? value : match
  })
}

export function filterTemplates(templates, query, category) {
  const keyword = typeof query === 'string' ? query.trim().toLowerCase() : ''
  const targetCategory = typeof category === 'string' && category !== 'all' ? category : ''
  return templates.filter((template) => {
    if (targetCategory && template.category !== targetCategory) return false
    if (!keyword) return true
    const haystack = [template.name, template.description, ...(template.tags || []), template.content]
      .join('\n')
      .toLowerCase()
    return haystack.includes(keyword)
  })
}

export function getTemplateById(templates, id) {
  return templates.find((template) => template.id === id) || null
}

export function getTemplateCategoryName(categoryId) {
  const entry = TEMPLATE_CATEGORIES.find((item) => item.id === categoryId)
  return entry ? entry.name : ''
}

export function collectPluginTemplates(plugins) {
  if (!Array.isArray(plugins)) return []
  const items = []
  for (const plugin of plugins) {
    const name = typeof plugin?.name === 'string' ? plugin.name.trim() : ''
    if (!name) continue
    const templates = Array.isArray(plugin.templates) ? plugin.templates : []
    for (const template of templates) {
      if (!template || typeof template.id !== 'string' || !template.id) continue
      items.push({ ...template, id: `plugin:${name}:${template.id}`, plugin: name })
    }
  }
  return items
}
