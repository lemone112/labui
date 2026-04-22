/**
 * Diagnostic helpers — format rich failure messages pointing to the plan
 * section that a check enforces.
 *
 * @governs test-strategy.md §P2 · Fail messages guide
 */

export interface FailDetail {
  what: string
  expected: string
  got: string
  diagnosis?: string
  fix: string
  plan_ref: string
}

export function formatFail(d: FailDetail): string {
  const lines = [
    `FAIL: ${d.what}`,
    `  Expected: ${d.expected}`,
    `  Got:      ${d.got}`,
  ]
  if (d.diagnosis) lines.push(`  Diagnosis: ${d.diagnosis}`)
  lines.push(`  Fix:      ${d.fix}`)
  lines.push(`  Plan:     ${d.plan_ref}`)
  return lines.join('\n')
}
