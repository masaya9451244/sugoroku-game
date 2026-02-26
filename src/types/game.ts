import type { Property } from './event';

export type PlayerType = 'human' | 'cpu';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type BombeeType = 'none' | 'mini' | 'normal' | 'king';

export type GamePhase =
  | 'card_use'       // カード使用フェーズ
  | 'dice_roll'      // サイコロフェーズ
  | 'moving'         // 移動フェーズ
  | 'junction'       // 分岐選択フェーズ
  | 'square_action'  // マス処理フェーズ
  | 'bombee_action'  // ボンビー行動フェーズ
  | 'year_end'       // 年末決算フェーズ
  | 'game_over';     // ゲーム終了

export interface Position {
  cityId: string;           // 現在いる都市ID
  routeId: string | null;   // 移動中の路線ID（都市間移動中）
  squareIndex: number;      // 路線上のマス目インデックス
  previousCityId?: string;  // 1手前の都市ID（後退移動用）
}

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  difficulty: Difficulty;
  money: number;          // 所持金（万円）
  totalAssets: number;    // 総資産（万円）
  position: Position;
  hand: string[];         // 手持ちカードID配列
  bombeeType: BombeeType; // 憑依中のボンビー
  bombeeElapsedTurns: number; // ボンビー憑依後の経過ターン数
  color: number;          // コマの色（Phaser.jsカラー）
  pawIndex: number;       // コマの画像インデックス
  incomeMultiplier?: number; // 収益倍率（double_incomeカード用、デフォルト1）
  diceMultiplier?: number;   // サイコロ倍率（新幹線カード用、使用後1にリセット）
  bombeeImmuneYears?: number; // ボンビー無効化残り年数（ボンビーバスターカード用）
}

export interface GameState {
  id: string;
  currentYear: number;
  currentMonth: number;
  totalYears: number;
  currentPlayerIndex: number;
  phase: GamePhase;
  players: Player[];
  properties: Property[];
  destinationCityId: string;
  turnCount: number;
}

export interface PlayerConfig {
  name: string;
  type: PlayerType;
  difficulty: Difficulty;
}

export interface GameConfig {
  totalYears: number;
  players: PlayerConfig[];
}
