// Formatting helpers shared across screens.

// P-values: scientific notation below 0.001, otherwise three decimals
// (matches the backend's format_p and the HANDOFF fixture).
export function formatP(p: number): string {
  if (p < 0.001) {
    const s = p.toExponential(0); // e.g. "4e-12"
    return s.replace("e-", "e\u2212").replace("e+", "e+");
  }
  return p.toFixed(3);
}

export function yearOf(t: string): string {
  return t.slice(0, 4);
}

export function signed(n: number, digits = 2): string {
  const v = n.toFixed(digits);
  return n >= 0 ? `+${v}` : v;
}
