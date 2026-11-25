import { executeSkill } from '../extensions/skills.js'

const PREVIEWABLE_TOOLS = new Set(['file-ops'])

export async function buildToolPreview(name, args, runtime = {}) {
  if (!PREVIEWABLE_TOOLS.has(name)) return null
  try {
    const result = await executeSkill(name, args, { ...runtime, dryRun: true })
    if (result && result.success && result.preview) return result.preview
    return null
  } catch {
    return null
  }
}
