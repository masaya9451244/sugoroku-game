import Phaser from 'phaser';
import { SCENE_KEYS, COLORS, FONTS } from '../config';
import type { GameState, Player } from '../types';
import { formatManEn } from '../utils/format';

const PAWN_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12];
const RANK_COLORS = ['#f1c40f', '#aaaaaa', '#cd7f32', '#888888'];

export class ResultScene extends Phaser.Scene {
  private gameState?: GameState;

  constructor() {
    super({ key: SCENE_KEYS.RESULT });
  }

  init(data: { gameState?: GameState }): void {
    this.gameState = data.gameState;
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    // 背景グラデーション風
    this.add.rectangle(0, 0, width, height, 0x1a0a2e).setOrigin(0);
    this.add.rectangle(0, height * 0.6, width, height * 0.4, 0x0d0620, 0.8).setOrigin(0);

    // タイトル帯
    this.add.rectangle(cx, 60, width, 80, COLORS.PRIMARY, 0.9).setOrigin(0.5);
    this.add.text(cx, 60, 'ゲーム終了！', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.XL,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    if (!this.gameState || this.gameState.players.length === 0) {
      this.showNoDataFallback(cx, height);
      return;
    }

    const ranked = this.getRankedPlayers(this.gameState.players);
    this.showWinner(cx, ranked[0]);
    this.showRankings(cx, ranked);
    this.showGameInfo(cx, height);
    this.createReturnButton(cx, height - 50);

    // 入場アニメーション
    this.animateEntrance();
  }

  private getRankedPlayers(players: Player[]): Player[] {
    return [...players].sort((a, b) => b.totalAssets - a.totalAssets);
  }

  private showWinner(cx: number, winner: Player): void {
    // 優勝発表
    this.add.text(cx, 130, '🏆 優勝者 🏆', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#f1c40f',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 175, winner.name, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.XL,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 215, `総資産 ${formatManEn(winner.totalAssets)}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#f1c40f',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private showRankings(cx: number, ranked: Player[]): void {
    this.add.text(cx, 265, '--- 最終順位 ---', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#aaaaaa',
    }).setOrigin(0.5);

    ranked.forEach((player, i) => {
      const y = 310 + i * 80;
      const playerColorHex = '#' + PAWN_COLORS[player.pawIndex].toString(16).padStart(6, '0');

      // 順位背景
      const bgColor = i === 0 ? 0x2c1810 : 0x1a1a2e;
      const bgAlpha = i === 0 ? 0.9 : 0.6;
      this.add.rectangle(cx, y, 560, 68, bgColor, bgAlpha).setOrigin(0.5);

      if (i === 0) {
        this.add.rectangle(cx, y, 560, 68).setOrigin(0.5)
          .setStrokeStyle(2, 0xf1c40f);
      }

      // 順位
      const rankNum = i + 1;
      this.add.text(cx - 250, y, `${rankNum}位`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.LG,
        color: RANK_COLORS[i] ?? '#888888',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      // プレイヤー名
      this.add.text(cx - 160, y - 14, player.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: playerColorHex,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      // 所持金・物件数
      const propCount = this.gameState!.properties.filter((p) => p.ownerId === player.id).length;
      this.add.text(
        cx - 160,
        y + 12,
        `所持金 ${formatManEn(player.money)}  物件${propCount}件`,
        { fontFamily: FONTS.PRIMARY, fontSize: 12, color: '#aaaaaa' },
      ).setOrigin(0, 0.5);

      // 総資産
      this.add.text(cx + 240, y, formatManEn(player.totalAssets), {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.MD,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    });
  }

  private showGameInfo(cx: number, height: number): void {
    if (!this.gameState) return;

    this.add.text(cx, height - 110, `${this.gameState.totalYears}年間のゲームが終了しました`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: 13,
      color: '#666666',
    }).setOrigin(0.5);
  }

  private createReturnButton(cx: number, y: number): void {
    const bg = this.add.rectangle(cx, y, 240, 48, COLORS.PRIMARY)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.add.text(cx, y, 'タイトルへ戻る', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    bg.on('pointerover', () => bg.setFillStyle(0xe65a2a));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.PRIMARY));
    bg.on('pointerdown', () => this.scene.start(SCENE_KEYS.TITLE));
  }

  private showNoDataFallback(cx: number, height: number): void {
    this.add.text(cx, height / 2, 'ゲーム終了', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.XL,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.createReturnButton(cx, height / 2 + 80);
  }

  private animateEntrance(): void {
    // 全テキストをフェードイン
    this.cameras.main.fadeIn(600, 0, 0, 0);
  }
}
