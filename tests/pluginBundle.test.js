import { describe, expect, it } from 'vitest'
import { normalizePluginCommand, normalizePluginManifest, normalizePluginTemplate } from '../src/shared/pluginBundle.js'

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
      ],
      commands: [],
      templates: [],
      sandbox: { actions: [], permissions: [] }
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

  it('接受沙箱动作并派生权限', () => {
    const { manifest } = normalizePluginManifest({
      name: 'sandbox-pack',
      sandbox: {
        actions: [{ id: 'fmt', title: '格式化', op: 'toolbox', params: { action: 'codec', mode: 'json' } }]
      }
    })
    expect(manifest.sandbox.actions[0]).toMatchObject({
      input: 'clipboard',
      output: 'clipboard',
      permissions: ['toolbox', 'clipboard.read', 'clipboard.write']
    })
    expect(manifest.sandbox.permissions).toEqual(['toolbox', 'clipboard.read', 'clipboard.write'])
    expect(
      normalizePluginManifest({
        name: 'bad-pack',
        sandbox: { actions: [{ id: 'x', title: 'x', op: 'http', params: { url: 'http://127.0.0.1/status' } }] }
      }).error
    ).toContain('沙箱动作')
  })

  it('接受仅含命令与模板的插件', () => {
    const { manifest } = normalizePluginManifest({
      name: 'snippets-pack',
      commands: [{ id: 'open-yaml', title: '打开 YAML', action: 'navigate', target: '/yaml-editor' }],
      templates: [{ id: 'note', name: '会议纪要', content: '# 会议纪要\n', category: 'docs' }]
    })
    expect(manifest.commands).toEqual([
      { id: 'open-yaml', title: '打开 YAML', subtitle: '', keywords: '', action: 'navigate', target: '/yaml-editor' }
    ])
    expect(manifest.templates).toEqual([
      {
        id: 'note',
        name: '会议纪要',
        description: '',
        category: 'docs',
        targetPath: null,
        tags: [],
        content: '# 会议纪要\n'
      }
    ])
  })

  it('规范化命令的三种动作', () => {
    expect(
      normalizePluginCommand({ id: 'to-settings', title: '网络设置', action: 'settings', target: 'network' })
    ).toMatchObject({ action: 'settings', target: 'network' })
    expect(
      normalizePluginCommand({
        id: 'to-md',
        title: '发送到文档',
        action: 'send',
        target: '/markdown-editor',
        text: '  # 标题  '
      })
    ).toMatchObject({ action: 'send', target: '/markdown-editor', text: '  # 标题  ' })
    expect(normalizePluginCommand({ id: 'bad', title: 'x', action: 'exec', target: '/chat' })).toBeNull()
    expect(normalizePluginCommand({ id: 'bad', title: 'x', action: 'navigate', target: '/not-a-tool' })).toBeNull()
    expect(normalizePluginCommand({ id: 'bad', title: 'x', action: 'settings', target: 'nope' })).toBeNull()
    expect(
      normalizePluginCommand({ id: 'bad', title: 'x', action: 'send', target: '/image-viewer', text: 'x' })
    ).toBeNull()
    expect(normalizePluginCommand({ id: 'bad', title: 'x', action: 'send', target: '/markdown-editor' })).toBeNull()
    expect(normalizePluginCommand({ id: 'Bad Id', title: 'x', action: 'navigate', target: '/chat' })).toBeNull()
  })

  it('规范化模板并拒绝未知分类与目标', () => {
    expect(
      normalizePluginTemplate({
        id: 'note',
        name: '会议纪要',
        category: 'data',
        targetPath: '/json-parser',
        tags: ['例会', ''],
        content: '{}'
      })
    ).toEqual({
      id: 'note',
      name: '会议纪要',
      description: '',
      category: 'data',
      targetPath: '/json-parser',
      tags: ['例会'],
      content: '{}'
    })
    expect(normalizePluginTemplate({ id: 'note', name: 'x', category: 'nope', content: 'y' })).toBeNull()
    expect(normalizePluginTemplate({ id: 'note', name: 'x', targetPath: '/image-viewer', content: 'y' })).toBeNull()
    expect(normalizePluginTemplate({ id: 'note', name: 'x', content: '   ' })).toBeNull()
    expect(normalizePluginTemplate({ id: 'note', content: 'x' })).toBeNull()
  })

  it('拒绝重复命令或模板 ID', () => {
    expect(
      normalizePluginManifest({
        name: 'dupe-pack',
        commands: [
          { id: 'same', title: 'A', action: 'navigate', target: '/chat' },
          { id: 'same', title: 'B', action: 'navigate', target: '/chat' }
        ]
      }).error
    ).toContain('命令 ID 重复')
    expect(
      normalizePluginManifest({
        name: 'dupe-pack',
        templates: [
          { id: 'same', name: 'A', content: 'a' },
          { id: 'same', name: 'B', content: 'b' }
        ]
      }).error
    ).toContain('模板 ID 重复')
  })
})
