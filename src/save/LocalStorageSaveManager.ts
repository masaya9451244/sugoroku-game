import type { ISaveManager } from './ISaveManager';
import type { SaveData, SaveSlot } from '../types';
import type { GameState } from '../types';
import { SAVE_KEYS } from '../config';

export class LocalStorageSaveManager implements ISaveManager {
  private readonly slotIndexKey = `${SAVE_KEYS.SLOT_PREFIX}index`;

  /**
   * ゲーム状態を指定スロットに保存する
   */
  save(slotId: string, gameState: GameState): boolean {
    try {
      const saveData: SaveData = {
        version: SAVE_KEYS.VERSION,
        savedAt: new Date().toISOString(),
        gameState,
      };

      const key = this.getSlotKey(slotId);
      localStorage.setItem(key, JSON.stringify(saveData));

      // スロットインデックスを更新
      this.updateSlotIndex(slotId, gameState);

      return true;
    } catch {
      console.error(`[SaveManager] Failed to save slot ${slotId}`);
      return false;
    }
  }

  /**
   * 指定スロットからゲーム状態を読み込む
   */
  load(slotId: string): SaveData | null {
    try {
      const key = this.getSlotKey(slotId);
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const data = JSON.parse(raw) as SaveData;

      // バージョンチェック（簡易：メジャーバージョンが一致すれば OK）
      if (!data.version?.startsWith(SAVE_KEYS.VERSION.split('.')[0])) {
        console.warn(`[SaveManager] Version mismatch: ${data.version}`);
      }

      return data;
    } catch {
      console.error(`[SaveManager] Failed to load slot ${slotId}`);
      return null;
    }
  }

  /**
   * 保存済みスロット一覧を返す
   */
  listSlots(): SaveSlot[] {
    try {
      const raw = localStorage.getItem(this.slotIndexKey);
      if (!raw) return [];
      return JSON.parse(raw) as SaveSlot[];
    } catch {
      return [];
    }
  }

  /**
   * 指定スロットのデータを削除する
   */
  deleteSlot(slotId: string): boolean {
    try {
      const key = this.getSlotKey(slotId);
      localStorage.removeItem(key);

      // インデックスからも削除
      const slots = this.listSlots().filter((s) => s.slotId !== slotId);
      localStorage.setItem(this.slotIndexKey, JSON.stringify(slots));

      return true;
    } catch {
      console.error(`[SaveManager] Failed to delete slot ${slotId}`);
      return false;
    }
  }

  /**
   * 指定スロットにデータが存在するか確認する
   */
  hasSlot(slotId: string): boolean {
    return localStorage.getItem(this.getSlotKey(slotId)) !== null;
  }

  // ──────────────────────────────────────
  // プライベートヘルパー
  // ──────────────────────────────────────

  private getSlotKey(slotId: string): string {
    return `${SAVE_KEYS.SLOT_PREFIX}${slotId}`;
  }

  private updateSlotIndex(slotId: string, gameState: GameState): void {
    const slots = this.listSlots();
    const existingIndex = slots.findIndex((s) => s.slotId === slotId);

    const slot: SaveSlot = {
      slotId,
      savedAt: new Date().toISOString(),
      currentYear: gameState.currentYear,
      totalYears: gameState.totalYears,
      playerNames: gameState.players.map((p) => p.name),
    };

    if (existingIndex >= 0) {
      slots[existingIndex] = slot;
    } else {
      slots.push(slot);
    }

    localStorage.setItem(this.slotIndexKey, JSON.stringify(slots));
  }
}
