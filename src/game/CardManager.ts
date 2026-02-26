import type { Card, CardType } from '../types';
import type { GameState } from '../types';
import { GAME_CONFIG } from '../config';
import { randomPick, randomPickN, weightedRandom } from '../utils/random';

export interface UseCardResult {
  success: boolean;
  reason?: 'not_found' | 'not_owner' | 'no_target' | 'hand_full';
  newState?: GameState;
  message?: string;
}

/** カード使用の追加引数 */
export interface UseCardOptions {
  targetPlayerId?: string;  // ボンビー移し替え・カード奪取の対象
  targetPropertyId?: string; // 物件横取り・売却の対象
  targetCityId?: string;    // 特定都市移動の対象
  targetCardId?: string;    // 選択カード奪取の対象カードID（card_steal/selected_card用）
}

const RARITY_WEIGHTS: Record<string, number> = {
  common: 60,
  uncommon: 30,
  rare: 10,
};

export class CardManager {
  private allCards: Card[] = [];

  loadCards(cards: Card[]): void {
    this.allCards = cards;
  }

  getCardById(id: string): Card | undefined {
    return this.allCards.find((c) => c.id === id);
  }

  getAllCards(): Card[] {
    return this.allCards;
  }

  getCardsByType(type: CardType): Card[] {
    return this.allCards.filter((c) => c.type === type);
  }

  /**
   * 手札上限チェック
   */
  canDrawCard(state: GameState, playerId: string): boolean {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return false;
    return player.hand.length < GAME_CONFIG.MAX_CARD_COUNT;
  }

  /**
   * レアリティ重み付きでランダムにカードを1枚引く
   */
  drawRandomCard(): Card | undefined {
    if (this.allCards.length === 0) return undefined;
    const weights = this.allCards.map(
      (c) => RARITY_WEIGHTS[c.rarity] ?? 10,
    );
    return weightedRandom(this.allCards, weights);
  }

