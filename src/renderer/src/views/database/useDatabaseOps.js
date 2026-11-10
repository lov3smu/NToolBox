import { dbExportTable, dbGetTableMeta, dbQueryTables, readFile, saveSqlFile, selectSqlFile, writeFile } from '@/api'
export function createDatabaseOps(state, api) {
  const { activeTabId, selectedDatabase, tables, tabs } = state

  async function editDatabase(target) {
    if (!target.connection || !target.database) return
    api.selectConnection(target.connection)
    await api.selectDatabase(target.database)

    api.createQueryTab(target.connection.name, target.database)
    const activeTab = tabs.value.find((t) => t.id === activeTabId.value)
    if (activeTab) {
      activeTab.sqlQuery = `-- 编辑数据库: ${target.database}\n-- 修改数据库字符集\nALTER DATABASE \`${target.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    }
  }

  async function deleteDatabase(target) {
    if (!target.connection || !target.database) return

    const confirmed = await api.showConfirm(`确定要删除数据库 "${target.database}" 吗？此操作不可恢复！`)
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(`DROP DATABASE \`${target.database}\`;`, target.connection.name)

    if (result.success) {
      await api.loadConnectionDatabases(target.connection.name)
      if (selectedDatabase.value === target.database) {
        selectedDatabase.value = ''
        tables.value = []
      }
      await api.showMessage(`数据库 "${target.database}" 已删除`, 'success')
    } else {
      await api.showMessage('删除数据库失败: ' + result.error, 'error')
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

  async function runSqlFile(target) {
    if (!target.connection) return

    try {
      const result = await selectSqlFile()

      if (result.canceled || !result.filePaths.length) return

      const filePath = result.filePaths[0]
      const fileResult = await readFile(filePath)

      if (!fileResult.success) {
        await api.showMessage('读取文件失败: ' + fileResult.error, 'error')
        return
      }

      const sqlContent = fileResult.content

      api.selectConnection(target.connection)

      if (!target.connection.active) {
        await api.connectToDatabase()
      }

      const sql = target.database ? `USE \`${target.database}\`;\n${sqlContent}` : sqlContent

      const execResult = await api.executeSqlDirect(sql, target.connection.name)

      if (execResult.success) {
        await api.showMessage('SQL文件执行成功', 'success')
      } else {
        await api.showMessage('SQL文件执行失败: ' + execResult.error, 'error')
      }
    } catch (error) {
      console.error('运行SQL文件失败:', error)
      await api.showMessage('运行SQL文件失败: ' + error.message, 'error')
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
        await api.showMessage('获取表列表失败: ' + (tablesResult.error || ''), 'error')
        return
      }

      const tableNames = (tablesResult.details || []).filter((table) => !table.isView).map((table) => table.name)

      const header = [
        `-- 数据库转储: ${target.database}`,
        `-- 生成时间: ${new Date().toISOString()}`,
        `-- 连接: ${target.connection.host}:${target.connection.port}`,
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
            parts.push(`-- 获取表 ${tableName} 结构失败: ${meta.error}`, '')
            continue
          }
          parts.push(`-- 表结构: ${tableName}`)
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
          parts.push(`-- 导出表 ${tableName} 失败: ${exported.error}`, '')
          continue
        }

        parts.push(`-- 表: ${tableName} (${exported.rowCount} 行)`)
        parts.push(exported.content, '')
        if (exported.truncated) truncated = true
      }

      if (truncated) {
        parts.push('-- 提示: 部分表数据量超过导出上限，已截断', '')
      }

      const defaultFileName = `${target.database}_${type}_${Date.now()}.sql`
      const saveResult = await saveSqlFile(defaultFileName)

      if (saveResult.canceled || !saveResult.filePath) return

      const writeResult = await writeFile(saveResult.filePath, parts.join('\n'))

      if (writeResult.success) {
        await api.showMessage(`转储文件已保存到: ${saveResult.filePath}`, 'success')
      } else {
        await api.showMessage('保存文件失败: ' + writeResult.error, 'error')
      }
    } catch (error) {
      console.error('转储数据库失败:', error)
      await api.showMessage('转储数据库失败: ' + error.message, 'error')
    }
  }

  async function refreshDatabase(target) {
    if (!target.connection) return

    api.selectConnection(target.connection)
    await api.loadConnectionDatabases(target.connection.name)

    if (target.database) {
      await api.selectDatabase(target.database)
    }

    await api.showMessage('数据库列表已刷新', 'success')
  }

  async function refreshCategory(target) {
    if (!target.connection || !target.database || !target.category) return

    api.selectConnection(target.connection)

    if (!target.connection.active) {
      await api.connectToDatabase()
    }

    await api.loadDatabaseObjects(target.connection.name, target.database)

    const categoryName = target.category === 'tables' ? '表' : target.category === 'views' ? '视图' : '函数'
    await api.showMessage(`${categoryName}列表已刷新`, 'success')
  }

  return {
    editDatabase,
    deleteDatabase,
    newQueryForDatabase,
    runSqlFile,
    dumpDatabase,
    refreshDatabase,
    refreshCategory
  }
}
