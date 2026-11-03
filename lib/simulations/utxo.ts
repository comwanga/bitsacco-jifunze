export type Coin = { id: string; sats: number; spent: boolean };
export type Transaction = { id: string; coinIds: string[]; total: number; payment: number; fee: number; change: number; outputs: { id: string; owner: "recipient" | "learner"; sats: number }[] };
export type UtxoState = { coins: Coin[]; history: Transaction[] };
export type TransactionRequest = { coinIds: string[]; payment: number; fee: number };
export type UtxoError = "noCoins" | "invalidAmount" | "invalidFee" | "duplicateCoin" | "unknownCoin" | "spentCoin" | "funds" | "overflow";
type Result<T> = { ok: true; value: T } | { ok: false; error: UtxoError };
type Preview = { total: number; payment: number; fee: number; change: number };

export function initialUtxoState(): UtxoState {
  return { coins: [6000, 4000, 2000].map((sats, i) => ({ id: `coin-${i + 1}`, sats, spent: false })), history: [] };
}

export function previewTransaction(state: UtxoState, request: TransactionRequest): Result<Preview> {
  const { coinIds, payment, fee } = request;
  if (!Array.isArray(coinIds) || coinIds.length === 0) return { ok: false, error: "noCoins" };
  if (!Number.isSafeInteger(payment) || payment <= 0) return { ok: false, error: "invalidAmount" };
  if (!Number.isSafeInteger(fee) || fee < 0) return { ok: false, error: "invalidFee" };
  if (new Set(coinIds).size !== coinIds.length) return { ok: false, error: "duplicateCoin" };
  let total = 0;
  for (const id of coinIds) {
    const coin = state.coins.find((c) => c.id === id);
    if (!coin) return { ok: false, error: "unknownCoin" };
    if (coin.spent) return { ok: false, error: "spentCoin" };
    total += coin.sats;
    if (!Number.isSafeInteger(total) || coin.sats <= 0) return { ok: false, error: "overflow" };
  }
  if (!Number.isSafeInteger(payment + fee)) return { ok: false, error: "overflow" };
  if (total < payment + fee) return { ok: false, error: "funds" };
  return { ok: true, value: { total, payment, fee, change: total - payment - fee } };
}

export function buildTransaction(state: UtxoState, request: TransactionRequest): Result<UtxoState> {
  const preview = previewTransaction(state, request);
  if (!preview.ok) return preview;
  const id = `tx-${state.history.length + 1}`;
  const tx: Transaction = { id, coinIds: [...request.coinIds], ...preview.value,
    outputs: [{ id: `${id}:0`, owner: "recipient", sats: request.payment }] };
  const coins = state.coins.map((c) => request.coinIds.includes(c.id) ? { ...c, spent: true } : c);
  if (tx.change > 0) {
    const outputId = `${id}:1`;
    tx.outputs.push({ id: outputId, owner: "learner", sats: tx.change });
    coins.push({ id: outputId, sats: tx.change, spent: false });
  }
  return { ok: true, value: { coins, history: [...state.history, tx] } };
}
