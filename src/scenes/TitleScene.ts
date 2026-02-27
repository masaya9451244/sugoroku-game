import Phaser from 'phaser';
import { SCENE_KEYS, COLORS, FONTS } from '../config';
import { LocalStorageSaveManager } from '../save/LocalStorageSaveManager';
import type { SaveSlot } from '../types';

const MAX_SAVE_SLOTS = 3;

export class TitleScene extends Phaser.Scene {
  private saveManager = new LocalStorageSaveManager();
  private loadPanelObjects: Phaser.GameObjects.GameObject[] = [];
  private isLoadPanelVisible = false;

  constructor() {
    super({ key: SCENE_KEYS.TITLE });
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // 背景：濃い紺グラデーション
    this.add.rectangle(0, 0, width, height, COLORS.HUD_BG).setOrigin(0);
    // 下グラデーション風の帯
    this.add.rectangle(0, height * 0.6, width, height * 0.4, 0x1a237e, 0.6).setOrigin(0);

    // 上部デコバー
    this.add.rectangle(0, 0, width, 6, COLORS.PRIMARY).setOrigin(0);
    this.add.rectangle(0, height - 6, width, 6, COLORS.PRIMARY).setOrigin(0);

    // タイトルテキスト（白・赤縁取り）
    this.add.text(cx, cy - 130, '双六ゲーム', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 64,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#cc0000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    // サブタイトル（ゴールド）
    this.add.text(cx, cy - 55, '〜 桃鉄風 日本一周 〜', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#' + COLORS.GOLD.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 区切り線
    const lineGr = this.add.graphics();
    lineGr.lineStyle(1, COLORS.GOLD, 0.5);
    lineGr.beginPath();
    lineGr.moveTo(cx - 160, cy - 25);
    lineGr.lineTo(cx + 160, cy - 25);
    lineGr.strokePath();

    // はじめからボタン
    this.createButton(cx, cy + 20, 'はじめから', COLORS.PRIMARY, () => {
      this.scene.start(SCENE_KEYS.PLAYER_SETUP);
    });

    // つづきからボタン
    const slots = this.saveManager.listSlots();
    const hasSave = slots.length > 0;
    this.createButton(cx, cy + 90, 'つづきから', hasSave ? 0x1565c0 : 0x333355, () => {
      if (!hasSave) return;
      this.toggleLoadPanel();
    });

    // バージョン表示（左下）
    this.add.text(10, height - 10, 'v1.0.0', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 10,
      color: '#555577',
    }).setOrigin(0, 1);
  }

  private toggleLoadPanel(): void {
    if (this.isLoadPanelVisible) {
      this.hideLoadPanel();
    } else {
      this.showLoadPanel();
    }
  }

  private showLoadPanel(): void {
    this.hideLoadPanel();
    this.isLoadPanelVisible = true;

    const { width, height } = this.scale;
    const cx = width / 2;
    const slots = this.saveManager.listSlots();

    // パネルサイズを先に計算（bg のヒット判定に使用）
    const panelH = 100 + MAX_SAVE_SLOTS * 80 + 50;
    const panelY = height / 2 - panelH / 2;

    // 半透明背景（パネル外クリックで閉じる）
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0)
      .setInteractive()
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.x < cx - 250 || pointer.x > cx + 250 ||
            pointer.y < panelY || pointer.y > panelY + panelH) {
          this.hideLoadPanel();
        }
      });
    this.loadPanelObjects.push(bg);

    // パネル（濃い紺）
    const panel = this.add.rectangle(cx, height / 2, 500, panelH, COLORS.PANEL_DARK).setOrigin(0.5);
    panel.setStrokeStyle(2, COLORS.GOLD);
    this.loadPanelObjects.push(panel);

    // パネルタイトルバー
    const titleBar = this.add.rectangle(cx, panelY, 500, 44, COLORS.PRIMARY).setOrigin(0.5, 0);
    this.loadPanelObjects.push(titleBar);

    const titleText = this.add.text(cx, panelY + 22, 'セーブデータを選択', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.loadPanelObjects.push(titleText);

    // セーブスロット
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const rowY = panelY + 64 + i * 76;
      const slot = slots.find((s) => s.slotId === `slot_${i + 1}`);
      if (slot) {
        this.createSlotRow(cx, rowY, slot);
      } else {
        this.createEmptySlotRow(cx, rowY, `slot_${i + 1}`);
      }
    }

    // 閉じるボタン
    const closeBtn = this.add.text(cx, panelY + panelH - 22, '✕ 閉じる', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hideLoadPanel());
    this.loadPanelObjects.push(closeBtn);
  }

  private createSlotRow(cx: number, y: number, slot: SaveSlot): void {
    const savedDate = new Date(slot.savedAt).toLocaleDateString('ja-JP');
    const players = slot.playerNames.join('・');

    const rowBg = this.add.rectangle(cx, y, 460, 68, 0x1e3a5f)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x334488)
      .setInteractive({ useHandCursor: true });
    rowBg.on('pointerover', () => rowBg.setFillStyle(0x2a4a70));
    rowBg.on('pointerout', () => rowBg.setFillStyle(0x1e3a5f));
    rowBg.on('pointerdown', () => this.loadGame(slot.slotId));
    this.loadPanelObjects.push(rowBg);

    const infoText = this.add.text(cx - 210, y - 14, `${slot.currentYear}年目 / ${slot.totalYears}年間`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#' + COLORS.GOLD.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.loadPanelObjects.push(infoText);

    const playerText = this.add.text(cx - 210, y + 10, players, {
      fontFamily: FONTS.PRIMARY,
      fontSize: 12,
      color: '#aabbcc',
    }).setOrigin(0, 0.5);
    this.loadPanelObjects.push(playerText);

    const dateText = this.add.text(cx + 210, y, savedDate, {
      fontFamily: FONTS.PRIMARY,
      fontSize: 11,
      color: '#778899',
    }).setOrigin(1, 0.5);
    this.loadPanelObjects.push(dateText);

    // 削除ボタン
    const delBtn = this.add.text(cx + 175, y - 20, '×', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#e74c3c',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.saveManager.deleteSlot(slot.slotId);
        this.showLoadPanel();
      });
    this.loadPanelObjects.push(delBtn);
  }

  private createEmptySlotRow(cx: number, y: number, _slotId: string): void {
    const rowBg = this.add.rectangle(cx, y, 460, 68, 0x141e30)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x223355);
    this.loadPanelObjects.push(rowBg);

    const emptyText = this.add.text(cx, y, '--- 空きスロット ---', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#445566',
    }).setOrigin(0.5);
    this.loadPanelObjects.push(emptyText);
  }

  private hideLoadPanel(): void {
    this.loadPanelObjects.forEach((o) => o.destroy());
    this.loadPanelObjects = [];
    this.isLoadPanelVisible = false;
  }

  private loadGame(slotId: string): void {
    const data = this.saveManager.load(slotId);
    if (!data) return;

    this.hideLoadPanel();
    this.scene.start(SCENE_KEYS.GAME, {
      gameState: data.gameState,
      saveSlotId: slotId,
    });
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const bg = this.add.rectangle(x, y, 280, 56, color)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y, label, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1);

    const darkerColor = Math.max(0, color - 0x222222);
    bg.on('pointerover', () => { bg.setFillStyle(darkerColor); bg.setScale(1.03); });
    bg.on('pointerout', () => { bg.setFillStyle(color); bg.setScale(1); });
    bg.on('pointerdown', onClick);
  }
}
