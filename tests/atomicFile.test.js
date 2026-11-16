import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFileAtomic, readJsonWithBackup } from '../src/main/utils/atomicFile.js'

let dir

beforeEach(async () => {
  dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ntoolbox-atomic-'))
})

afterEach(async () => {
  await fs.promises.rm(dir, { recursive: true, force: true })
})

describe('writeFileAtomic', () => {
  it('writes the full content and leaves no temp files behind', async () => {
    const filePath = path.join(dir, 'config.json')
    await fs.promises.writeFile(filePath, '{"old":true}', 'utf8')

    await writeFileAtomic(filePath, JSON.stringify({ next: true }), 'utf8')

    expect(JSON.parse(await fs.promises.readFile(filePath, 'utf8'))).toEqual({ next: true })
    const leftovers = (await fs.promises.readdir(dir)).filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})

describe('readJsonWithBackup', () => {
  it('returns parsed content with recovered=false when the main file is valid', async () => {
    const filePath = path.join(dir, 'config.json')
    await fs.promises.writeFile(filePath, '{"theme":"dark"}', 'utf8')

    await expect(readJsonWithBackup(filePath)).resolves.toEqual({
      data: { theme: 'dark' },
      recovered: false
    })
  })

  it('falls back to the .bak file when the main file is corrupt', async () => {
    const filePath = path.join(dir, 'config.json')
    await fs.promises.writeFile(filePath, '{broken', 'utf8')
    await fs.promises.writeFile(`${filePath}.bak`, '{"theme":"forest"}', 'utf8')

    await expect(readJsonWithBackup(filePath)).resolves.toEqual({
      data: { theme: 'forest' },
      recovered: true
    })
  })

  it('throws when neither the main file nor the backup is readable', async () => {
    const filePath = path.join(dir, 'config.json')
    await expect(readJsonWithBackup(filePath)).rejects.toMatchObject({ code: 'ENOENT' })

    await fs.promises.writeFile(filePath, '{broken', 'utf8')
    await fs.promises.writeFile(`${filePath}.bak`, 'also broken', 'utf8')
    await expect(readJsonWithBackup(filePath)).rejects.toBeInstanceOf(SyntaxError)
  })
})
