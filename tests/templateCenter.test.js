import { describe, expect, it } from 'vitest'
import {
  BUILTIN_TEMPLATES as CENTER_TEMPLATES,
  TEMPLATE_CATEGORIES,
  collectPluginTemplates,
  getTemplateById,
  getTemplateCategoryName,
  filterTemplates,
  extractTemplateVariables,
  fillTemplate
} from '../src/shared/templates.js'
import { SEND_TARGETS } from '../src/shared/sendTo.js'

describe('template center catalog', () => {
  it('has unique ids, valid categories and known send targets', () => {
    const ids = CENTER_TEMPLATES.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    const categoryIds = TEMPLATE_CATEGORIES.map((entry) => entry.id)
    const targetPaths = SEND_TARGETS.map((entry) => entry.path)
    for (const template of CENTER_TEMPLATES) {
      expect(categoryIds).toContain(template.category)
      expect(template.name.length).toBeGreaterThan(0)
      expect(template.description.length).toBeGreaterThan(0)
      expect(template.content.length).toBeGreaterThan(20)
      if (template.targetPath) expect(targetPaths).toContain(template.targetPath)
    }
  })

  it('filters by category, query and both together', () => {
    expect(filterTemplates(CENTER_TEMPLATES, '', 'all')).toHaveLength(CENTER_TEMPLATES.length)
    expect(filterTemplates(CENTER_TEMPLATES, '', 'data')).toHaveLength(2)
    expect(filterTemplates(CENTER_TEMPLATES, 'YAML', 'all')[0].id).toBe('github-actions')
    expect(filterTemplates(CENTER_TEMPLATES, 'innodb', 'all')[0].id).toBe('mysql-table')
    expect(filterTemplates(CENTER_TEMPLATES, 'yaml', 'data')).toHaveLength(0)
    expect(filterTemplates(CENTER_TEMPLATES, '  不存在的关键字  ', 'all')).toHaveLength(0)
  })

  it('looks up templates and category names', () => {
    expect(getTemplateById(CENTER_TEMPLATES, 'readme')?.name).toBe('README 骨架')
    expect(getTemplateById(CENTER_TEMPLATES, 'missing')).toBeNull()
    expect(getTemplateCategoryName('docs')).toBe('通用文档')
    expect(getTemplateCategoryName('nope')).toBe('')
  })

  it('collects plugin templates with namespaced ids', () => {
    const plugins = [
      {
        name: 'team-pack',
        templates: [
          {
            id: 'release-notes',
            name: '发布说明',
            description: '版本发布记录',
            category: 'docs',
            targetPath: '/markdown-editor',
            tags: ['release'],
            content: '# 发布说明\n'
          }
        ]
      },
      { name: 'empty-pack', templates: [] },
      { templates: [{ id: 'orphan', content: 'x' }] },
      null
    ]
    const items = collectPluginTemplates(plugins)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'plugin:team-pack:release-notes',
      plugin: 'team-pack',
      category: 'docs',
      targetPath: '/markdown-editor'
    })
    expect(collectPluginTemplates(null)).toEqual([])
    expect(collectPluginTemplates([{ name: 'a', templates: [{ id: '', content: 'x' }] }])).toEqual([])
  })

  it('extracts unique template variables in order', () => {
    expect(extractTemplateVariables('# {{主题}}\n{{主题}} / {{ 作者 }} / {{}}')).toEqual(['主题', '作者'])
    expect(extractTemplateVariables(null)).toEqual([])
    expect(extractTemplateVariables('no variables')).toEqual([])
  })

  it('fills template variables and keeps unfilled placeholders', () => {
    const content = '# {{主题}}\n作者：{{作者}}\n日期：{{date}}'
    expect(fillTemplate(content, { 主题: '发布计划', 作者: '  ' })).toBe('# 发布计划\n作者：{{作者}}\n日期：{{date}}')
    expect(fillTemplate(content, {})).toBe(content)
    expect(fillTemplate(null, {})).toBe('')
  })
})
