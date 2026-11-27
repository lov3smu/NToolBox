import { searchKnowledge } from '../../../services/agent/memory.js'

export default async function handler(params, context) {
  const result = await searchKnowledge({ query: params.query, topK: params.top_k })
  if (!result.success) return { success: false, error: result.error }

  const metadata = {
    action: 'knowledge-search',
    query: result.query,
    count: result.results.length,
    searchedFiles: result.searchedFiles,
    results: result.results.map((item) => ({
      path: item.path,
      label: item.label,
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel,
      score: item.score
    }))
  }

  if (result.results.length === 0) {
    const reason = result.message || `未在知识库中找到与「${result.query}」匹配的内容`
    const detail = result.searchedFiles ? `（已扫描 ${result.searchedFiles} 个文件）` : ''
    context?.log?.debug?.(`knowledge-search 无结果：${result.query}`)
    return { success: true, content: `${reason}${detail}`, metadata }
  }

  const lines = [
    `知识库检索「${result.query}」命中 ${result.results.length} 条${
      result.searchedFiles ? `（扫描 ${result.searchedFiles} 个文件）` : ''
    }：`
  ]
  result.results.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.path}（来源：${item.sourceLabel}，匹配度 ${item.score}）\n   ${item.excerpt}`)
  })
  if (result.truncated) lines.push('提示：知识库文件较多，本次只扫描了前 600 个文件')

  return { success: true, content: lines.join('\n'), metadata }
}
