import { describe, it, expect } from 'vitest';
import { randomInt, rollDice, randomPick, randomPickN, weightedRandom } from '../../src/utils/random';

describe('randomInt', () => {
  it('min以上max以下の整数を返す', () => {
    for (let i = 0; i < 100; i++) {
      const n = randomInt(1, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('min === maxのとき常にその値を返す', () => {
    for (let i = 0; i < 10; i++) {
      expect(randomInt(5, 5)).toBe(5);
    }
  });
});

describe('rollDice', () => {
  it('1〜6の整数を返す', () => {
    for (let i = 0; i < 100; i++) {
      const n = rollDice();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});

describe('randomPick', () => {
  it('配列の要素を返す', () => {
    const arr = [1, 2, 3, 4, 5];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(randomPick(arr));
    }
  });
});

describe('randomPickN', () => {
  it('n個の要素を重複なく返す', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = randomPickN(arr, 3);
    expect(result).toHaveLength(3);
    // 重複なし
    expect(new Set(result).size).toBe(3);
    // すべて元の配列の要素
    result.forEach((v) => expect(arr).toContain(v));
  });

  it('配列より多くは取れない', () => {
    const arr = [1, 2, 3];
    const result = randomPickN(arr, 10);
    expect(result).toHaveLength(3);
  });
});

describe('weightedRandom', () => {
  it('重みに従ってアイテムを選択する（統計テスト）', () => {
    const items = ['A', 'B', 'C'];
    const weights = [90, 9, 1]; // A: 90%, B: 9%, C: 1%
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };

    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const result = weightedRandom(items, weights);
      counts[result]++;
    }

    // Aが最も多く選ばれるはず（大まかな検証）
    expect(counts.A).toBeGreaterThan(counts.B);
    expect(counts.B).toBeGreaterThan(counts.C);
  });
});
