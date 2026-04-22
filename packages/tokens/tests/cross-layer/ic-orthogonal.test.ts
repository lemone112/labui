/**
 * IC is orthogonal to BaseMode.
 *
 * @layer Cross-layer
 * @governs plan-v2 §1.5 · Two-axis rendering
 * @invariant IC mode amplifies contrast in BOTH light and dark; it does
 *            not require a particular base mode. The 4 outputs are real.
 * @why A user can opt-in to IC in either light or dark; they should both
 *      produce stricter-contrast output.
 * @on-fail check tier_targets.X.ic > tier_targets.X.normal; verify
 *          resolveSemantic uses contrast axis.
 */

import { describe, expect, test } from 'bun:test'
import { semantic } from '../_helpers/fixtures'

describe('IC orthogonality', () => {
  test('label-brand-primary IC has stricter contrast than normal in both base modes', () => {
    const t = semantic.tokens.find((t) => t.name === 'label-brand-primary')!
    expect(t.diagnostic).toBeDefined()
    const lightNorm = t.diagnostic!.measured_apca['light/normal']
    const lightIc = t.diagnostic!.measured_apca['light/ic']
    const darkNorm = t.diagnostic!.measured_apca['dark/normal']
    const darkIc = t.diagnostic!.measured_apca['dark/ic']
    expect(lightIc).toBeGreaterThan(lightNorm)
    expect(darkIc).toBeGreaterThan(darkNorm)
  })
})
