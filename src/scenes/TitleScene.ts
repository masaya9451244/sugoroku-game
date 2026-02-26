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

    // 背景
    this.add.rectangle(0, 0, width, height, COLORS.BACKGROUND).setOrigin(0);

    // タイトルテキスト
    this.add.text(cx, cy - 120, '双六ゲーム', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.XXL,
      color: `#${COLORS.PRIMARY.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 60, '〜 桃鉄風 日本一周 〜', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#666666',
    }).setOrigin(0.5);

    // はじめからボタン
    this.createButton(cx, cy + 20, 'はじめから', COLORS.PRIMARY, () => {
      this.scene.start(SCENE_KEYS.PLAYER_SETUP);
    });

    // つづきからボタン
    const slots = this.saveManager.listSlots();
    const hasSave = slots.length > 0;
    this.createButton(cx, cy + 90, 'つづきから', hasSave ? COLORS.SECONDARY : 0xaaaaaa, () => {
      if (!hasSave) return;
      this.toggleLoadPanel();
    });

    // バージョン表示
    this.add.text(width - 10, height - 10, 'v1.0.0', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 10,
      color: '#aaaaaa',
    }).setOrigin(1, 1);
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

    // 半透明背景
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0)
      .setInteractive()
      .on('pointerdown', () => this.hideLoadPanel());
    this.loadPanelObjects.push(bg);

    // パネル
    const panelH = 80 + slots.length * 80 + 60;
    const panelY = height / 2 - panelH / 2;
    const panel = this.add.rectangle(cx, height / 2, 480, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(2, COLORS.SECONDARY);
    this.loadPanelObjects.push(panel);

    const title = this.add.text(cx, panelY + 30, 'セーブデータを選択', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.loadPanelObjects.push(title);

    if (slots.length === 0) {
      const empty = this.add.text(cx, height / 2, 'セーブデータがありません', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#aaaaaa',
      }).setOrigin(0.5);
      this.loadPanelObjects.push(empty);
    }

    slots.forEach((slot, i) => {
      const rowY = panelY + 80 + i * 80;
      this.createSlotRow(cx, rowY, slot);
    });

    // 空きスロットを追加表示
    for (let i = slots.length; i < MAX_SAVE_SLOTS; i++) {
      const rowY = panelY + 80 + i * 80;
      this.createEmptySlotRow(cx, rowY, `slot_${i + 1}`);
    }

    // 閉じるボタン
    const closeBtn = this.add.text(cx, panelY + panelH - 30, '閉じる', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#666666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hideLoadPanel());
    this.loadPanelObjects.push(closeBtn);
  }

  private createSlotRow(cx: number, y: number, slot: SaveSlot): void {
    const savedDate = new Date(slot.savedAt).toLocaleDateString('ja-JP');
    const players = slot.playerNames.join('・');

    const rowBg = this.add.rectangle(cx, y, 420, 68, 0xf8f8f8)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xdddddd)
      .setInteractive({ useHandCursor: true });
    rowBg.on('pointerover', () => rowBg.setFillStyle(0xfff0e8));
    rowBg.on('pointerout', () => rowBg.setFillStyle(0xf8f8f8));
    rowBg.on('pointerdown', () => this.loadGame(slot.slotId));
    this.loadPanelObjects.push(rowBg);

    const infoText = this.add.text(cx - 190, y - 16, `${slot.currentYear}年目 / ${slot.totalYears}年間`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.loadPanelObjects.push(infoText);

    const playerText = this.add.text(cx - 190, y + 8, players, {
      fontFamily: FONTS.PRIMARY,
      fontSize: 12,
      color: '#666666',
    }).setOrigin(0, 0.5);
    this.loadPanelObjects.push(playerText);

    const dateText = this.add.text(cx + 190, y, savedDate, {
      fontFamily: FONTS.PRIMARY,
      fontSize: 11,
      color: '#999999',
    }).setOrigin(1, 0.5);
    this.loadPanelObjects.push(dateText);

    // 削除ボタン
    const delBtn = this.add.text(cx + 160, y - 22, '×', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#e74c3c',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.saveManager.deleteSlot(slot.slotId);
        this.showLoadPanel(); // 再描画
      });
    this.loadPanelObjects.push(delBtn);
  }

  private createEmptySlotRow(cx: number, y: number, _slotId: string): void {
    const rowBg = this.add.rectangle(cx, y, 420, 68, 0xf0f0f0)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xdddddd);
    this.loadPanelObjects.push(rowBg);

    const emptyText = this.add.text(cx, y, '--- 空きスロット ---', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#cccccc',
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
    const bg = this.add.rectangle(x, y, 240, 52, color)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y, label, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    bg.on('pointerover', () => bg.setFillStyle(color === COLORS.PRIMARY ? 0xe65a2a : 0x3db8b0));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerdown', onClick);
  }
}
