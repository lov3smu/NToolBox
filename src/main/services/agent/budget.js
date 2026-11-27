const MIN_PLAN_BUDGET = 6
const STEPS_PER_ITERATION = 2
const PLAN_OVERHEAD = 2

export function computeIterationBudget(plan, configured) {
  const cap = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 20
  const steps = Array.isArray(plan?.steps) ? plan.steps.length : 0
  if (!steps) return cap
  const planned = steps * STEPS_PER_ITERATION + PLAN_OVERHEAD
  return Math.min(cap, Math.max(MIN_PLAN_BUDGET, planned))
}

export function collectRemainingSteps(plan) {
  if (!Array.isArray(plan?.steps)) return []
  return plan.steps
    .filter((step) => {
      if (!step || typeof step !== 'object') return false
      return step.state !== 'done'
    })
    .map((step) => String(step.text || '').trim())
    .filter(Boolean)
}
