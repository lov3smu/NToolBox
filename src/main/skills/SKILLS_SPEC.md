# Skills 规范说明

## 概述

Skills 是 AI 助手的可扩展工具模块。每个 Skill 就是一条 function calling 工具定义：模型根据 `description` 和 `parameters` 选择调用，主进程负责参数校验与执行。

系统支持三类来源：

| 类型 | 位置 | 说明 |
|------|------|------|
| builtin | `src/main/skills/builtin/<name>/` | 随应用打包，只读，不可卸载、不可被同名用户技能覆盖 |
| market | `src/main/skills/market/<name>/` | 随应用打包的技能市场模板，安装后复制到用户目录 |
| user | `<dataDir>/skills/<name>/` | 用户安装或自行开发的技能；`dataDir` 由 `src/main/utils/appPaths.js` 解析（见 PROJECT.md 存储布局） |
| remote | ClawHub | 通过远程市场安装，安装方式与 market 相同（临时目录 + rename） |

## 目录结构

```
builtin/                 # 或 market/、<dataDir>/skills/
└── skill-name/
    ├── skill.json       # 必需：工具定义
    ├── handler.js       # 可选：本地执行逻辑（与 promptTemplate 二选一）
    └── prompt.txt       # 可选：Prompt 模板（与 handler 二选一）
```

`handler` 优先于 `promptTemplate`。两者都没有的 Skill 会加载成功但无法执行。

## skill.json

```json
{
  "name": "demo-skill",
  "version": "1.0.0",
  "description": "一句话说明能力、触发场景和边界",
  "author": "system",
  "type": "builtin",
  "category": "general",
  "tags": ["示例"],
  "icon": "code",
  "parameters": {
    "type": "object",
    "properties": {
      "input": {
        "type": "string",
        "description": "输入内容"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 200,
        "default": 100,
        "description": "返回条数，默认100"
      }
    },
    "required": ["input"],
    "additionalProperties": false
  },
  "handler": "handler.js",
  "examples": [
    {
      "input": "示例输入",
      "output": "示例输出"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✓ | 唯一标识，必须匹配 `^[a-z0-9][a-z0-9-]*$` |
| version | string | ✓ | SemVer，修改行为时递增 |
| description | string | ✓ | 会原样发送给模型，应简洁说明能力与限制 |
| author | string | ✓ | 作者或来源 |
| type | string | - | 运行时以所在目录为准（builtin/user），manifest 中的值会被覆盖 |
| category | string | - | 展示分类：code/database/document/general/security |
| tags | array | - | 用于市场搜索与展示 |
| icon | string | - | 展示图标名，见 `src/renderer/src/utils/skillIcons.js` |
| parameters | object | ✓ | JSON Schema 子集，见下文 |
| handler | string | - | 相对 Skill 目录的模块路径 |
| promptTemplate | string | - | 相对 Skill 目录的模板路径 |
| examples | array | - | 仅用于扩展管理界面展示，不会发送给模型 |

`semantic_rules` 字段已废弃：模型只能看到 `description` 和 `parameters`，路由规则请写入 `description` 或 `chat.js` 的系统提示词。

### parameters 约定

- 只支持 `type`、`properties`、`required`、`items`、`enum`、`minimum`、`maximum`、`default`、`additionalProperties`。
- 执行前会由 `src/main/services/skillSchema.js` 统一校验：缺失必填、类型、枚举、数值范围都会返回明确错误。
- `default` 会在调用前自动补齐；不要只在 `description` 里写"默认 xxx"。
- 未知参数会被丢弃，不会传给 handler。
- 必填参数不要依赖示例或系统提示词补齐；示例只用于界面展示。

## 执行方式

### Handler

```javascript
export default async function handler(params, context) {
  const { input } = params
  const { log, database, getConfig } = context

  log.debug('执行 demo-skill')

  return {
    success: true,
    content: '给模型看的文本结果',
    metadata: { extra: '结构化数据' }
  }
}
```

`context` 包含：

| 字段 | 说明 |
|------|------|
| config | 当前配置只读快照 |
| log | electron-log 实例 |
| skill | 当前 Skill 定义 |
| database | 数据库服务（连接、查询、结构等） |
| getConfig | 获取最新配置 |
| isPathWithinBase | 路径越界校验函数，处理用户提供的文件路径时必须调用 |
| generateSQLFile | 生成规范 SQL 脚本 |
| executeDictionarySql | 字典 SQL 生成 |
| executeFunctionGroupSql | 功能权限组 SQL 生成 |

约束：

- 执行超时 120 秒，超时返回失败。
- 返回对象必须包含 `success`；失败时提供 `error`，不要把失败包装成成功。
- `metadata` 会原样进入模型上下文，避免返回全量数据；大结果集要截断并标记 `truncated`。
- 不要在日志中输出密码、完整 SQL 结果、文件内容等敏感信息。
- handler 模块会被 `import()` 缓存，更新用户技能后需重启应用才能生效。

### Prompt 模板

```
你是一个专业的代码审查助手。请审查以下代码：

