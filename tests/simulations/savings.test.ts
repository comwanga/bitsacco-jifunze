import { expect, test } from "vitest";
import { evaluateSavings, SAVINGS_PRESETS } from "../../lib/simulations/savings.ts";
import { savingsCopy } from "../../lib/simulations/savings-copy.ts";

test("worked household, group and cooperative cases distinguish value from timely resources", () => {
  expect(evaluateSavings(SAVINGS_PRESETS.household)).toEqual({ assetValue: 2000, netAsset: 2000, available: 10000, expense: 13200, balance: -3200 });
  expect(evaluateSavings(SAVINGS_PRESETS.community)?.balance).toBe(4000);
  expect(evaluateSavings({ ...SAVINGS_PRESETS.community, assetAvailable: false })?.balance).toBe(-10000);
  expect(evaluateSavings(SAVINGS_PRESETS.cooperative)?.balance).toBe(-5000);
  expect(evaluateSavings({ ...SAVINGS_PRESETS.cooperative, assetAvailable: false })?.balance).toBe(-10000);
});

test("percentage then fixed costs, total loss, zero costs and two-decimal rounding are explicit", () => {
  const s = { ...SAVINGS_PRESETS.household, cash: 0, riskyAsset: 10000, priceChange: -30, inflation: 0, expense: 7000, feePercent: 2, fixedFee: 100 };
  expect(evaluateSavings(s)).toMatchObject({ available: 6760, balance: -240 });
  expect(evaluateSavings({ ...s, priceChange: -100 })).toMatchObject({ available: 0, netAsset: 0 });
  expect(evaluateSavings({ ...s, priceChange: 0, feePercent: 0, fixedFee: 0 })?.available).toBe(10000);
  expect(evaluateSavings({ ...s, riskyAsset: 1.01, priceChange: 0, feePercent: 1, fixedFee: 0 })?.netAsset).toBe(1);
  expect(evaluateSavings({ ...s, inflation: -50 })?.expense).toBe(3500);
});

test("reject invalid amounts and percentages rather than returning misleading arithmetic", () => {
  for (const field of ["cash", "riskyAsset", "expense", "fixedFee"] as const) for (const value of [-1, NaN, Infinity, 1_000_000_001, 0.001]) expect(evaluateSavings({ ...SAVINGS_PRESETS.household, [field]: value })).toBeNull();
  for (const [field,values] of [["priceChange",[-101,101,Infinity]], ["inflation",[-100,101,NaN]], ["feePercent",[-1,101,Infinity]], ["expense",[0]]] as const) for (const value of values) expect(evaluateSavings({ ...SAVINGS_PRESETS.household, [field]: value })).toBeNull();
});

test("scenario copy has matching nonempty English and Kiswahili fields", () => {
  expect(Object.keys(savingsCopy.en).sort()).toEqual(Object.keys(savingsCopy.sw).sort());
  for (const copy of Object.values(savingsCopy)) expect(Object.values(copy).every((value) => value.trim())).toBe(true);
});
