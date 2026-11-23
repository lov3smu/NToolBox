import path from 'node:path'
import codeExec from './code-exec/handler.js'
import cron from './cron/handler.js'
import dbConnect from './db-connect/handler.js'
import dbQuery from './db-query/handler.js'
import dbSchema from './db-schema/handler.js'
import dictionarySql from './dictionary-sql/handler.js'
import fileOps from './file-ops/handler.js'
import functionGroupSql from './function-group-sql/handler.js'
import jsonFormat from './json-format/handler.js'
import knowledgeSearch from './knowledge-search/handler.js'
import memory from './memory/handler.js'
import password from './password/handler.js'
import resultRead from './result-read/handler.js'
import sqlConfig from './sql-config/handler.js'
import sqlScript from './sql-script/handler.js'
import subagent from './subagent/handler.js'
import timestamp from './timestamp/handler.js'
import webFetch from './web-fetch/handler.js'
import webSearch from './web-search/handler.js'
import yamlValidate from './yaml-validate/handler.js'

// 内置技能 handler 随主进程打包，保证与 services 共享同一模块实例；
// 目录名与 skill.json 的 name 一致。
export const builtinHandlers = {
  'code-exec': codeExec,
  cron,
  'db-connect': dbConnect,
  'db-query': dbQuery,
  'db-schema': dbSchema,
  'dictionary-sql': dictionarySql,
  'file-ops': fileOps,
  'function-group-sql': functionGroupSql,
  'json-format': jsonFormat,
  'knowledge-search': knowledgeSearch,
  memory,
  password,
  'result-read': resultRead,
  'sql-config': sqlConfig,
  'sql-script': sqlScript,
  subagent,
  timestamp,
  'web-fetch': webFetch,
  'web-search': webSearch,
  'yaml-validate': yamlValidate
}

export function getBuiltinHandler(skillPath) {
  return builtinHandlers[path.basename(skillPath)] || null
}
