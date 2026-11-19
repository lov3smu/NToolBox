import { describe, it, expect } from 'vitest'
import {
  MAX_ENTRY_TAGS,
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUP_NOTES_LENGTH,
  MAX_TAG_LENGTH,
  PASSWORD_VAULT_ERRORS,
  PASSWORD_VAULT_VERSION,
  normalizePasswordEntry,
  normalizePasswordGroup,
  normalizePasswordVault,
  normalizeTags
} from '../src/shared/passwordVault.js'

const NOW = '2026-11-19T08:00:00.000Z'

describe('password vault shared contract', () => {
  it('normalizes tags from strings and arrays', () => {
    expect(normalizeTags('工作, 个人，重要、工作; Personal\n')).toEqual(['工作', '个人', '重要', 'Personal'])
    expect(normalizeTags([' a ', 'A', '', null])).toEqual(['a'])
    expect(normalizeTags(undefined)).toEqual([])
  })

  it('caps tag count and length', () => {
    const tags = Array.from({ length: MAX_ENTRY_TAGS + 5 }, (_, index) => `tag-${index}`)
    expect(normalizeTags(tags)).toHaveLength(MAX_ENTRY_TAGS)
    expect(normalizeTags(['x'.repeat(MAX_TAG_LENGTH + 10)])[0]).toHaveLength(MAX_TAG_LENGTH)
  })

  it('normalizes groups with generated ids and timestamps', () => {
    const group = normalizePasswordGroup({ name: '  工作  ', notes: '  团队账号  ' }, NOW)
    expect(group.name).toBe('工作')
    expect(group.notes).toBe('团队账号')
    expect(group.id).toMatch(/^grp-/)
    expect(group.createdAt).toBe(NOW)
    expect(group.updatedAt).toBe(NOW)

    const limited = normalizePasswordGroup(
      {
        name: 'x'.repeat(MAX_GROUP_NAME_LENGTH + 20),
        notes: 'y'.repeat(MAX_GROUP_NOTES_LENGTH + 20),
        createdAt: 'bad-date'
      },
      NOW
    )
    expect(limited.name).toHaveLength(MAX_GROUP_NAME_LENGTH)
    expect(limited.notes).toHaveLength(MAX_GROUP_NOTES_LENGTH)
    expect(limited.createdAt).toBe(NOW)
  })

  it('normalizes entries and keeps unknown optional fields out', () => {
    const entry = normalizePasswordEntry(
      {
        id: ' pwd-1 ',
        groupId: ' grp-1 ',
        title: '  GitHub ',
        username: ' user ',
        password: 'secret',
        url: ' https://github.com ',
        tags: 'dev, git',
        notes: ' note ',
        createdAt: NOW,
        updatedAt: '2026-11-19T09:00:00.000Z',
        ignored: true
      },
      NOW
    )

    expect(entry).toEqual({
      id: 'pwd-1',
      groupId: 'grp-1',
      title: 'GitHub',
      username: 'user',
      password: 'secret',
      url: 'https://github.com',
      tags: ['dev', 'git'],
      notes: 'note',
      createdAt: NOW,
      updatedAt: '2026-11-19T09:00:00.000Z'
    })

    const ungrouped = normalizePasswordEntry({ title: 'Mail', groupId: '   ', tags: [] }, NOW)
    expect(ungrouped.groupId).toBeNull()
    expect(ungrouped.id).toMatch(/^pwd-/)
    expect(ungrouped.createdAt).toBe(NOW)
    expect(ungrouped.updatedAt).toBe(NOW)
  })

  it('drops nameless or duplicate groups and reattaches orphan entries', () => {
    const vault = normalizePasswordVault({
      groups: [
        { id: 'grp-a', name: 'Work' },
        { id: 'grp-a', name: 'Duplicate' },
        { id: 'grp-b', name: '   ' }
      ],
      entries: [
        { id: 'pwd-1', title: 'One', groupId: 'grp-a' },
        { id: 'pwd-1', title: 'Duplicate' },
        { id: 'pwd-2', title: 'Orphan', groupId: 'grp-missing' }
      ]
    })

    expect(vault.version).toBe(PASSWORD_VAULT_VERSION)
    expect(vault.groups).toHaveLength(1)
    expect(vault.groups[0].name).toBe('Work')
    expect(vault.entries).toHaveLength(2)
    expect(vault.entries[0].groupId).toBe('grp-a')
    expect(vault.entries[1].groupId).toBeNull()
  })

  it('normalizes group parent references and breaks cycles', () => {
    const vault = normalizePasswordVault({
      groups: [
        { id: 'grp-a', name: 'Work', parentId: '  ' },
        { id: 'grp-b', name: 'Dev', parentId: ' grp-a ' },
        { id: 'grp-c', name: 'Orphan', parentId: 'grp-missing' },
        { id: 'grp-d', name: 'Self', parentId: 'grp-d' },
        { id: 'grp-e', name: 'Cycle1', parentId: 'grp-f' },
        { id: 'grp-f', name: 'Cycle2', parentId: 'grp-e' }
      ]
    })

    const parents = Object.fromEntries(vault.groups.map((group) => [group.id, group.parentId]))
    expect(parents['grp-a']).toBeNull()
    expect(parents['grp-b']).toBe('grp-a')
    expect(parents['grp-c']).toBeNull()
    expect(parents['grp-d']).toBeNull()
    expect(parents['grp-e'] === null || parents['grp-f'] === null).toBe(true)
  })

  it('tolerates malformed vault payloads', () => {
    expect(normalizePasswordVault(null)).toEqual({ version: PASSWORD_VAULT_VERSION, groups: [], entries: [] })
    expect(normalizePasswordVault({ groups: 'bad', entries: 42 })).toEqual({
      version: PASSWORD_VAULT_VERSION,
      groups: [],
      entries: []
    })
  })

  it('exposes stable error codes', () => {
    expect(Object.values(PASSWORD_VAULT_ERRORS)).toContain('ENTRY_TITLE_REQUIRED')
    expect(Object.values(PASSWORD_VAULT_ERRORS)).toContain('GROUP_NAME_DUPLICATE')
  })
})
