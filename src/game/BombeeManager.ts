import type { GameState, Player } from '../types';
import type { BombeeType } from '../types';
import { BOMBEE } from '../config';
import { randomPick } from '../utils/random';

export interface BombeeActionResult {
  newState: GameState;
  message: string;
}

export class BombeeManager {
  /**
   * ボンビーを最下位プレイヤーに憑依させる
   * （まだ誰にも憑いていない場合の初期化）
   * bombeeImmuneYears > 0 のプレイヤーはスキップ
   */
  attachBombeeToLastPlace(state: GameState): GameState {
    // すでに誰かが憑依されている場合はスキップ
    const hasBombee = state.players.some((p) => p.bombeeType !== 'none');
    if (hasBombee) return state;

    // 2人以上いないとボンビーなし
    if (state.players.length < 2) return state;

    const lastPlayer = this.getLastPlacePlayer(state.players);
    if (!lastPlayer) return state;

    // 免疫中はスキップ（免疫のない最下位に憑依）
    const eligible = this.getLastPlacePlayer(
      state.players.filter((p) => !(p.bombeeImmuneYears && p.bombeeImmuneYears > 0)),
    );
    const target = eligible ?? lastPlayer;

    return {
      ...state,
      players: state.players.map((p) =>
        p.id === target.id
          ? { ...p, bombeeType: 'mini', bombeeElapsedTurns: 0 }
          : p,
      ),
    };
  }

  /**
   * 年末に bombeeImmuneYears を1年減らす
   */
  decrementBombeeImmunity(state: GameState): GameState {
    return {
      ...state,
      players: state.players.map((p) =>
        (p.bombeeImmuneYears ?? 0) > 0
          ? { ...p, bombeeImmuneYears: p.bombeeImmuneYears! - 1 }
          : p,
      ),
    };
  }

  /**
   * ボンビー行動処理
   * ボンビーは現在プレイヤーのターン終了後に行動する
   */
  processBombeeAction(state: GameState): BombeeActionResult {
    const bombeePlayer = state.players.find((p) => p.bombeeType !== 'none');
    if (!bombeePlayer) {
      return { newState: state, message: '' };
    }

    // 経過ターン更新
    const newElapsed = bombeePlayer.bombeeElapsedTurns + 1;

    // ボンビー進化チェック
    const evolvedType = this.checkEvolution(bombeePlayer.bombeeType, newElapsed);
    let newState = {
      ...state,
      players: state.players.map((p) =>
        p.id === bombeePlayer.id
          ? { ...p, bombeeType: evolvedType, bombeeElapsedTurns: newElapsed }
          : p,
      ),
    };

    // ボンビー種類に応じた行動
    const result = this.executeBombeeEffect(newState, bombeePlayer.id, evolvedType);
    newState = result.newState;

    // ターン終了後、最下位プレイヤーに移動するかチェック
    newState = this.maybeMoveToLastPlace(newState, bombeePlayer.id);

    let message = result.message;
    if (evolvedType !== bombeePlayer.bombeeType) {
      message = `ボンビーが ${this.getBombeeName(evolvedType)} に進化！\n` + message;
    }

    return { newState, message };
  }

  /**
   * ボンビーの進化チェック
   */
  private checkEvolution(current: BombeeType, elapsed: number): BombeeType {
    if (current === 'mini' && elapsed >= BOMBEE.MINI_TO_NORMAL_TURNS) {
      return 'normal';
    }
    if (current === 'normal' && elapsed >= BOMBEE.NORMAL_TO_KING_TURNS) {
      return 'king';
    }
    return current;
  }

  /**
   * ボンビー効果を実行
   */
  private executeBombeeEffect(
    state: GameState,
    targetId: string,
    bombeeType: BombeeType,
  ): BombeeActionResult {
    const target = state.players.find((p) => p.id === targetId);
    if (!target) return { newState: state, message: '' };

    switch (bombeeType) {
      case 'mini':
        return this.miniAction(state, target);
      case 'normal':
        return this.normalAction(state, target);
      case 'king':
        return this.kingAction(state, target);
      default:
        return { newState: state, message: '' };
    }
  }

