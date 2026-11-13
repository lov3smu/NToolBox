import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS, IPC_EVENTS, IPC_METHODS, IPC_LISTENERS } from '../src/shared/ipc.js'

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('IPC contract', () => {
  it('defines a unique channel for every method', () => {
    const channelValues = Object.values(IPC_CHANNELS)
    expect(new Set(channelValues).size).toBe(channelValues.length)
    expect(new Set(IPC_METHODS.map((method) => method.name)).size).toBe(IPC_METHODS.length)
    expect(IPC_METHODS).toHaveLength(channelValues.length)
  })

  it('resolves every method to its channel and fallback', () => {
    for (const method of IPC_METHODS) {
      expect(method.channel, method.name).toBe(IPC_CHANNELS[method.name])
      expect(method.channel, method.name).toBeTruthy()
      expect(method, method.name).toHaveProperty('fallback')
    }
  })

  it('defines unique event listeners', () => {
    const channels = Object.values(IPC_EVENTS)
    expect(new Set(channels).size).toBe(channels.length)
    expect(new Set(IPC_LISTENERS.map((listener) => listener.name)).size).toBe(IPC_LISTENERS.length)
    for (const listener of IPC_LISTENERS) {
      expect(listener.channel).toBeTruthy()
    }
  })

  it('registers every contract channel in the main process', () => {
    const source = read('src/main/ipc/index.js')
    for (const method of IPC_METHODS) {
      expect(source, method.channel).toContain(`handle(IPC_CHANNELS.${method.name},`)
    }
  })

  it('keeps channel literals out of preload and renderer API', () => {
    const preload = read('src/preload/index.js')
    const rendererApi = read('src/renderer/src/api/index.js')

    for (const channel of Object.values(IPC_CHANNELS)) {
      expect(preload).not.toContain(`'${channel}'`)
      expect(rendererApi).not.toContain(`'${channel}'`)
    }
    for (const channel of Object.values(IPC_EVENTS)) {
      expect(preload).not.toContain(`'${channel}'`)
    }
  })
})
