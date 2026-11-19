import { t } from '@/i18n'
import {
  dbCompareSchemas,
  dbCreateTable,
  dbExportTable,
  dbGetTableMeta,
  dbQueryTables,
  getConfig,
  readFile,
  saveSqlFile,
  selectSqlFile,
  writeFile
} from '@/api'
import { copyToClipboard } from '@/utils/clipboard'
export function createDatabaseOps(state, api) {
  const {
    activeTabId,
    cellViewer,
    connectionDatabases,
    connections,
    createTableDialog,
    schemaDiffDialog,
    selectedDatabase,
    tables,
    tabs
  } = state

  function openCreateTableDialog(target) {
    if (!target?.connection || !target.database) return
    api.selectConnection(target.connection)
    if (!target.connection.active) {
      api.connectToDatabase()
    }
    createTableDialog.value = {
      show: true,
      connectionName: target.connection.name,
      database: target.database
    }
  }

  function closeCreateTableDialog() {
    createTableDialog.value = { ...createTableDialog.value, show: false }
  }

  async function submitCreateTable(payload) {
    const { connectionName, database } = createTableDialog.value
    if (!connectionName || !database) return { success: false, error: t('请先选择数据库') }

    const result = await dbCreateTable(connectionName, database, payload.tableName, payload)
    if (!result.success) return result

    closeCreateTableDialog()
    await api.loadDatabaseObjects(connectionName, database, undefined, { force: true })
    if (selectedDatabase.value === database) {
      await api.selectDatabase(database)
    }
    await api.showMessage(t('表 "{p0}" 已创建', { p0: payload.tableName }), 'success')
    return result
  }

  async function openSchemaDiffDialog(target) {
    if (!target?.connection || !target.database) return
    api.selectConnection(target.connection)
    if (!target.connection.active) {
      await api.connectToDatabase()
    }
    schemaDiffDialog.value = {
      show: true,
      connectionName: target.connection.name,
      database: target.database,
      targetConnectionName: target.connection.name,
      targetDatabase: '',
      loading: false,
      result: null,
      error: ''
    }
    await api.loadConnectionDatabases(target.connection.name)
  }

  function closeSchemaDiffDialog() {
    schemaDiffDialog.value = { ...schemaDiffDialog.value, show: false }
  }

  async function loadDiffDatabases(connectionName) {
    if (!connectionName) return []
    const conn = connections.value.find((item) => item.name === connectionName)
    if (conn && !conn.active) {
      api.selectConnection(conn)
      await api.connectToDatabase()
    }
    if (!connectionDatabases.value[connectionName]) {
      await api.loadConnectionDatabases(connectionName)
    }
    return connectionDatabases.value[connectionName] || []
  }

  async function compareSchemaDiff() {
    const { connectionName, database, targetConnectionName, targetDatabase } = schemaDiffDialog.value
    if (!connectionName || !database || !targetConnectionName || !targetDatabase) {
      schemaDiffDialog.value.error = t('请选择源连接/数据库和目标连接/数据库')
      return
    }
    schemaDiffDialog.value.loading = true
    schemaDiffDialog.value.error = ''
    try {
      const result = await dbCompareSchemas(connectionName, database, targetConnectionName, targetDatabase)
      if (!result.success) {
        schemaDiffDialog.value.error = result.error || t('结构对比失败')
        schemaDiffDialog.value.result = null
      } else {
        schemaDiffDialog.value.result = result
      }
    } catch (error) {
      schemaDiffDialog.value.error = error.message || t('结构对比失败')
    } finally {
      schemaDiffDialog.value.loading = false
    }
  }

  async function copySchemaDiffSql() {
    const statements = schemaDiffDialog.value.result?.statements || []
    if (!statements.length) {
      await api.showMessage(t('没有需要同步的 SQL'), 'warning')
      return
    }
    const text = statements.map((sql) => `${sql};`).join('\n\n')
    const copied = await copyToClipboard(text)
    await api.showMessage(copied ? t('同步 SQL 已复制到剪贴板') : t('复制失败'), copied ? 'success' : 'error')
  }

  function openCellViewer(field, columnType, value, extra = {}) {
    cellViewer.value = {
      show: true,
      field: field || '',
      columnType: columnType || '',
      value,
      loading: Boolean(extra.load),
      byteLength: Number(extra.byteLength) || 0,
      error: '',
      load: extra.load || null
    }
    if (!extra.load) return
    const loader = extra.load
    loader()
      .then((result) => {
        const viewer = cellViewer.value
        if (!viewer.show || viewer.load !== loader) return
        if (result?.success) viewer.value = result.value
        else viewer.error = result?.error || t('读取失败')
      })
      .catch((error) => {
        const viewer = cellViewer.value
        if (viewer.show && viewer.load === loader) viewer.error = error.message || t('读取失败')
      })
      .finally(() => {
        const viewer = cellViewer.value
        if (viewer.show && viewer.load === loader) viewer.loading = false
      })
  }

  function closeCellViewer() {
    cellViewer.value = { ...cellViewer.value, show: false, load: null, loading: false }
  }

  async function editDatabase(target) {
    if (!target.connection || !target.database) return
    api.selectConnection(target.connection)
    await api.selectDatabase(target.database)

    api.createQueryTab(target.connection.name, target.database)
    const activeTab = tabs.value.find((t) => t.id === activeTabId.value)
    if (activeTab) {
      activeTab.sqlQuery = [
        t('-- 编辑数据库: {name}', { name: target.database }),
        t('-- 修改数据库字符集'),
        `ALTER DATABASE \`${target.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      ].join('\n')
    }
  }

  async function deleteDatabase(target) {
    if (!target.connection || !target.database) return

    const confirmed = await api.showConfirm(t('确定要删除数据库 "{p0}" 吗？此操作不可恢复！', { p0: target.database }))
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(`DROP DATABASE \`${target.database}\`;`, target.connection.name)

    if (result.success) {
      await api.loadConnectionDatabases(target.connection.name)
      if (selectedDatabase.value === target.database) {
        selectedDatabase.value = ''
        tables.value = []
      }
      await api.showMessage(t('数据库 "{p0}" 已删除', { p0: target.database }), 'success')
    } else {
      await api.showMessage(t('删除数据库失败: ') + result.error, 'error')
    }
  }

  function newQueryForDatabase(target) {
    if (!target.connection || !target.database) return
    api.selectConnection(target.connection)
    if (!target.connection.active) {
      api.connectToDatabase()
    }
    api.createQueryTab(target.connection.name, target.database)
  }

  function findRiskyStatements(sqlText) {
    const risks = []
    for (const raw of String(sqlText || '').split(';')) {
      const statement = raw.replace(/^(?:\/\*[\s\S]*?\*\/|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\s)+/g, '').trim()
      if (!statement) continue
      if (/^drop\b/i.test(statement)) {
        risks.push(t('删除对象: {p0}', { p0: statement.split('\n')[0].slice(0, 80) }))
      } else if (/^truncate\b/i.test(statement)) {
        risks.push(t('清空表: {p0}', { p0: statement.split('\n')[0].slice(0, 80) }))
      } else if (/^(update|delete)\b/i.test(statement) && !/\bwhere\b/i.test(statement)) {
        risks.push(t('缺少 WHERE: {p0}', { p0: statement.split('\n')[0].slice(0, 80) }))
      }
    }
    return risks
  }

  async function confirmRiskySqlFile(sqlText) {
    try {
      const config = await getConfig()
      if (config?.database?.safe_mode === false) return true
    } catch {
      return true
    }
    const risks = findRiskyStatements(sqlText)
    if (!risks.length) return true
    const preview = risks
      .slice(0, 5)
      .map((risk, index) => `${index + 1}. ${risk}`)
      .join('\n')
    const more = risks.length > 5 ? t('… 另有 {count} 条', { count: risks.length - 5 }) : ''
    const message = [
      t('SQL 文件中包含 {count} 条高风险语句：', { count: risks.length }),
      preview,
      more,
      '',
      t('确认继续执行吗？')
    ]
      .filter(Boolean)
      .join('\n')
    return api.showConfirm(message, t('安全模式'))
  }

  async function runSqlFile(target) {
    if (!target.connection) return
    try {
      const result = await selectSqlFile()

      if (result.canceled || !result.filePaths.length) return

      const filePath = result.filePaths[0]
      const fileResult = await readFile(filePath)

      if (!fileResult.success) {
        await api.showMessage(t('读取文件失败: ') + fileResult.error, 'error')
        return
      }

      const sqlContent = fileResult.content

      if (!(await confirmRiskySqlFile(sqlContent))) return

      api.selectConnection(target.connection)

      if (!target.connection.active) {
        await api.connectToDatabase()
      }

      const sql = target.database ? `USE \`${target.database}\`;\n${sqlContent}` : sqlContent

      const execResult = await api.executeSqlDirect(sql, target.connection.name)

      if (execResult.success) {
        await api.showMessage(t('SQL文件执行成功'), 'success')
      } else {
        await api.showMessage(t('SQL文件执行失败: ') + execResult.error, 'error')
      }
    } catch (error) {
      console.error('运行SQL文件失败:', error)
      await api.showMessage(t('运行SQL文件失败: ') + error.message, 'error')
    }
  }

  async function dumpDatabase(target, type) {
    if (!target.connection || !target.database) return

    try {
      api.selectConnection(target.connection)

      if (!target.connection.active) {
        await api.connectToDatabase()
      }

      const tablesResult = await dbQueryTables(target.connection.name, target.database)
      if (!tablesResult.success) {
        await api.showMessage(t('获取表列表失败: ') + (tablesResult.error || ''), 'error')
        return
      }

      const tableNames = (tablesResult.details || []).filter((table) => !table.isView).map((table) => table.name)

      const header = [
        t('-- 数据库转储: {p0}', { p0: target.database }),
        t('-- 生成时间: {p0}', { p0: new Date().toISOString() }),
        t('-- 连接: {p0}:{p1}', { p0: target.connection.host, p1: target.connection.port }),
        '',
        `CREATE DATABASE IF NOT EXISTS \`${target.database}\`;`,
        `USE \`${target.database}\`;`,
        ''
      ].join('\n')

      const parts = [header]
      let truncated = false

      for (const tableName of tableNames) {
        if (type === 'structure') {
          const meta = await dbGetTableMeta(target.connection.name, target.database, tableName)
          if (!meta.success) {
            parts.push(t('-- 获取表 {p0} 结构失败: {p1}', { p0: tableName, p1: meta.error }), '')
            continue
          }
          parts.push(t('-- 表结构: {p0}', { p0: tableName }))
          parts.push(`DROP TABLE IF EXISTS \`${tableName}\`;`)
          parts.push(`${meta.ddl};`, '')
          continue
        }

        const exported = await dbExportTable(target.connection.name, target.database, tableName, {
          format: 'sql',
          includeStructure: true,
          maxRows: 1000000
        })

        if (!exported.success) {
          parts.push(t('-- 导出表 {p0} 失败: {p1}', { p0: tableName, p1: exported.error }), '')
          continue
        }

        parts.push(t('-- 表: {p0} ({p1} 行)', { p0: tableName, p1: exported.rowCount }))
        parts.push(exported.content, '')
        if (exported.truncated) truncated = true
      }

      if (truncated) {
        parts.push(t('-- 提示: 部分表数据量超过导出上限，已截断'), '')
      }

      const defaultFileName = `${target.database}_${type}_${Date.now()}.sql`
      const saveResult = await saveSqlFile(defaultFileName)

      if (saveResult.canceled || !saveResult.filePath) return

      const writeResult = await writeFile(saveResult.filePath, parts.join('\n'))

      if (writeResult.success) {
        await api.showMessage(t('转储文件已保存到: {p0}', { p0: saveResult.filePath }), 'success')
      } else {
        await api.showMessage(t('保存文件失败: ') + writeResult.error, 'error')
      }
    } catch (error) {
      console.error('转储数据库失败:', error)
      await api.showMessage(t('转储数据库失败: ') + error.message, 'error')
    }
  }

  async function refreshDatabase(target) {
    if (!target.connection) return

    api.selectConnection(target.connection)
    await api.loadConnectionDatabases(target.connection.name)

    if (target.database) {
      await api.selectDatabase(target.database)
    }

    await api.showMessage(t('数据库列表已刷新'), 'success')
  }

  async function refreshCategory(target) {
    if (!target.connection || !target.database || !target.category) return

    api.selectConnection(target.connection)

    if (!target.connection.active) {
      await api.connectToDatabase()
    }

    await api.loadDatabaseCategory(target.connection.name, target.database, target.category, { force: true })

    const categoryLabels = {
      tables: t('表'),
      views: t('视图'),
      functions: t('函数'),
      procedures: t('存储过程'),
      triggers: t('触发器'),
      events: t('事件')
    }
    await api.showMessage(t('{p0}列表已刷新', { p0: categoryLabels[target.category] || target.category }), 'success')
  }

  return {
    editDatabase,
    deleteDatabase,
    newQueryForDatabase,
    runSqlFile,
    dumpDatabase,
    refreshDatabase,
    refreshCategory,
    openCreateTableDialog,
    closeCreateTableDialog,
    submitCreateTable,
    openSchemaDiffDialog,
    closeSchemaDiffDialog,
    loadDiffDatabases,
    compareSchemaDiff,
    copySchemaDiffSql,
    openCellViewer,
    closeCellViewer
  }
}
