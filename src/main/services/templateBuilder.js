import { escapeSql } from '../utils/sanitize'

export const DICTIONARY_TEMPLATE = {
  name: '字典配置',
  description: '生成字典表和字典数据表的初始化SQL',
  dictInsert:
    "INSERT INTO `t_dictionary` (`dict_name`, `dict_value`, `remark`, `create_by`, `create_time`, `modify_by`, `modify_time`) VALUES ('{{dict_name}}', '{{dict_value}}', NULL, @author, NOW(), @author, NOW());",
  dictDataInsert: `INSERT INTO \`t_dictionary_data\` (\`dict_value\`, \`dict_data_name\`, \`dict_data_value\`, \`expression\`, \`status\`, \`sort\`, \`remark\`, \`create_by\`, \`create_time\`, \`modify_by\`, \`modify_time\`) VALUES 
{{dict_data_values}};`
}

export const FUNCTION_GROUP_TEMPLATE = {
  name: '功能权限组',
  description: '生成功能权限组和功能权限的初始化SQL',
  parentQuery:
    "SET @{{var_name}} = (SELECT id FROM t_function_group WHERE app_group='{{app_group}}' AND code='{{parent_code}}' LIMIT 1);",
  groupInsert:
    "INSERT INTO `t_function_group` (`app_group`, `parent_id`, `group_level`, `sort`, `code`, `name`, `old_group_id`, `create_by`, `create_time`, `modify_by`, `modify_time`, `version`) VALUES ('{{app_group}}', {{parent_id}}, {{group_level}}, {{sort}}, '{{code}}', '{{name}}', 0, @author, NOW(), @author, NOW(), 1);",
  setIdAfterInsert: 'SET @{{var_name}} = LAST_INSERT_ID();',
  functionInsert:
    "INSERT INTO `t_function` (`parent_id`, `function_number`, `function_name`, `is_sensitive`, `sort`, `status`, `create_by`, `create_time`, `modify_by`, `modify_time`, `version`) VALUES (@{{group_var}}, '{{function_number}}', '{{function_name}}', {{is_sensitive}}, {{sort}}, {{status}}, @author, NOW(), @author, NOW(), 1);"
}

export const BUILTIN_TEMPLATES = {
  dictionary: DICTIONARY_TEMPLATE,
  function_group: FUNCTION_GROUP_TEMPLATE
}

export function buildDictionaryStatements(dictName, dictValues, translationMap = {}) {
  const dictValue = translationMap[dictName] || dictName.toUpperCase().replace(/\s+/g, '_')
  const safeDictName = escapeSql(dictName)
  const safeDictValue = escapeSql(dictValue)

  const dictDataValues = dictValues
    .map((item, index) => {
      const dataValue = translationMap[item.name] || item.name.toUpperCase().replace(/\s+/g, '_')
      const safeDataName = escapeSql(item.name)
      const safeDataValue = escapeSql(dataValue)
      const sort = item.sort || index + 1
      const status = item.status || 'EBL'
      return `('${safeDictValue}', '${safeDataName}', '${safeDataValue}', NULL, '${status}', ${sort}, NULL, @author, NOW(), @author, NOW())`
    })
    .join(',\n')

  const dictSql = DICTIONARY_TEMPLATE.dictInsert
    .replace('{{dict_name}}', safeDictName)
    .replace('{{dict_value}}', safeDictValue)

  const dictDataSql = DICTIONARY_TEMPLATE.dictDataInsert.replace('{{dict_data_values}}', dictDataValues)

  return {
    dict_value: dictValue,
    sql: `${dictSql}\n${dictDataSql}`
  }
}

export function buildFunctionGroupStatements(appGroup, functionGroups, translationMap = {}) {
  const sqlStatements = []
  let groupIndex = 0

  const sortedGroups = [...functionGroups].sort((a, b) => (a.level || 1) - (b.level || 1))

  for (const group of sortedGroups) {
    const groupCode = translationMap[group.code || group.name] || group.code || group.name
    const groupName = group.name || group.code
    const groupLevel = group.level || 1
    const sort = group.sort || (groupLevel === 1 ? 10 : 1000 + groupIndex * 10)

    const varName = `group_${groupIndex}_id`

    let parentIdValue
    if (groupLevel === 1 || !group.parent_code) {
      parentIdValue = '0'
    } else {
      const parentVarName = `parent_${groupIndex}_id`
      const parentCodeTranslated = translationMap[group.parent_code] || group.parent_code

      sqlStatements.push(
        FUNCTION_GROUP_TEMPLATE.parentQuery
          .replace(/{{var_name}}/g, parentVarName)
          .replace(/{{app_group}}/g, escapeSql(appGroup))
          .replace(/{{parent_code}}/g, escapeSql(parentCodeTranslated))
      )
      sqlStatements.push('')

      parentIdValue = `@${parentVarName}`
    }

    sqlStatements.push(
      FUNCTION_GROUP_TEMPLATE.groupInsert
        .replace(/{{app_group}}/g, escapeSql(appGroup))
        .replace(/{{parent_id}}/g, parentIdValue)
        .replace(/{{group_level}}/g, groupLevel)
        .replace(/{{sort}}/g, sort)
        .replace(/{{code}}/g, escapeSql(groupCode))
        .replace(/{{name}}/g, escapeSql(groupName))
    )
    sqlStatements.push('')

    sqlStatements.push(FUNCTION_GROUP_TEMPLATE.setIdAfterInsert.replace(/{{var_name}}/g, varName))
    sqlStatements.push('')

    if (group.functions && group.functions.length > 0) {
      for (const func of group.functions) {
        const funcCode = translationMap[func.code || func.name] || func.code || func.name
        const funcName = func.name || func.code
        const isSensitive = func.is_sensitive || 0
        const funcSort = func.sort || 0
        const status = func.status || 101001

        sqlStatements.push(
          FUNCTION_GROUP_TEMPLATE.functionInsert
            .replace(/{{group_var}}/g, varName)
            .replace(/{{function_number}}/g, escapeSql(funcCode))
            .replace(/{{function_name}}/g, escapeSql(funcName))
            .replace(/{{is_sensitive}}/g, isSensitive)
            .replace(/{{sort}}/g, funcSort)
            .replace(/{{status}}/g, status)
        )
        sqlStatements.push('')
      }
    }

    groupIndex++
  }

  return sqlStatements.join('\n').trim()
}
