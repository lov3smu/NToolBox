import { getMemoryOverview, addMemory, updateMemory, removeMemory } from '../../../services/memory.js'

function summarize(text, limit = 120) {
  const value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function formatEntries(title, entries) {
  if (entries.length === 0) return `${title}：暂无`
  const lines = entries.map((entry, index) => {
    const tags = entry.tags.length ? `[${entry.tags.join('/')}] ` : ''
    return `${index + 1}. ${tags}${summarize(entry.content)}（id: ${entry.id}）`
  })
  return `${title}（${entries.length} 条）：\n${lines.join('\n')}`
}

export default async function handler(params, context) {
  const action = params.action
  const scope = params.scope === 'project' ? 'project' : 'global'
  const workspacePath = typeof context?.workspacePath === 'string' ? context.workspacePath : ''

  if (action === 'list') {
    const overview = await getMemoryOverview(workspacePath)
    const content = [
      formatEntries('全局记忆', overview.global),
      formatEntries('项目记忆', overview.project),
      `外挂知识库：${overview.knowledge.length} 个来源（启用 ${overview.knowledgeEnabled} 个）`
    ].join('\n\n')
    return {
      success: true,
      content,
      metadata: {
        action,
        global: overview.global.length,
        project: overview.project.length,
        knowledge: overview.knowledge.length
      }
    }
  }

  if (action === 'add') {
    const result = await addMemory({
      scope,
      workspacePath,
      content: params.content,
      tags: params.tags,
      source: 'ai'
    })
    if (!result.success) return { success: false, error: result.error }
    return {
      success: true,
      content: `${result.duplicated ? '该内容已存在，已更新标签' : '已保存'}到${
        scope === 'global' ? '全局记忆' : '项目记忆'
      }：${summarize(result.entry.content)}（id: ${result.entry.id}）`,
      metadata: { action, scope, id: result.entry.id }
    }
  }

  if (action === 'update') {
    const result = await updateMemory({
      scope,
      workspacePath,
      id: params.id,
      content: params.content,
      tags: params.tags
    })
    if (!result.success) return { success: false, error: result.error }
    return {
      success: true,
      content: `记忆已更新：${summarize(result.entry.content)}（id: ${result.entry.id}）`,
      metadata: { action, scope, id: result.entry.id }
    }
  }

  if (action === 'remove') {
    const result = await removeMemory({ scope, workspacePath, id: params.id })
    if (!result.success) return { success: false, error: result.error }
    return {
      success: true,
      content: `已删除${scope === 'global' ? '全局' : '项目'}记忆（id: ${params.id}）`,
      metadata: { action, scope, id: params.id }
    }
  }

  return { success: false, error: `未知的记忆操作：${action}` }
}
