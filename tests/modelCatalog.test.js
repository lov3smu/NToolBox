import { describe, it, expect } from 'vitest'
import { BASE_MODELS } from '../src/main/services/ai/catalogs/base.js'
import { ZEN_CATALOG } from '../src/main/services/ai/catalogs/zen.js'
import { GO_CATALOG } from '../src/main/services/ai/catalogs/go.js'

// 两个网关官方 models API 返回的窗口确实不同，以下是已核实的差异项
const DOCUMENTED_OVERRIDES = {
  'minimax-m3': ['contextWindow', 'maxOutput'],
  'qwen3.8-max': ['contextWindow']
}

function toMap(models) {
  return new Map(models.map((model) => [model.id, model]))
}

describe('OpenCode 模型目录', () => {
  it('base 目录中的模型没有重复 id', () => {
    const ids = Object.keys(BASE_MODELS)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('zen/go 共用模型沿用 base 元数据', () => {
    for (const catalog of [ZEN_CATALOG, GO_CATALOG]) {
      const ids = catalog.models.map((model) => model.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const model of catalog.models) {
        const base = BASE_MODELS[model.id]
        if (!base) continue
        expect(model).toEqual({ id: model.id, ...base })
      }
    }
  })

  it('同 id 在 zen/go 中元数据唯一，差异仅限已记录的窗口覆盖', () => {
    const zen = toMap(ZEN_CATALOG.models)
    const go = toMap(GO_CATALOG.models)
    for (const [id, zenModel] of zen) {
      const goModel = go.get(id)
      if (!goModel) continue
      const overrides = DOCUMENTED_OVERRIDES[id] || []
      for (const key of ['name', 'contextWindow', 'maxOutput', 'inputTypes']) {
        if (overrides.includes(key)) continue
        expect(`${id}.${key}=${zenModel[key]}`).toBe(`${id}.${key}=${goModel[key]}`)
      }
    }
  })

  it('默认模型存在于各自目录中', () => {
    expect(ZEN_CATALOG.models.some((model) => model.id === ZEN_CATALOG.defaultModel)).toBe(true)
    expect(GO_CATALOG.models.some((model) => model.id === GO_CATALOG.defaultModel)).toBe(true)
  })
})
