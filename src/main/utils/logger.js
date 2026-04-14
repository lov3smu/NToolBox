import path from 'path'
import fs from 'fs'
import log from 'electron-log'
import { getLogDir } from './path'

const logDir = getLogDir()
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log')
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

export default log