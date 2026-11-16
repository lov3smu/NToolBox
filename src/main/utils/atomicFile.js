import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

function tempPathFor(filePath) {
  const suffix = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  return path.join(path.dirname(filePath), `.${path.basename(filePath)}.${suffix}.tmp`)
}

export async function writeFileAtomic(filePath, content, encoding = 'utf8') {
  const tempPath = tempPathFor(filePath)
  try {
    const handle = await fs.promises.open(tempPath, 'w')
    try {
      await handle.writeFile(content, encoding)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await fs.promises.rename(tempPath, filePath)
    if (process.platform !== 'win32') {
      await fs.promises.chmod(filePath, 0o600).catch(() => {})
    }
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => {})
    throw error
  }
}

export async function readJsonWithBackup(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')
    return { data: JSON.parse(content), recovered: false }
  } catch (error) {
    let backupContent
    try {
      backupContent = await fs.promises.readFile(`${filePath}.bak`, 'utf8')
    } catch {
      throw error
    }
    return { data: JSON.parse(backupContent), recovered: true }
  }
}
