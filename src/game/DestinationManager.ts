import type { City } from '../types';
import type { GameState, Player } from '../types';
import { BoardManager } from './BoardManager';

export interface DestinationArrivalResult {
  bonus: number;
  newDestinationCityId: string;
  newState: GameState;
}

export class DestinationManager {
  private boardManager: BoardManager;

  constructor(boardManager: BoardManager) {
    this.boardManager = boardManager;
  }

  /**
   * 目的地到着ボーナスを計算する
   * 本家踏襲：他プレイヤーの総資産合計 × 比率
   */
  calcArrivalBonus(state: GameState, arrivedPlayerId: string): number {
    const arrived = state.players.find((p) => p.id === arrivedPlayerId);
    if (!arrived) return 0;

    // 他プレイヤーの総資産合計
    const othersTotal = state.players
      .filter((p) => p.id !== arrivedPlayerId)
      .reduce((sum, p) => sum + p.totalAssets, 0);

    if (othersTotal === 0) {
      // 他プレイヤー資産がない場合は固定ボーナス
      return 1000;
    }

    // 本家に近いルール：他全員の総資産の平均 × プレイヤー数 × 10%
    const avgOthers = othersTotal / (state.players.length - 1);
    return Math.max(1000, Math.floor(avgOthers * state.players.length * 0.1));
  }

  /**
   * 目的地到着処理
   */
  processArrival(state: GameState, arrivedPlayerId: string): DestinationArrivalResult {
    const bonus = this.calcArrivalBonus(state, arrivedPlayerId);

    // ボーナス付与
    const newPlayers = state.players.map((p) => {
      if (p.id !== arrivedPlayerId) return p;
      return {
        ...p,
        money: p.money + bonus,
        totalAssets: p.totalAssets + bonus,
      };
    });

    // 新しい目的地を設定（現在の目的地以外からランダム）
    const newDest = this.boardManager.getRandomDestination(state.destinationCityId);
    const newDestId = newDest?.id ?? state.destinationCityId;

    const newState: GameState = {
      ...state,
      players: newPlayers,
      destinationCityId: newDestId,
    };

    return { bonus, newDestinationCityId: newDestId, newState };
  }

  /**
   * 目的地候補リストを取得（目的地選択に使用）
   */
  getDestinationCandidates(
    allCities: City[],
    excludeCityId: string,
    count = 3,
  ): City[] {
    const candidates = allCities.filter((c) => c.id !== excludeCityId);
    // ランダムにシャッフルして先頭N件を返す
    return candidates
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  }

  /**
   * 現在の目的地情報を取得
   */
  getDestinationCity(state: GameState): City | undefined {
    return this.boardManager.getCityById(state.destinationCityId);
  }

  /**
   * 目的地到着判定
   */
  isAtDestination(player: Player, state: GameState): boolean {
    return player.position.cityId === state.destinationCityId;
  }
}
