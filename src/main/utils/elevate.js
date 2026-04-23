import fs from 'fs'
import path from 'path'
import sudo from 'sudo-prompt'
import log from './logger'

export function mkdirWithElevate(targetPath) {
  return new Promise((resolve, reject) => {
    fs.promises.mkdir(targetPath, { recursive: true })
      .then(() => resolve({ elevated: false }))
      .catch(async (err) => {
        if (err.code === 'EPERM' || err.code === 'EACCES') {
          log.info('权限不足，尝试提升权限创建目录:', targetPath)
          try {
            const result = await elevateMkdir(targetPath)
            resolve(result)
          } catch (elevateErr) {
            reject(elevateErr)
          }
        } else {
          reject(err)
        }
      })
  })
}

function elevateMkdir(targetPath) {
  return new Promise((resolve, reject) => {
    const command = `cmd /c "if not exist "${targetPath}" mkdir "${targetPath}""`
    const options = {
      name: 'SQL Script Generator'
    }

    sudo.exec(command, options, (error) => {
      if (error) {
        log.error('提升权限创建目录失败:', error)
        reject(new Error(`创建目录需要管理员权限: ${error.message}`))
      } else {
        log.info('通过提升权限成功创建目录:', targetPath)
        resolve({ elevated: true })
      }
    })
  })
}