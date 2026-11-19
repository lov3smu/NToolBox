import { t } from '@/i18n'
import { computed } from 'vue'
import {
  dbExecuteQuery,
  dbExportTable,
  dbGetObjectDefinition,
  dbGetTableData,
  dbGetTableMeta,
  dbGetTableStructure,
  dbInsertRows,
  dbQueryDatabases,
  dbQueryObjects,
  dbSaveConnectionFile,
  dbSaveExportFile,
  dbSelectConnectionFile,
  dbSelectImportFile,
  getConfig,
  patchConfig
} from '@/api'
import {
  DEFAULT_BATCH_SIZE,
  applyNameCase,
  buildDropStatement,
  buildTruncateStatement,
  getTransferTypeLabel,
  normalizeTransferObjects,
  normalizeTransferSettings,
  normalizeTransferTask,
  parseBulkObjectNames,
  remapRow,
  sortTransferObjects,
  stripDefiner,
  transformTableDdl,
  transformViewDdl,
  transferObjectKey
} from './transferPlan'

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
    if (!list.length) throw new Error(t('JSON 中未找到数据数组'))
    return list.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
  }

  const rows = parseCsv(content)
  if (rows.length < 2) throw new Error(t('CSV 文件为空或缺少数据行'))
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

export function createTransfer(state, api, options = {}) {
  const {
    connections,
    connectionTransferDialog,
    dataTransferDialog,
    exportDialog,
    importDialog,
    selectedConnection,
    selectedDatabase
  } = state

  const activeConnections = computed(() => connections.value.filter((conn) => conn.active))

  function openImportDialog(tab) {
    if (!tab || tab.isView) {
      api.showMessage(t('视图不支持导入数据'), 'warning')
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
      dialog.error = t('没有可导入的数据行，请检查列名是否与表字段匹配')
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
          dialog.error = t('已导入 {p0} 行后失败: {p1}', { p0: inserted, p1: result.error })
          dialog.importing = false
          return
        }
        inserted += result.inserted || batch.length
      }

      await api.showMessage(
        unmatched.length
          ? t('导入完成，共写入 {count} 行，忽略 {unmatched} 个未匹配列', {
              count: inserted,
              unmatched: unmatched.length
            })
          : t('导入完成，共写入 {count} 行', { count: inserted }),
        'success'
      )
      closeImportDialog()
      await api.executeTableQuery(tab, 1)
      await api.loadDatabaseObjects(tab.connectionName, tab.database, { force: true })
    } catch (error) {
      dialog.error = error.message
    } finally {
      dialog.importing = false
    }
  }

  function openExportDialog(tab) {
    if (!tab || (tab.type === 'query' && !tab.queryResult?.rows?.length)) {
      api.showMessage(t('没有可导出的查询结果'), 'warning')
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
            await api.showMessage(t('导出失败: ') + result.error, 'error')
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
        await api.showMessage(t('保存失败: ') + saveResult.error, 'error')
        return
      }

      await api.showMessage(
        t('已导出 {p0} 行{p1}到: {p2}', {
          p0: rowCount,
          p1: truncated ? t('（数据量超过上限，已截断）') : '',
          p2: saveResult.filePath
        }),
        'success'
      )
      closeExportDialog()
    } catch (error) {
      await api.showMessage(t('导出失败: ') + error.message, 'error')
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
      await api.showMessage(t('导出失败: ') + result.error, 'error')
      return
    }
    closeConnectionTransferDialog()
    await api.showMessage(t('已导出 {p0} 个连接', { p0: list.length }), 'success')
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
        dialog.error = t('文件中未找到连接配置')
        return
      }
      dialog.content = result.content
      dialog.fileName = result.filePath.split(/[\\/]/).pop()
      dialog.previewCount = list.length
      dialog.error = ''
    } catch (error) {
      dialog.error = t('连接配置文件解析失败: {p0}', { p0: error.message })
    }
  }

  async function executeConnectionImport() {
    const dialog = connectionTransferDialog.value
    if (dialog.importing) return

    try {
      const parsed = JSON.parse(dialog.content || '')
      const list = Array.isArray(parsed) ? parsed : parsed.connections
      if (!Array.isArray(list) || list.length === 0) {
        dialog.error = t('文件中未找到连接配置')
        return
      }

      dialog.importing = true
      const config = await getConfig()
      const existing = config.database?.connections || []
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
          autoConnect: Boolean(item.autoConnect),
          readOnly: item.readOnly === true,
          ssh: {
            enabled: item.ssh?.enabled === true,
            host: item.ssh?.host || '',
            port: item.ssh?.port || 22,
            user: item.ssh?.user || '',
            keyPath: item.ssh?.keyPath || ''
          },
          ssl: {
            enabled: item.ssl?.enabled === true,
            verify: item.ssl?.verify !== false,
            caPath: item.ssl?.caPath || ''
          }
        })
        imported++
      }

      await patchConfig({ database: { connections: existing } })
      await api.loadConnections()
      closeConnectionTransferDialog()
      await api.showMessage(t('已导入 {p0} 个连接', { p0: imported }), 'success')
    } catch (error) {
      dialog.error = t('导入失败: {p0}', { p0: error.message })
    } finally {
      dialog.importing = false
    }
  }

  async function openDataTransferDialog() {
    const active = activeConnections.value
    const preferred = active.find((conn) => conn.name === selectedConnection.value?.name)
    const sourceConnection = preferred?.name || active[0]?.name || ''
    const previousTasks = dataTransferDialog.value.tasks || []

    dataTransferDialog.value = {
      show: true,
      sourceConnection,
      sourceDatabase: '',
      targetConnection: sourceConnection,
      targetDatabase: '',
      sourceDatabases: [],
      targetDatabases: [],
      objects: [],
      selectedObjects: [],
      objectKeyword: '',
      bulkOpen: false,
      bulkText: '',
      loadingDatabases: false,
      loadingObjects: false,
      transferring: false,
      progress: '',
      error: '',
      summary: null,
      contentMode: 'all',
      targetMode: 'append',
      tableNameCase: 'keep',
      columnNameCase: 'keep',
      batchSize: options.defaultBatchSize?.value ?? DEFAULT_BATCH_SIZE,
      timeoutMode: 'inherit',
      tasks: previousTasks,
      taskKeyword: ''
    }

    loadTransferTasks()
    if (!active.length) {
      dataTransferDialog.value.error = t('暂无已连接的数据库，请先连接后再传输')
      return
    }

    await Promise.all([loadTransferDatabases('source'), loadTransferDatabases('target')])
  }

  function closeDataTransferDialog() {
    if (dataTransferDialog.value.transferring) return
    dataTransferDialog.value.show = false
  }

  async function loadTransferTasks() {
    try {
      const config = await getConfig()
      const tasks = Array.isArray(config.database?.transfer_tasks) ? config.database.transfer_tasks : []
      dataTransferDialog.value.tasks = tasks.map(normalizeTransferTask).filter((task) => task.name)
    } catch (error) {
      console.error('加载数据传输任务失败:', error)
    }
  }

  async function refreshTransferTasks() {
    await loadTransferTasks()
  }

  function clearTransferObjects(dialog) {
    dialog.objects = []
    dialog.selectedObjects = []
    dialog.summary = null
  }

  async function loadTransferDatabases(side, options = {}) {
    const dialog = dataTransferDialog.value
    const connName = side === 'source' ? dialog.sourceConnection : dialog.targetConnection
    const listKey = side === 'source' ? 'sourceDatabases' : 'targetDatabases'
    const databaseKey = side === 'source' ? 'sourceDatabase' : 'targetDatabase'

    dialog[listKey] = []
    dialog[databaseKey] = ''
    dialog.error = ''
    if (side === 'source') clearTransferObjects(dialog)
    if (!connName) return

    dialog.loadingDatabases = true
    try {
      const result = await dbQueryDatabases(connName)
      if (!dialog.show) return
      if (!result.success) {
        dialog.error = result.error || t('读取数据库列表失败')
        return
      }
      dialog[listKey] = result.databases || []
      if (side === 'source' && options.autoSelect !== false && result.databases?.includes(selectedDatabase.value)) {
        dialog.sourceDatabase = selectedDatabase.value
        await loadTransferObjects()
      }
    } catch (error) {
      dialog.error = error.message
    } finally {
      dialog.loadingDatabases = false
    }
  }

  async function loadTransferObjects() {
    const dialog = dataTransferDialog.value
    clearTransferObjects(dialog)
    if (!dialog.sourceConnection || !dialog.sourceDatabase) return

    dialog.loadingObjects = true
    dialog.error = ''
    try {
      const result = await dbQueryObjects(dialog.sourceConnection, dialog.sourceDatabase)
      if (!dialog.show) return
      if (!result.success) {
        dialog.error = result.error || t('读取对象列表失败')
        return
      }
      dialog.objects = normalizeTransferObjects(result.items || [])
      dialog.selectedObjects = dialog.objects.map(transferObjectKey)
    } catch (error) {
      dialog.error = error.message
    } finally {
      dialog.loadingObjects = false
    }
  }

  function toggleTransferObject(key) {
    const list = dataTransferDialog.value.selectedObjects
    const index = list.indexOf(key)
    if (index >= 0) list.splice(index, 1)
    else list.push(key)
  }

  function toggleTransferGroup(type) {
    const dialog = dataTransferDialog.value
    const keys = dialog.objects.filter((item) => item.type === type).map(transferObjectKey)
    if (!keys.length) return

    const selected = new Set(dialog.selectedObjects)
    const allSelected = keys.every((key) => selected.has(key))
    for (const key of keys) {
      if (allSelected) selected.delete(key)
      else selected.add(key)
    }
    dialog.selectedObjects = dialog.objects.map(transferObjectKey).filter((key) => selected.has(key))
  }

  function toggleAllTransferObjects() {
    const dialog = dataTransferDialog.value
    dialog.selectedObjects =
      dialog.selectedObjects.length === dialog.objects.length ? [] : dialog.objects.map(transferObjectKey)
  }

  async function applyBulkTransferObjects() {
    const dialog = dataTransferDialog.value
    const { keys, unmatched } = parseBulkObjectNames(dialog.bulkText, dialog.objects)

    if (!keys.length) {
      dialog.error = unmatched.length
        ? t('未匹配到对象：{p0}', { p0: unmatched.slice(0, 5).join(t('、')) })
        : t('请输入要选择的对象名称')
      return
    }

    dialog.selectedObjects = keys
    dialog.bulkOpen = false
    dialog.bulkText = ''
    dialog.error = ''
    if (unmatched.length) {
      await api.showMessage(
        t('已选择 {p0} 个对象，未匹配 {p1} 个', { p0: keys.length, p1: unmatched.length }),
        'warning'
      )
    }
  }

  async function swapTransferSides() {
    const dialog = dataTransferDialog.value
    if (dialog.transferring) return

    const sourceDatabase = dialog.targetDatabase
    const targetDatabase = dialog.sourceDatabase
    const sourceConnection = dialog.targetConnection
    const targetConnection = dialog.sourceConnection

    dialog.sourceConnection = sourceConnection
    dialog.targetConnection = targetConnection
    dialog.sourceDatabase = ''
    dialog.targetDatabase = ''
    dialog.error = ''
    clearTransferObjects(dialog)

    await Promise.all([loadTransferDatabases('source', { autoSelect: false }), loadTransferDatabases('target')])

    if (sourceDatabase && dialog.sourceDatabases.includes(sourceDatabase)) {
      dialog.sourceDatabase = sourceDatabase
      await loadTransferObjects()
    }
    if (targetDatabase && dialog.targetDatabases.includes(targetDatabase)) {
      dialog.targetDatabase = targetDatabase
    }
  }

  async function saveTransferTask() {
    const dialog = dataTransferDialog.value
    if (!dialog.sourceConnection || !dialog.sourceDatabase || !dialog.targetConnection || !dialog.targetDatabase) {
      dialog.error = t('请先选择源和目标连接、数据库')
      return
    }

    const suggestedName =
      dialog.sourceDatabase && dialog.targetDatabase
        ? `${dialog.sourceDatabase} → ${dialog.targetDatabase}`
        : t('数据传输任务')
    const name = await api.showPrompt('请输入传输任务名称：', suggestedName)
    const taskName = String(name || '').trim()
    if (!taskName) return

    const tasks = dialog.tasks.map(normalizeTransferTask)
    const index = tasks.findIndex((task) => task.name === taskName)
    if (index >= 0) {
      const overwrite = await api.showConfirm(t('任务「{p0}」已存在，是否覆盖？', { p0: taskName }), t('保存任务'))
      if (!overwrite) return
    }

    const task = { name: taskName, ...normalizeTransferSettings(dialog) }
    if (index >= 0) tasks[index] = task
    else tasks.push(task)

    try {
      const saved = await patchConfig({ database: { transfer_tasks: tasks } })
      if (saved === false) throw new Error(t('保存配置失败'))
      dialog.tasks = tasks
      await api.showMessage(t('传输任务已保存'), 'success')
    } catch (error) {
      dialog.error = t('保存任务失败: {p0}', { p0: error.message })
    }
  }

  async function applyTransferTask(task) {
    const dialog = dataTransferDialog.value
    if (dialog.transferring) return

    const settings = normalizeTransferTask(task)
    if (!settings.name) return

    const activeNames = new Set(activeConnections.value.map((conn) => conn.name))
    if (!activeNames.has(settings.sourceConnection) || !activeNames.has(settings.targetConnection)) {
      dialog.error = t('任务中的数据库连接未激活，请先连接后再载入任务')
      return
    }

    dialog.error = ''
    dialog.progress = ''
    dialog.summary = null
    dialog.sourceConnection = settings.sourceConnection
    dialog.targetConnection = settings.targetConnection
    dialog.sourceDatabase = ''
    dialog.targetDatabase = ''
    clearTransferObjects(dialog)

    await Promise.all([loadTransferDatabases('source', { autoSelect: false }), loadTransferDatabases('target')])

    if (dialog.sourceDatabases.includes(settings.sourceDatabase)) {
      dialog.sourceDatabase = settings.sourceDatabase
    }
    if (dialog.targetDatabases.includes(settings.targetDatabase)) {
      dialog.targetDatabase = settings.targetDatabase
    }

    Object.assign(dialog, {
      contentMode: settings.contentMode,
      targetMode: settings.targetMode,
      tableNameCase: settings.tableNameCase,
      columnNameCase: settings.columnNameCase,
      batchSize: settings.batchSize,
      timeoutMode: settings.timeoutMode
    })

    if (!dialog.sourceDatabase) {
      dialog.error = t('任务中的源数据库不存在')
      return
    }

    await loadTransferObjects()
    const available = new Set(dialog.objects.map(transferObjectKey))
    dialog.selectedObjects = settings.selectedObjects.filter((key) => available.has(key))
    if (!dialog.targetDatabase) {
      dialog.error = t('任务中的目标数据库不存在')
    }
  }

  async function deleteTransferTask(task) {
    const dialog = dataTransferDialog.value
    const confirmed = await api.showConfirm(t('确定删除传输任务「{p0}」？', { p0: task.name }), t('删除任务'))
    if (!confirmed) return

    const tasks = dialog.tasks.filter((item) => item.name !== task.name)
    try {
      const saved = await patchConfig({ database: { transfer_tasks: tasks } })
      if (saved === false) throw new Error(t('保存配置失败'))
      dialog.tasks = tasks
      await api.showMessage(t('传输任务已删除'), 'success')
    } catch (error) {
      dialog.error = t('删除任务失败: {p0}', { p0: error.message })
    }
  }

  function resolveTransferTimeout(dialog, connectionName, kind) {
    if (dialog.timeoutMode !== 'inherit') {
      const seconds = Number(dialog.timeoutMode)
      return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
    }

    const conn = connections.value.find((item) => item.name === connectionName)
    if (!conn) return 0
    if (kind === 'read' && conn.enableReadTimeout === false) return 0
    if (kind === 'write' && conn.enableWriteTimeout === false) return 0
    const seconds = Number(kind === 'read' ? conn.readTimeout : conn.writeTimeout)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  }

  function collectTargetObjects(result) {
    const map = new Map()
    for (const item of result.items || []) {
      if (!item?.type || !item?.name) continue
      if (!['table', 'view', 'procedure', 'function', 'trigger', 'event'].includes(item.type)) continue
      map.set(transferObjectKey(item), item)
    }
    return map
  }

  async function copyTableData(context, sourceName, targetName, meta) {
    const { dialog, batchSize, sourceTimeout, targetTimeout } = context
    const structure = await dbGetTableStructure(dialog.targetConnection, dialog.targetDatabase, targetName)
    if (!structure.success) {
      return { status: 'failed', error: structure.error || t('读取目标表结构失败') }
    }

    const targetFields = structure.fields || []
    const sort = (meta?.primaryKeys || []).map((field) => ({ field, order: 'ASC' }))
    let page = 1
    let copied = 0

    while (true) {
      const data = await dbGetTableData(dialog.sourceConnection, dialog.sourceDatabase, sourceName, {
        page,
        pageSize: batchSize,
        sort,
        timeout: sourceTimeout
      })
      if (!data.success) {
        return { status: 'failed', error: data.error || t('读取源表数据失败'), rows: copied }
      }

      const rows = (data.rows || []).map((row) => remapRow(row, targetFields)).filter(Boolean)
      if (rows.length) {
        const inserted = await dbInsertRows(dialog.targetConnection, dialog.targetDatabase, targetName, rows, {
          timeout: targetTimeout
        })
        if (!inserted.success) {
          return { status: 'failed', error: inserted.error || t('写入目标表失败'), rows: copied }
        }
        copied += inserted.inserted ?? rows.length
        dialog.progress = t('{p0}（已写入 {p1} 行）', { p0: context.currentLabel, p1: copied })
      }

      if (page >= data.pageCount) break
      page++
    }

    return { status: 'transferred', rows: copied }
  }

  async function transferTable(context, object) {
    const { dialog, contentMode, targetMode, tableNameCase, columnNameCase, targetTimeout } = context
    const targetName = applyNameCase(object.name, tableNameCase)
    const key = `table:${targetName}`
    const exists = context.targetExisting.has(key)

    if (exists && targetMode === 'skip') {
      return { status: 'skipped', reason: t('目标表已存在') }
    }
    if (contentMode === 'data' && !exists) {
      return { status: 'failed', error: t('目标表不存在，仅数据模式需要先创建目标表') }
    }

    const meta = await dbGetTableMeta(dialog.sourceConnection, dialog.sourceDatabase, object.name)
    if (!meta.success || !meta.ddl) {
      return { status: 'failed', error: meta.error || t('无法读取源表结构') }
    }

    let created = false
    if (!exists) {
      const ddl = transformTableDdl(meta.ddl, {
        targetName,
        columnCase: columnNameCase,
        tableNameCase
      })
      const result = await dbExecuteQuery(dialog.targetConnection, ddl, [], {
        database: dialog.targetDatabase,
        timeout: targetTimeout
      })
      if (!result.success) {
        return { status: 'failed', error: result.error || t('创建目标表失败') }
      }
      created = true
      context.targetExisting.set(key, true)
    } else if (contentMode === 'structure') {
      return { status: 'skipped', reason: t('目标表已存在，仅结构模式不覆盖') }
    } else if (targetMode === 'truncate') {
      const result = await dbExecuteQuery(
        dialog.targetConnection,
        buildTruncateStatement(dialog.targetDatabase, targetName),
        [],
        { database: dialog.targetDatabase, timeout: targetTimeout }
      )
      if (!result.success) {
        return { status: 'failed', error: result.error || t('清空目标表失败') }
      }
    }

    if (contentMode === 'structure') {
      return { status: 'transferred', rows: 0, created }
    }

    const copied = await copyTableData(context, object.name, targetName, meta)
    if (copied.status === 'failed') return copied
    return { status: 'transferred', rows: copied.rows, created }
  }

  async function transferView(context, object) {
    const { dialog, contentMode, targetMode, tableNameCase, targetTimeout } = context
    const targetName = applyNameCase(object.name, tableNameCase)

    if (contentMode === 'data') {
      return { status: 'skipped', reason: t('视图不包含数据') }
    }
    if (context.targetExisting.has(`view:${targetName}`) && targetMode === 'skip') {
      return { status: 'skipped', reason: t('目标视图已存在') }
    }

    const definition = await dbGetObjectDefinition(dialog.sourceConnection, dialog.sourceDatabase, 'view', object.name)
    if (!definition.success || !definition.ddl) {
      return { status: 'failed', error: definition.error || t('读取视图定义失败') }
    }

    const ddl = transformViewDdl(definition.ddl, { targetName })
    const result = await dbExecuteQuery(dialog.targetConnection, ddl, [], {
      database: dialog.targetDatabase,
      timeout: targetTimeout
    })
    if (!result.success) {
      return { status: 'failed', error: result.error || t('创建目标视图失败') }
    }

    context.targetExisting.set(`view:${targetName}`, true)
    return { status: 'transferred', rows: 0 }
  }

  async function transferDefinitionObject(context, object) {
    const { dialog, contentMode, targetMode, targetTimeout } = context
    const label = getTransferTypeLabel(object.type)
    const key = transferObjectKey(object)

    if (contentMode === 'data') {
      return { status: 'skipped', reason: t('仅数据模式不传输{p0}', { p0: label }) }
    }
    if (context.targetExisting.has(key) && targetMode === 'skip') {
      return { status: 'skipped', reason: t('目标{p0}已存在', { p0: label }) }
    }

    const definition = await dbGetObjectDefinition(
      dialog.sourceConnection,
      dialog.sourceDatabase,
      object.type,
      object.name
    )
    if (!definition.success || !definition.ddl) {
      return { status: 'failed', error: definition.error || t('读取{p0}定义失败', { p0: label }) }
    }

    const ddl = stripDefiner(definition.ddl.trim().replace(/;\s*$/, ''))
    if (context.targetExisting.has(key)) {
      const dropped = await dbExecuteQuery(
        dialog.targetConnection,
        buildDropStatement(object.type, dialog.targetDatabase, object.name),
        [],
        { database: dialog.targetDatabase, timeout: targetTimeout }
      )
      if (!dropped.success) {
        return { status: 'failed', error: dropped.error || t('删除目标{p0}失败', { p0: label }) }
      }
    }

    const result = await dbExecuteQuery(dialog.targetConnection, ddl, [], {
      database: dialog.targetDatabase,
      timeout: targetTimeout
    })
    if (!result.success) {
      return { status: 'failed', error: result.error || t('创建目标{p0}失败', { p0: label }) }
    }

    context.targetExisting.set(key, true)
    return { status: 'transferred', rows: 0 }
  }

  async function executeDataTransfer() {
    const dialog = dataTransferDialog.value
    if (dialog.transferring) return

    if (!dialog.sourceConnection || !dialog.sourceDatabase || !dialog.targetConnection || !dialog.targetDatabase) {
      dialog.error = t('请选择源和目标连接、数据库')
      return
    }
    if (dialog.sourceConnection === dialog.targetConnection && dialog.sourceDatabase === dialog.targetDatabase) {
      dialog.error = t('源数据库和目标数据库不能相同')
      return
    }

    const selected = new Set(dialog.selectedObjects)
    const objects = sortTransferObjects(dialog.objects.filter((item) => selected.has(transferObjectKey(item))))
    if (!objects.length) {
      dialog.error = t('请至少选择一个传输对象')
      return
    }

    const settings = normalizeTransferSettings(dialog)
    const sourceTimeout = resolveTransferTimeout(dialog, dialog.sourceConnection, 'read')
    const targetTimeout = resolveTransferTimeout(dialog, dialog.targetConnection, 'write')

    dialog.transferring = true
    dialog.error = ''
    dialog.progress = ''
    dialog.summary = null

    const summary = { transferred: [], skipped: [], failed: [] }
    let started = false
    const context = {
      dialog,
      contentMode: settings.contentMode,
      targetMode: settings.targetMode,
      tableNameCase: settings.tableNameCase,
      columnNameCase: settings.columnNameCase,
      batchSize: settings.batchSize,
      sourceTimeout,
      targetTimeout,
      targetExisting: new Map(),
      currentLabel: ''
    }

    try {
      const targetResult = await dbQueryObjects(dialog.targetConnection, dialog.targetDatabase)
      if (!targetResult.success) {
        dialog.error = targetResult.error || t('读取目标数据库对象失败')
        return
      }
      context.targetExisting = collectTargetObjects(targetResult)
      started = true

      for (let index = 0; index < objects.length; index++) {
        const object = objects[index]
        const label = `${getTransferTypeLabel(object.type)} ${object.name}`
        context.currentLabel = label
        dialog.progress = t('正在传输 {p0}/{p1}：{p2}', { p0: index + 1, p1: objects.length, p2: label })

        let result
        if (object.type === 'table') result = await transferTable(context, object)
        else if (object.type === 'view') result = await transferView(context, object)
        else result = await transferDefinitionObject(context, object)

        if (result.status === 'transferred') {
          summary.transferred.push({ type: object.type, name: object.name, rows: result.rows || 0 })
        } else if (result.status === 'skipped') {
          summary.skipped.push({ type: object.type, name: object.name, reason: result.reason || t('已跳过') })
        } else {
          summary.failed.push({
            type: object.type,
            name: object.name,
            error: result.error || t('传输失败'),
            rows: result.rows || 0
          })
        }
      }
    } catch (error) {
      dialog.error = error.message
    } finally {
      dialog.transferring = false
      dialog.progress = ''
      if (started) dialog.summary = summary
      if (summary.transferred.length) {
        await api.loadDatabaseObjects(dialog.targetConnection, dialog.targetDatabase, { force: true })
      }
      if (started) {
        await api.showMessage(
          t('数据传输完成：成功 {p0}，跳过 {p1}，失败 {p2}', {
            p0: summary.transferred.length,
            p1: summary.skipped.length,
            p2: summary.failed.length
          }),
          summary.failed.length ? 'warning' : 'success'
        )
      }
    }
  }

  return {
    activeConnections,
    openDataTransferDialog,
    closeDataTransferDialog,
    loadTransferDatabases,
    loadTransferObjects,
    toggleTransferObject,
    toggleTransferGroup,
    toggleAllTransferObjects,
    applyBulkTransferObjects,
    swapTransferSides,
    saveTransferTask,
    applyTransferTask,
    deleteTransferTask,
    refreshTransferTasks,
    executeDataTransfer,
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
