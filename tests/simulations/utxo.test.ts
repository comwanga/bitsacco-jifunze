import { expect, test } from "vitest";
import { buildTransaction, initialUtxoState, previewTransaction } from "../../lib/simulations/utxo.ts";
import { parseSats } from "../../lib/simulations/amount.ts";

test("spends whole inputs, preserves unselected coins and creates deterministic change", () => {
  const original = initialUtxoState();
  const before = structuredClone(original);
  const request = { coinIds: ["coin-1", "coin-2"], payment: 7000, fee: 500 };
  expect(previewTransaction(original, request)).toEqual({ ok: true, value: { total: 10000, payment: 7000, fee: 500, change: 2500 } });
  const result = buildTransaction(original, request);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(original).toEqual(before);
  expect(result.value.coins.filter((c) => !c.spent).map((c) => c.sats)).toEqual([2000, 2500]);
  expect(result.value.history[0].outputs).toEqual([{ id: "tx-1:0", owner: "recipient", sats: 7000 }, { id: "tx-1:1", owner: "learner", sats: 2500 }]);
  const next = buildTransaction(result.value, { coinIds: ["coin-3", "tx-1:1"], payment: 4000, fee: 500 });
  expect(next.ok).toBe(true);
  if (!next.ok) return;
  expect(next.value.history[1].outputs).toEqual([{ id: "tx-2:0", owner: "recipient", sats: 4000 }]);
  const remaining = next.value.coins.filter((c) => !c.spent).reduce((n, c) => n + c.sats, 0);
  expect(remaining + next.value.history.reduce((n, tx) => n + tx.payment + tx.fee, 0)).toBe(12000);
  expect(buildTransaction(original, request)).toEqual(result);
  expect(initialUtxoState()).toEqual(before);
});

test("rejects all invalid requests without mutating state, including reused inputs", () => {
  const state = initialUtxoState();
  for (const request of [
    { coinIds: [], payment: 1, fee: 0 }, { coinIds: ["missing"], payment: 1, fee: 0 },
    { coinIds: ["coin-1", "coin-1"], payment: 1, fee: 0 }, { coinIds: ["coin-1"], payment: 7000, fee: 500 },
    ...[0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((payment) => ({ coinIds: ["coin-1"], payment, fee: 0 })),
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((fee) => ({ coinIds: ["coin-1"], payment: 1, fee })),
    { coinIds: ["coin-1"], payment: Number.MAX_SAFE_INTEGER, fee: 1 },
  ]) {
    const before = structuredClone(state);
    expect(buildTransaction(state, request).ok).toBe(false);
    expect(state).toEqual(before);
  }
  const built = buildTransaction(state, { coinIds: ["coin-1"], payment: 6000, fee: 0 });
  if (!built.ok) throw Error("expected valid exact spend");
  expect(buildTransaction(built.value, { coinIds: ["coin-1"], payment: 1, fee: 0 })).toEqual({ ok: false, error: "spentCoin" });
});

test("text amounts are never silently truncated or converted from blank input", () => {
  expect(parseSats(" 7000 ")).toBe(7000);
  expect(parseSats("0")).toBe(0);
  for (const text of ["", " ", "1.5", "-1", "1e3", "NaN", "Infinity", "9007199254740993", "123x"]) expect(Number.isNaN(parseSats(text))).toBe(true);
});
