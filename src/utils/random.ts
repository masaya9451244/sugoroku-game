/**
 * min以上max以下の整数をランダムに返す
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * サイコロを振る（1〜6）
 */
export function rollDice(): number {
  return randomInt(1, 6);
}

/**
 * 配列からランダムに1要素を返す
 */
export function randomPick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

/**
 * 配列からランダムにn要素を返す（重複なし）
 */
export function randomPickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = randomInt(0, copy.length - 1);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

/**
 * 重み付きランダム選択
 * items: 選択肢の配列, weights: 各選択肢の重み（合計は問わない）
 */
export function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let threshold = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return items[i];
  }
  return items[items.length - 1];
}
