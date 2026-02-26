import type { GameState, Player } from '../types';
import type { Difficulty } from '../types';
import type { Route, City } from '../types';
import type { Property } from '../types';
import { BoardManager } from './BoardManager';
import { PropertyManager } from './PropertyManager';
import { CardManager } from './CardManager';
import { randomPick } from '../utils/random';

export interface CpuDecision {
  type: 'buy_property' | 'skip_property' | 'use_card' | 'skip_card' | 'choose_route';
  propertyId?: string;
  cardId?: string;
  routeId?: string;
  targetPlayerId?: string;
}

export interface RouteChoice {
  route: Route;
  nextCity: City;
}

export class CpuManager {
  private boardManager: BoardManager;
  private propertyManager: PropertyManager;
  private cardManager: CardManager;

  constructor(
    boardManager: BoardManager,
    propertyManager: PropertyManager,
    cardManager: CardManager,
  ) {
    this.boardManager = boardManager;
    this.propertyManager = propertyManager;
    this.cardManager = cardManager;
  }

  // ──────────────────────────────────────
  // 分岐選択
  // ──────────────────────────────────────

  /**
   * 分岐でどの路線を選ぶか決定する
   */
  chooseRoute(
    state: GameState,
    player: Player,
    choices: RouteChoice[],
  ): RouteChoice {
    if (choices.length === 1) return choices[0];

    switch (player.difficulty) {
      case 'easy':
        return this.chooseRouteEasy(choices);
      case 'normal':
        return this.chooseRouteNormal(state, player, choices);
      case 'hard':
        return this.chooseRouteHard(state, player, choices);
      default:
        return randomPick(choices);
    }
  }

  private chooseRouteEasy(choices: RouteChoice[]): RouteChoice {
    // ランダム選択
    return randomPick(choices);
  }

  private chooseRouteNormal(
    state: GameState,
    _player: Player,
    choices: RouteChoice[],
  ): RouteChoice {
    // 目的地に近い方を優先（簡易：都市IDが目的地に近い方）
    const dest = this.boardManager.getCityById(state.destinationCityId);
    if (!dest) return randomPick(choices);

    // 目的地への隣接度でスコアリング（実装は簡易版）
    const scored = choices.map((choice) => ({
      choice,
      score: this.estimateDistanceToDestination(choice.nextCity.id, state.destinationCityId),
    }));

    scored.sort((a, b) => a.score - b.score);
    return scored[0].choice;
  }

