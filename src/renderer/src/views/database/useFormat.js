import { formatCellText } from './cellFormat'
import { splitSqlStatements } from '@/utils/sqlStatements'

export function createFormat(state, api) {
  const { databaseObjectsMap, selectedCategory, selectedConnection, selectedGroup, selectedInfoType, selectedObject } =
    state

  function parseSqlStatements(sql) {
    return splitSqlStatements(sql)
  }

  function formatCellValue(value) {
    return formatCellText(value)
  }

  function truncateSql(sql) {
    if (!sql) return ''
    const maxLength = 60
    if (sql.length <= maxLength) return sql
    return sql.substring(0, maxLength) + '...'
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '--'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  function formatDate(time) {
    if (!time) return '--'
    const date = new Date(time)
    if (isNaN(date.getTime())) return '--'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function getInfoHeaderName() {
    if (selectedInfoType.value === 'group') return selectedGroup.value?.name
    if (selectedInfoType.value === 'connection') return selectedConnection.value?.name
    if (selectedInfoType.value === 'database') return selectedObject.value?.name
    if (selectedInfoType.value === 'table') return selectedObject.value?.name
    if (selectedInfoType.value === 'object') return selectedObject.value?.name
    if (selectedInfoType.value === 'category') {
      const typeLabels = {
        tables: '表',
        views: '视图',
        functions: '函数',
        procedures: '存储过程',
        triggers: '触发器',
        events: '事件'
      }
      return typeLabels[selectedCategory.value?.type] || ''
    }
    return ''
  }

  function getInfoHeaderDesc() {
    if (selectedInfoType.value === 'group') return '分组'
    if (selectedInfoType.value === 'connection') return selectedConnection.value?.active ? '已连接' : '未连接'
    if (selectedInfoType.value === 'database') return '数据库'
    if (selectedInfoType.value === 'table') return selectedObject.value?.database || ''
    if (selectedInfoType.value === 'object') return selectedObject.value?.database || ''
    if (selectedInfoType.value === 'category') return selectedCategory.value?.database || ''
    return ''
  }

  function getCategoryList() {
    if (!selectedCategory.value) return []
    const key = `${selectedCategory.value.connectionName}_${selectedCategory.value.database}`
    const objects = databaseObjectsMap.value[key]
    if (!objects) return []
    return objects[selectedCategory.value.type] || []
  }

  function handleCategoryItemClick(item) {
    if (selectedCategory.value?.type === 'tables') {
      api.selectTableObject(item)
    } else if (selectedCategory.value?.type === 'views') {
      api.selectViewObject(item)
    } else if (selectedCategory.value?.type === 'functions') {
      api.selectFunctionObject(item)
    } else if (selectedCategory.value?.type === 'procedures') {
      api.selectProcedureObject(item)
    } else if (selectedCategory.value?.type === 'triggers') {
      api.selectTriggerObject(item)
    } else if (selectedCategory.value?.type === 'events') {
      api.selectEventObject(item)
    }
  }

  return {
    formatCellValue,
    truncateSql,
    formatSize,
    formatDate,
    getInfoHeaderName,
    getInfoHeaderDesc,
    getCategoryList,
    handleCategoryItemClick,
    parseSqlStatements
  }
}
