import { log } from '../../utils'
import { t } from '../i18n.js'
import { getEntry } from './state.js'
import { quoteIdentifier, toErrorResult, auditWrite, READONLY_BLOCK_MESSAGE } from './helpers.js'
import { engineOf } from './engines/index.js'

function mysqlEntry(name) {
  const entry = getEntry(name)
  if (engineOf(entry) !== 'mysql') {
    throw new Error(t('当前数据库引擎暂不支持该功能'))
  }
  return entry
}

function parseGrantee(grantee) {
  const match = /^'(.*)'@'(.*)'$/.exec(String(grantee || ''))
  if (match) return { user: match[1], host: match[2] }
  return { user: String(grantee || ''), host: '' }
}

export async function queryUsers(name) {
  let conn = null
  try {
    const entry = mysqlEntry(name)
    conn = await entry.pool.getConnection()

    const [sessionRows] = await conn.query('SELECT CURRENT_USER() AS currentUser, USER() AS sessionUser')
    const session = sessionRows[0] || {}

    let users = []
    let source = 'mysql.user'
    try {
      const [rows] = await conn.query('SELECT User AS user, Host AS host FROM mysql.user ORDER BY User, Host')
      users = rows.map((row) => ({ user: row.user, host: row.host }))
    } catch {
      // 无 mysql.user 读取权限时回退到 information_schema
      const [rows] = await conn.query(
        'SELECT DISTINCT GRANTEE AS grantee FROM information_schema.USER_PRIVILEGES ORDER BY GRANTEE'
      )
      users = rows.map((row) => parseGrantee(row.grantee))
      source = 'information_schema'
    }

    return {
      success: true,
      currentUser: session.currentUser || '',
      sessionUser: session.sessionUser || '',
      users,
      source
    }
  } catch (error) {
    log.error('查询数据库用户失败:', error)
    return toErrorResult(error, t('查询数据库用户失败'))
  } finally {
    conn?.release()
  }
}

const USER_PRIVILEGES = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'DROP',
  'ALTER',
  'INDEX',
  'CREATE VIEW',
  'SHOW VIEW',
  'TRIGGER',
  'EXECUTE',
  'REFERENCES',
  'CREATE ROUTINE',
  'ALTER ROUTINE'
]

const ACCOUNT_PART_PATTERN = /^[A-Za-z0-9_.%-]+$/

function escapeSqlLiteral(value) {
  return `'${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")}'`
}

function normalizeAccount(user, host) {
  const userName = String(user || '').trim()
  const hostName = String(host || '').trim() || '%'
  if (!userName) throw new Error(t('用户名不能为空'))
  if (!ACCOUNT_PART_PATTERN.test(userName)) throw new Error(t('用户名包含不支持的字符'))
  if (!ACCOUNT_PART_PATTERN.test(hostName)) throw new Error(t('主机名包含不支持的字符'))
  return { user: userName, host: hostName, quoted: `${escapeSqlLiteral(userName)}@${escapeSqlLiteral(hostName)}` }
}

function normalizeUserPrivileges(list) {
  const privileges = []
  for (const item of Array.isArray(list) ? list : []) {
    const privilege = String(item || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
    if (!privilege) continue
    if (privilege === 'ALL PRIVILEGES') return ['ALL PRIVILEGES']
    if (!USER_PRIVILEGES.includes(privilege)) throw new Error(t('不支持的权限: {p0}', { p0: item }))
    if (!privileges.includes(privilege)) privileges.push(privilege)
  }
  if (!privileges.length) throw new Error(t('请至少选择一个权限'))
  return privileges
}

function buildPrivilegeScope(database, table) {
  const databaseName = String(database || '').trim()
  if (!databaseName || databaseName === '*') return '*.*'
  const tableName = String(table || '').trim() || '*'
  if (tableName === '*') return `${quoteIdentifier(databaseName)}.*`
  return `${quoteIdentifier(databaseName)}.${quoteIdentifier(tableName)}`
}

export async function getUserGrants(name, user, host) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    const entry = mysqlEntry(name)
    conn = await entry.pool.getConnection()
    const [rows] = await conn.query(`SHOW GRANTS FOR ${account.quoted}`)
    return {
      success: true,
      grants: rows.map((row) => String(Object.values(row)[0] || '')).filter(Boolean)
    }
  } catch (error) {
    log.error('读取用户权限失败:', error)
    return toErrorResult(error, t('读取用户权限失败'))
  } finally {
    conn?.release()
  }
}

