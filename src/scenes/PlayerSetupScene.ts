import Phaser from 'phaser';
import { SCENE_KEYS, COLORS, FONTS, GAME_CONFIG } from '../config';
import type { GameConfig, PlayerConfig, Difficulty } from '../types';

const PLAYER_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12];
const PLAYER_COLOR_NAMES = ['赤', '青', '緑', '黄'];

export class PlayerSetupScene extends Phaser.Scene {
  private totalYears = 10;
  private playerConfigs: PlayerConfig[] = [
    { name: 'プレイヤー1', type: 'human', difficulty: 'normal' },
    { name: 'CPU2', type: 'cpu', difficulty: 'normal' },
    { name: 'CPU3', type: 'cpu', difficulty: 'normal' },
    { name: 'CPU4', type: 'cpu', difficulty: 'normal' },
  ];
  private playerCount = 2;

  // UI テキストオブジェクト（再描画用）
  private yearText!: Phaser.GameObjects.Text;
  private playerRows: PlayerRow[] = [];

  constructor() {
    super({ key: SCENE_KEYS.PLAYER_SETUP });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, COLORS.BACKGROUND).setOrigin(0);

    // タイトル
    this.add.text(width / 2, 40, 'プレイヤー設定', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.XL,
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 年数設定
    this.createYearSelector(width / 2, 110);

    // プレイヤー設定欄
    for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS; i++) {
      this.createPlayerRow(i, 200 + i * 110);
    }

    // スタートボタン
    this.createStartButton(width / 2, height - 60);

    // 戻るボタン
    this.add.text(50, 35, '← 戻る', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#666666',
    }).setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SCENE_KEYS.TITLE));
  }

  private createYearSelector(cx: number, y: number): void {
    this.add.text(cx - 120, y, '年数：', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#333333',
    }).setOrigin(0, 0.5);

    // マイナスボタン
    this.createSmallButton(cx - 20, y, '-', () => {
      if (this.totalYears > 1) {
        this.totalYears--;
        this.yearText.setText(`${this.totalYears}年`);
      }
    });

    this.yearText = this.add.text(cx + 40, y, `${this.totalYears}年`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // プラスボタン
    this.createSmallButton(cx + 100, y, '+', () => {
      if (this.totalYears < 99) {
        this.totalYears++;
        this.yearText.setText(`${this.totalYears}年`);
      }
    });
  }

  private createPlayerRow(index: number, y: number): void {
    const { width } = this.scale;
    const isActive = index < this.playerCount;
    const config = this.playerConfigs[index];

    const row: PlayerRow = { index, y, objects: [] };

    // プレイヤー番号
    const colorDot = this.add.circle(80, y, 12, PLAYER_COLORS[index]);
    const numText = this.add.text(100, y, `P${index + 1} ${PLAYER_COLOR_NAMES[index]}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#333333',
    }).setOrigin(0, 0.5);

    // 有効/無効トグル（P3,P4のみ）
    let addBtn: Phaser.GameObjects.Text | null = null;
    if (index >= 2) {
      addBtn = this.add.text(width - 80, y, isActive ? '✕ 外す' : '＋ 追加', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: isActive ? '#e74c3c' : '#27ae60',
      }).setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.togglePlayer(index));
    }

    // 名前表示（クリックで編集 - 簡易版）
    const nameText = this.add.text(220, y, config?.name ?? `P${index + 1}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: isActive ? '#333333' : '#aaaaaa',
    }).setOrigin(0, 0.5);

    // 人間/CPU トグル
    const typeBtn = this.add.text(420, y, config?.type === 'human' ? '人間' : 'CPU', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: isActive ? '#ffffff' : '#aaaaaa',
      backgroundColor: isActive
        ? config?.type === 'human' ? '#27ae60' : '#3498db'
        : '#cccccc',
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleType(index));

    // 難易度ボタン（CPU時のみ表示）
    const diffTexts = ['やさしい', 'ふつう', 'むずかしい'] as const;
    const diffValues: Difficulty[] = ['easy', 'normal', 'hard'];
    const diffBtns = diffTexts.map((label, di) => {
      const btn = this.add.text(540 + di * 100, y, label, {
        fontFamily: FONTS.PRIMARY,
        fontSize: 12,
        color: isActive && config?.type === 'cpu' ? '#333333' : '#aaaaaa',
        backgroundColor:
          isActive && config?.type === 'cpu' && config.difficulty === diffValues[di]
            ? '#f39c12'
            : '#eeeeee',
        padding: { x: 6, y: 4 },
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setDifficulty(index, diffValues[di]));
      return btn;
    });

    // 非アクティブ時は薄く
    if (!isActive) {
      colorDot.setAlpha(0.3);
      numText.setAlpha(0.3);
      nameText.setAlpha(0.3);
      typeBtn.setAlpha(0.3);
      diffBtns.forEach((b) => b.setAlpha(0.3));
    }

    row.objects = [colorDot, numText, nameText, typeBtn, ...diffBtns];
    if (addBtn) row.objects.push(addBtn);
    this.playerRows.push(row);
  }

  private togglePlayer(index: number): void {
    if (index < 2) return; // P1,P2は必須
    if (this.playerCount > index) {
      this.playerCount = index;
    } else {
      this.playerCount = index + 1;
    }
    this.rebuildRows();
  }

  private toggleType(index: number): void {
    if (index >= this.playerCount) return;
    const cfg = this.playerConfigs[index];
    cfg.type = cfg.type === 'human' ? 'cpu' : 'human';
    this.rebuildRows();
  }

  private setDifficulty(index: number, diff: Difficulty): void {
    if (index >= this.playerCount) return;
    this.playerConfigs[index].difficulty = diff;
    this.rebuildRows();
  }

  private rebuildRows(): void {
    // 既存のオブジェクトを破棄して再生成
    this.playerRows.forEach((row) => row.objects.forEach((o) => o.destroy()));
    this.playerRows = [];
    for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS; i++) {
      this.createPlayerRow(i, 200 + i * 110);
    }
  }

  private createStartButton(cx: number, y: number): void {
    const bg = this.add.rectangle(cx, y, 260, 52, COLORS.SUCCESS)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(cx, y, 'ゲームスタート', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x229954));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.SUCCESS));
    bg.on('pointerdown', () => {
      const gameConfig: GameConfig = {
        totalYears: this.totalYears,
        players: this.playerConfigs.slice(0, this.playerCount),
      };
      this.scene.start(SCENE_KEYS.GAME, { gameConfig });
    });

    // ラベルを前面に
    label.setDepth(1);
  }

  private createSmallButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 36, 36, COLORS.PRIMARY)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    bg.on('pointerdown', onClick);
  }
}

interface PlayerRow {
  index: number;
  y: number;
  objects: Phaser.GameObjects.GameObject[];
}