  /**
   * カードマスでカードを取得する
   */
  gainCard(state: GameState, playerId: string): { newState: GameState; card: Card | null } {
    if (!this.canDrawCard(state, playerId)) {
      return { newState: state, card: null };
    }

    const card = this.drawRandomCard();
    if (!card) return { newState: state, card: null };

    const newPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, hand: [...p.hand, card.id] } : p,
    );
    return { newState: { ...state, players: newPlayers }, card };
  }

  /**
   * カード売り場で指定カードを購入する
   * cards.json の効果から価格を算出（レアリティベース）
   */
  buyCard(
    state: GameState,
    playerId: string,
    cardId: string,
  ): { newState: GameState; success: boolean; reason?: string } {
    const player = state.players.find((p) => p.id === playerId);
    const card = this.getCardById(cardId);

    if (!player || !card) return { newState: state, success: false, reason: 'not_found' };
    if (!this.canDrawCard(state, playerId)) {
      return { newState: state, success: false, reason: 'hand_full' };
    }

    const price = this.getCardShopPrice(card);
    if (player.money < price) {
      return { newState: state, success: false, reason: 'not_enough_money' };
    }

    const newPlayers = state.players.map((p) => {
      if (p.id === playerId) {
        return { ...p, money: p.money - price, hand: [...p.hand, card.id] };
      }
      return p;
    });

    return { newState: { ...state, players: newPlayers }, success: true };
  }

  /**
   * カード売り場での価格（レアリティベース）
   */
  getCardShopPrice(card: Card): number {
    const basePrice: Record<string, number> = {
      common: 500,
      uncommon: 1500,
      rare: 5000,
    };
    return basePrice[card.rarity] ?? 1000;
  }

  /**
   * カードを使用する
   */
  useCard(
    state: GameState,
    playerId: string,
    cardId: string,
    options: UseCardOptions = {},
  ): UseCardResult {
    const player = state.players.find((p) => p.id === playerId);
    const card = this.getCardById(cardId);

    if (!player || !card) {
      return { success: false, reason: 'not_found' };
    }
    if (!player.hand.includes(cardId)) {
      return { success: false, reason: 'not_owner' };
    }

    // 手札から削除
    const removeFromHand = (s: GameState): GameState => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, hand: p.hand.filter((id) => id !== cardId) } : p,
      ),
    });

    switch (card.type) {
      case 'move_to_destination':
        return this.useMoveToDest(removeFromHand(state), playerId, card);

      case 'get_money':
        return this.useGetMoney(removeFromHand(state), playerId, card);

      case 'pay_money':
        return this.usePayMoney(removeFromHand(state), playerId, card);

      case 'bombee_transfer': {
        // last_to_second は自動移動（target不要）
        if (card.effect.targetType === 'last_to_second') {
          return this.useBombeeTransferLastToSecond(removeFromHand(state));
        }
        if (!options.targetPlayerId) return { success: false, reason: 'no_target' };
        return this.useBombeeTransfer(removeFromHand(state), playerId, options.targetPlayerId);
      }

      case 'card_steal': {
        if (!options.targetPlayerId) return { success: false, reason: 'no_target' };
        return this.useCardSteal(
          removeFromHand(state),
          playerId,
          options.targetPlayerId,
          options.targetCardId,
        );
      }

      case 'move_to_city':
        return this.useMoveToCity(removeFromHand(state), playerId, card);

      case 'bombee_away':
        return this.useBombeeAway(removeFromHand(state), playerId, card);

      case 'sell_property':
        return this.useSellProperty(
          removeFromHand(state),
          playerId,
          card,
          options.targetPropertyId,
          options.targetPlayerId,
          options.targetCityId,
        );

      case 'steal_property':
        return this.useStealProperty(removeFromHand(state), playerId, card, options.targetCityId);

      case 'monopoly_break':
        return this.useMonopolyBreak(removeFromHand(state), playerId, card);

      case 'buy_property':
        return this.useBuyProperty(removeFromHand(state), playerId, card, options.targetCityId);

      case 'double_income':
        return this.useDoubleIncome(removeFromHand(state), playerId, card);

      case 'move_steps':
      case 'plus_dice':
        // 移動・サイコロ追加はGameScene側で処理するため手札削除のみ
        return {
          success: true,
          newState: removeFromHand(state),
          message: `${card.name} を使用しました`,
        };

      default:
        return {
          success: true,
          newState: removeFromHand(state),
          message: `${card.name} を使用しました`,
        };
    }
  }

  /**
   * 目的地へGO！カード
   * - current_destination: 現在の目的地へ移動
   * - current_destination_express: 現在の目的地へ直行（アニメーションなし扱い）
   * - any_destination: 現在の目的地へ移動（GameScene側で選択処理をする場合は別途対応）
   * - double_move_next_turn: 次のターンのサイコロ移動マス数が2倍（新幹線カード）
   */
  private useMoveToDest(state: GameState, playerId: string, card: Card): UseCardResult {
    if (card.effect.targetType === 'double_move_next_turn') {
      const multiplier = card.effect.value ?? 2;
      const newState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId ? { ...p, diceMultiplier: multiplier } : p,
        ),
      };
      return {
        success: true,
        newState,
        message: `${card.name}！次のターンのサイコロが${multiplier}倍になります！`,
      };
    }

    const newState: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              position: {
                ...p.position,
                cityId: state.destinationCityId,
              },
            }
          : p,
      ),
    };
    return { success: true, newState, message: `${card.name}！目的地へ向かいます` };
  }

  /**
   * 収入カード
   * - flat: 固定額を受け取る
   * - property_value_percent: 所有物件総額の value% を受け取る
   * - all_players_each: 全対戦相手から value 万円ずつ受け取る
   */
  private useGetMoney(state: GameState, playerId: string, card: Card): UseCardResult {
    const value = card.effect.value ?? 1000;
    const targetType = card.effect.targetType;

    if (targetType === 'property_value_percent') {
      const propTotal = state.properties
        .filter((p) => p.ownerId === playerId)
        .reduce((sum, p) => sum + p.price, 0);
      const gain = Math.floor((propTotal * value) / 100);
      return {
        success: true,
        newState: {
          ...state,
          players: state.players.map((p) =>
            p.id === playerId
              ? { ...p, money: p.money + gain, totalAssets: p.totalAssets + gain }
              : p,
          ),
        },
        message: `${card.name}！${gain}万円を獲得しました`,
      };
    }

    if (targetType === 'all_players_each') {
      let totalReceived = 0;
      let newPlayers = [...state.players];
      for (const opp of state.players.filter((p) => p.id !== playerId)) {
        const actual = Math.min(value, opp.money);
        totalReceived += actual;
        newPlayers = newPlayers.map((p) =>
          p.id === opp.id
            ? { ...p, money: p.money - actual, totalAssets: p.totalAssets - actual }
            : p,
        );
      }
      newPlayers = newPlayers.map((p) =>
        p.id === playerId
          ? { ...p, money: p.money + totalReceived, totalAssets: p.totalAssets + totalReceived }
          : p,
      );
      return {
        success: true,
        newState: { ...state, players: newPlayers },
        message: `${card.name}！全員から合計${totalReceived}万円受け取りました！`,
      };
    }

    // flat
    const newState: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? { ...p, money: p.money + value, totalAssets: p.totalAssets + value }
          : p,
      ),
    };
    return { success: true, newState, message: `${card.name}！${value}万円を獲得しました` };
  }

  /**
   * 支払いカード
   * - flat: 固定額を支払う
   * - property_value_percent: 所有物件総額の value% を支払う
   * - total_assets_percent: 総資産の value% を支払う（税金）
   * - all_players_each: 全対戦相手に value 万円ずつ支払う
   */
  private usePayMoney(state: GameState, playerId: string, card: Card): UseCardResult {
    const value = card.effect.value ?? 1000;
    const player = state.players.find((p) => p.id === playerId)!;
    const targetType = card.effect.targetType;

    if (targetType === 'property_value_percent') {
      const propTotal = state.properties
        .filter((p) => p.ownerId === playerId)
        .reduce((sum, p) => sum + p.price, 0);
      const actual = Math.min(Math.floor((propTotal * value) / 100), player.money);
      return {
        success: true,
        newState: {
          ...state,
          players: state.players.map((p) =>
            p.id === playerId
              ? { ...p, money: p.money - actual, totalAssets: p.totalAssets - actual }
              : p,
          ),
        },
        message: `${card.name}！修繕費${actual}万円を支払いました`,
      };
    }

    if (targetType === 'total_assets_percent') {
      const actual = Math.min(Math.floor((player.totalAssets * value) / 100), player.money);
      return {
        success: true,
        newState: {
          ...state,
          players: state.players.map((p) =>
            p.id === playerId
              ? { ...p, money: p.money - actual, totalAssets: p.totalAssets - actual }
              : p,
          ),
        },
        message: `${card.name}！税金${actual}万円を支払いました`,
      };
    }

    if (targetType === 'all_players_each') {
      const opponents = state.players.filter((p) => p.id !== playerId);
      let totalPaid = 0;
      let remaining = player.money;
      let newPlayers = [...state.players];
      for (const opp of opponents) {
        if (remaining <= 0) break;
        const actual = Math.min(value, remaining);
        totalPaid += actual;
        remaining -= actual;
        newPlayers = newPlayers.map((p) =>
          p.id === opp.id
            ? { ...p, money: p.money + actual, totalAssets: p.totalAssets + actual }
            : p,
        );
      }
      newPlayers = newPlayers.map((p) =>
        p.id === playerId
          ? { ...p, money: p.money - totalPaid, totalAssets: p.totalAssets - totalPaid }
          : p,
      );
      return {
        success: true,
        newState: { ...state, players: newPlayers },
        message: `${card.name}！全員に合計${totalPaid}万円支払いました`,
      };
    }

    // flat
    const actual = Math.min(value, player.money);
    const newState: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? { ...p, money: p.money - actual, totalAssets: p.totalAssets - actual }
          : p,
      ),
    };
    return { success: true, newState, message: `${card.name}！${actual}万円を支払いました` };
  }

  /**
   * ボンビー移し替えカード
   */
  private useBombeeTransfer(
    state: GameState,
    fromId: string,
    toId: string,
  ): UseCardResult {
    const from = state.players.find((p) => p.id === fromId);
    const to = state.players.find((p) => p.id === toId);
    if (!from || !to) return { success: false, reason: 'no_target' };
    // ボンビーを持っていない場合は移転不可
    if (from.bombeeType === 'none') return { success: false, reason: 'no_target' };

    const newState: GameState = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === fromId) return { ...p, bombeeType: 'none', bombeeElapsedTurns: 0 };
        if (p.id === toId) return { ...p, bombeeType: from.bombeeType, bombeeElapsedTurns: 0 };
        return p;
      }),
    };
    return {
      success: true,
      newState,
      message: `ボンビーを ${to.name} へ移しました！`,
    };
  }

  /**
   * カード奪取
   * - random_card: ランダムに1枚奪う
   * - selected_card: targetCardId で指定したカードを奪う（未指定はランダム）
   */
  private useCardSteal(
    state: GameState,
    stealerId: string,
    targetId: string,
    targetCardId?: string,
  ): UseCardResult {
    const stealer = state.players.find((p) => p.id === stealerId);
    const target = state.players.find((p) => p.id === targetId);
    if (!target || target.hand.length === 0) {
      return { success: false, reason: 'no_target' };
    }
    // 奪取者の手札が上限に達している場合は奪えない
    if (stealer && stealer.hand.length >= GAME_CONFIG.MAX_CARD_COUNT) {
      return { success: false, reason: 'hand_full' };
    }

    const stolen =
      targetCardId && target.hand.includes(targetCardId)
        ? targetCardId
        : randomPick(target.hand);
    const newState: GameState = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === stealerId) return { ...p, hand: [...p.hand, stolen] };
        if (p.id === targetId) return { ...p, hand: p.hand.filter((id) => id !== stolen) };
        return p;
      }),
    };

    const stolenCard = this.getCardById(stolen);
    return {
      success: true,
      newState,
      message: `${target.name} から「${stolenCard?.name ?? '???'}」を奪いました！`,
    };
  }

  /**
   * 特定都市移動カード
   */
  private useMoveToCity(state: GameState, playerId: string, card: Card): UseCardResult {
    const targetCityId = card.effect.targetType ?? 'tokyo';
    const newState: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? { ...p, position: { ...p.position, cityId: targetCityId } }
          : p,
      ),
    };
    return { success: true, newState, message: `${card.name}！移動します` };
  }

  /**
   * ボンビー除去カード
   * - self: 現在のボンビーを除去
   * - self_permanent: ボンビーを除去し、一定期間再憑依を防ぐ（bombeeImmuneYears）
   */
  private useBombeeAway(state: GameState, playerId: string, card: Card): UseCardResult {
    const player = state.players.find((p) => p.id === playerId);
    if (!player || player.bombeeType === 'none') {
      return { success: true, newState: state, message: 'ボンビーがついていません' };
    }
    const isPermanent = card.effect.targetType === 'self_permanent';
    const immuneYears = isPermanent ? (card.effect.value ?? 1) : 0;
    const newState: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? { ...p, bombeeType: 'none', bombeeElapsedTurns: 0, bombeeImmuneYears: immuneYears }
          : p,
      ),
    };
    const msg = isPermanent
      ? `${card.name}！ボンビーを追い払い、${immuneYears}年間寄せつけません！`
      : `${card.name}！ボンビーを追い払いました！`;
    return { success: true, newState, message: msg };
  }

  /**
   * ボンビー強制移動（最下位→2位）
   * last_to_second: 最下位プレイヤーのボンビーを2位最下位へ移す
   */
  private useBombeeTransferLastToSecond(state: GameState): UseCardResult {
    const sorted = [...state.players].sort((a, b) => a.totalAssets - b.totalAssets);
    if (sorted.length < 2) return { success: false, reason: 'no_target' };

    const last = sorted[0];
    const second = sorted[1];

    if (last.bombeeType === 'none') {
      return { success: false, reason: 'no_target' };
    }

    const newState: GameState = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === last.id) return { ...p, bombeeType: 'none', bombeeElapsedTurns: 0 };
        if (p.id === second.id) return { ...p, bombeeType: last.bombeeType, bombeeElapsedTurns: 0 };
        return p;
      }),
    };
    return {
      success: true,
      newState,
      message: `ボンビーが${last.name}から${second.name}へ強制移動しました！`,
    };
  }

  /**
   * 物件売却カード
   * - self_choice: 自分の物件を1つ選んで売却（targetPropertyId があれば優先）
   * - current_city_all: 現在地の自分の物件をすべて売却
   * - opponent_forced: 指定相手の最安値物件を強制売却（相手が代金を受け取る）
   */
  private useSellProperty(
    state: GameState,
    playerId: string,
    card: Card,
    targetPropertyId?: string,
    targetPlayerId?: string,
    currentCityId?: string,
  ): UseCardResult {
    const sellRate = (card.effect.value ?? 100) / 100;

    // current_city_all: 現在地の自分の物件をすべて売却
    if (card.effect.targetType === 'current_city_all' && currentCityId) {
      const cityOwned = state.properties.filter(
        (p) => p.cityId === currentCityId && p.ownerId === playerId,
      );
      if (cityOwned.length === 0) return { success: false, reason: 'no_target' };

      let totalReceived = 0;
      let newProperties = [...state.properties];
      for (const prop of cityOwned) {
        totalReceived += Math.floor(prop.price * sellRate);
        newProperties = newProperties.map((p) =>
          p.id === prop.id ? { ...p, ownerId: null, upgradeLevel: 0 } : p,
        );
      }
      const newPlayers = state.players.map((p) =>
        p.id === playerId
          ? { ...p, money: p.money + totalReceived }
          : p,
      );
      return {
        success: true,
        newState: this.recalcTotalAssetsLocal({ ...state, players: newPlayers, properties: newProperties }),
        message: `現在地の物件${cityOwned.length}件を${totalReceived}万円で売却しました！`,
      };
    }

    // opponent_forced: 対象プレイヤーの最安値物件を強制売却
    if (card.effect.targetType === 'opponent_forced' && targetPlayerId) {
      const oppProps = state.properties.filter((p) => p.ownerId === targetPlayerId);
      if (oppProps.length === 0) return { success: false, reason: 'no_target' };
      const cheapest = oppProps.reduce((min, p) => p.price < min.price ? p : min);
      const sellPrice = Math.floor(cheapest.price * sellRate);
      const newPlayers = state.players.map((p) =>
        p.id === targetPlayerId ? { ...p, money: p.money + sellPrice } : p,
      );
      const newProperties = state.properties.map((p) =>
        p.id === cheapest.id ? { ...p, ownerId: null, upgradeLevel: 0 } : p,
      );
      const opp = state.players.find((p) => p.id === targetPlayerId);
      return {
        success: true,
        newState: this.recalcTotalAssetsLocal({ ...state, players: newPlayers, properties: newProperties }),
        message: `${opp?.name}の「${cheapest.name}」を強制売却させました！`,
      };
    }

    // self_choice: 自分の物件を選んで売却
    const owned = state.properties.filter((p) => p.ownerId === playerId);
    if (owned.length === 0) return { success: false, reason: 'no_target' };

    const target =
      (targetPropertyId ? owned.find((p) => p.id === targetPropertyId) : null) ?? owned[0];
    const sellPrice = Math.floor(target.price * sellRate);
    const newPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, money: p.money + sellPrice } : p,
    );
    const newProperties = state.properties.map((p) =>
      p.id === target.id ? { ...p, ownerId: null, upgradeLevel: 0 } : p,
    );
    return {
      success: true,
      newState: this.recalcTotalAssetsLocal({ ...state, players: newPlayers, properties: newProperties }),
      message: `「${target.name}」を${sellPrice}万円で売却しました`,
    };
  }

  /**
   * 物件横取りカード
   * - any_player: 最も資産の多い相手の最安値物件を奪う
   * - current_city_all: 現在地の全対戦相手物件を奪う
   */
  private useStealProperty(
    state: GameState,
    playerId: string,
    card: Card,
    currentCityId?: string,
  ): UseCardResult {
    if (card.effect.targetType === 'current_city_all' && currentCityId) {
      const cityOppProps = state.properties.filter(
        (p) => p.cityId === currentCityId && p.ownerId !== null && p.ownerId !== playerId,
      );
      if (cityOppProps.length === 0) {
        return { success: false, reason: 'no_target' };
      }
      const newProperties = state.properties.map((p) =>
        cityOppProps.find((op) => op.id === p.id) ? { ...p, ownerId: playerId } : p,
      );
      return {
        success: true,
        newState: this.recalcTotalAssetsLocal({ ...state, properties: newProperties }),
        message: `現在地の物件${cityOppProps.length}件を奪い取りました！`,
      };
    }

    // any_player: 最も資産が多い相手の最安値物件を奪う
    const opponents = state.players.filter((p) => p.id !== playerId);
    if (opponents.length === 0) return { success: false, reason: 'no_target' };

    const richest = opponents.reduce((best, p) =>
      p.totalAssets > best.totalAssets ? p : best,
    );
    const oppProps = state.properties.filter((p) => p.ownerId === richest.id);
    if (oppProps.length === 0) return { success: false, reason: 'no_target' };

    const cheapest = oppProps.reduce((min, p) => p.price < min.price ? p : min);
    const newProperties = state.properties.map((p) =>
      p.id === cheapest.id ? { ...p, ownerId: playerId } : p,
    );
    return {
      success: true,
      newState: this.recalcTotalAssetsLocal({ ...state, properties: newProperties }),
      message: `「${cheapest.name}」を${richest.name}から奪い取りました！`,
    };
  }

  /**
   * 独占阻止カード
   * - 独占中の都市があればその最安値物件を80%返金で市場に戻す
   * - なければ独占に最も近い相手の物件を1つ市場に戻す
   */
  private useMonopolyBreak(
    state: GameState,
    playerId: string,
    _card: Card,
  ): UseCardResult {
    const opponentIds = state.players.filter((p) => p.id !== playerId).map((p) => p.id);
    const cityIds = [...new Set(state.properties.map((p) => p.cityId))];

    // 独占中の都市を探す
    for (const cityId of cityIds) {
      const cityProps = state.properties.filter((p) => p.cityId === cityId);
      if (cityProps.length === 0) continue;
      for (const oppId of opponentIds) {
        if (cityProps.every((p) => p.ownerId === oppId)) {
          const cheapest = cityProps.reduce((min, p) => p.price < min.price ? p : min);
          const refund = Math.floor(cheapest.price * 0.8);
          const newPlayers = state.players.map((p) =>
            p.id === oppId ? { ...p, money: p.money + refund } : p,
          );
          const newProperties = state.properties.map((p) =>
            p.id === cheapest.id ? { ...p, ownerId: null, upgradeLevel: 0 } : p,
          );
          const opp = state.players.find((p) => p.id === oppId);
          return {
            success: true,
            newState: this.recalcTotalAssetsLocal({ ...state, players: newPlayers, properties: newProperties }),
            message: `${opp?.name}の「${cheapest.name}」の独占を崩しました！(${refund}万円返却)`,
          };
        }
      }
    }

    // 独占に最も近い都市の物件を1つ市場に戻す
    let bestTarget: { oppId: string; prop: (typeof state.properties)[0]; ratio: number } | null = null;
    for (const cityId of cityIds) {
      const cityProps = state.properties.filter((p) => p.cityId === cityId);
      if (cityProps.length <= 1) continue;
      for (const oppId of opponentIds) {
        const count = cityProps.filter((p) => p.ownerId === oppId).length;
        const ratio = count / cityProps.length;
        if (ratio > 0 && ratio < 1 && (!bestTarget || ratio > bestTarget.ratio)) {
          const prop = cityProps.find((p) => p.ownerId === oppId)!;
          bestTarget = { oppId, prop, ratio };
        }
      }
    }

    if (bestTarget) {
      const refund = Math.floor(bestTarget.prop.price * 0.8);
      const newPlayers = state.players.map((p) =>
        p.id === bestTarget!.oppId ? { ...p, money: p.money + refund } : p,
      );
      const newProperties = state.properties.map((p) =>
        p.id === bestTarget!.prop.id ? { ...p, ownerId: null, upgradeLevel: 0 } : p,
      );
      const opp = state.players.find((p) => p.id === bestTarget!.oppId);
      return {
        success: true,
        newState: this.recalcTotalAssetsLocal({ ...state, players: newPlayers, properties: newProperties }),
        message: `${opp?.name}の「${bestTarget.prop.name}」を市場に戻しました！`,
      };
    }

    return { success: false, reason: 'no_target' };
  }

  /**
   * 物件購入カード
   * - current_location_discount: 現在地の最安値未所有物件を割引購入
   * - any_location: 全国最安値の未所有物件を購入
   * - current_city_free_one: 現在地の未所有物件を1件無料取得
   */
  private useBuyProperty(
    state: GameState,
    playerId: string,
    card: Card,
    currentCityId?: string,
  ): UseCardResult {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return { success: false, reason: 'not_found' };

    const targetType = card.effect.targetType;

    if (targetType === 'current_city_free_one' && currentCityId) {
      const unowned = state.properties.find(
        (p) => p.cityId === currentCityId && p.ownerId === null,
      );
      if (!unowned) return { success: false, reason: 'no_target' };
      const newProperties = state.properties.map((p) =>
        p.id === unowned.id ? { ...p, ownerId: playerId } : p,
      );
      return {
        success: true,
        newState: this.recalcTotalAssetsLocal({ ...state, properties: newProperties }),
        message: `「${unowned.name}」を無料で入手しました！`,
      };
    }

    if (targetType === 'any_location') {
      const unowned = state.properties
        .filter((p) => p.ownerId === null && player.money >= p.price)
        .sort((a, b) => a.price - b.price)[0];
      if (!unowned) return { success: false, reason: 'no_target' };
      const newPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, money: p.money - unowned.price } : p,
      );
      const newProperties = state.properties.map((p) =>
        p.id === unowned.id ? { ...p, ownerId: playerId } : p,
      );
      return {
        success: true,
        newState: this.recalcTotalAssetsLocal({
          ...state,
          players: newPlayers,
          properties: newProperties,
        }),
        message: `「${unowned.name}」を購入しました！(${unowned.price}万円)`,
      };
    }

    // current_location_discount
    if (currentCityId) {
      const discountPct = card.effect.value ?? 0;
      const discountRate = discountPct / 100;
      const unowned = state.properties
        .filter((p) => p.cityId === currentCityId && p.ownerId === null)
        .sort((a, b) => a.price - b.price)[0];
      if (!unowned) return { success: false, reason: 'no_target' };
      const discountedPrice = Math.floor(unowned.price * (1 - discountRate));
      if (player.money < discountedPrice) return { success: false, reason: 'no_target' };
      const newPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, money: p.money - discountedPrice } : p,
      );
      const newProperties = state.properties.map((p) =>
        p.id === unowned.id ? { ...p, ownerId: playerId } : p,
      );
      return {
        success: true,
        newState: this.recalcTotalAssetsLocal({
          ...state,
          players: newPlayers,
          properties: newProperties,
        }),
        message: `「${unowned.name}」を${discountPct}%割引で購入しました！(${discountedPrice}万円)`,
      };
    }

    return { success: false, reason: 'no_target' };
  }

  /**
   * 収益倍増カード
   * - until_settlement: 次の年末決算まで収益がvalue倍
   * - one_month: 今月の収益をvalue倍にして即座に受け取る
   */
  private useDoubleIncome(state: GameState, playerId: string, card: Card): UseCardResult {
    const multiplier = card.effect.value ?? 2;

    if (card.effect.targetType === 'one_month') {
      // 現在の月収益をvalue倍にして即座に付与
      const owned = state.properties.filter((p) => p.ownerId === playerId);
      const monthlyIncome = owned.reduce((sum, p) => {
        const income = p.upgradeLevel === 0
          ? p.income
          : (p.upgradeIncomes[p.upgradeLevel - 1] ?? p.income);
        return sum + Math.floor(income / 12);
      }, 0);
      const gain = Math.floor(monthlyIncome * multiplier);
      const newState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId
            ? { ...p, money: p.money + gain, totalAssets: p.totalAssets + gain }
            : p,
        ),
      };
      return {
        success: true,
        newState,
        message: `今月の収益が${multiplier}倍！${gain}万円を即座に獲得しました！`,
      };
    }

    // until_settlement
    const newState: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, incomeMultiplier: multiplier } : p,
      ),
    };
    return {
      success: true,
      newState,
      message: `次の年末決算まで収益が${multiplier}倍になります！`,
    };
  }

  /**
   * 総資産再計算（PropertyManager に依存しない内部ヘルパー）
   */
  private recalcTotalAssetsLocal(state: GameState): GameState {
    const newPlayers = state.players.map((player) => {
      const propertyValue = state.properties
        .filter((p) => p.ownerId === player.id)
        .reduce((sum, p) => sum + p.price, 0);
      return { ...player, totalAssets: player.money + propertyValue };
    });
    return { ...state, players: newPlayers };
  }

  /**
   * カード売り場のラインナップを取得（ランダムN枚）
   */
  getShopLineup(count = 5): Card[] {
    if (this.allCards.length <= count) return [...this.allCards];
    return randomPickN(this.allCards, count);
  }

  /**
   * プレイヤーの手札カードを取得
   */
  getPlayerHand(state: GameState, playerId: string): Card[] {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return [];
    return player.hand
      .map((id) => this.getCardById(id))
      .filter((c): c is Card => c !== undefined);
  }

  /**
   * 手札を捨てる
   */
  discardCard(state: GameState, playerId: string, cardId: string): GameState {
    return {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, hand: p.hand.filter((id) => id !== cardId) } : p,
      ),
    };
  }
}
