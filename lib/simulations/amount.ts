/** Keep numeric input honest: no blank-to-zero, fractional truncation or exponent syntax. */
export function parseSats(text: string): number {
  const trimmed = text.trim();
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  return Number.isSafeInteger(value) ? value : NaN;
}
