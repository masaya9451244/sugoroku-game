/**
 * 金額を「万円」表記にフォーマットする
 */
export function formatMoney(amount: number): string {
  if (amount >= 100000000) {
    const oku = (amount / 100000000).toFixed(1);
    return `${oku}億円`;
  }
  if (amount >= 10000) {
    const man = Math.floor(amount / 10000);
    const remaining = amount % 10000;
    if (remaining === 0) return `${man.toLocaleString()}万円`;
    return `${man.toLocaleString()}万${remaining.toLocaleString()}円`;
  }
  return `${amount.toLocaleString()}円`;
}

/**
 * 金額（万円単位）を表示用にフォーマット（マイナス値対応）
 */
export function formatManEn(manAmount: number): string {
  const abs = Math.abs(manAmount);
  const sign = manAmount < 0 ? '-' : '';
  if (abs >= 10000) {
    const oku = (abs / 10000).toFixed(1);
    return `${sign}${oku}億円`;
  }
  return `${sign}${abs.toLocaleString()}万円`;
}

/**
 * ゼロパディングで月を表示
 */
export function formatMonth(month: number): string {
  return `${month}月`;
}
