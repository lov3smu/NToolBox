import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { shell } from 'electron'
import { log } from '../utils'
import { getConfig } from './config'
import { VALID_OPERATE_TYPES } from '../constants'
import {
  escapeSql,
  isValidIdentifier,
  escapeIdentifier,
  sanitizePathSegment,
  isPathWithinBase
} from '../utils/sanitize'
import { mkdirWithElevate } from '../utils/elevate'

let isGenerating = false

export async function generateSQLFile(scriptInfo) {
  if (isGenerating) {
    return { success: false, error: '正在生成中，请稍后再试' }
  }
  isGenerating = true

  try {
    const config = getConfig()
    log.info('开始生成SQL文件', scriptInfo)

    if (!scriptInfo || typeof scriptInfo !== 'object') {
      throw new Error('无效的脚本信息')
    }
    if (!isValidIdentifier(scriptInfo.database)) {
      throw new Error('数据库名称不合法，仅允许字母、数字和下划线')
    }
    if (!VALID_OPERATE_TYPES.includes(scriptInfo.operateType)) {
      throw new Error('无效的操作类型')
    }
    if (scriptInfo.operateType !== 'QUERY') {
      if (!scriptInfo.scriptType || !isValidIdentifier(scriptInfo.scriptType)) {
        throw new Error('脚本类型不合法，仅允许字母、数字和下划线')
      }
    }

    const safeDirName = sanitizePathSegment(scriptInfo.dirName)
    const safeUsageForFilename = sanitizePathSegment(scriptInfo.usage)
    if (!safeDirName) throw new Error('目录名不能为空或包含非法字符')
    if (!safeUsageForFilename) throw new Error('脚本用途不能为空或包含非法字符')

    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const currentDate = now.toISOString().split('T')[0]
    const dateCompact = now.toISOString().slice(2, 10).replace(/-/g, '')

    let targetPath
    switch (scriptInfo.operateType) {
      case 'FIX':
        targetPath = path.join(config.base_path, 'PRODUCT-FIX', currentYear, safeDirName)
        if (scriptInfo.scriptType) targetPath = path.join(targetPath, scriptInfo.scriptType)
        break
      case 'PUBLISH':
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, safeDirName)
        if (scriptInfo.scriptType) targetPath = path.join(targetPath, scriptInfo.scriptType)
        break
      case 'QUERY':
        targetPath = path.join(config.base_path, 'DATA-QUERY', currentYear, safeDirName)
        break
    }

    if (!isPathWithinBase(targetPath, config.base_path)) {
      throw new Error('目标路径超出允许范围')
    }

    await mkdirWithElevate(targetPath)

    const files = await fs.promises.readdir(targetPath)
    const sqlFiles = files.filter(f => f.endsWith('.sql'))
    let maxNumber = 0
    for (const f of sqlFiles) {
      const match = f.match(/^S(\d+)-/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }
    const nextNumber = maxNumber + 1
    const padWidth = Math.max(2, String(nextNumber).length)
    const sNumber = `S${String(nextNumber).padStart(padWidth, '0')}`

    let filename
    if (scriptInfo.operateType === 'QUERY') {
      filename = `${sNumber}-${currentDate}-${scriptInfo.database}-${safeUsageForFilename}.sql`
    } else {
      filename = `${sNumber}-${currentDate}-${scriptInfo.scriptType}-${scriptInfo.database}-${safeUsageForFilename}.sql`
    }
    filename = filename.replace(/\s/g, '_')

    const filePath = path.join(targetPath, filename)
    if (!isPathWithinBase(filePath, config.base_path)) {
      throw new Error('生成的文件路径超出允许范围')
    }

    const safeUsage = escapeSql(scriptInfo.usage)
    const safeDevEnName = escapeSql(config.developer_en_name)
    const safeFilename = escapeSql(filename)
    const safeDbIdentifier = escapeIdentifier(scriptInfo.database)

    const content = `-- Please use UTF8 encoding without BOM
-- Script Usage: ${scriptInfo.usage}
-- Script Author: ${config.developer_ch_name}
-- Creation Time: ${currentDate}

USE ${safeDbIdentifier};

BEGIN;

SET @author = '${safeDevEnName}${dateCompact}';

-- 请在此处添加SQL语句

INSERT INTO t_script_history (scriptName, remark, create_by, modify_by, create_time, modify_time)
VALUES ('${safeFilename}', '${safeUsage}', @author, @author, NOW(), NOW());

COMMIT;
`

    await fs.promises.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' })

    return { success: true, filePath, filename, targetPath }
  } catch (error) {
    log.error('生成SQL文件失败:', error)
    return { success: false, error: error.message }
  } finally {
    isGenerating = false
  }
}

export async function openFile(filePath, editor) {
  try {
    await fs.promises.access(filePath)
    if (editor && editor !== '') {
      try {
        const editorStat = await fs.promises.stat(editor)
        if (!editorStat.isFile()) {
          log.error('编辑器路径不是有效文件:', editor)
          await shell.openPath(filePath)
          return true
        }
      } catch (statErr) {
        log.error('编辑器路径不存在，回退到系统默认:', editor, statErr.message)
        await shell.openPath(filePath)
        return true
      }
      execFile(editor, [filePath], (err) => {
        if (err) log.error('使用编辑器打开文件失败:', err)
      })
    } else {
      await shell.openPath(filePath)
    }
    return true
  } catch (error) {
    log.error('打开文件失败:', error)
    return false
  }
}

export async function openFolder(folderPath) {
  try {
    await fs.promises.access(folderPath)
    await shell.openPath(folderPath)
    return true
  } catch (error) {
    log.error('打开文件夹失败:', error)
    return false
  }
}