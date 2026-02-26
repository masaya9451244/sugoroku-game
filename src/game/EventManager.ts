import type { GameEvent, EventEffect } from '../types';
import type { GameState, Player } from '../types';

export interface EventResult {
  event: GameEvent;
  newState: GameState;
  affectedPlayers: { playerId: string; delta: number }[];
}

export class EventManager {
  private allEvents: GameEvent[] = [];

  loadEvents(events: GameEvent[]): void {
    this.allEvents = events;
  }

  /**
   * 指定月に発生するイベントを抽選して返す
   */
  drawMonthlyEvents(month: number): GameEvent[] {
    const results: GameEvent[] = [];

    for (const event of this.allEvents) {
      const { trigger } = event;

      // 固定月イベント
      if (event.type === 'monthly' && trigger.month === month) {
        results.push(event);
        continue;
      }

      // ランダムイベント・年間イベント（確率で発生）
      if (event.type !== 'monthly' && Math.random() < trigger.probability) {
        results.push(event);
      }
    }

    return results;
  }

  /**
   * イベントをゲーム状態に適用する
   */
  applyEvent(
    state: GameState,
    event: GameEvent,
    activatingPlayerId?: string,
  ): EventResult {
    const { effect } = event;
    const affected: { playerId: string; delta: number }[] = [];

    let newState = { ...state };

    switch (effect.type) {
      case 'money_percent':
        newState = this.applyMoneyPercent(state, effect, activatingPlayerId, affected);
        break;
      case 'money_fixed':
        newState = this.applyMoneyFixed(state, effect, activatingPlayerId, affected);
        break;
      case 'property_income_bonus':
        // 収益ボーナスは年末決算時に適用するフラグとして保持（簡易実装：即時適用）
        newState = this.applyPropertyIncomeBonus(state, effect, affected);
        break;
      case 'all_money_equalizer':
        newState = this.applyAllMoneyEqualizer(state, effect, affected);
        break;
      case 'random_teleport':
        newState = this.applyRandomTeleport(state, activatingPlayerId);
        break;
      case 'none':
      default:
        break;
    }

    return { event, newState, affectedPlayers: affected };
  }

  /**
   * 総資産の割合でお金を増減
   */
  private applyMoneyPercent(
    state: GameState,
    effect: EventEffect,
    activatingPlayerId: string | undefined,
    affected: { playerId: string; delta: number }[],
  ): GameState {
    const rate = (effect.value ?? 0) / 100;
    const targets = this.resolveTargets(state, effect.targetType, activatingPlayerId);

    const newPlayers = state.players.map((p) => {
      if (!targets.includes(p.id)) return p;
      const delta = Math.floor(p.totalAssets * rate);
      // マイナス所持金のプレイヤーにはペナルティを与えない（ボーナスは通常通り）
      const actualDelta = delta < 0
        ? (p.money > 0 ? Math.max(-p.money, delta) : 0)
        : delta;
      affected.push({ playerId: p.id, delta: actualDelta });
      return {
        ...p,
        money: p.money + actualDelta,
        totalAssets: p.totalAssets + actualDelta,
      };
    });

    return { ...state, players: newPlayers };
  }

  /**
   * 固定金額でお金を増減
   */
  private applyMoneyFixed(
    state: GameState,
    effect: EventEffect,
    activatingPlayerId: string | undefined,
    affected: { playerId: string; delta: number }[],
  ): GameState {
    const delta = effect.value ?? 0;
    const targets = this.resolveTargets(state, effect.targetType, activatingPlayerId);

    const newPlayers = state.players.map((p) => {
      if (!targets.includes(p.id)) return p;
      // マイナス所持金プレイヤーにはペナルティを与えない（ボーナスは通常通り）
      const actualDelta = delta < 0 ? Math.max(delta, -Math.max(0, p.money)) : delta;
      affected.push({ playerId: p.id, delta: actualDelta });
      return {
        ...p,
        money: p.money + actualDelta,
        totalAssets: p.totalAssets + actualDelta,
      };
    });

    return { ...state, players: newPlayers };
  }

