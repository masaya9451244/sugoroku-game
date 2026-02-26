import type { GameState } from './game';

export interface SaveSlot {
  slotId: string;
  savedAt: string; // ISO8601
  currentYear: number;
  totalYears: number;
  playerNames: string[];
}

export interface SaveData {
  version: string;
  savedAt: string;
  gameState: GameState;
}
