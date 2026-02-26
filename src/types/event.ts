export type PropertyTheme = 'food' | 'tourism' | 'industry' | 'agriculture';

export type EventType = 'monthly' | 'yearly' | 'random';

export interface EventTrigger {
  month: number | null;   // 固定月（null = 任意）
  probability: number;    // 発生確率 0〜1
}

export interface EventEffect {
  type: string;
  value: number | null;
  targetType: 'all' | 'self' | 'other' | 'last_place' | 'first_place' | null;
}

export interface GameEvent {
  id: string;
  type: EventType;
  trigger: EventTrigger;
  name: string;
  description: string;
  effect: EventEffect;
}

export interface Property {
  id: string;
  cityId: string;
  name: string;
  theme: PropertyTheme;
  price: number;        // 購入価格（万円）
  income: number;       // 年間収益（万円）
  upgradePrices: number[];  // アップグレード価格
  upgradeIncomes: number[]; // アップグレード後の収益
  upgradeLevel: number;     // 現在のアップグレードレベル（0=初期）
  ownerId: string | null;   // 保有プレイヤーID（null=未購入）
}
