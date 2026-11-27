import { describe, expect, it } from 'vitest'
import {
  HTTP_COLLECTION_LIMITS,
  extractHttpVariableNames,
  findHttpEnvironment,
  formatHttpEnvironmentLines,
  normalizeHttpClientState,
  parseHttpEnvironmentLines,
  substituteHttpVariables
} from '../src/shared/httpCollections.js'

describe('httpCollections', () => {
  it('substitutes variables and reports missing names', () => {
    const result = substituteHttpVariables('{{baseUrl}}/users?token={{token}}&x={{token}}', {
      baseUrl: 'https://a.dev'
    })
    expect(result.ok).toBe(false)
    expect(result.value).toBe('https://a.dev/users?token={{token}}&x={{token}}')
    expect(result.missing).toEqual(['token'])
  })

  it('extracts unique variable names in order', () => {
    expect(extractHttpVariableNames('{{ a }} {{b}} {{ a }}')).toEqual(['a', 'b'])
    expect(extractHttpVariableNames('plain text')).toEqual([])
  })

  it('parses KEY=VALUE environment lines', () => {
    const parsed = parseHttpEnvironmentLines('# comment\nbaseUrl = https://api.dev\ntoken=abc=def\n\nbad line')
    expect(parsed.ok).toBe(false)
    expect(parsed.errors).toEqual([5])
    expect(parsed.variables).toEqual({ baseUrl: 'https://api.dev', token: 'abc=def' })
  })

  it('rejects invalid variable keys', () => {
    const parsed = parseHttpEnvironmentLines('9bad=x\n-good=y')
    expect(parsed.ok).toBe(false)
    expect(parsed.variables).toEqual({})
    expect(parsed.errors).toEqual([1, 2])
  })

  it('formats variables back to lines', () => {
    expect(formatHttpEnvironmentLines({ a: '1', b: '2' })).toBe('a=1\nb=2')
    expect(formatHttpEnvironmentLines(null)).toBe('')
  })

  it('normalizes state and keeps the active environment only when present', () => {
    const state = normalizeHttpClientState({
      environments: [{ id: 'env-a', name: '开发', variables: { baseUrl: 'https://a.dev', '9x': 'bad' } }],
      collections: [
        { id: 'col-a', name: '用户', requests: [{ name: '列表', url: 'https://a.dev/users', method: 'post' }] }
      ],
      activeEnvironmentId: 'env-a'
    })
    expect(state.environments).toHaveLength(1)
    expect(state.environments[0].variables).toEqual({ baseUrl: 'https://a.dev' })
    expect(state.collections[0].requests[0]).toMatchObject({ name: '列表', method: 'POST', timeoutSeconds: 30 })
    expect(state.activeEnvironmentId).toBe('env-a')

    expect(normalizeHttpClientState({ environments: [], activeEnvironmentId: 'missing' }).activeEnvironmentId).toBe('')
    expect(normalizeHttpClientState(null)).toEqual({ collections: [], environments: [], activeEnvironmentId: '' })
  })

  it('drops collections and environments without a name and enforces limits', () => {
    const requests = Array.from({ length: HTTP_COLLECTION_LIMITS.requestsPerCollection + 5 }, (_, index) => ({
      url: `https://a.dev/${index}`
    }))
    const state = normalizeHttpClientState({
      collections: [
        { name: '  ', requests },
        { name: 'ok', requests }
      ],
      environments: [{ name: '' }]
    })
    expect(state.collections).toHaveLength(1)
    expect(state.collections[0].requests).toHaveLength(HTTP_COLLECTION_LIMITS.requestsPerCollection)
    expect(state.environments).toHaveLength(0)
  })

  it('finds an environment by id', () => {
    const state = normalizeHttpClientState({ environments: [{ id: 'env-a', name: '开发' }] })
    expect(findHttpEnvironment(state, 'env-a')?.name).toBe('开发')
    expect(findHttpEnvironment(state, 'env-b')).toBeNull()
  })

  it('leaves vault secret placeholders for the main process', () => {
    const result = substituteHttpVariables('{{baseUrl}}/users?token={{ secret:api_token }}', {
      baseUrl: 'https://a.dev'
    })
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.value).toBe('https://a.dev/users?token={{ secret:api_token }}')
  })
})
