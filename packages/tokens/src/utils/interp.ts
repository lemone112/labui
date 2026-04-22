/** Linear / eased interpolation helpers used by the primitive generators. */

export type Interp = 'linear' | 'ease-in' | 'ease-out'

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function interpAt(from: number, to: number, t: number, mode: Interp): number {
  switch (mode) {
    case 'linear':
      return lerp(from, to, t)
    case 'ease-in':
      return lerp(from, to, t * t)
    case 'ease-out':
      return lerp(from, to, 1 - (1 - t) * (1 - t))
  }
}

/**
 * Produce `steps` evenly-distributed t-values in [0, 1]. `steps=13` yields
 * `[0, 1/12, 2/12, …, 1]`.
 */
export function tSequence(steps: number): number[] {
  if (steps <= 1) return [0]
  const out: number[] = []
  for (let i = 0; i < steps; i++) out.push(i / (steps - 1))
  return out
}
