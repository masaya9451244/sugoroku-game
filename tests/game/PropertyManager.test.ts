import { describe, it, expect, beforeEach } from 'vitest';
import { PropertyManager } from '../../src/game/PropertyManager';
import type { GameState, Player, Property } from '../../src/types';

function makePlayer(id: string, money: number): Player {
  return {
    id,
    name: `Player ${id}`,
    type: 'human',
    difficulty: 'normal',
    money,
    totalAssets: money,
    position: { cityId: 'tokyo', routeId: null, squareIndex: 0 },
    hand: [],
    bombeeType: 'none',
    bombeeElapsedTurns: 0,
    color: 0xff0000,
    pawIndex: 0,
  };
}

function makeProperty(id: string, cityId: string, price: number, income: number): Property {
  return {
    id,
    cityId,
    name: `Property ${id}`,
    theme: 'food',
    price,
    income,
    upgradePrices: [price * 2, price * 3],
    upgradeIncomes: [income * 2, income * 3],
    upgradeLevel: 0,
    ownerId: null,
  };
}

function makeState(players: Player[], properties: Property[]): GameState {
  return {
    id: 'test_game',
    currentYear: 1,
    currentMonth: 4,
    totalYears: 10,
    currentPlayerIndex: 0,
    phase: 'dice_roll',
    players,
    properties,
    destinationCityId: 'osaka',
    turnCount: 0,
  };
}

