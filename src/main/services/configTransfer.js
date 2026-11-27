import fs from 'fs'
import { log } from '../utils'
import { writeFileAtomic } from '../utils/atomicFile'
import { getConfig, normalizeConfig, saveConfig } from './config'
import { migrateConfig } from './configMigrations'
import {
  buildConfigExport,
  parseConfigExport,
  summarizeConfig,
  CONFIG_IMPORT_ERROR_CODES,
  CONFIG_IMPORT_MAX_BYTES
} from '../../shared/configTransfer.js'

function pad(value) {
  return String(value).padStart(2, '0')
}

export function defaultConfigExportFileName(date = new Date()) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `ntoolbox-config-${stamp}.json`
}

export async function writeConfigExport(filePath) {
  try {
    const payload = buildConfigExport(getConfig())
    await writeFileAtomic(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { success: true, filePath }
  } catch (error) {
    log.error('导出配置失败:', error)
    return { success: false, error: error.message }
  }
}

export async function readConfigImport(filePath) {
  try {
    const stat = await fs.promises.stat(filePath)
    if (!stat.isFile()) return { success: false, code: CONFIG_IMPORT_ERROR_CODES.READ }
    if (stat.size > CONFIG_IMPORT_MAX_BYTES) return { success: false, code: CONFIG_IMPORT_ERROR_CODES.SIZE }

    const text = await fs.promises.readFile(filePath, 'utf8')
    const parsed = parseConfigExport(text)
    if (!parsed.ok) return { success: false, code: parsed.code }

    const normalized = normalizeConfig(migrateConfig(parsed.config).config)
    return {
      success: true,
      filePath,
      exportedAt: parsed.exportedAt,
      config: normalized,
      summary: summarizeConfig(normalized)
    }
  } catch (error) {
    log.error('读取配置文件失败:', error)
    return { success: false, code: CONFIG_IMPORT_ERROR_CODES.READ }
  }
}

export async function applyConfigImport(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return false
  const normalized = normalizeConfig(migrateConfig(rawConfig).config)
  return await saveConfig(normalized)
}
