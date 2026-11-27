import { t } from '@/i18n'
import { formatBytes } from '@shared/format'
import { formatCellText } from './cellFormat'
import { splitSqlStatements } from '@shared/sqlStatements'

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
    return formatBytes(bytes, { zero: '--' })
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
        tables: t('表'),
        views: t('视图'),
        functions: t('函数'),
        procedures: t('存储过程'),
        triggers: t('触发器'),
        events: t('事件')
      }
      return typeLabels[selectedCategory.value?.type] || ''
    }
    return ''
  }

  function getInfoHeaderDesc() {
    if (selectedInfoType.value === 'group') return t('分组')
    if (selectedInfoType.value === 'connection') return selectedConnection.value?.active ? t('已连接') : t('未连接')
    if (selectedInfoType.value === 'database') return t('数据库')
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
