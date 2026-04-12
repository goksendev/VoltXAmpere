/**
 * SPICE engineering notation parser.
 * Converts strings like "1k", "100n", "4.7u" to numbers.
 */

const SUFFIXES: Record<string, number> = {
  f: 1e-15,   // femto
  p: 1e-12,   // pico
  n: 1e-9,    // nano
  u: 1e-6,    // micro
  m: 1e-3,    // milli
  k: 1e3,     // kilo
  K: 1e3,     // kilo (alt)
  meg: 1e6,   // mega
  M: 1e6,     // mega
  g: 1e9,     // giga
  G: 1e9,     // giga
  t: 1e12,    // tera
  T: 1e12,    // tera
};

/**
 * Parse a value string with optional engineering suffix.
 *
 * Examples:
 *   "1k"     → 1000
 *   "4.7u"   → 4.7e-6
 *   "100"    → 100
 *   "2.2meg" → 2.2e6
 *   "10e-3"  → 0.01
 */
export function parseValue(input: string | number): number {
  if (typeof input === 'number') return input;

  const trimmed = input.trim().toLowerCase();

  // Try direct number parse first (handles "1e-3", "0.001", etc.)
  const direct = Number(trimmed);
  if (!isNaN(direct)) return direct;

  // Try suffix matching — longest suffix first
  for (const suffix of ['meg', ...Object.keys(SUFFIXES).filter(s => s !== 'meg')]) {
    const lower = suffix.toLowerCase();
    if (trimmed.endsWith(lower)) {
      const numPart = trimmed.slice(0, -lower.length);
      const num = Number(numPart);
      if (!isNaN(num)) {
        return num * (SUFFIXES[suffix] ?? 1);
      }
    }
  }

  throw new Error(`Cannot parse value: "${input}"`);
}

/**
 * Format a number with engineering notation.
 *
 * Examples:
 *   1000       → "1k"
 *   0.0000047  → "4.7µ"
 *   0.1        → "100m"
 */
export function formatValue(value: number, unit: string = ''): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const tiers: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
    [1e-15, 'f'],
  ];

  for (const [threshold, prefix] of tiers) {
    if (abs >= threshold * 0.999) {
      const scaled = abs / threshold;
      const formatted = scaled < 10
        ? scaled.toPrecision(3)
        : scaled < 100
          ? scaled.toPrecision(4)
          : scaled.toFixed(0);
      return `${sign}${formatted}${prefix}${unit}`;
    }
  }

  return `${sign}${value.toExponential(2)}${unit}`;
}
