import { describe, expect, it } from 'vitest'
import {
  buildConfigExport,
  CONFIG_EXPORT_TYPE,
  CONFIG_EXPORT_VERSION,
  CONFIG_IMPORT_ERROR_CODES,
  parseConfigExport,
  summarizeConfig
} from '../src/shared/configTransfer'
import { SECRET_MASK } from '../src/shared/secrets'

function createConfig() {
  return {
    config_version: 3,
    app: { shortcuts: { settings: 'CmdOrCtrl+,' } },
    ai: { provider: 'bailian', keys: { bailian: 'sk-real', moonshot: '' } },
    database: { connections: [{ id: 'c1', name: 'local', password: 'db-secret', savePassword: true }] },
    image_hosting: {
      providers: {
        github: { token: 'ghp-secret' },
        s3: { secretKey: 's3-secret' }
      }
    },
    extensions: {
      mcp_servers: [
        { name: 'files', command: 'npx' },
        { name: 'db', command: 'npx' }
      ]
    }
  }
}

describe('buildConfigExport', () => {
  it('wraps the config in a versioned payload', () => {
    const payload = buildConfigExport(createConfig(), { exportedAt: '2026-01-02T03:04:05.000Z' })
    expect(payload.type).toBe(CONFIG_EXPORT_TYPE)
    expect(payload.version).toBe(CONFIG_EXPORT_VERSION)
    expect(payload.exported_at).toBe('2026-01-02T03:04:05.000Z')
    expect(payload.config.ai.provider).toBe('bailian')
  })

  it('masks AI keys and image host secrets but blanks database passwords', () => {
    const payload = buildConfigExport(createConfig())
    expect(payload.config.ai.keys.bailian).toBe(SECRET_MASK)
    expect(payload.config.ai.keys.moonshot).toBe('')
    expect(payload.config.database.connections[0].password).toBe('')
    expect(payload.config.image_hosting.providers.github.token).toBe(SECRET_MASK)
    expect(payload.config.image_hosting.providers.s3.secretKey).toBe(SECRET_MASK)
  })

  it('does not mutate the source config', () => {
    const config = createConfig()
    buildConfigExport(config)
    expect(config.ai.keys.bailian).toBe('sk-real')
    expect(config.database.connections[0].password).toBe('db-secret')
  })

  it('handles non-object input and exports everything else as-is', () => {
    const empty = buildConfigExport(null)
    expect(empty.config).toEqual({})
    const payload = buildConfigExport(createConfig())
    expect(payload.type).toBe(CONFIG_EXPORT_TYPE)
  })
})

describe('parseConfigExport', () => {
  it('accepts a valid payload object or JSON string', () => {
    const payload = buildConfigExport(createConfig())
    const fromObject = parseConfigExport(payload)
    expect(fromObject.ok).toBe(true)
    expect(fromObject.config.ai.provider).toBe('bailian')

    const fromString = parseConfigExport(JSON.stringify(payload))
    expect(fromString.ok).toBe(true)
  })

  it('rejects malformed JSON', () => {
    expect(parseConfigExport('{not json')).toEqual({ ok: false, code: CONFIG_IMPORT_ERROR_CODES.FORMAT })
  })

  it('rejects a foreign payload type', () => {
    expect(parseConfigExport({ type: 'other', version: 1, config: {} })).toEqual({
      ok: false,
      code: CONFIG_IMPORT_ERROR_CODES.TYPE
    })
  })

  it('rejects unsupported versions', () => {
    expect(parseConfigExport({ type: CONFIG_EXPORT_TYPE, version: 99, config: {} })).toEqual({
      ok: false,
      code: CONFIG_IMPORT_ERROR_CODES.VERSION
    })
    expect(parseConfigExport({ type: CONFIG_EXPORT_TYPE, version: 0, config: {} })).toEqual({
      ok: false,
      code: CONFIG_IMPORT_ERROR_CODES.VERSION
    })
  })

  it('rejects a payload without config data', () => {
    expect(parseConfigExport({ type: CONFIG_EXPORT_TYPE, version: 1 })).toEqual({
      ok: false,
      code: CONFIG_IMPORT_ERROR_CODES.CONFIG
    })
  })
})

describe('summarizeConfig', () => {
  it('counts configured providers, connections, connectors and shortcuts', () => {
    expect(summarizeConfig(createConfig())).toEqual({
      providers: 1,
      connections: 1,
      mcpServers: 2,
      shortcuts: 1
    })
  })

  it('returns zeros for an empty config', () => {
    expect(summarizeConfig({})).toEqual({ providers: 0, connections: 0, mcpServers: 0, shortcuts: 0 })
    expect(summarizeConfig(null)).toEqual({ providers: 0, connections: 0, mcpServers: 0, shortcuts: 0 })
  })
})
