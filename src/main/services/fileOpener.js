import fs from 'fs'
import { execFile } from 'child_process'
import { shell } from 'electron'
import { log } from '../utils'

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
