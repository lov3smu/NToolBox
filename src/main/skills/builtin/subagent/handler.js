const ALLOWED_TOOLS = new Set([
  'web-fetch',
  'knowledge-search',
  'db-query',
  'result-read',
  'timestamp',
  'json-format',
  'yaml-validate'
])
const MAX_TASK_LENGTH = 4000
const MAX_CONTEXT_LENGTH = 4000
const MAX_OUTPUT_LENGTH = 12000

function selectReadOnlyTools(context) {
  if (typeof context.listToolDefinitions !== 'function') return []
  return context.listToolDefinitions().filter((tool) => {
    const name = tool?.function?.name
    return Boolean(name) && ALLOWED_TOOLS.has(name)
  })
}

function buildPrompt(task, context) {
  const lines = [
    '你是子代理，只负责完成下面这一个子任务；完成后立即给出结论，不要继续扩展任务范围。',
    `子任务：${task}`
  ]
  if (context) lines.push(`补充背景：${context}`)
  lines.push(
    '执行要求：',
    '- 只能使用提供的只读工具获取事实，不得编造数据或路径；',
    '- 最多进行少量必要的工具调用，拿到足够信息就停止；',
    '- 输出简洁的中文结论，列出关键发现，并注明依据来自哪个工具结果。'
  )
  return lines.join('\n')
}

export default async function handler(params, runtime = {}) {
  const task = typeof params.task === 'string' ? params.task.trim() : ''
  if (!task) return { success: false, error: '缺少子任务描述' }
  if (task.length > MAX_TASK_LENGTH) {
    return { success: false, error: `子任务描述过长（最多 ${MAX_TASK_LENGTH} 字）` }
  }

  const extra = typeof params.context === 'string' ? params.context.trim().slice(0, MAX_CONTEXT_LENGTH) : ''
  const tools = selectReadOnlyTools(runtime)
  if (tools.length === 0) return { success: false, error: '当前没有可供子代理使用的只读工具' }
  if (typeof runtime.runChat !== 'function') return { success: false, error: '子代理运行环境不可用' }

  const config = runtime.config || {}

  try {
    const result = await runtime.runChat([{ role: 'user', content: buildPrompt(task, extra) }], {
      provider: runtime.providerType || config.ai.provider || undefined,
      model: runtime.model || undefined,
      workspacePath: runtime.workspacePath,
      tools,
      toolsEnabled: true
    })

    if (!result?.success) {
      return { success: false, error: result?.error || '子代理执行失败' }
    }

    const content = String(result.content || '').trim()
    if (!content) return { success: false, error: '子代理没有返回结论' }

    return {
      success: true,
      content: content.slice(0, MAX_OUTPUT_LENGTH),
      metadata: {
        action: 'subagent',
        tools: tools.map((tool) => tool.function.name),
        model: runtime.model || ''
      }
    }
  } catch (error) {
    return { success: false, error: error?.message || String(error) }
  }
}
