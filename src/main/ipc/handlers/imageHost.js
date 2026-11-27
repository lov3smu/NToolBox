import { clipboard, dialog } from 'electron'
import { t } from '../../services/i18n.js'
import {
  clearImageHostHistory,
  getImageHostState,
  removeImageHostHistory,
  saveImageHostSettings,
  testImageHostProvider,
  uploadImageBuffer,
  uploadImagePaths
} from '../../services/imageHost/index.js'
import { buildClipboardFileName } from '../../services/imageHost/utils.js'
import { maskImageHostSettings } from '../../../shared/secrets.js'
import { IMAGE_HOST_EXTENSIONS } from '../../../shared/imageHosts.js'
import { IPC_CHANNELS } from '../../../shared/ipc'
import { getDialogParentWindow } from './common'

export function registerImageHostHandlers(handle) {
  handle(IPC_CHANNELS.imageHostState, async (_event, options) => {
    const state = await getImageHostState(options)
    return { ...state, settings: maskImageHostSettings(state.settings) }
  })

  handle(IPC_CHANNELS.imageHostSaveSettings, async (_event, settings) => {
    const result = await saveImageHostSettings(settings)
    return { ...result, settings: maskImageHostSettings(result.settings) }
  })

  handle(IPC_CHANNELS.imageHostSelectFiles, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('选择要上传的图片'),
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: t('图片文件'), extensions: IMAGE_HOST_EXTENSIONS },
        { name: t('所有文件'), extensions: ['*'] }
      ]
    })
    return { canceled: result.canceled, paths: result.canceled ? [] : result.filePaths }
  })

  handle(IPC_CHANNELS.imageHostUpload, async (_event, paths) => uploadImagePaths(paths))

  handle(IPC_CHANNELS.imageHostUploadData, async (_event, payload = {}) => {
    const data = payload?.data
    const buffer = data instanceof Uint8Array ? Buffer.from(data) : Buffer.alloc(0)
    return uploadImageBuffer({ buffer, name: payload?.name, mime: payload?.mime })
  })

  handle(IPC_CHANNELS.imageHostUploadClipboard, async () => {
    const image = clipboard.readImage()
    if (!image || image.isEmpty()) {
      const state = await getImageHostState()
      return {
        success: false,
        results: [],
        error: '剪贴板中没有图片',
        history: state.history
      }
    }
    return uploadImageBuffer({
      buffer: image.toPNG(),
      name: buildClipboardFileName(),
      mime: 'image/png'
    })
  })

  handle(IPC_CHANNELS.imageHostTest, async (_event, providerId, settings) =>
    testImageHostProvider(providerId, settings)
  )

  handle(IPC_CHANNELS.imageHostClearHistory, async () => clearImageHostHistory())

  handle(IPC_CHANNELS.imageHostRemoveHistory, async (_event, id) => removeImageHostHistory(id))
}
