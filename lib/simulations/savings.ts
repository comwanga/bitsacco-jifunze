export type SavingsScenario = {
  cash: number; riskyAsset: number; priceChange: number; inflation: number;
  expense: number; feePercent: number; fixedFee: number; assetAvailable: boolean;
};
export type SavingsResult = { assetValue: number; netAsset: number; available: number; expense: number; balance: number };
const money = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 && Math.abs(n * 100 - Math.round(n * 100)) < 0.0001;
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** One fictional period, no interest/income/tax. Costs are capped at asset proceeds, never charged to cash. */
export function evaluateSavings(s: SavingsScenario): SavingsResult | null {
  if (![s.cash, s.riskyAsset, s.expense, s.fixedFee].every(money) || s.expense === 0
    || !Number.isFinite(s.priceChange) || s.priceChange < -100 || s.priceChange > 100
    || !Number.isFinite(s.inflation) || s.inflation <= -100 || s.inflation > 100
    || !Number.isFinite(s.feePercent) || s.feePercent < 0 || s.feePercent > 100
    || typeof s.assetAvailable !== "boolean") return null;
  const assetValue = round(s.riskyAsset * (1 + s.priceChange / 100));
  const netAsset = s.assetAvailable ? round(Math.max(0, assetValue * (1 - s.feePercent / 100) - s.fixedFee)) : 0;
  const available = round(s.cash + netAsset);
  const expense = round(s.expense * (1 + s.inflation / 100));
  return { assetValue, netAsset, available, expense, balance: round(available - expense) };
}

export const SAVINGS_PRESETS: Record<"household" | "community" | "cooperative", SavingsScenario> = {
  household: { cash: 8000, riskyAsset: 4000, priceChange: -50, inflation: 10, expense: 12000, feePercent: 0, fixedFee: 0, assetAvailable: true },
  community: { cash: 70000, riskyAsset: 30000, priceChange: -50, inflation: 0, expense: 80000, feePercent: 0, fixedFee: 1000, assetAvailable: true },
  cooperative: { cash: 20000, riskyAsset: 5000, priceChange: 0, inflation: 0, expense: 30000, feePercent: 0, fixedFee: 0, assetAvailable: true },
};
