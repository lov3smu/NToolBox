import { contextBridge, ipcRenderer } from 'electron'
import { IPC_METHODS, IPC_LISTENERS } from '../shared/ipc'

async function invoke(channel, args) {
  const response = await ipcRenderer.invoke(channel, ...args)
  if (response && typeof response === 'object' && response.__ipc === true) {
    if (!response.ok) {
      throw new Error(response.error || `IPC call failed: ${channel}`)
    }
    return response.data
  }
  return response
}

const api = {
  platform: process.platform
}

for (const { name, channel } of IPC_METHODS) {
  api[name] = (...args) => invoke(channel, args)
}

for (const { name, channel } of IPC_LISTENERS) {
  api[name] = (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
