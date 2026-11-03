export type ChannelState = { capacity: number; alice: number; bob: number; history: { from: "alice" | "bob"; amount: number; alice: number; bob: number }[] };
type ChannelResult = { ok: true; value: ChannelState } | { ok: false; error: "invalidDirection" | "invalidAmount" | "channelFunds" };

export function initialChannelState(): ChannelState { return { capacity: 100000, alice: 70000, bob: 30000, history: [] }; }

/** An already-settled arithmetic example, deliberately excluding reserves, fees and HTLCs. */
export function settleExamplePayment(state: ChannelState, from: string, amount: number): ChannelResult {
  if (from !== "alice" && from !== "bob") return { ok: false, error: "invalidDirection" };
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "invalidAmount" };
  if (amount > state[from]) return { ok: false, error: "channelFunds" };
  const alice = state.alice + (from === "alice" ? -amount : amount);
  const bob = state.bob + (from === "bob" ? -amount : amount);
  return { ok: true, value: { capacity: state.capacity, alice, bob, history: [...state.history, { from, amount, alice, bob }] } };
}
