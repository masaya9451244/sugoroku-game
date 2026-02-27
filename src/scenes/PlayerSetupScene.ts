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

    // 背景：濃い紺
    this.add.rectangle(0, 0, width, height, COLORS.HUD_BG).setOrigin(0);

    // タイトルバー（上部 PRIMARY 赤）
    this.add.rectangle(0, 0, width, 56, COLORS.PRIMARY).setOrigin(0);
    this.add.text(width / 2, 28, 'プレイヤー設定', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.XL,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // 戻るボタン（タイトルバー内）
    this.add.text(20, 28, '← 戻る', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffdddd',
    }).setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SCENE_KEYS.TITLE));

    // 年数設定
    this.createYearSelector(width / 2, 100);

    // プレイヤー設定欄
    for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS; i++) {
      this.createPlayerRow(i, 160 + i * 118);
    }

    // スタートボタン
    this.createStartButton(width / 2, height - 50);
  }

  private createYearSelector(cx: number, y: number): void {
    this.add.text(cx - 130, y, '年数：', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#ffffff',
      fontStyle: 'bold',
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
      color: '#' + COLORS.GOLD.toString(16).padStart(6, '0'),
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

    // カード背景矩形
    const cardBg = this.add.rectangle(width / 2, y + 50, width - 40, 108,
      isActive ? COLORS.PANEL_DARK : 0x0d1525)
      .setOrigin(0.5)
      .setStrokeStyle(isActive ? 2 : 0, PLAYER_COLORS[index]);
    row.objects.push(cardBg);

    // 左縁ストライプ（プレイヤーカラー）
    const stripe = this.add.rectangle(20, y + 6, 4, 100, PLAYER_COLORS[index], isActive ? 1 : 0.3)
      .setOrigin(0);
    row.objects.push(stripe);

    // プレイヤー番号・色ドット
    const colorDot = this.add.circle(52, y + 50, 14, PLAYER_COLORS[index], isActive ? 1 : 0.3);
    row.objects.push(colorDot);

    const numText = this.add.text(76, y + 50, `P${index + 1} ${PLAYER_COLOR_NAMES[index]}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: isActive ? '#ffffff' : '#445566',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    row.objects.push(numText);

    // 有効/無効トグル（P3,P4のみ）
    if (index >= 2) {
      const addBtn = this.add.text(width - 24, y + 24, isActive ? '✕ 外す' : '＋ 追加', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: isActive ? '#ff6666' : '#44cc88',
      }).setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.togglePlayer(index));
      row.objects.push(addBtn);
    }

    // 名前テキスト
    const nameText = this.add.text(76, y + 76, config?.name ?? `P${index + 1}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: 12,
      color: isActive ? '#aabbcc' : '#334455',
    }).setOrigin(0, 0.5);
    row.objects.push(nameText);

    // 人間/CPU トグルボタン
    const typeColor = config?.type === 'human' ? 0x27ae60 : 0x2980b9;
    const typeBtn = this.add.text(260, y + 50, config?.type === 'human' ? '人間' : 'CPU', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: isActive ? '#ffffff' : '#445566',
      backgroundColor: isActive ? '#' + typeColor.toString(16).padStart(6, '0') : '#223344',
      padding: { x: 12, y: 5 },
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleType(index));
    row.objects.push(typeBtn);

    // 難易度ボタン（CPU時のみ表示）
    const diffTexts = ['やさしい', 'ふつう', 'むずかしい'] as const;
    const diffValues: Difficulty[] = ['easy', 'normal', 'hard'];
    const diffBtns = diffTexts.map((label, di) => {
      const isSelected = isActive && config?.type === 'cpu' && config.difficulty === diffValues[di];
      const btn = this.add.text(420 + di * 118, y + 50, label, {
        fontFamily: FONTS.PRIMARY,
        fontSize: 12,
        color: isActive && config?.type === 'cpu' ? (isSelected ? '#000000' : '#aabbcc') : '#334455',
        backgroundColor: isSelected ? '#' + COLORS.SECONDARY.toString(16).padStart(6, '0') : '#1a2a3a',
        padding: { x: 8, y: 5 },
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setDifficulty(index, diffValues[di]));
      return btn;
    });
    diffBtns.forEach((b) => row.objects.push(b));

    // 非アクティブ時は薄く
    if (!isActive) {
      colorDot.setAlpha(0.3);
    }

    this.playerRows.push(row);
  }

  private togglePlayer(index: number): void {
    if (index < 2) return;
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
    this.playerRows.forEach((row) => row.objects.forEach((o) => o.destroy()));
    this.playerRows = [];
    for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS; i++) {
      this.createPlayerRow(i, 160 + i * 118);
    }
  }

  private createStartButton(cx: number, y: number): void {
    const bg = this.add.rectangle(cx, y, 300, 56, COLORS.PRIMARY)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(cx, y, 'ゲームスタート！', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    bg.on('pointerover', () => { bg.setFillStyle(0xcc0000); bg.setScale(1.03); });
    bg.on('pointerout', () => { bg.setFillStyle(COLORS.PRIMARY); bg.setScale(1); });
    bg.on('pointerdown', () => {
      const gameConfig: GameConfig = {
        totalYears: this.totalYears,
        players: this.playerConfigs.slice(0, this.playerCount),
      };
      this.scene.start(SCENE_KEYS.GAME, { gameConfig });
    });

    label.setDepth(1);
  }

  private createSmallButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 38, 38, COLORS.PRIMARY)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    bg.on('pointerover', () => bg.setFillStyle(0xcc0000));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.PRIMARY));
    bg.on('pointerdown', onClick);
  }
}

interface PlayerRow {
  index: number;
  y: number;
  objects: Phaser.GameObjects.GameObject[];
}
