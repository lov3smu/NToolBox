# Skills 规范说明

## 概述

Skills 是可扩展的功能模块，用于增强 AI 助手的能力。系统支持两种类型的 Skills：
- **内置 Skills (builtin)**：系统预置的通用技能，随应用一起提供
- **用户 Skills (user)**：用户自行安装或开发的技能，可动态扩展

## Skills 目录结构

```
skills/
├── builtin/              # 内置 Skills
│   ├── code-review/      # 代码审查 Skill
│   │   ├── skill.json    # Skill 定义文件
│   │   ├── handler.js    # Skill 处理逻辑（可选）
│   │   └── prompt.txt    # Prompt 模板（可选）
│   │   └── README.md     # Skill 说明文档
│   ├── code-generate/    # 代码生成 Skill
│   ├── doc-generate/     # 文档生成 Skill
│   └── sql-optimize/     # SQL优化 Skill
│
└── user/                 # 用户 Skills（可选）
│   └── custom-skill/
│       ├── skill.json
│       └── handler.js
```

## Skill 定义文件 (skill.json)

```json
{
  "name": "skill-name",
  "version": "1.0.0",
  "description": "Skill 功能描述",
  "author": "作者名称",
  "type": "builtin",
  "category": "code|database|document|general",
  "tags": ["代码", "审查"],
  "icon": "icon-name",
  "parameters": {
    "type": "object",
    "properties": {
      "input": {
        "type": "string",
        "description": "输入内容描述"
      }
    },
    "required": ["input"]
  },
  "handler": "handler.js",
  "promptTemplate": "prompt.txt",
  "examples": [
    {
      "input": "示例输入",
      "output": "示例输出描述"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✓ | Skill 唯一标识名 |
| version | string | ✓ | 版本号，格式：x.y.z |
| description | string | ✓ | 功能描述 |
| author | string | ✓ | 作者/来源 |
| type | string | ✓ | 类型：builtin 或 user |
| category | string | ✓ | 分类：code/database/document/general |
| tags | array | - | 标签，用于搜索和分类 |
| icon | string | - | 图标名称 |
| parameters | object | ✓ | 参数定义，遵循 JSON Schema |
| handler | string | - | 处理脚本路径，优先使用 |
| promptTemplate | string | - | Prompt 模板路径，无 handler 时使用 |
| examples | array | - | 使用示例 |

## Skill 实现方式

### 方式一：Handler 脚本

适用于需要复杂逻辑处理、调用外部服务的场景。

```javascript
// handler.js
export default async function handler(params, context) {
  const { input } = params
  const { config, log } = context
  
  // 处理逻辑
  const result = await processData(input)
  
  return {
    success: true,
    content: result,
    metadata: {}
  }
}

// 支持 schema 导出（可选）
export const schema = {
  input: { type: 'string', description: '...' }
}
```

### 方式二：Prompt 模板

适用于基于 AI 对话的场景，简单灵活。

```
// prompt.txt
你是一个专业的代码审查助手。请对以下代码进行审查：

{{input}}

审查要点：
1. 代码质量和可读性
2. 潜在的bug和错误
3. 性能优化建议
4. 安全性问题

请提供详细的审查报告。
```

模板变量使用 `{{变量名}}` 格式，系统会自动替换。

## Skills 管理服务 API

### 加载 Skills
```javascript
import { SkillsManager } from './skills'

const manager = new SkillsManager()
await manager.loadSkills()
```

### 获取 Skills 列表
```javascript
const skills = manager.getSkills()
// [{ name, description, type, category, ... }]
```

### 执行 Skill
```javascript
const result = await manager.executeSkill('code-review', {
  input: '代码内容'
})
```

### 安装/卸载 Skill
```javascript
await manager.installSkill(skillPath)
await manager.uninstallSkill('skill-name')
```

## 内置 Skills 列表

### 1. code-review (代码审查)
审查代码质量、安全性、性能等问题

### 2. code-generate (代码生成)
根据需求生成代码片段

### 3. doc-generate (文档生成)
为代码生成文档说明

### 4. sql-optimize (SQL优化)
优化SQL查询性能

### 5. api-design (API设计)
设计RESTful API规范

### 6. data-analyze (数据分析)
分析数据特征和趋势

## 用户 Skills 开发指南

1. 创建 Skill 目录：`skills/user/your-skill/`
2. 编写 `skill.json` 定义文件
3. 实现 `handler.js` 或 `prompt.txt`
4. 测试 Skill 功能
5. 可选：编写 `README.md` 说明文档

## 最佳实践

1. **命名规范**：使用小写字母和连字符，如 `code-review`
2. **参数设计**：参数应简洁明确，避免过多必填参数
3. **错误处理**：Handler 应捕获异常，返回清晰的错误信息
4. **日志记录**：使用 context.log 记录关键操作
5. **通用性**：Skill 应尽量通用，不依赖特定项目结构
6. **版本管理**：更新 Skill 时同步更新版本号