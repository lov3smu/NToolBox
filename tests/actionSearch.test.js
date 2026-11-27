import { describe, it, expect } from 'vitest'
import { filterActions } from '../src/shared/actionSearch.js'

const actions = [
  { id: 'tool:/chat', title: 'AI助手', subtitle: '多模型 Agent 对话与工具调用', keywords: '/chat' },
  { id: 'settings:network', title: '网络', subtitle: '设置', keywords: '设置 settings network' },
  { id: 'command:check-updates', title: '检查更新', subtitle: '检查并安装应用更新', keywords: 'update upgrade version' }
]

describe('filterActions', () => {
  it('空查询返回全部动作', () => {
    expect(filterActions(actions, '')).toHaveLength(3)
    expect(filterActions(actions, '   ')).toHaveLength(3)
    expect(filterActions(actions, null)).toHaveLength(3)
  })

  it('按中文标题、副标题与关键字匹配', () => {
    expect(filterActions(actions, '助手').map((item) => item.id)).toEqual(['tool:/chat'])
    expect(filterActions(actions, '设置').map((item) => item.id)).toEqual(['settings:network'])
    expect(filterActions(actions, 'upgrade').map((item) => item.id)).toEqual(['command:check-updates'])
  })

  it('匹配不区分大小写且支持路径关键字', () => {
    expect(filterActions(actions, 'AI').map((item) => item.id)).toEqual(['tool:/chat'])
    expect(filterActions(actions, '/chat').map((item) => item.id)).toEqual(['tool:/chat'])
  })

  it('英文译文参与匹配', () => {
    const translate = (value) => {
      if (value === '网络') return 'Network'
      if (value === '设置') return 'Settings'
      return value
    }
    expect(filterActions(actions, 'network', translate).map((item) => item.id)).toEqual(['settings:network'])
  })

  it('无匹配时返回空数组', () => {
    expect(filterActions(actions, 'zzz')).toEqual([])
  })
})
