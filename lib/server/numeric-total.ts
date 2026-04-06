/**
 * SRS Appendix A / DB: `order_total` NUMERIC(10,2).
 * Max value 99_999_999.99; two decimal places.
 */
const MAX_NUMERIC_10_2 = 99_999_999.99;

export function orderTotalFromLines(
  lines: { quantity: number; unitPrice: number }[],
): number {
  let sum = 0;
  for (const line of lines) {
    const q = line.quantity;
    const p = line.unitPrice;
    if (!Number.isFinite(q) || !Number.isFinite(p) || q < 1 || p <= 0) {
      throw new Error("Invalid line item for total calculation.");
    }
    sum += q * p;
  }
  const rounded = Math.round(sum * 100) / 100;
  if (rounded > MAX_NUMERIC_10_2) {
    throw new Error("Order total exceeds NUMERIC(10,2) range.");
  }
  return rounded;
}
