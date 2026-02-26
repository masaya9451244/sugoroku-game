import type { SaveData, SaveSlot } from '../types';
import type { GameState } from '../types';

export interface ISaveManager {
  /**
   * ゲーム状態を指定スロットに保存する
   */
  save(slotId: string, gameState: GameState): boolean;

  /**
   * 指定スロットからゲーム状態を読み込む
   */
  load(slotId: string): SaveData | null;

  /**
   * 保存済みスロット一覧を返す
   */
  listSlots(): SaveSlot[];

  /**
   * 指定スロットのデータを削除する
   */
  deleteSlot(slotId: string): boolean;

  /**
   * 指定スロットにデータが存在するか確認する
   */
  hasSlot(slotId: string): boolean;
}
