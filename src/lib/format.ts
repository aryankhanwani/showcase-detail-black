/** Indian digit grouping — ₹1,50,000, never ₹150,000. */
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(value: number): string {
  return inr.format(value);
}

/** A price band. The studio never quotes a single figure before inspection. */
export function formatBand(from: number, to: number): string {
  return `${formatINR(from)} – ${formatINR(to)}`;
}