  /**
   * 物件収益ボーナス（簡易：全所有物件の収益を一時的に増加）
   */
  private applyPropertyIncomeBonus(
    state: GameState,
    effect: EventEffect,
    affected: { playerId: string; delta: number }[],
  ): GameState {
    const rate = (effect.value ?? 0) / 100;

    // 所有物件の収益の割合をお金として付与
    const newPlayers = state.players.map((p) => {
      const ownedProps = state.properties.filter((pr) => pr.ownerId === p.id);
      if (ownedProps.length === 0) return p;

      const bonus = Math.floor(
        ownedProps.reduce((sum, pr) => sum + pr.income, 0) * rate,
      );
      if (bonus === 0) return p;

      affected.push({ playerId: p.id, delta: bonus });
      return {
        ...p,
        money: p.money + bonus,
        totalAssets: p.totalAssets + bonus,
      };
    });

    return { ...state, players: newPlayers };
  }

  /**
   * 全員の金額を均等化（平均に近づける）
   */
  private applyAllMoneyEqualizer(
    state: GameState,
    effect: EventEffect,
    affected: { playerId: string; delta: number }[],
  ): GameState {
    const delta = effect.value ?? 0;
    const newPlayers = state.players.map((p) => {
      // マイナス所持金プレイヤーにはペナルティを与えない（ボーナスは通常通り）
      const actualDelta = delta < 0 ? Math.max(delta, -Math.max(0, p.money)) : delta;
      affected.push({ playerId: p.id, delta: actualDelta });
      return {
        ...p,
        money: p.money + actualDelta,
        totalAssets: p.totalAssets + actualDelta,
      };
    });

    return { ...state, players: newPlayers };
  }

  /**
   * ランダム都市へ移動
   */
  private applyRandomTeleport(
    state: GameState,
    activatingPlayerId: string | undefined,
  ): GameState {
    if (!activatingPlayerId) return state;

    // 全都市IDを収集してランダムに選ぶ
    const cityIds = [...new Set(state.properties.map((p) => p.cityId))];
    if (cityIds.length === 0) return state;

    const randomCity = cityIds[Math.floor(Math.random() * cityIds.length)];

    return {
      ...state,
      players: state.players.map((p) =>
        p.id === activatingPlayerId
          ? { ...p, position: { ...p.position, cityId: randomCity } }
          : p,
      ),
    };
  }

  /**
   * 対象プレイヤーIDを解決する
   */
  private resolveTargets(
    state: GameState,
    targetType: EventEffect['targetType'],
    activatingPlayerId: string | undefined,
  ): string[] {
    switch (targetType) {
      case 'all':
        return state.players.map((p) => p.id);
      case 'self':
        return activatingPlayerId ? [activatingPlayerId] : [];
      case 'first_place': {
        const first = this.getFirstPlacePlayer(state.players);
        return first ? [first.id] : [];
      }
      case 'last_place': {
        const last = this.getLastPlacePlayer(state.players);
        return last ? [last.id] : [];
      }
      default:
        return state.players.map((p) => p.id);
    }
  }

  private getFirstPlacePlayer(players: Player[]): Player | undefined {
    if (players.length === 0) return undefined;
    return players.reduce((best, p) => (p.totalAssets > best.totalAssets ? p : best));
  }

  private getLastPlacePlayer(players: Player[]): Player | undefined {
    if (players.length === 0) return undefined;
    return players.reduce((worst, p) => (p.totalAssets < worst.totalAssets ? p : worst));
  }

  getAllEvents(): GameEvent[] {
    return this.allEvents;
  }

  getEventById(id: string): GameEvent | undefined {
    return this.allEvents.find((e) => e.id === id);
  }
}
