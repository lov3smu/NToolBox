import { describe, expect, it } from 'vitest'
import {
  createRecipeId,
  createRecipeStep,
  normalizeRecipe,
  normalizeRecipeStep,
  normalizeRecipes,
  recipeStepLabel,
  RECIPE_LIMITS,
  runRecipeSteps,
  sortRecipes
} from '../src/shared/recipes.js'

describe('recipe steps', () => {
  it('normalizes codec and text steps', () => {
    expect(normalizeRecipeStep({ type: 'codec', mode: 'base64', direction: 'decode' })).toEqual({
      type: 'codec',
      mode: 'base64',
      direction: 'decode'
    })
    expect(normalizeRecipeStep({ type: 'codec', mode: 'nope', direction: 'sideways' })).toEqual({
      type: 'codec',
      mode: 'base64',
      direction: 'encode'
    })
    expect(normalizeRecipeStep({ type: 'text', operation: 'trim-lines' })).toEqual({
      type: 'text',
      operation: 'trim-lines'
    })
    expect(normalizeRecipeStep({ type: 'text', operation: 'nope' })).toBe(null)
    expect(normalizeRecipeStep(null)).toBe(null)
    expect(createRecipeStep('text')).toMatchObject({ type: 'text' })
    expect(createRecipeStep()).toMatchObject({ type: 'codec', mode: 'base64' })
  })

  it('labels steps with their mode or operation', () => {
    expect(recipeStepLabel({ type: 'codec', mode: 'base64', direction: 'decode' })).toBe('Base64 解码')
    expect(recipeStepLabel({ type: 'text', operation: 'trim-lines' })).toBe('去除行首尾空白')
    expect(recipeStepLabel(null)).toBe('')
  })

  it('drops invalid steps and caps the chain length', () => {
    const raw = Array.from({ length: RECIPE_LIMITS.maxSteps + 4 }, () => ({ type: 'text', operation: 'upper' }))
    raw.splice(2, 0, { type: 'bogus' })
    const steps = runRecipeSteps(raw, 'abc')
    expect(steps.ok).toBe(true)
    expect(steps.steps).toHaveLength(RECIPE_LIMITS.maxSteps)
  })
})

describe('recipes', () => {
  it('normalizes saved recipes and requires at least one step', () => {
    const recipe = normalizeRecipe({ name: '  Demo  ', steps: [{ type: 'text', operation: 'upper' }] })
    expect(recipe.name).toBe('Demo')
    expect(recipe.steps).toHaveLength(1)
    expect(normalizeRecipe({ name: 'empty', steps: [] })).toBe(null)
    expect(normalizeRecipe(null)).toBe(null)
    const long = normalizeRecipe({ name: 'x'.repeat(200), steps: [{ type: 'text', operation: 'upper' }] })
    expect(long.name.length).toBe(RECIPE_LIMITS.nameLength)
  })

  it('deduplicates ids, caps the list and sorts by recency', () => {
    const list = []
    for (let index = 0; index < RECIPE_LIMITS.max + 5; index += 1) {
      list.push({ id: createRecipeId(), name: `r${index}`, steps: [{ type: 'text', operation: 'upper' }] })
    }
    const normalized = normalizeRecipes(list)
    expect(normalized).toHaveLength(RECIPE_LIMITS.max)
    expect(new Set(normalized.map((recipe) => recipe.id)).size).toBe(RECIPE_LIMITS.max)
    expect(normalizeRecipes('nope')).toEqual([])

    const sorted = sortRecipes([
      { id: 'a', updatedAt: 1 },
      { id: 'b', updatedAt: 3 },
      { id: 'c', updatedAt: 2 }
    ])
    expect(sorted.map((recipe) => recipe.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('recipe execution', () => {
  it('runs chained codec and text steps in order', () => {
    const encoded = runRecipeSteps([{ type: 'codec', mode: 'base64', direction: 'encode' }], 'hello')
    expect(encoded.ok).toBe(true)
    expect(encoded.value).toBe('aGVsbG8=')

    const decoded = runRecipeSteps(
      [
        { type: 'codec', mode: 'base64', direction: 'decode' },
        { type: 'text', operation: 'upper' }
      ],
      'aGVsbG8='
    )
    expect(decoded.ok).toBe(true)
    expect(decoded.value).toBe('HELLO')
    expect(decoded.steps.map((step) => step.ok)).toEqual([true, true])

    const lines = runRecipeSteps(
      [
        { type: 'text', operation: 'trim-lines' },
        { type: 'text', operation: 'remove-empty-lines' },
        { type: 'text', operation: 'dedupe-lines' },
        { type: 'text', operation: 'sort-lines' }
      ],
      ' b \n\n a \n b \n'
    )
    expect(lines.value).toBe('a\nb')
  })

  it('reports the failing step and keeps earlier results', () => {
    const result = runRecipeSteps(
      [
        { type: 'text', operation: 'upper' },
        { type: 'codec', mode: 'base64', direction: 'decode' }
      ],
      '!!!'
    )
    expect(result.ok).toBe(false)
    expect(result.stepIndex).toBe(1)
    expect(result.error).toBe('invalid-base64')
    expect(result.steps).toHaveLength(2)
    expect(result.steps[1].ok).toBe(false)
    expect(result.value).toBe('!!!')
  })

  it('empties output when no steps are configured', () => {
    const result = runRecipeSteps([], 'abc')
    expect(result.ok).toBe(true)
    expect(result.value).toBe('abc')
    expect(result.steps).toEqual([])
  })
})
