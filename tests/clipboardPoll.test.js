import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  userDataDir: '',
  text: '',
  formats: [],
  clipboard: {
    readText: () => fake.text,
    availableFormats: () => fake.formats,
    readBuffer: () => Buffer.alloc(0),
    readImage: () => ({ isEmpty: () => true }),
    writeText: () => {},
    writeImage: () => {}
  }
}))

vi.mock('electron', () => ({
  app: { getPath: () => fake.userDataDir },
  clipboard: fake.clipboard,
  nativeImage: {
    createFromBuffer: () => ({ isEmpty: () => false, toDataURL: () => 'data:image/png;base64,AAAA' }),
    createFromDataURL: () => ({ isEmpty: () => false })
  },
  BrowserWindow: { getAllWindows: () => [] }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: () => {}, warn: () => {}, error: () => {} }
}))

let service
let tempDir
let imagePath

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-clipboard-'))
  imagePath = path.join(tempDir, 'copied-image.png')
  fs.writeFileSync(imagePath, Buffer.from('fake-png-bytes'))
  fake.userDataDir = tempDir
  fake.text = imagePath

  service = await import('../src/main/services/clipboard.js')
  await service.initClipboardHistory()
})

afterAll(() => {
  service?.stopClipboardHistory()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('clipboard polling', () => {
  it('records the referenced image file alongside the copied path text', async () => {
    await vi.waitFor(
      () => {
        const { entries } = service.getClipboardState()
        expect(entries.some((entry) => entry.type === 'image')).toBe(true)
      },
      { timeout: 3000, interval: 100 }
    )

    const { entries } = service.getClipboardState()
    expect(entries.some((entry) => entry.type === 'text' && entry.text === imagePath)).toBe(true)
    const image = entries.find((entry) => entry.type === 'image')
    expect(image.image).toBe('data:image/png;base64,AAAA')
  })
})
