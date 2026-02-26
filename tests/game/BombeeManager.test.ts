import { describe, it, expect, beforeEach } from 'vitest';
import { BombeeManager } from '../../src/game/BombeeManager';
import type { GameState, Player } from '../../src/types';

function makePlayer(id: string, totalAssets: number, bombeeType: Player['bombeeType'] = 'none'): Player {
  return {
    id,
    name: `Player ${id}`,
    type: 'human',
    difficulty: 'normal',
    money: totalAssets,
    totalAssets,
    position: { cityId: 'tokyo', routeId: null, squareIndex: 0 },
    hand: [],
    bombeeType,
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

describe('BombeeManager', () => {
  let manager: BombeeManager;

  beforeEach(() => {
    manager = new BombeeManager();
  });

  // ──────────────────────────────────────
  // attachBombeeToLastPlace
  // ──────────────────────────────────────

  describe('attachBombeeToLastPlace', () => {
    it('最下位プレイヤーにミニボンビーを憑依させる', () => {
      const rich = makePlayer('rich', 50000);
      const poor = makePlayer('poor', 1000);
      const state = makeState([rich, poor]);

      const newState = manager.attachBombeeToLastPlace(state);
      expect(newState.players.find((p) => p.id === 'poor')?.bombeeType).toBe('mini');
      expect(newState.players.find((p) => p.id === 'rich')?.bombeeType).toBe('none');
    });

    it('すでにボンビーがいる場合は再憑依しない', () => {
      const p1 = makePlayer('p1', 50000, 'mini');
      const p2 = makePlayer('p2', 1000);
      const state = makeState([p1, p2]);

      const newState = manager.attachBombeeToLastPlace(state);
      // 変化なし（p2には憑依しない）
      expect(newState.players.find((p) => p.id === 'p2')?.bombeeType).toBe('none');
    });

    it('プレイヤー1人の場合はボンビーなし', () => {
      const alone = makePlayer('alone', 5000);
      const state = makeState([alone]);
      const newState = manager.attachBombeeToLastPlace(state);
      expect(newState.players[0].bombeeType).toBe('none');
    });
  });

  // ──────────────────────────────────────
  // getLastPlacePlayer
  // ──────────────────────────────────────

  describe('getLastPlacePlayer', () => {
    it('総資産最小のプレイヤーを返す', () => {
      const rich = makePlayer('rich', 50000);
      const mid = makePlayer('mid', 20000);
      const poor = makePlayer('poor', 5000);

      const result = manager.getLastPlacePlayer([rich, mid, poor]);
      expect(result?.id).toBe('poor');
    });

    it('プレイヤーがいない場合はundefinedを返す', () => {
      expect(manager.getLastPlacePlayer([])).toBeUndefined();
    });
  });

  // ──────────────────────────────────────
  // removeBombee
  // ──────────────────────────────────────

  describe('removeBombee', () => {
    it('ボンビーを除去できる', () => {
      const bombeePlayer = makePlayer('victim', 5000, 'king');
      const state = makeState([bombeePlayer]);

      const newState = manager.removeBombee(state, 'victim');
      expect(newState.players[0].bombeeType).toBe('none');
      expect(newState.players[0].bombeeElapsedTurns).toBe(0);
    });
  });

  // ──────────────────────────────────────
  // getBombeeName
  // ──────────────────────────────────────

  describe('getBombeeName', () => {
    it('各ボンビータイプの名前を返す', () => {
      expect(manager.getBombeeName('none')).toBe('なし');
      expect(manager.getBombeeName('mini')).toBe('ミニボンビー');
      expect(manager.getBombeeName('normal')).toBe('ボンビー');
      expect(manager.getBombeeName('king')).toBe('キングボンビー');
    });
  });

  // ──────────────────────────────────────
  // processBombeeAction
  // ──────────────────────────────────────

  describe('processBombeeAction', () => {
    it('ボンビーがいない場合は何も起きない', () => {
      const p1 = makePlayer('p1', 10000);
      const state = makeState([p1]);
      const result = manager.processBombeeAction(state);
      expect(result.message).toBe('');
      expect(result.newState.players[0].money).toBe(10000);
    });

    it('ミニボンビー行動でお金が減る', () => {
      const victim = makePlayer('victim', 10000, 'mini');
      const state = makeState([victim]);
      const result = manager.processBombeeAction(state);
      // お金が減っているはず
      expect(result.newState.players[0].money).toBeLessThanOrEqual(10000);
      expect(result.message).toBeTruthy();
    });

    it('経過ターン数が増える', () => {
      const victim = makePlayer('victim', 10000, 'mini');
      const state = makeState([victim]);
      const result = manager.processBombeeAction(state);
      const bombeePlayer = result.newState.players.find(
        (p) => p.bombeeType !== 'none',
      );
      expect(bombeePlayer?.bombeeElapsedTurns).toBeGreaterThanOrEqual(1);
    });
  });

  // ──────────────────────────────────────
  // getBombeePlayer
  // ──────────────────────────────────────

  describe('getBombeePlayer', () => {
    it('ボンビーを持つプレイヤーを返す', () => {
      const normal = makePlayer('normal', 10000);
      const bombee = makePlayer('bombee', 5000, 'mini');
      const state = makeState([normal, bombee]);

      const result = manager.getBombeePlayer(state);
      expect(result?.id).toBe('bombee');
    });

    it('誰もボンビーを持っていない場合はundefined', () => {
      const state = makeState([makePlayer('p1', 10000)]);
      expect(manager.getBombeePlayer(state)).toBeUndefined();
    });
  });

  // ──────────────────────────────────────
  // decrementBombeeImmunity
  // ──────────────────────────────────────

  describe('decrementBombeeImmunity', () => {
    it('免疫年数が1以上のプレイヤーを1減らす', () => {
      const immune = { ...makePlayer('immune', 10000), bombeeImmuneYears: 3 };
      const normal = makePlayer('normal', 10000);
      const state = makeState([immune, normal]);

      const result = manager.decrementBombeeImmunity(state);
      expect(result.players.find((p) => p.id === 'immune')?.bombeeImmuneYears).toBe(2);
      expect(result.players.find((p) => p.id === 'normal')?.bombeeImmuneYears ?? 0).toBe(0);
    });

    it('免疫年数が0のプレイヤーはそのまま', () => {
      const p = { ...makePlayer('p', 10000), bombeeImmuneYears: 0 };
      const state = makeState([p]);

      const result = manager.decrementBombeeImmunity(state);
      expect(result.players[0].bombeeImmuneYears).toBe(0);
    });

    it('免疫年数が1のプレイヤーは0になる', () => {
      const p = { ...makePlayer('p', 10000), bombeeImmuneYears: 1 };
      const state = makeState([p]);

      const result = manager.decrementBombeeImmunity(state);
      expect(result.players[0].bombeeImmuneYears).toBe(0);
    });
  });

  // ──────────────────────────────────────
  // attachBombeeToLastPlace（免疫プレイヤースキップ）
  // ──────────────────────────────────────

  describe('attachBombeeToLastPlace（免疫）', () => {
    it('最下位プレイヤーが免疫中なら次の最下位に憑依する', () => {
      const immunePoor = { ...makePlayer('poor', 1000), bombeeImmuneYears: 2 };
      const secondPoor = makePlayer('second', 2000);
      const rich = makePlayer('rich', 50000);
      const state = makeState([immunePoor, secondPoor, rich]);

      const newState = manager.attachBombeeToLastPlace(state);
      expect(newState.players.find((p) => p.id === 'poor')?.bombeeType).toBe('none');
      expect(newState.players.find((p) => p.id === 'second')?.bombeeType).toBe('mini');
    });
  });
});