语言：{{language}}
审查重点：{{focus}}

{{code}}
```

- 变量使用 `{{name}}`，只允许替换 `parameters.properties` 中声明的参数。
- 替换是严格模式：缺失参数直接返回错误，不会把占位符发给模型。
- 默认值由 `parameters` 的 `default` 补齐。
- Prompt 技能跟随当前聊天使用的 provider 和 model；通过 IPC 单独执行时回退到 `config.ai_provider` 与默认模型。

## 校验与加载规则

1. 目录中缺少 `skill.json` 或缺少 `name`/`description` 时跳过并记录警告。
2. `name` 不合法或重名时跳过；同名用户技能不能覆盖内置技能。
3. 用户技能目录按名称排序加载，重复的用户技能只保留第一个。
4. 安装技能会先校验目录与 manifest，再复制到用户目录；ClawHub 安装使用临时目录 + rename。
5. 用户技能与市场技能会在主进程中执行任意 JavaScript，安装前必须确认来源可信。

## 服务 API

```javascript
import { initSkills, getSkillsManager, executeSkill, getSkillToolDefinitions } from './skills.js'

await initSkills()
const manager = getSkillsManager()

manager.getSkills() // 展示用列表
manager.getToolDefinitions() // function calling 定义（只含 name/description/parameters）
await executeSkill('code-review', { code }, { provider, model }) // 第三个参数可选
```

## 内置 Skills

| 名称 | 执行方式 | 说明 |
|------|----------|------|
| db-connect | handler | 列出/测试/建立/断开数据库连接 |
| db-query | handler | 列出数据库、表，执行只读 SQL |
| db-schema | handler | 表结构、建表语句、索引、字段详情 |
| dictionary-sql | handler | 生成字典配置 SQL |
| function-group-sql | handler | 生成功能权限组 SQL |
| sql-script | handler | 生成规范命名的 SQL 脚本文件 |
| sql-optimize | prompt | SQL 性能优化建议 |
| sql-config | handler | 读取脚本生成配置 |
| code-review | prompt | 代码质量/安全/性能审查 |
| code-generate | prompt | 按需求生成代码 |
| api-design | prompt | 设计 RESTful/GraphQL/RPC API |
| doc-generate | prompt | 生成行内注释、API 文档或 README |
| password | handler | 密码学安全随机密码 |
| timestamp | handler | 时间戳与日期互转，支持时区 |
| cron | handler | 生成 5 段 Cron 表达式 |
| file-ops | handler | 在 base_path 内列出、读写、复制、移动、删除、搜索文件 |
| json-format | handler | 格式化/校验 JSON |
| yaml-validate | handler | 使用 js-yaml 校验 YAML |

## 最佳实践

1. **命名**：小写字母、数字、连字符，如 `code-review`。
2. **描述**：一句话写清能力、触发词和禁止事项；不要写成长篇规则。
3. **参数**：必填尽量少，默认值写进 schema，数值参数给出 `minimum`/`maximum`。
4. **错误**：失败返回 `success: false` 与可执行的 `error`，不要编造结果。
5. **安全**：数据库工具只允许只读语句；文件路径必须经过 `isPathWithinBase`。
6. **版本**：行为变更递增版本号；`examples` 只用于展示。
