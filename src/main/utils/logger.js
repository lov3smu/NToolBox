import path from 'path'
import fs from 'fs'
import log from 'electron-log'
import sudo from 'sudo-prompt'
import { getLogDir } from './path'

let initialized = false

export async function initLogger() {
  if (initialized) return
  initialized = true
  
  const logDir = getLogDir()
  
  try {
    if (!fs.existsSync(logDir)) {
      await fs.promises.mkdir(logDir, { recursive: true })
    }
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      await elevateMkdir(logDir)
    } else {
      throw err
    }
  }
  
  log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log')
  log.transports.file.level = 'info'
  log.transports.console.level = 'debug'
}

function elevateMkdir(targetPath) {
  return new Promise((resolve, reject) => {
    const command = `cmd /c "if not exist "${targetPath}" mkdir "${targetPath}""`
    const options = {
      name: 'SQL Script Generator'
    }

    sudo.exec(command, options, (error) => {
      if (error) {
        reject(new Error(`创建日志目录需要管理员权限: ${error.message}`))
      } else {
        resolve()
      }
    })
  })
}

export default log