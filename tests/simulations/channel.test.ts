import { expect, test } from "vitest";
import { initialChannelState, settleExamplePayment } from "../../lib/simulations/channel.ts";

test("settled payments change direction-dependent balances with fixed capacity", () => {
  const initial = initialChannelState();
  const first = settleExamplePayment(initial, "alice", 21000);
  if (!first.ok) throw Error("valid payment rejected");
  expect(first.value).toMatchObject({ capacity: 100000, alice: 49000, bob: 51000 });
  const second = settleExamplePayment(first.value, "bob", 10000);
  if (!second.ok) throw Error("valid reverse payment rejected");
  expect(second.value).toMatchObject({ alice: 59000, bob: 41000 });
  expect(second.value.history).toHaveLength(2);
  expect(initial).toEqual(initialChannelState());
  let state = second.value;
  for (let i = 0; i < 100; i++) {
    const from = i % 2 ? "bob" : "alice";
    const result = settleExamplePayment(state, from, state[from]);
    if (!result.ok) throw Error("exact balance rejected by arithmetic model");
    state = result.value;
    expect(state.alice + state.bob).toBe(state.capacity);
    expect(Math.min(state.alice, state.bob)).toBeGreaterThanOrEqual(0);
  }
});

test("invalid requests never change either balance or history", () => {
  const state = initialChannelState();
  for (const from of ["alice", "bob"] as const) for (const amount of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, state[from] + 1]) {
    const before = structuredClone(state);
    expect(settleExamplePayment(state, from, amount).ok).toBe(false);
    expect(state).toEqual(before);
  }
  expect(settleExamplePayment(state, "unknown", 1)).toEqual({ ok: false, error: "invalidDirection" });
});