  /**
   * ミニボンビーの行動：少額のお金を奪う（所持金の5〜15%）
   */
  private miniAction(state: GameState, target: Player): BombeeActionResult {
    const rate = (Math.random() * 0.1) + 0.05; // 5〜15%
    const stolen = Math.max(100, Math.floor(target.money * rate));
    const actualStolen = Math.min(stolen, target.money);

    if (actualStolen <= 0) {
      return { newState: state, message: 'ミニボンビーが現れたが、お金がなかった！' };
    }

    const newState: GameState = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === target.id) {
          return { ...p, money: p.money - actualStolen, totalAssets: p.totalAssets - actualStolen };
        }
        return p;
      }),
    };

    return {
      newState,
      message: `ミニボンビー：${target.name} から ${actualStolen}万円を奪った！`,
    };
  }

  /**
   * ボンビーの行動：物件売却 or お金を奪う（所持金の20〜40%）
   */
  private normalAction(state: GameState, target: Player): BombeeActionResult {
    const ownedProperties = state.properties.filter((p) => p.ownerId === target.id);

    // 物件があれば売却（確率50%）
    if (ownedProperties.length > 0 && Math.random() < 0.5) {
      const prop = randomPick(ownedProperties);
      const sellValue = Math.floor(prop.price * 0.7); // 売却額70%

      const newState: GameState = {
        ...state,
        players: state.players.map((p) => {
          if (p.id !== target.id) return p;
          return {
            ...p,
            money: p.money + sellValue,
            totalAssets: p.totalAssets - (prop.price - sellValue),
          };
        }),
        properties: state.properties.map((p) =>
          p.id === prop.id ? { ...p, ownerId: null } : p,
        ),
      };

      return {
        newState,
        message: `ボンビー：${target.name} の「${prop.name}」を売却した！（${sellValue}万円）`,
      };
    }

    // お金を奪う
    const rate = (Math.random() * 0.2) + 0.2; // 20〜40%
    const stolen = Math.max(500, Math.floor(target.money * rate));
    const actualStolen = Math.min(stolen, target.money);

    if (actualStolen <= 0) {
      return { newState: state, message: 'ボンビーが現れたが、お金がなかった！' };
    }

    const newState: GameState = {
      ...state,
      players: state.players.map((p) => {
        if (p.id !== target.id) return p;
        return { ...p, money: p.money - actualStolen, totalAssets: p.totalAssets - actualStolen };
      }),
    };

    return {
      newState,
      message: `ボンビー：${target.name} から ${actualStolen}万円を奪った！`,
    };
  }

  /**
   * キングボンビーの行動：大ダメージ（物件強制売却 or 大金奪取 or 全員被害）
   */
  private kingAction(state: GameState, target: Player): BombeeActionResult {
    const actions = ['sell_all', 'steal_big', 'affect_all'] as const;
    const action = randomPick([...actions]);

    if (action === 'sell_all') {
      // 所有物件を最大3件強制売却
      const ownedProperties = state.properties
        .filter((p) => p.ownerId === target.id)
        .slice(0, 3);

      if (ownedProperties.length === 0) {
        return this.kingStealBig(state, target);
      }

      let totalLoss = 0;
      let newState = { ...state };
      for (const prop of ownedProperties) {
        totalLoss += Math.floor(prop.price * 0.3); // 30%の損失
        newState = {
          ...newState,
          properties: newState.properties.map((p) =>
            p.id === prop.id ? { ...p, ownerId: null } : p,
          ),
        };
      }
      newState = {
        ...newState,
        players: newState.players.map((p) => {
          if (p.id !== target.id) return p;
          return {
            ...p,
            money: Math.max(0, p.money - totalLoss),
            totalAssets: Math.max(0, p.totalAssets - totalLoss * 2),
          };
        }),
      };

      return {
        newState,
        message: `キングボンビー：${target.name} の物件 ${ownedProperties.length} 件を強制売却！`,
      };
    }

    if (action === 'affect_all') {
      // 全プレイヤーから少額ずつ奪う
      let newState = { ...state };
      newState = {
        ...newState,
        players: newState.players.map((p) => {
          const damage = Math.max(100, Math.floor(p.money * 0.1));
          const actual = Math.min(damage, p.money);
          return { ...p, money: p.money - actual, totalAssets: p.totalAssets - actual };
        }),
      };
      return {
        newState,
        message: 'キングボンビー：全員から10%ずつ奪った！',
      };
    }

    return this.kingStealBig(state, target);
  }

  private kingStealBig(state: GameState, target: Player): BombeeActionResult {
    const rate = (Math.random() * 0.2) + 0.4; // 40〜60%
    const stolen = Math.max(2000, Math.floor(target.money * rate));
    const actualStolen = Math.min(stolen, target.money);

    if (actualStolen <= 0) {
      return { newState: state, message: 'キングボンビーが現れたが、お金がなかった！' };
    }

    const newState: GameState = {
      ...state,
      players: state.players.map((p) => {
        if (p.id !== target.id) return p;
        return { ...p, money: p.money - actualStolen, totalAssets: p.totalAssets - actualStolen };
      }),
    };

    return {
      newState,
      message: `キングボンビー：${target.name} から ${actualStolen}万円を強奪！`,
    };
  }

  /**
   * ボンビーが最下位に移動するかチェック
   * 本家ルール：ターン終了時に現在の憑依プレイヤーが最下位でなければ移動
   * bombeeImmuneYears > 0 のプレイヤーはスキップ
   */
  private maybeMoveToLastPlace(state: GameState, currentBombeeId: string): GameState {
    // 免疫のない最下位プレイヤーを探す
    const eligible = state.players.filter(
      (p) => p.id !== currentBombeeId && !(p.bombeeImmuneYears && p.bombeeImmuneYears > 0),
    );
    const lastPlayer = this.getLastPlacePlayer(eligible);
    if (!lastPlayer) return state;

    const currentBombeePlayer = state.players.find((p) => p.id === currentBombeeId);
    // 現在の憑依者が最下位（免疫考慮後）であればそのまま
    if (!currentBombeePlayer || currentBombeePlayer.totalAssets <= lastPlayer.totalAssets) {
      return state;
    }

    // 最下位プレイヤーに移動（確率75%）
    if (Math.random() < 0.75) {
      return {
        ...state,
        players: state.players.map((p) => {
          if (p.id === currentBombeeId) {
            return { ...p, bombeeType: 'none', bombeeElapsedTurns: 0 };
          }
          if (p.id === lastPlayer.id) {
            return {
              ...p,
              bombeeType: currentBombeePlayer?.bombeeType ?? 'mini',
              bombeeElapsedTurns: 0,
            };
          }
          return p;
        }),
      };
    }

    return state;
  }

  /**
   * 最下位プレイヤーを返す
   */
  getLastPlacePlayer(players: Player[]): Player | undefined {
    if (players.length === 0) return undefined;
    return players.reduce((worst, p) => (p.totalAssets < worst.totalAssets ? p : worst));
  }

  /**
   * ボンビーを除去する
   */
  removeBombee(state: GameState, targetId: string): GameState {
    return {
      ...state,
      players: state.players.map((p) =>
        p.id === targetId ? { ...p, bombeeType: 'none', bombeeElapsedTurns: 0 } : p,
      ),
    };
  }

  /**
   * ボンビー名称を返す
   */
  getBombeeName(type: BombeeType): string {
    const names: Record<BombeeType, string> = {
      none: 'なし',
      mini: 'ミニボンビー',
      normal: 'ボンビー',
      king: 'キングボンビー',
    };
    return names[type];
  }

  /**
   * ボンビーを持つプレイヤーを返す
   */
  getBombeePlayer(state: GameState): Player | undefined {
    return state.players.find((p) => p.bombeeType !== 'none');
  }
}