export async function createDatabaseUser(name, user, host, password) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    if (!String(password ?? '').length) throw new Error(t('密码不能为空'))
    const entry = mysqlEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    await conn.query(`CREATE USER ${account.quoted} IDENTIFIED BY ${escapeSqlLiteral(password)}`)
    log.info(`已创建数据库用户: ${name}, ${account.quoted}`)
    const result = { success: true, message: t('用户已创建') }
    auditWrite(name, '', 'CREATE USER', `CREATE USER ${account.user}@${account.host}`, result, { source: 'user' })
    return result
  } catch (error) {
    log.error('创建用户失败:', error)
    const result = toErrorResult(error, t('创建用户失败'))
    auditWrite(name, '', 'CREATE USER', '', result, { source: 'user' })
    return result
  } finally {
    conn?.release()
  }
}

export async function dropDatabaseUser(name, user, host) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    const entry = mysqlEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    const [identityRows] = await conn.query('SELECT CURRENT_USER() AS currentUser')
    if (String(identityRows[0]?.currentUser || '') === `${account.user}@${account.host}`) {
      throw new Error(t('不能删除当前登录用户'))
    }
    await conn.query(`DROP USER ${account.quoted}`)
    log.info(`已删除数据库用户: ${name}, ${account.quoted}`)
    const result = { success: true, message: t('用户已删除') }
    auditWrite(name, '', 'DROP USER', `DROP USER ${account.user}@${account.host}`, result, { source: 'user' })
    return result
  } catch (error) {
    log.error('删除用户失败:', error)
    const result = toErrorResult(error, t('删除用户失败'))
    auditWrite(name, '', 'DROP USER', '', result, { source: 'user' })
    return result
  } finally {
    conn?.release()
  }
}

export async function setDatabaseUserPassword(name, user, host, password) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    if (!String(password ?? '').length) throw new Error(t('密码不能为空'))
    const entry = mysqlEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    await conn.query(`ALTER USER ${account.quoted} IDENTIFIED BY ${escapeSqlLiteral(password)}`)
    log.info(`已修改用户密码: ${name}, ${account.quoted}`)
    const result = { success: true, message: t('密码已更新') }
    auditWrite(name, '', 'ALTER USER', `ALTER USER ${account.user}@${account.host}`, result, { source: 'user' })
    return result
  } catch (error) {
    log.error('修改用户密码失败:', error)
    const result = toErrorResult(error, t('修改用户密码失败'))
    auditWrite(name, '', 'ALTER USER', '', result, { source: 'user' })
    return result
  } finally {
    conn?.release()
  }
}

export async function setDatabaseUserPrivileges(name, action, user, host, privileges, database, table) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    if (action !== 'grant' && action !== 'revoke') {
      throw new Error(t('无效的权限操作'))
    }
    const privilegeList = normalizeUserPrivileges(privileges)
    const scope = buildPrivilegeScope(database, table)
    const keyword = action === 'grant' ? 'GRANT' : 'REVOKE'
    const target = action === 'grant' ? 'TO' : 'FROM'
    const entry = mysqlEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    await conn.query(`${keyword} ${privilegeList.join(', ')} ON ${scope} ${target} ${account.quoted}`)
    log.info(`已${action === 'grant' ? '授予' : '撤销'}用户权限: ${name}, ${account.quoted}, ${scope}`)
    const result = {
      success: true,
      message: action === 'grant' ? t('权限已授予') : t('权限已撤销')
    }
    const summary = `${keyword} ${privilegeList.join(', ')} ON ${scope} ${target} ${account.user}@${account.host}`
    auditWrite(name, database || '', keyword, summary, result, { source: 'user' })
    return result
  } catch (error) {
    log.error('更新用户权限失败:', error)
    const result = toErrorResult(error, t('更新用户权限失败'))
    auditWrite(name, database || '', action === 'grant' ? 'GRANT' : 'REVOKE', '', result, { source: 'user' })
    return result
  } finally {
    conn?.release()
  }
}
