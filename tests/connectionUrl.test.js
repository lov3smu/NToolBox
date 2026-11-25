import { describe, it, expect } from 'vitest'
import { parseConnectionUrl } from '../src/renderer/src/views/database/connectionUrl.js'

describe('parseConnectionUrl', () => {
  it('parses a mysql url with credentials and database', () => {
    expect(parseConnectionUrl('mysql://root:secret@127.0.0.1:3307/shop')).toEqual({
      engine: 'mysql',
      host: '127.0.0.1',
      port: 3307,
      user: 'root',
      password: 'secret',
      database: 'shop'
    })
  })

  it('maps postgres protocols and fills the default port', () => {
    expect(parseConnectionUrl('postgres://app@db.local/app')).toEqual({
      engine: 'postgres',
      host: 'db.local',
      port: 5432,
      user: 'app',
      database: 'app'
    })
    expect(parseConnectionUrl('postgresql://db.local:6543')).toMatchObject({ engine: 'postgres', port: 6543 })
  })

  it('decodes escaped credentials', () => {
    expect(parseConnectionUrl('mysql://user:p%40ss%2Fword@localhost/test')).toMatchObject({
      password: 'p@ss/word',
      database: 'test'
    })
  })

  it('parses sqlite file urls', () => {
    expect(parseConnectionUrl('sqlite:///home/me/data/app%20db.sqlite')).toEqual({
      engine: 'sqlite',
      filePath: '/home/me/data/app db.sqlite'
    })
  })

  it('rejects unsupported or malformed input', () => {
    expect(parseConnectionUrl('')).toBeNull()
    expect(parseConnectionUrl('not a url')).toBeNull()
    expect(parseConnectionUrl('oracle://host:1521/orcl')).toBeNull()
    expect(parseConnectionUrl('mysql:///shop')).toBeNull()
    expect(parseConnectionUrl('sqlite://')).toBeNull()
  })
})
