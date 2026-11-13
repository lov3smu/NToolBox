import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fetchClawHubMarket,
  fetchClawHubSkillDetail,
  normalizeSkillName,
  parseSkillFrontmatter,
  searchClawHubSkills
} from '../src/main/services/clawhub.js'

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('clawhub client', () => {
  it('normalizes remote skill names', () => {
    expect(normalizeSkillName('PDF Tools')).toBe('pdf-tools')
    expect(normalizeSkillName('_GitLab_Agent!')).toBe('gitlab-agent')
    expect(normalizeSkillName('---')).toBe('')
    expect(normalizeSkillName('')).toBe('')
  })

  it('parses SKILL.md frontmatter and keeps the prompt body', () => {
    const parsed = parseSkillFrontmatter(
      '---\nname: pdf\ndescription: PDF toolkit\nlicense: MIT\n---\n\n# Guide\n\nUse pypdf.'
    )

    expect(parsed.meta).toEqual({ name: 'pdf', description: 'PDF toolkit', license: 'MIT' })
    expect(parsed.body).toBe('# Guide\n\nUse pypdf.')
  })

  it('returns plain content when frontmatter is missing', () => {
    const parsed = parseSkillFrontmatter('# Plain skill\n\nDo something.')
    expect(parsed.meta).toEqual({})
    expect(parsed.body).toBe('# Plain skill\n\nDo something.')
  })

  it('maps the market list into installable entries', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        items: [
          {
            ownerHandle: 'awspace',
            slug: 'pdf',
            displayName: 'Pdf',
            summary: 'PDF manipulation toolkit',
            topics: ['PDF'],
            stats: { downloads: 51934, stars: 66 },
            latestVersion: { version: '0.1.0', changelog: 'Initial release', license: 'MIT' }
          },
          {
            ownerHandle: 'xrowgmbh',
            slug: 'gitlab-agent',
            displayName: 'GitLab Agent',
            summary: 'Operate GitLab work',
            topics: [],
            stats: { downloads: 120 },
            latestVersion: { version: '1.2.0', changelog: '', license: 'MIT-0' }
          },
          { ownerHandle: 'broken', slug: '___', summary: 'invalid name' }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const items = await fetchClawHubMarket({ limit: 3 })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://clawhub.ai/api/v1/skills?limit=3',
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      name: 'pdf',
      version: '0.1.0',
      category: 'document',
      downloads: 51934,
      source: 'clawhub',
      sourceUrl: 'https://clawhub.ai/awspace/skills/pdf'
    })
    expect(items[1]).toMatchObject({ name: 'gitlab-agent', category: 'code', version: '1.2.0' })
  })

  it('normalizes search results without requiring a version', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: [
          {
            ownerHandle: 'awspace',
            slug: 'pdf',
            displayName: 'Pdf',
            summary: 'PDF manipulation toolkit',
            downloads: 51934,
            featured: true,
            canonicalUrl: '/awspace/skills/pdf',
            native: { skill: { topics: ['PDF'], stats: { downloads: 51934 } } }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchClawHubSkills('pdf tools', { limit: 2 })

    expect(fetchMock.mock.calls[0][0]).toBe('https://clawhub.ai/api/v1/search?q=pdf%20tools&limit=2')
    expect(results[0]).toMatchObject({
      name: 'pdf',
      version: '',
      featured: true,
      category: 'document',
      sourceUrl: 'https://clawhub.ai/awspace/skills/pdf'
    })
  })

  it('extracts the SKILL.md body and version from a detail response', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        skill: {
          slug: 'pdf',
          displayName: 'Pdf',
          summary: 'PDF manipulation toolkit',
          icon: null,
          description: '---\nname: pdf\ndescription: PDF toolkit\n---\n\n# PDF Guide\n\nUse pypdf.',
          topics: ['PDF'],
          tags: { latest: '0.1.0' },
          stats: { downloads: 51934 }
        }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const detail = await fetchClawHubSkillDetail({ ownerHandle: 'awspace', slug: 'pdf' })

    expect(fetchMock.mock.calls[0][0]).toBe('https://clawhub.ai/api/v1/skills/pdf?owner=awspace')
    expect(detail).toMatchObject({
      version: '0.1.0',
      summary: 'PDF manipulation toolkit',
      body: '# PDF Guide\n\nUse pypdf.',
      category: 'document'
    })
  })

  it('rejects non-success responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 500)))

    await expect(fetchClawHubMarket()).rejects.toThrow('HTTP 500')
  })
})
