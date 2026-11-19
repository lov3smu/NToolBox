// Skill enable/disable flags and display overrides are stored in config so the
// metadata layer can stay stateless. Names follow the skill name rules used by
// the loader (lowercase letters, digits and hyphens).
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const MAX_ENTRIES = 200
const MAX_DESCRIPTION_LENGTH = 500

export function isValidSkillName(name) {
  return typeof name === 'string' && SKILL_NAME_PATTERN.test(name)
}

export function normalizeDisabledSkills(raw) {
  if (!Array.isArray(raw)) return []
  const result = []
  const seen = new Set()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    if (!isValidSkillName(name) || seen.has(name)) continue
    seen.add(name)
    result.push(name)
    if (result.length >= MAX_ENTRIES) break
  }
  return result
}

export function normalizeSkillOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result = {}
  let count = 0
  for (const [key, value] of Object.entries(raw)) {
    if (count >= MAX_ENTRIES) break
    const name = typeof key === 'string' ? key.trim() : ''
    if (!isValidSkillName(name)) continue
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const description =
      typeof value.description === 'string' ? value.description.trim().slice(0, MAX_DESCRIPTION_LENGTH) : ''
    if (!description) continue
    result[name] = { description }
    count += 1
  }
  return result
}

export function getSkillOverride(rawOverrides, name) {
  const overrides = normalizeSkillOverrides(rawOverrides)
  return overrides[name] || null
}
