import { describe, it, expect, beforeEach } from 'vitest';
import { CardManager } from '../../src/game/CardManager';
import type { GameState, Player, Card } from '../../src/types';

function makePlayer(id: string, money: number, hand: string[] = []): Player {
  return {
    id,
    name: `Player ${id}`,
    type: 'human',
    difficulty: 'normal',
    money,
    totalAssets: money,
    position: { cityId: 'tokyo', routeId: null, squareIndex: 0 },
    hand,
    bombeeType: 'none',
    bombeeElapsedTurns: 0,
    color: 0xff0000,
    pawIndex: 0,
  };
}

function makeState(players: Player[]): GameState {
  return {
    id: 'test',
    currentYear: 1,
    currentMonth: 4,
    totalYears: 10,
    currentPlayerIndex: 0,
    phase: 'dice_roll',
    players,
    properties: [],
    destinationCityId: 'osaka',
    turnCount: 0,
  };
}

const sampleCards: Card[] = [
  {
    id: 'card_dest',
    type: 'move_to_destination',
    name: '目的地へGO！',
    description: '目的地へ直行',
    effect: { type: 'move_to_destination', value: null, targetType: 'self' },
    rarity: 'rare',
  },
  {
    id: 'card_money',
    type: 'get_money',
    name: '収入カード',
    description: '1000万円を獲得',
    effect: { type: 'get_money', value: 1000, targetType: 'self' },
    rarity: 'common',
  },
  {
    id: 'card_pay',
    type: 'pay_money',
    name: '支払いカード',
    description: '500万円を支払い',
    effect: { type: 'pay_money', value: 500, targetType: 'self' },
    rarity: 'common',
  },
];

describe('CardManager', () => {
  let manager: CardManager;
  let p1: Player;
  let p2: Player;
  let state: GameState;

  beforeEach(() => {
    manager = new CardManager();
    manager.loadCards(sampleCards);
    p1 = makePlayer('p1', 10000);
    p2 = makePlayer('p2', 10000);
    state = makeState([p1, p2]);
  });

  // ──────────────────────────────────────
  // gainCard
  // ──────────────────────────────────────

  describe('gainCard', () => {
    it('カードを取得できる', () => {
      const { newState, card } = manager.gainCard(state, 'p1');
      expect(card).not.toBeNull();
      expect(newState.players[0].hand).toHaveLength(1);
    });

    it('手札上限(8枚)に達した場合はカードを取得できない', () => {
      const fullHand = Array(8).fill('card_money');
      const fullPlayer = makePlayer('p1', 10000, fullHand);
      const fullState = makeState([fullPlayer, p2]);

      const { card } = manager.gainCard(fullState, 'p1');
      expect(card).toBeNull();
    });
  });

  // ──────────────────────────────────────
  // useCard
  // ──────────────────────────────────────

  describe('useCard - get_money', () => {
    it('収入カードを使用してお金が増える', () => {
      const playerWithCard = makePlayer('p1', 5000, ['card_money']);
      const cardState = makeState([playerWithCard, p2]);

      const result = manager.useCard(cardState, 'p1', 'card_money');
      expect(result.success).toBe(true);
      expect(result.newState?.players[0].money).toBe(6000);
      expect(result.newState?.players[0].hand).toHaveLength(0);
    });
  });

  describe('useCard - pay_money', () => {
    it('支払いカードを使用してお金が減る', () => {
      const playerWithCard = makePlayer('p1', 5000, ['card_pay']);
      const cardState = makeState([playerWithCard, p2]);

      const result = manager.useCard(cardState, 'p1', 'card_pay');
      expect(result.success).toBe(true);
      expect(result.newState?.players[0].money).toBe(4500);
    });

    it('所持金より多い場合は0まで減る', () => {
      const poorPlayer = makePlayer('poor', 200, ['card_pay']);
      const poorState = makeState([poorPlayer, p2]);

      const result = manager.useCard(poorState, 'poor', 'card_pay');
      expect(result.success).toBe(true);
      expect(result.newState?.players[0].money).toBe(0);
    });
  });

  describe('useCard - move_to_destination', () => {
    it('目的地へGO！カードで目的地に移動する', () => {
      const playerWithCard = makePlayer('p1', 5000, ['card_dest']);
      const cardState = makeState([playerWithCard, p2]);

      const result = manager.useCard(cardState, 'p1', 'card_dest');
      expect(result.success).toBe(true);
      expect(result.newState?.players[0].position.cityId).toBe('osaka');
    });
  });

  describe('useCard - エラーケース', () => {
    it('手札にないカードは使えない', () => {
      const result = manager.useCard(state, 'p1', 'card_money');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_owner');
    });

    it('存在しないカードは使えない', () => {
      const result = manager.useCard(state, 'p1', 'nonexistent_card');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_found');
    });
  });

  // ──────────────────────────────────────
  // getPlayerHand
  // ──────────────────────────────────────

  describe('getPlayerHand', () => {
    it('プレイヤーの手札カードを取得できる', () => {
      const playerWithCard = makePlayer('p1', 5000, ['card_money', 'card_dest']);
      const cardState = makeState([playerWithCard, p2]);

      const hand = manager.getPlayerHand(cardState, 'p1');
      expect(hand).toHaveLength(2);
      expect(hand.map((c) => c.id)).toContain('card_money');
    });
  });

  // ──────────────────────────────────────
  // getShopLineup
  // ──────────────────────────────────────

  describe('getShopLineup', () => {
    it('指定数以下のカードを返す', () => {
      const lineup = manager.getShopLineup(2);
      expect(lineup.length).toBeLessThanOrEqual(2);
    });
  });
});
