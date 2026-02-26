import type { GameState, Player } from '../types';
import type { Property } from '../types';

export interface PurchaseResult {
  success: boolean;
  reason?: 'not_enough_money' | 'already_owned';
  newState?: GameState;
}

export interface IncomeResult {
  playerId: string;
  propertyIncome: number;
  monopolyBonus: number;
  totalIncome: number;
}

export class PropertyManager {
  /**
   * 指定都市の物件一覧を返す
   */
  getPropertiesByCity(properties: Property[], cityId: string): Property[] {
    return properties.filter((p) => p.cityId === cityId);
  }

  /**
   * プレイヤーが保有する物件一覧を返す
   */
  getOwnedProperties(properties: Property[], playerId: string): Property[] {
    return properties.filter((p) => p.ownerId === playerId);
  }

  /**
   * 指定都市をプレイヤーが独占しているか判定する
   */
  hasMonopoly(properties: Property[], cityId: string, playerId: string): boolean {
    const cityProps = properties.filter((p) => p.cityId === cityId);
    return cityProps.length > 0 && cityProps.every((p) => p.ownerId === playerId);
  }

  /**
   * 物件を購入する
   */
  buyProperty(state: GameState, playerId: string, propertyId: string): PurchaseResult {
    const player = state.players.find((p) => p.id === playerId);
    const property = state.properties.find((p) => p.id === propertyId);

    if (!player || !property) {
      return { success: false, reason: 'not_enough_money' };
    }
    if (property.ownerId !== null) {
      return { success: false, reason: 'already_owned' };
    }

    const currentPrice = this.getCurrentPrice(property);
    if (player.money < currentPrice) {
      return { success: false, reason: 'not_enough_money' };
    }

    const newPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, money: p.money - currentPrice } : p,
    );
    const newProperties = state.properties.map((p) =>
      p.id === propertyId ? { ...p, ownerId: playerId } : p,
    );

    const newState = { ...state, players: newPlayers, properties: newProperties };
    return { success: true, newState: this.recalcTotalAssets(newState) };
  }

  /**
   * 物件をアップグレードする
   */
  upgradeProperty(state: GameState, playerId: string, propertyId: string): PurchaseResult {
    const player = state.players.find((p) => p.id === playerId);
    const property = state.properties.find((p) => p.id === propertyId);

    if (!player || !property || property.ownerId !== playerId) {
      return { success: false };
    }
    if (property.upgradeLevel >= property.upgradePrices.length) {
      return { success: false }; // 最大レベル
    }

    const upgradeCost = property.upgradePrices[property.upgradeLevel];
    if (player.money < upgradeCost) {
      return { success: false, reason: 'not_enough_money' };
    }

    const newPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, money: p.money - upgradeCost } : p,
    );
    const newProperties = state.properties.map((p) =>
      p.id === propertyId ? { ...p, upgradeLevel: p.upgradeLevel + 1 } : p,
    );

    const newState = { ...state, players: newPlayers, properties: newProperties };
    return { success: true, newState: this.recalcTotalAssets(newState) };
  }

  /**
   * 地代を支払う（他プレイヤーの物件マスに止まった時）
   */
  payLandFee(state: GameState, payerId: string, propertyId: string): GameState {
    const payer = state.players.find((p) => p.id === payerId);
    const property = state.properties.find((p) => p.id === propertyId);

    if (!payer || !property || !property.ownerId || property.ownerId === payerId) {
      return state;
    }

    const fee = this.getLandFee(property);
    const actualFee = Math.min(fee, payer.money);

    const newPlayers = state.players.map((p) => {
      if (p.id === payerId) return { ...p, money: p.money - actualFee };
      if (p.id === property.ownerId) return { ...p, money: p.money + actualFee };
      return p;
    });

    return this.recalcTotalAssets({ ...state, players: newPlayers });
  }

  /**
   * 年末決算：全プレイヤーの物件収益を計算・付与する
   */
  calcYearEndIncome(state: GameState): { newState: GameState; results: IncomeResult[] } {
    const results: IncomeResult[] = [];
    let newPlayers = [...state.players];

    for (const player of state.players) {
      const income = this.calcPlayerAnnualIncome(state.properties, player.id);
      const multiplier = player.incomeMultiplier ?? 1;
      const boostedIncome: IncomeResult = {
        ...income,
        totalIncome: Math.floor(income.totalIncome * multiplier),
      };
      results.push(boostedIncome);

      newPlayers = newPlayers.map((p) =>
        p.id === player.id
          ? { ...p, money: p.money + boostedIncome.totalIncome, incomeMultiplier: 1 }
          : p,
      );
    }

    const newState = this.recalcTotalAssets({ ...state, players: newPlayers });
    return { newState, results };
  }

  /**
   * プレイヤーの年間収益を計算する
   */
  calcPlayerAnnualIncome(properties: Property[], playerId: string): IncomeResult {
    const owned = this.getOwnedProperties(properties, playerId);
    if (owned.length === 0) {
      return { playerId, propertyIncome: 0, monopolyBonus: 0, totalIncome: 0 };
    }

    // 都市ごとにグループ化
    const byCityId = new Map<string, Property[]>();
    for (const p of owned) {
      const list = byCityId.get(p.cityId) ?? [];
      list.push(p);
      byCityId.set(p.cityId, list);
    }

    let propertyIncome = 0;
    let monopolyBonus = 0;

    for (const [cityId, cityProps] of byCityId) {
      const cityIncome = cityProps.reduce(
        (sum, p) => sum + this.getCurrentIncome(p),
        0,
      );
      propertyIncome += cityIncome;

      // 独占判定：そのcityIdの全物件をプレイヤーが保有しているか
      const allCityProps = properties.filter((p) => p.cityId === cityId);
      const isMonopoly =
        allCityProps.length > 0 &&
        allCityProps.every((p) => p.ownerId === playerId);

      if (isMonopoly) {
        monopolyBonus += cityIncome; // 独占で収益が2倍（ボーナス = 元の収益分を加算）
      }
    }

    return {
      playerId,
      propertyIncome,
      monopolyBonus,
      totalIncome: propertyIncome + monopolyBonus,
    };
  }

  /**
   * 物件の現在の購入価格を返す（アップグレード済みでも初期価格）
   */
  getCurrentPrice(property: Property): number {
    return property.price;
  }

  /**
   * 物件の現在の収益を返す（アップグレードレベルを反映）
   */
  getCurrentIncome(property: Property): number {
    if (property.upgradeLevel === 0) return property.income;
    return property.upgradeIncomes[property.upgradeLevel - 1] ?? property.income;
  }

  /**
   * 地代（他プレイヤーのマスに止まった時の支払額）
   * 収益の50%
   */
  getLandFee(property: Property): number {
    return Math.floor(this.getCurrentIncome(property) * 0.5);
  }

  /**
   * 破産時の物件強制売却（購入価格の50%返金）
   * - アップグレード状態にかかわらず購入価格の50%で売却
   * - 物件は市場に戻る（ownerId: null, upgradeLevel: 0）
   */
  sellPropertyForcibly(state: GameState, playerId: string, propertyId: string): GameState {
    const player = state.players.find((p) => p.id === playerId);
    const property = state.properties.find((p) => p.id === propertyId);
    if (!player || !property || property.ownerId !== playerId) return state;

    const sellValue = Math.floor(property.price * 0.5);
    const newPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, money: p.money + sellValue } : p,
    );
    const newProperties = state.properties.map((p) =>
      p.id === propertyId ? { ...p, ownerId: null, upgradeLevel: 0 } : p,
    );
    return this.recalcTotalAssets({ ...state, players: newPlayers, properties: newProperties });
  }

  /**
   * プレイヤーの総資産を再計算してstateを更新する
   */
  recalcTotalAssets(state: GameState): GameState {
    const newPlayers = state.players.map((player) => {
      const propertyValue = state.properties
        .filter((p) => p.ownerId === player.id)
        .reduce((sum, p) => sum + p.price, 0);
      return { ...player, totalAssets: player.money + propertyValue };
    });
    return { ...state, players: newPlayers };
  }

  /**
   * 最下位プレイヤーのIDを返す（ボンビー憑依判定に使用）
   */
  getLastPlacePlayerId(players: Player[]): string {
    return players.reduce((worst, p) => (p.totalAssets < worst.totalAssets ? p : worst)).id;
  }
}
