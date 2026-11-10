import {
  dbExportTable,
  dbInsertRows,
  dbSaveConnectionFile,
  dbSaveExportFile,
  dbSelectConnectionFile,
  dbSelectImportFile,
  getConfig,
  saveConfig
} from '@/api'

const EXPORT_FORMATS = ['csv', 'json', 'sql', 'markdown']

function timestamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(
    now.getMinutes()
  )}${pad(now.getSeconds())}`
}

function detectDelimiter(line) {
  const candidates = [',', ';', '\t']
  let best = ','
  let bestCount = -1
  for (const delimiter of candidates) {
    let inQuotes = false
    let count = 0
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes
      else if (char === delimiter && !inQuotes) count++
    }
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

function parseCsv(text, delimiter) {
  const source = text.replace(/^\uFEFF/, '')
  const sep = delimiter || detectDelimiter(source.split(/\r?\n/, 1)[0] || '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === sep) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((item) => item.some((cell) => String(cell).trim() !== ''))
}

function parseImportContent(content, format) {
  if (format === 'json') {
    const parsed = JSON.parse(content)
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.rows)
          ? parsed.rows
          : []
    if (!list.length) throw new Error('JSON 中未找到数据数组')
    return list.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
  }

  const rows = parseCsv(content)
  if (rows.length < 2) throw new Error('CSV 文件为空或缺少数据行')
  const seen = new Map()
  const headers = rows[0].map((header, index) => {
    const name = String(header || '').trim() || `column_${index + 1}`
    const count = seen.get(name) || 0
    seen.set(name, count + 1)
    return count === 0 ? name : `${name}_${count + 1}`
  })

  return rows.slice(1).map((row) => {
    const item = {}
    headers.forEach((header, index) => {
      item[header] = row[index] === undefined ? '' : row[index]
    })
    return item
  })
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function escapeSqlValue(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

function escapeMarkdownCell(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

function buildExportContent(tab, format) {
  const rows = tab.queryResult?.rows || []
  const fields = (tab.queryResult?.fields || []).map((field) => field.name)
  const tableRef = tab.tableName ? quoteIdentifier(tab.tableName) : 'query_result'

  if (format === 'json') {
    return { content: JSON.stringify(rows, null, 2), rowCount: rows.length }
  }

  if (format === 'sql') {
    const lines = rows.map(
      (row) =>
        `INSERT INTO ${tableRef} (${fields.map((field) => quoteIdentifier(field)).join(', ')}) VALUES (${fields
          .map((field) => escapeSqlValue(row[field]))
          .join(', ')});`
    )
    return { content: lines.join('\n'), rowCount: rows.length }
  }

  if (format === 'markdown') {
    const lines = [
      `| ${fields.map((field) => escapeMarkdownCell(field)).join(' | ')} |`,
      `| ${fields.map(() => '---').join(' | ')} |`
    ]
    for (const row of rows) {
      lines.push(`| ${fields.map((field) => escapeMarkdownCell(row[field])).join(' | ')} |`)
    }
    return { content: lines.join('\n'), rowCount: rows.length }
  }

  const lines = [fields.map((field) => escapeCsvCell(field)).join(',')]
  for (const row of rows) {
    lines.push(fields.map((field) => escapeCsvCell(row[field])).join(','))
  }
  return { content: lines.join('\n'), rowCount: rows.length }
}

export function createTransfer(state, api) {
  const { connections, connectionTransferDialog, exportDialog, importDialog } = state

  function openImportDialog(tab) {
    if (!tab || tab.isView) {
      api.showMessage('视图不支持导入数据', 'warning')
      return
    }
    importDialog.value = {
      show: true,
      tab,
      format: 'csv',
      filePath: '',
      fileName: '',
      headers: [],
      mapping: [],
      rows: [],
      error: '',
      importing: false
    }
  }

  function closeImportDialog() {
    importDialog.value.show = false
    importDialog.value.rows = []
    importDialog.value.mapping = []
    importDialog.value.tab = null
  }

  async function selectImportFile(format) {
    const dialog = importDialog.value
    if (!dialog.tab) return

    dialog.format = format || dialog.format
    dialog.error = ''

    try {
      const result = await dbSelectImportFile(dialog.format)
      if (!result || result.canceled) return
      if (result.error) {
        dialog.error = result.error
        return
      }

      const rows = parseImportContent(result.content || '', dialog.format)
      const headers = Array.from(
        rows.reduce((set, row) => {
          Object.keys(row).forEach((key) => set.add(key))
          return set
        }, new Set())
      )

      dialog.filePath = result.filePath
      dialog.fileName = result.filePath.split(/[\\/]/).pop()
      dialog.headers = headers
      dialog.rows = rows
      dialog.mapping = buildImportMapping(dialog.tab, headers)
    } catch (error) {
      dialog.error = error.message
      dialog.rows = []
      dialog.headers = []
      dialog.mapping = []
    }
  }

  function buildImportMapping(tab, headers) {
    const columns = tab?.columns || []
    return headers.map((header) => {
      const matched = columns.find(
        (column) => column.name === header || column.name.toLowerCase() === String(header).toLowerCase()
      )
      return { header, column: matched?.name || '', matched: Boolean(matched) }
    })
  }

  function getImportMapping() {
    const dialog = importDialog.value
    if (dialog.mapping?.length) return dialog.mapping
    return buildImportMapping(dialog.tab, dialog.headers)
  }

  function setImportMappingColumn(index, column) {
    const item = importDialog.value.mapping[index]
    if (!item) return
    item.column = column
    item.matched = Boolean(column)
  }

  function getMatchedImportRows() {
    const dialog = importDialog.value
    const mapping = getImportMapping().filter((item) => item.matched)
    const rows = []

    for (const row of dialog.rows) {
      const values = {}
      for (const item of mapping) {
        const raw = row[item.header]
        values[item.column] = raw === '' || raw === undefined ? null : raw
      }
      if (Object.keys(values).length > 0) rows.push(values)
    }

    return { rows, unmatched: getImportMapping().filter((item) => !item.matched) }
  }

  async function executeImport() {
    const dialog = importDialog.value
    if (!dialog.tab || dialog.importing) return
    const { rows, unmatched } = getMatchedImportRows()

    if (!rows.length) {
      dialog.error = '没有可导入的数据行，请检查列名是否与表字段匹配'
      return
    }

    dialog.importing = true
    dialog.error = ''
    const tab = dialog.tab
    let inserted = 0

    try {
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500)
        const result = await dbInsertRows(tab.connectionName, tab.database, tab.tableName, batch)
        if (!result.success) {
          dialog.error = `已导入 ${inserted} 行后失败: ${result.error}`
          dialog.importing = false
          return
        }
        inserted += result.inserted || batch.length
      }

      await api.showMessage(
        `导入完成，共写入 ${inserted} 行${unmatched.length ? `，忽略 ${unmatched.length} 个未匹配列` : ''}`,
        'success'
      )
      closeImportDialog()
      await api.executeTableQuery(tab, 1)
      await api.loadDatabaseObjects(tab.connectionName, tab.database)
    } catch (error) {
      dialog.error = error.message
    } finally {
      dialog.importing = false
    }
  }

  function openExportDialog(tab) {
    if (!tab || (tab.type === 'query' && !tab.queryResult?.rows?.length)) {
      api.showMessage('没有可导出的查询结果', 'warning')
      return
    }
    exportDialog.value = {
      show: true,
      tab,
      format: 'csv',
      scope: tab.type === 'table' ? 'all' : 'page',
      includeStructure: false,
      exporting: false
    }
  }

  function closeExportDialog() {
    exportDialog.value.show = false
    exportDialog.value.tab = null
  }

  async function executeExport() {
    const dialog = exportDialog.value
    if (!dialog.tab || dialog.exporting) return
    const tab = dialog.tab
    const format = EXPORT_FORMATS.includes(dialog.format) ? dialog.format : 'csv'
    const extension = format === 'markdown' ? 'md' : format

    dialog.exporting = true
    try {
      let content = ''
      let rowCount = 0
      let truncated = false

      if (format === 'sql' || dialog.scope === 'all') {
        if (tab.type === 'table' && dialog.scope === 'all') {
          const result = await dbExportTable(tab.connectionName, tab.database, tab.tableName, {
            format,
            includeStructure: dialog.includeStructure,
            maxRows: 100000
          })
          if (!result.success) {
            await api.showMessage('导出失败: ' + result.error, 'error')
            return
          }
          content = result.content
          rowCount = result.rowCount
          truncated = result.truncated
        } else {
          const built = buildExportContent(tab, format)
          content = built.content
          rowCount = built.rowCount
        }
      } else {
        const built = buildExportContent(tab, format)
        content = built.content
        rowCount = built.rowCount
      }

      const baseName = tab.tableName || 'query_result'
      const defaultName = `${baseName}_${timestamp()}.${extension}`
      const saveResult = await dbSaveExportFile(defaultName, content, format)

      if (saveResult?.canceled) return
      if (saveResult?.error) {
        await api.showMessage('保存失败: ' + saveResult.error, 'error')
        return
      }

      await api.showMessage(
        `已导出 ${rowCount} 行${truncated ? '（数据量超过上限，已截断）' : ''}到: ${saveResult.filePath}`,
        'success'
      )
      closeExportDialog()
    } catch (error) {
      await api.showMessage('导出失败: ' + error.message, 'error')
    } finally {
      dialog.exporting = false
    }
  }

  function openConnectionTransferDialog(mode) {
    connectionTransferDialog.value = {
      show: true,
      mode,
      includePasswords: false,
      content: '',
      fileName: '',
      importing: false,
      error: ''
    }
    if (mode === 'import') {
      selectConnectionImportFile()
    }
  }

  function closeConnectionTransferDialog() {
    connectionTransferDialog.value.show = false
  }

  async function executeConnectionExport() {
    const dialog = connectionTransferDialog.value
    const list = connections.value.map((conn) => {
      const item = {
        name: conn.name,
        group: conn.group || '',
        host: conn.host,
        port: conn.port,
        user: conn.user,
        savePassword: conn.savePassword !== false,
        charset: conn.charset || '',
        enableKeepAlive: conn.enableKeepAlive,
        keepAliveInterval: conn.keepAliveInterval,
        enableConnectTimeout: conn.enableConnectTimeout,
        connectTimeout: conn.connectTimeout,
        enableReadTimeout: conn.enableReadTimeout,
        readTimeout: conn.readTimeout,
        enableWriteTimeout: conn.enableWriteTimeout,
        writeTimeout: conn.writeTimeout,
        autoConnect: conn.autoConnect
      }
      if (dialog.includePasswords) item.password = conn.password || ''
      return item
    })

    const content = JSON.stringify(
      { type: 'ntoolbox-connections', version: 1, exportedAt: new Date().toISOString(), connections: list },
      null,
      2
    )

    const result = await dbSaveConnectionFile(`connections_${timestamp()}.json`, content)
    if (result?.canceled) return
    if (result?.error) {
      await api.showMessage('导出失败: ' + result.error, 'error')
      return
    }
    closeConnectionTransferDialog()
    await api.showMessage(`已导出 ${list.length} 个连接`, 'success')
  }

  async function selectConnectionImportFile() {
    const dialog = connectionTransferDialog.value
    const result = await dbSelectConnectionFile()
    if (!result || result.canceled) {
      if (!dialog.content) closeConnectionTransferDialog()
      return
    }

    try {
      const parsed = JSON.parse(result.content || '')
      const list = Array.isArray(parsed) ? parsed : parsed.connections
      if (!Array.isArray(list) || list.length === 0) {
        dialog.error = '文件中未找到连接配置'
        return
      }
      dialog.content = result.content
      dialog.fileName = result.filePath.split(/[\\/]/).pop()
      dialog.previewCount = list.length
      dialog.error = ''
    } catch (error) {
      dialog.error = '连接配置文件解析失败: ' + error.message
    }
  }

  async function executeConnectionImport() {
    const dialog = connectionTransferDialog.value
    if (dialog.importing) return

    try {
      const parsed = JSON.parse(dialog.content || '')
      const list = Array.isArray(parsed) ? parsed : parsed.connections
      if (!Array.isArray(list) || list.length === 0) {
        dialog.error = '文件中未找到连接配置'
        return
      }

      dialog.importing = true
      const config = await getConfig()
      const existing = config.dbConnections || []
      const names = new Set(existing.map((conn) => conn.name))
      let imported = 0

      for (const item of list) {
        if (!item || typeof item !== 'object' || !item.name || !item.host) continue
        let name = String(item.name)
        let suffix = 1
        while (names.has(name)) {
          name = `${item.name}_imported${suffix > 1 ? suffix : ''}`
          suffix++
        }
        names.add(name)
        existing.push({
          name,
          group: item.group || '',
          host: item.host,
          port: item.port || 3306,
          user: item.user || 'root',
          password: item.password || '',
          savePassword: item.savePassword !== false,
          charset: item.charset || '',
          enableKeepAlive: item.enableKeepAlive !== false,
          keepAliveInterval: item.keepAliveInterval || 240,
          enableConnectTimeout: item.enableConnectTimeout !== false,
          connectTimeout: item.connectTimeout || 30,
          enableReadTimeout: Boolean(item.enableReadTimeout),
          readTimeout: item.readTimeout || 30,
          enableWriteTimeout: item.enableWriteTimeout !== false,
          writeTimeout: item.writeTimeout || 30,
          autoConnect: Boolean(item.autoConnect)
        })
        imported++
      }

      await saveConfig({ ...config, dbConnections: existing })
      await api.loadConnections()
      closeConnectionTransferDialog()
      await api.showMessage(`已导入 ${imported} 个连接`, 'success')
    } catch (error) {
      dialog.error = '导入失败: ' + error.message
    } finally {
      dialog.importing = false
    }
  }

  return {
    openImportDialog,
    closeImportDialog,
    selectImportFile,
    getImportMapping,
    setImportMappingColumn,
    getMatchedImportRows,
    executeImport,
    openExportDialog,
    closeExportDialog,
    executeExport,
    openConnectionTransferDialog,
    closeConnectionTransferDialog,
    executeConnectionExport,
    selectConnectionImportFile,
    executeConnectionImport
  }
}
