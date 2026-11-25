import { describe, expect, it } from 'vitest'
import {
  PROFILE_LIMITS,
  createProfileId,
  extractSecretAliases,
  findCredential,
  findProfileEnvironment,
  isSecretVariableName,
  normalizeCredential,
  normalizeCredentials,
  normalizeProfile,
  normalizeProfiles,
  normalizeSecretAlias,
  replaceSecretMarkers,
  resolveActiveEnvironment
} from '../src/shared/profiles.js'

function makeProfile(overrides = {}) {
  return normalizeProfile({
    name: '内部 API',
    description: ' 联调用 ',
    environments: [
      { id: 'env-prod', name: '生产', variables: { baseUrl: 'https://api.example.com', token: '{{secret:api}}' } },
      { id: 'env-dev', name: '开发', variables: { baseUrl: 'http://localhost:3000' } }
    ],
    activeEnvironmentId: 'env-dev',
    ...overrides
  })
}

describe('profiles contract', () => {
  it('normalizes a project and keeps the requested active environment', () => {
    const project = makeProfile()
    expect(project).toMatchObject({ name: '内部 API', description: '联调用', activeEnvironmentId: 'env-dev' })
    expect(project.environments).toHaveLength(2)
    expect(project.environments[0].variables.token).toBe('{{secret:api}}')
  })

  it('falls back to the first environment and clips names', () => {
    const project = makeProfile({ activeEnvironmentId: 'missing' })
    expect(project.activeEnvironmentId).toBe('env-prod')
    const longName = makeProfile({ name: 'x'.repeat(PROFILE_LIMITS.nameLength + 20) })
    expect(longName.name).toHaveLength(PROFILE_LIMITS.nameLength)
    expect(normalizeProfile({ environments: [] })).toBeNull()
  })

  it('caps environments per project and projects in total', () => {
    const environments = Array.from({ length: PROFILE_LIMITS.environmentsPerProject + 3 }, (_, index) => ({
      name: `env-${index}`
    }))
    const project = normalizeProfile({ name: 'cap', environments })
    expect(project.environments).toHaveLength(PROFILE_LIMITS.environmentsPerProject)

    const many = Array.from({ length: PROFILE_LIMITS.projects + 5 }, (_, index) => ({ name: `p-${index}` }))
    expect(normalizeProfiles(many)).toHaveLength(PROFILE_LIMITS.projects)
  })

  it('dedupes projects by id and finds environments', () => {
    const projects = normalizeProfiles([
      { id: 'p1', name: 'A', environments: [{ id: 'e1', name: 'dev' }] },
      { id: 'p1', name: 'A duplicate' },
      { id: 'p2', name: 'B' }
    ])
    expect(projects.map((project) => project.name)).toEqual(['A', 'B'])
    expect(findProfileEnvironment(projects[0], 'e1')?.name).toBe('dev')
    expect(findProfileEnvironment(projects[0], 'e2')).toBeNull()
  })

  it('resolves the active environment of the active project', () => {
    const projects = normalizeProfiles([makeProfile({ id: 'p1' }), makeProfile({ id: 'p2', name: 'B' })])
    const active = resolveActiveEnvironment(projects, 'p2')
    expect(active.project.name).toBe('B')
    expect(active.environment.name).toBe('开发')
    expect(resolveActiveEnvironment(projects, 'missing')).toBeNull()
    expect(resolveActiveEnvironment(projects, 'p1')?.environment.name).toBe('开发')
  })

  it('validates secret aliases and recognises secret variable names', () => {
    expect(normalizeSecretAlias(' api_token ')).toBe('api_token')
    expect(normalizeSecretAlias('1bad')).toBe('')
    expect(normalizeSecretAlias('bad alias')).toBe('')
    expect(isSecretVariableName(' secret:api ')).toBe(true)
    expect(isSecretVariableName('api')).toBe(false)
    expect(createProfileId('env')).toMatch(/^env-/)
  })

  it('extracts and replaces secret markers with missing tracking', () => {
    const text = 'Authorization: Bearer {{secret:api_token}}\nX-Fallback: {{ secret: backup }}'
    expect(extractSecretAliases(text)).toEqual(['api_token', 'backup'])
    expect(extractSecretAliases('no markers')).toEqual([])

    const resolved = replaceSecretMarkers(text, (alias) => (alias === 'api_token' ? 'abc123' : null))
    expect(resolved.value).toBe('Authorization: Bearer abc123\nX-Fallback: {{ secret: backup }}')
    expect(resolved.missing).toEqual(['backup'])
  })

  it('normalizes credentials with case-insensitive alias dedupe', () => {
    const entries = normalizeCredentials([
      { alias: 'API_TOKEN', entryId: 'e1', hint: ' prod ' },
      { alias: 'api_token', entryId: 'e2' },
      { alias: 'bad alias', entryId: 'e3' },
      { alias: 'GITHUB', entryId: '' }
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ alias: 'API_TOKEN', entryId: 'e1', hint: 'prod' })
    expect(normalizeCredential({ alias: 'ok', entryId: 'x' })).not.toBeNull()
    expect(findCredential(entries, 'api_token')?.entryId).toBe('e1')
    expect(findCredential(entries, '')).toBeNull()
  })

  it('caps credential aliases', () => {
    const list = Array.from({ length: PROFILE_LIMITS.credentials + 5 }, (_, index) => ({
      alias: `key_${index}`,
      entryId: `e-${index}`
    }))
    expect(normalizeCredentials(list)).toHaveLength(PROFILE_LIMITS.credentials)
  })
})