describe('PropertyManager', () => {
  let manager: PropertyManager;
  let p1: Player;
  let p2: Player;
  let prop1: Property;
  let prop2: Property;
  let state: GameState;

  beforeEach(() => {
    manager = new PropertyManager();
    p1 = makePlayer('p1', 10000);
    p2 = makePlayer('p2', 10000);
    prop1 = makeProperty('prop1', 'tokyo', 1000, 200);
    prop2 = makeProperty('prop2', 'tokyo', 2000, 400);
    state = makeState([p1, p2], [prop1, prop2]);
  });

  // ──────────────────────────────────────
  // getPropertiesByCity
  // ──────────────────────────────────────

  describe('getPropertiesByCity', () => {
    it('指定都市の物件を返す', () => {
      const osakaProps = [makeProperty('op1', 'osaka', 500, 100)];
      const allProps = [...state.properties, ...osakaProps];
      const result = manager.getPropertiesByCity(allProps, 'tokyo');
      expect(result).toHaveLength(2);
    });

    it('存在しない都市では空配列を返す', () => {
      const result = manager.getPropertiesByCity(state.properties, 'sapporo');
      expect(result).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────
  // buyProperty
  // ──────────────────────────────────────

  describe('buyProperty', () => {
    it('正常に物件を購入できる', () => {
      const result = manager.buyProperty(state, 'p1', 'prop1');
      expect(result.success).toBe(true);
      expect(result.newState?.players[0].money).toBe(10000 - 1000);
      expect(result.newState?.properties[0].ownerId).toBe('p1');
    });

    it('所持金不足で購入できない', () => {
      const poorPlayer = makePlayer('poor', 500);
      const poorState = makeState([poorPlayer, p2], [prop1]);
      const result = manager.buyProperty(poorState, 'poor', 'prop1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_enough_money');
    });

    it('購入済み物件は買えない', () => {
      const ownedProp = { ...prop1, ownerId: 'p2' };
      const ownedState = makeState([p1, p2], [ownedProp]);
      const result = manager.buyProperty(ownedState, 'p1', 'prop1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('already_owned');
    });

    it('購入後に総資産が再計算される', () => {
      const result = manager.buyProperty(state, 'p1', 'prop1');
      expect(result.success).toBe(true);
      // 総資産 = 所持金(9000) + 物件価値(1000) = 10000
      expect(result.newState?.players[0].totalAssets).toBe(10000);
    });
  });

  // ──────────────────────────────────────
  // payLandFee
  // ──────────────────────────────────────

  describe('payLandFee', () => {
    it('他プレイヤーの物件で地代を支払う', () => {
      // p2がprop1を所有
      const p2OwnedProp = { ...prop1, ownerId: 'p2' };
      const ownedState = makeState([p1, p2], [p2OwnedProp]);

      const fee = manager.getLandFee(p2OwnedProp);
      const newState = manager.payLandFee(ownedState, 'p1', 'prop1');

      expect(newState.players[0].money).toBe(10000 - fee);
      expect(newState.players[1].money).toBe(10000 + fee);
    });

    it('自分の物件では地代不発生', () => {
      const p1OwnedProp = { ...prop1, ownerId: 'p1' };
      const ownedState = makeState([p1, p2], [p1OwnedProp]);
      const newState = manager.payLandFee(ownedState, 'p1', 'prop1');
      expect(newState.players[0].money).toBe(10000);
    });

    it('所持金が不足している場合は持っている分だけ支払う', () => {
      const poorPlayer = makePlayer('poor', 10);
      const p2OwnedProp = { ...prop1, ownerId: 'p2' };
      const poorState = makeState([poorPlayer, p2], [p2OwnedProp]);

      const newState = manager.payLandFee(poorState, 'poor', 'prop1');
      expect(newState.players[0].money).toBe(0);
      expect(newState.players[1].money).toBe(10010);
    });
  });

  // ──────────────────────────────────────
  // calcPlayerAnnualIncome
  // ──────────────────────────────────────

  describe('calcPlayerAnnualIncome', () => {
    it('物件なしのプレイヤーは収益0', () => {
      const result = manager.calcPlayerAnnualIncome(state.properties, 'p1');
      expect(result.propertyIncome).toBe(0);
      expect(result.monopolyBonus).toBe(0);
      expect(result.totalIncome).toBe(0);
    });

    it('物件1件の収益を正しく計算', () => {
      const ownedProp = { ...prop1, ownerId: 'p1' };
      const testState = makeState([p1], [ownedProp, prop2]);
      const result = manager.calcPlayerAnnualIncome(testState.properties, 'p1');
      expect(result.propertyIncome).toBe(200);
      expect(result.monopolyBonus).toBe(0);
    });

    it('都市独占で収益2倍', () => {
      const ownedProp1 = { ...prop1, ownerId: 'p1' };
      const ownedProp2 = { ...prop2, ownerId: 'p1' };
      const result = manager.calcPlayerAnnualIncome([ownedProp1, ownedProp2], 'p1');
      // propertyIncome = 200 + 400 = 600
      // monopolyBonus = 600（独占で同額ボーナス）
      expect(result.propertyIncome).toBe(600);
      expect(result.monopolyBonus).toBe(600);
      expect(result.totalIncome).toBe(1200);
    });
  });

  // ──────────────────────────────────────
  // getLandFee
  // ──────────────────────────────────────

  describe('getLandFee', () => {
    it('地代は収益の50%', () => {
      const fee = manager.getLandFee(prop1);
      expect(fee).toBe(Math.floor(200 * 0.5));
    });
  });

  // ──────────────────────────────────────
  // upgradeProperty
  // ──────────────────────────────────────

  describe('upgradeProperty', () => {
    it('所有物件をアップグレードできる', () => {
      const richPlayer = makePlayer('rich', 50000);
      const ownedProp = { ...prop1, ownerId: 'rich' };
      const richState = makeState([richPlayer, p2], [ownedProp]);

      const result = manager.upgradeProperty(richState, 'rich', 'prop1');
      expect(result.success).toBe(true);
      expect(result.newState?.properties[0].upgradeLevel).toBe(1);
    });

    it('他人の物件はアップグレードできない', () => {
      const ownedProp = { ...prop1, ownerId: 'p2' };
      const ownedState = makeState([p1, p2], [ownedProp]);
      const result = manager.upgradeProperty(ownedState, 'p1', 'prop1');
      expect(result.success).toBe(false);
    });

    it('最大レベルではアップグレードできない', () => {
      const maxProp = { ...prop1, ownerId: 'p1', upgradeLevel: 2 };
      const maxState = makeState([p1, p2], [maxProp]);
      const result = manager.upgradeProperty(maxState, 'p1', 'prop1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────────────────────────────
  // getLastPlacePlayerId
  // ──────────────────────────────────────

  describe('getLastPlacePlayerId', () => {
    it('総資産最小のプレイヤーIDを返す', () => {
      const richPlayer = { ...p1, totalAssets: 50000 };
      const poorPlayer = { ...p2, totalAssets: 1000 };
      const id = manager.getLastPlacePlayerId([richPlayer, poorPlayer]);
      expect(id).toBe('p2');
    });
  });

  // ──────────────────────────────────────
  // sellPropertyForcibly
  // ──────────────────────────────────────

  describe('sellPropertyForcibly', () => {
    it('自分の物件を購入価格の50%で売却できる', () => {
      const ownedProp = { ...prop1, ownerId: 'p1' }; // price: 1000
      const ownState = makeState([p1, p2], [ownedProp]);

      const result = manager.sellPropertyForcibly(ownState, 'p1', 'prop1');
      const seller = result.players.find((p) => p.id === 'p1')!;
      const soldProp = result.properties.find((p) => p.id === 'prop1')!;

      expect(seller.money).toBe(p1.money + Math.floor(1000 * 0.5)); // 500万円回収
      expect(soldProp.ownerId).toBeNull();
      expect(soldProp.upgradeLevel).toBe(0);
    });

    it('アップグレード済みでも購入価格の50%で売却される', () => {
      const upgradedProp = { ...prop1, ownerId: 'p1', upgradeLevel: 2 };
      const ownState = makeState([p1, p2], [upgradedProp]);

      const result = manager.sellPropertyForcibly(ownState, 'p1', 'prop1');
      const seller = result.players.find((p) => p.id === 'p1')!;

      expect(seller.money).toBe(p1.money + Math.floor(1000 * 0.5)); // upgradeレベルに関係なく元値の50%
    });

    it('他人の物件は売却できない', () => {
      const othersProp = { ...prop1, ownerId: 'p2' };
      const ownState = makeState([p1, p2], [othersProp]);

      const result = manager.sellPropertyForcibly(ownState, 'p1', 'prop1');
      const unchanged = result.players.find((p) => p.id === 'p1')!;

      expect(unchanged.money).toBe(p1.money); // 変化なし
    });

    it('総資産が再計算される', () => {
      const ownedProp = { ...prop1, ownerId: 'p1' };
      const ownState = makeState([p1, p2], [ownedProp]);

      const result = manager.sellPropertyForcibly(ownState, 'p1', 'prop1');
      const seller = result.players.find((p) => p.id === 'p1')!;

      // 物件売却後: money = 元money + 500、物件価値 = 0 → totalAssets = money + 500
      expect(seller.totalAssets).toBe(p1.money + Math.floor(1000 * 0.5));
    });
  });

  // ──────────────────────────────────────
  // hasMonopoly
  // ──────────────────────────────────────

  describe('hasMonopoly', () => {
    it('都市の全物件を保有している場合 true を返す', () => {
      const p1Own1 = { ...prop1, cityId: 'kyoto', ownerId: 'p1' };
      const p1Own2 = makeProperty('prop3', 'kyoto', 1000, 100);
      const kyotoProp2 = { ...p1Own2, ownerId: 'p1' };
      const properties = [p1Own1, kyotoProp2, { ...prop2, ownerId: 'p2' }];

      expect(manager.hasMonopoly(properties, 'kyoto', 'p1')).toBe(true);
    });

    it('都市の物件が他人に含まれる場合 false を返す', () => {
      const p1Own = { ...prop1, cityId: 'kyoto', ownerId: 'p1' };
      const p2Own = makeProperty('prop3', 'kyoto', 1000, 100);
      const kyotoProp2 = { ...p2Own, ownerId: 'p2' };
      const properties = [p1Own, kyotoProp2];

      expect(manager.hasMonopoly(properties, 'kyoto', 'p1')).toBe(false);
    });

    it('都市の物件が1件もない場合 false を返す', () => {
      const properties = [{ ...prop1, cityId: 'osaka' }, { ...prop2, cityId: 'osaka' }];
      expect(manager.hasMonopoly(properties, 'kyoto', 'p1')).toBe(false);
    });

    it('未所有物件が残っている場合 false を返す', () => {
      const owned = { ...prop1, cityId: 'kyoto', ownerId: 'p1' };
      const unowned = makeProperty('prop3', 'kyoto', 1000, 100); // ownerId: null
      const properties = [owned, unowned];

      expect(manager.hasMonopoly(properties, 'kyoto', 'p1')).toBe(false);
    });
  });
});
