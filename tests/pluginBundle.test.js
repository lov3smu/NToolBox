import { describe, expect, it } from 'vitest'
import { normalizePluginManifest } from '../src/shared/pluginBundle.js'

describe('插件包 manifest', () => {
  it('规范化技能与连接器', () => {
    const { manifest } = normalizePluginManifest({
      name: 'office-pack',
      version: '1.2.0',
      description: ' 办公插件 ',
      author: 'tester',
      skills: ['skills/excel', './skills/doc', 'skills/excel'],
      connectors: [
        {
          name: 'Notion',
          command: 'npx',
          args: ['-y', '@notionhq/notion-mcp-server'],
          env: { NOTION_TOKEN: 'x' }
        }
      ]
    })

    expect(manifest).toEqual({
      name: 'office-pack',
      version: '1.2.0',
      description: '办公插件',
      author: 'tester',
      skills: ['skills/excel', 'skills/doc'],
      connectors: [
        {
          name: 'notion',
          command: 'npx',
          args: ['-y', '@notionhq/notion-mcp-server'],
          env: { NOTION_TOKEN: 'x' },
          enabled: true
        }
      ]
    })
  })

  it('拒绝非法名称、路径与重复连接器', () => {
    expect(normalizePluginManifest({ name: 'Bad Name', skills: ['a'] }).error).toContain('name')
    expect(normalizePluginManifest({ name: 'pack', skills: ['../escape'] }).error).toContain('路径无效')
    expect(normalizePluginManifest({ name: 'pack', skills: ['/abs'] }).error).toContain('路径无效')
    expect(
      normalizePluginManifest({
        name: 'pack',
        connectors: [
          { name: 'same', command: 'node' },
          { name: 'same', command: 'node' }
        ]
      }).error
    ).toContain('重复')
  })

  it('要求至少包含一个组件', () => {
    expect(normalizePluginManifest({ name: 'empty-pack', skills: [], connectors: [] }).error).toContain('至少')
    expect(normalizePluginManifest(null).error).toContain('格式无效')
  })
})
