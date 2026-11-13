import { dbExecuteQuery } from '@/api'
export function createPagination(state, api) {
  const { limitCount, lastExecutedSql } = state

  async function firstPage(tab) {
    if (!tab.queryResult || tab.queryResult.currentPage <= 1) return
    await loadPageData(tab, 1)
  }

  async function lastPage(tab) {
    if (!tab.queryResult || tab.queryResult.currentPage >= tab.queryResult.totalPages) return
    await loadPageData(tab, tab.queryResult.totalPages)
  }

  async function prevPage(tab) {
    if (!tab.queryResult || tab.queryResult.currentPage <= 1) return
    await loadPageData(tab, tab.queryResult.currentPage - 1)
  }

  async function nextPage(tab) {
    if (!tab.queryResult || tab.queryResult.currentPage >= tab.queryResult.totalPages) return
    await loadPageData(tab, tab.queryResult.currentPage + 1)
  }

  async function jumpToPage(tab) {
    if (!tab.queryResult || !tab.queryResult.jumpPage) return
    const targetPage = Math.max(1, Math.min(tab.queryResult.jumpPage, tab.queryResult.totalPages))
    await loadPageData(tab, targetPage)
  }

  async function loadPageData(tab, page) {
    if (tab.type === 'table') {
      const hasPending =
        Object.keys(tab.rowEdits || {}).length > 0 ||
        Object.keys(tab.rowDeletes || {}).length > 0 ||
        (tab.rowInserts || []).length > 0
      if (hasPending) {
        const confirmed = await api.showConfirm('翻页会丢弃未保存的修改，是否继续？')
        if (!confirmed) return
      }
      await api.executeTableQuery(tab, page)
      return
    }

    if (!tab.connectionName || !tab.sqlQuery) return

    let sql = tab.sqlQuery.trim()
    if (!/^\s*select\b/i.test(sql)) return

    const pageSize = Math.max(1, Number(limitCount.value) || 100)
    const offset = (page - 1) * pageSize

    sql = sql.replace(/\s+limit\s+(?:\d+\s*,\s*)?\d+(?:\s+offset\s+\d+)?\s*;?\s*$/i, '')
    if (sql.toLowerCase().endsWith(';')) {
      sql = sql.slice(0, -1)
    }
    sql = `${sql} LIMIT ${offset}, ${pageSize}`

    tab.executing = true
    const requestId = `${tab.id}_${Date.now()}`
    tab.requestId = requestId

    try {
      const startedAt = Date.now()
      const result = await dbExecuteQuery(tab.connectionName, sql, [], {
        autoLimit: false,
        requestId,
        database: tab.database
      })
      const duration = Date.now() - startedAt

      if (!tab.queryResult) return

      Object.assign(tab.queryResult, {
        success: result.success,
        rows: result.rows,
        fields: result.fields,
        error: result.error,
        canceled: result.canceled,
        duration,
        rowCount: result.rowCount || 0,
        currentPage: page,
        jumpPage: page
      })
    } catch (error) {
      console.error('分页查询失败:', error)
      if (tab.queryResult) {
        Object.assign(tab.queryResult, { success: false, error: error.message })
      }
    } finally {
      tab.executing = false
      tab.requestId = null
    }
  }

  async function copyLastSql() {
    if (!lastExecutedSql.value) return
    try {
      await navigator.clipboard.writeText(lastExecutedSql.value)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return { firstPage, lastPage, prevPage, nextPage, jumpToPage, loadPageData, copyLastSql }
}
