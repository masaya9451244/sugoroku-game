export type CardType =
  | 'move_to_destination'  // 目的地へGO！
  | 'move_steps'           // N歩移動
  | 'move_to_city'         // 特定都市へ移動
  | 'buy_property'         // 物件購入系
  | 'steal_property'       // 物件横取り
  | 'sell_property'        // 物件売却
  | 'get_money'            // 収入
  | 'pay_money'            // 支払い
  | 'bombee_away'          // ボンビー除去
  | 'bombee_transfer'      // ボンビー移し替え
  | 'monopoly_break'       // 独占阻止
  | 'card_steal'           // カード奪取
  | 'plus_dice'            // サイコロ追加
  | 'double_income';       // 収益2倍

export type CardRarity = 'common' | 'uncommon' | 'rare';

export interface CardEffect {
  type: string;
  value: number | null;
  targetType: string | null;
}

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  effect: CardEffect;
  rarity: CardRarity;
}