  private chooseRouteHard(
    state: GameState,
    player: Player,
    choices: RouteChoice[],
  ): RouteChoice {
    // 物件収益 + 目的地距離を総合スコアで評価
    const scored = choices.map((choice) => {
      const distScore = this.estimateDistanceToDestination(
        choice.nextCity.id,
        state.destinationCityId,
      );
      const propertyScore = this.calcCityPropertyValue(state, player.id, choice.nextCity.id);
      return {
        choice,
        score: -distScore + propertyScore * 0.01,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].choice;
  }

  // ──────────────────────────────────────
  // 物件購入判断
  // ──────────────────────────────────────

  /**
   * 物件を購入するか決定する
   */
  decidePurchase(
    state: GameState,
    player: Player,
    property: Property,
  ): CpuDecision {
    switch (player.difficulty) {
      case 'easy':
        return this.decidePurchaseEasy(player, property);
      case 'normal':
        return this.decidePurchaseNormal(state, player, property);
      case 'hard':
        return this.decidePurchaseHard(state, player, property);
      default:
        return { type: 'skip_property' };
    }
  }

  private decidePurchaseEasy(player: Player, property: Property): CpuDecision {
    // 所持金の50%以下なら確率50%で購入
    const canAfford = player.money >= property.price;
    const isAffordable = property.price <= player.money * 0.5;
    if (canAfford && isAffordable && Math.random() < 0.5) {
      return { type: 'buy_property', propertyId: property.id };
    }
    return { type: 'skip_property' };
  }

  private decidePurchaseNormal(
    state: GameState,
    player: Player,
    property: Property,
  ): CpuDecision {
    const currentPrice = this.propertyManager.getCurrentPrice(property);
    if (player.money < currentPrice) return { type: 'skip_property' };

    // ROI（投資回収期間）が10年以内なら購入
    const annualIncome = this.propertyManager.getCurrentIncome(property);
    if (annualIncome <= 0) return { type: 'skip_property' };

    const roiYears = currentPrice / annualIncome;
    const remainingYears = state.totalYears - state.currentYear;

    if (roiYears <= remainingYears * 0.8) {
      return { type: 'buy_property', propertyId: property.id };
    }

    // 独占できそうな都市なら購入
    if (this.canMonopolize(state, player.id, property.cityId)) {
      return { type: 'buy_property', propertyId: property.id };
    }

    return { type: 'skip_property' };
  }

  private decidePurchaseHard(
    state: GameState,
    player: Player,
    property: Property,
  ): CpuDecision {
    const currentPrice = this.propertyManager.getCurrentPrice(property);
    if (player.money < currentPrice) return { type: 'skip_property' };

    // 独占可能なら積極購入
    if (this.canMonopolize(state, player.id, property.cityId)) {
      return { type: 'buy_property', propertyId: property.id };
    }

    // 高収益物件は優先購入
    const annualIncome = this.propertyManager.getCurrentIncome(property);
    const yieldRate = annualIncome / currentPrice;
    if (yieldRate >= 0.15) {
      return { type: 'buy_property', propertyId: property.id };
    }

    // 残りゲーム年数でROIが取れるなら購入
    const remainingYears = state.totalYears - state.currentYear;
    if (annualIncome > 0 && currentPrice / annualIncome <= remainingYears) {
      return { type: 'buy_property', propertyId: property.id };
    }

    return { type: 'skip_property' };
  }

  // ──────────────────────────────────────
  // カード使用判断
  // ──────────────────────────────────────

  /**
   * カードを使用するか、どのカードを使うか決定する
   */
  decideCardUse(
    state: GameState,
    player: Player,
  ): CpuDecision {
    if (player.hand.length === 0) return { type: 'skip_card' };

    switch (player.difficulty) {
      case 'easy':
        return this.decideCardEasy(player);
      case 'normal':
        return this.decideCardNormal(state, player);
      case 'hard':
        return this.decideCardHard(state, player);
      default:
        return { type: 'skip_card' };
    }
  }

  private decideCardEasy(player: Player): CpuDecision {
    // 30%の確率でランダムカードを使用
    if (Math.random() < 0.3 && player.hand.length > 0) {
      return { type: 'use_card', cardId: randomPick(player.hand) };
    }
    return { type: 'skip_card' };
  }

  private decideCardNormal(state: GameState, player: Player): CpuDecision {
    // 目的地カードがあれば優先的に使用（残り年数が少ない場合）
    const remainingYears = state.totalYears - state.currentYear;
    if (remainingYears <= 3) {
      const destCard = player.hand.find((id) => {
        const card = this.cardManager.getCardById(id);
        return card?.type === 'move_to_destination';
      });
      if (destCard) return { type: 'use_card', cardId: destCard };
    }

    // ボンビーがついている場合、ボンビー除去カードを使用
    if (player.bombeeType !== 'none') {
      const bombeeCard = player.hand.find((id) => {
        const card = this.cardManager.getCardById(id);
        return card?.type === 'bombee_away';
      });
      if (bombeeCard) return { type: 'use_card', cardId: bombeeCard };
    }

    return { type: 'skip_card' };
  }

  private decideCardHard(state: GameState, player: Player): CpuDecision {
    // 手持ちカードをスコアリングして最も効果的なカードを使用
    const handCards = this.cardManager.getPlayerHand(state, player.id);
    if (handCards.length === 0) return { type: 'skip_card' };

    const scored = handCards.map((card) => ({
      card,
      score: this.scoreCard(state, player, card.id),
    }));

    scored.sort((a, b) => b.score - a.score);

    // スコアが閾値を超えたら使用
    if (scored[0].score >= 50) {
      return { type: 'use_card', cardId: scored[0].card.id };
    }

    return { type: 'skip_card' };
  }

  private scoreCard(state: GameState, player: Player, cardId: string): number {
    const card = this.cardManager.getCardById(cardId);
    if (!card) return 0;

    switch (card.type) {
      case 'move_to_destination': {
        // 目的地が遠いほど価値が高い
        const dist = this.estimateDistanceToDestination(
          player.position.cityId,
          state.destinationCityId,
        );
        return dist * 10;
      }
      case 'bombee_away':
        return player.bombeeType !== 'none' ? 100 : 0;
      case 'bombee_transfer': {
        // ボンビーを最強プレイヤーに移す
        return player.bombeeType === 'none' ? 0 : 80;
      }
      case 'get_money':
        return 40;
      case 'steal_property':
        return 60;
      default:
        return 20;
    }
  }

  // ──────────────────────────────────────
  // ヘルパー
  // ──────────────────────────────────────

  /**
   * 目的地への推定距離（BFSの深さ）
   * 簡易実装：隣接都市数をカウント
   */
  private estimateDistanceToDestination(fromCityId: string, destCityId: string): number {
    if (fromCityId === destCityId) return 0;

    const visited = new Set<string>();
    const queue: { cityId: string; depth: number }[] = [{ cityId: fromCityId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.cityId)) continue;
      visited.add(current.cityId);

      if (current.cityId === destCityId) return current.depth;
      if (current.depth >= 10) continue; // 探索深さ制限

      const adjacent = this.boardManager.getAdjacentCities(current.cityId);
      for (const city of adjacent) {
        if (!visited.has(city.id)) {
          queue.push({ cityId: city.id, depth: current.depth + 1 });
        }
      }
    }

    return 99; // 到達不能
  }

  /**
   * 指定都市を独占できるかチェック
   */
  private canMonopolize(
    state: GameState,
    playerId: string,
    cityId: string,
  ): boolean {
    const cityProps = this.propertyManager.getPropertiesByCity(state.properties, cityId);
    if (cityProps.length === 0) return false;

    return cityProps.every(
      (p) => p.ownerId === playerId || p.ownerId === null,
    );
  }

  /**
   * 指定都市の物件価値を評価（購入可能物件の収益合計）
   */
  private calcCityPropertyValue(
    state: GameState,
    playerId: string,
    cityId: string,
  ): number {
    const cityProps = this.propertyManager.getPropertiesByCity(state.properties, cityId);
    return cityProps
      .filter((p) => p.ownerId === null || p.ownerId === playerId)
      .reduce((sum, p) => sum + this.propertyManager.getCurrentIncome(p), 0);
  }

  /**
   * 最も強い（総資産が多い）プレイヤーを返す（自分除く）
   */
  getStrongestOpponent(state: GameState, excludeId: string): Player | undefined {
    const opponents = state.players.filter((p) => p.id !== excludeId);
    if (opponents.length === 0) return undefined;
    return opponents.reduce((best, p) => (p.totalAssets > best.totalAssets ? p : best));
  }

  /**
   * 指定難易度のCPU思考ウェイト（ミリ秒）
   */
  getThinkingDelay(difficulty: Difficulty): number {
    const delays: Record<Difficulty, number> = {
      easy: 800,
      normal: 1200,
      hard: 1800,
    };
    return delays[difficulty];
  }
}
