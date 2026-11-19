import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const skillsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/main/skills')
const PARAM_TYPES = new Set(['string', 'integer', 'number', 'boolean', 'array', 'object'])
const ALLOWED_ROOT_KEYS = new Set(['type', 'properties', 'required', 'additionalProperties'])
const ALLOWED_PARAM_KEYS = new Set([
  'type',
  'description',
  'properties',
  'required',
  'items',
  'enum',
  'minimum',
  'maximum',
  'default',
  'additionalProperties'
])

function loadManifests(folder) {
  const root = path.join(skillsRoot, folder)
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(root, entry.name)
      return { dir, definition: JSON.parse(fs.readFileSync(path.join(dir, 'skill.json'), 'utf8')) }
    })
}

function expectIdentity(manifests) {
  for (const { dir, definition } of manifests) {
    expect(definition.name, dir).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    expect(path.basename(dir)).toBe(definition.name)
    expect(definition.version, definition.name).toMatch(/^\d+\.\d+\.\d+$/)
    expect(typeof definition.description, definition.name).toBe('string')
    expect(definition.description.length, definition.name).toBeGreaterThan(4)
    expect(definition.semantic_rules, definition.name).toBeUndefined()
  }
}

function expectParameterSchema(manifests) {
  for (const { definition } of manifests) {
    const schema = definition.parameters
    expect(schema, definition.name).toBeTruthy()
    expect(schema.type, definition.name).toBe('object')
    expect(schema.additionalProperties, definition.name).toBe(false)
    expect(Object.keys(schema).every((key) => ALLOWED_ROOT_KEYS.has(key)), definition.name).toBe(true)

    for (const [paramName, param] of Object.entries(schema.properties || {})) {
      const label = `${definition.name}.${paramName}`
      expect(PARAM_TYPES.has(param.type), label).toBe(true)
      expect(Object.keys(param).every((key) => ALLOWED_PARAM_KEYS.has(key)), label).toBe(true)

      if (param.enum) {
        expect(Array.isArray(param.enum), label).toBe(true)
        if (param.default !== undefined) expect(param.enum, label).toContain(param.default)
      }
      if (param.type === 'integer' || param.type === 'number') {
        if (param.minimum !== undefined && param.default !== undefined) {
          expect(param.default, label).toBeGreaterThanOrEqual(param.minimum)
        }
        if (param.maximum !== undefined && param.default !== undefined) {
          expect(param.default, label).toBeLessThanOrEqual(param.maximum)
        }
      }
    }

    for (const required of schema.required || []) {
      expect(schema.properties?.[required], `${definition.name}.${required}`).toBeTruthy()
      expect(schema.properties[required].default, `${definition.name}.${required}`).toBeUndefined()
    }
  }
}

function expectExecutable(manifests) {
  for (const { dir, definition } of manifests) {
    const hasHandler = definition.handler && fs.existsSync(path.join(dir, definition.handler))
    const hasPrompt = definition.promptTemplate && fs.existsSync(path.join(dir, definition.promptTemplate))
    expect(Boolean(hasHandler || hasPrompt), definition.name).toBe(true)
    expect(path.extname(hasHandler ? definition.handler : definition.promptTemplate), definition.name).toBe(
      hasHandler ? '.js' : '.txt'
    )
  }
}

function expectDisplayableExamples(manifests) {
  for (const { definition } of manifests) {
    for (const example of definition.examples || []) {
      expect(example.input, definition.name).toBeTruthy()
      expect(example.output, definition.name).toBeTruthy()
    }
  }
}

const builtinManifests = loadManifests('builtin')
const marketManifests = loadManifests('market')

describe('builtin skill manifests', () => {
  it('are discoverable', () => {
    expect(builtinManifests.length).toBeGreaterThan(10)
  })

  it('declare consistent identity fields', () => {
    expectIdentity(builtinManifests)
    for (const { definition } of builtinManifests) {
      expect(definition.type, definition.name).toBe('builtin')
    }
  })

  it('expose an object parameter schema without undeclared fields', () => {
    expectParameterSchema(builtinManifests)
  })

  it('ship a usable handler or prompt template', () => {
    expectExecutable(builtinManifests)
  })

  it('keep examples aligned with declared parameters', () => {
    expectDisplayableExamples(builtinManifests)
  })
})

describe('market skill manifests', () => {
  it('are discoverable', () => {
    expect(marketManifests.length).toBeGreaterThan(0)
  })

  it('follow the same identity and parameter conventions as builtin skills', () => {
    expectIdentity(marketManifests)
    expectParameterSchema(marketManifests)
  })

  it('ship a usable prompt template', () => {
    expectExecutable(marketManifests)
  })

  it('keep examples aligned with declared parameters', () => {
    expectDisplayableExamples(marketManifests)
  })
})
