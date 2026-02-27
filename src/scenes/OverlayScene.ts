import Phaser from 'phaser';
import { SCENE_KEYS, COLORS, FONTS } from '../config';
import type { Property, Player, Card } from '../types';
import type { IncomeResult } from '../game/PropertyManager';
import { formatManEn } from '../utils/format';

export interface PropertyPurchaseData {
  property: Property;
  player: Player;
  onBuy: () => void;
  onSkip: () => void;
}

export interface YearEndData {
  year: number;
  results: IncomeResult[];
  players: Player[];
  onClose: () => void;
}

export interface DestinationBonusData {
  player: Player;
  bonus: number;
  destinationName: string;
  onClose: () => void;
}

export interface EventData {
  title: string;
  description: string;
  onClose: () => void;
}

export interface CardHandData {
  player: Player;
  cards: Card[];
  onUseCard: (cardId: string) => void;
  onDiscardCard: (cardId: string) => void;
  onClose: () => void;
}

export interface PropertyUpgradeData {
  property: Property;
  player: Player;
  onUpgrade: () => void;
  onSkip: () => void;
}

export interface CardShopData {
  player: Player;
  lineup: Card[];
  getPrice: (card: Card) => number;
  onBuy: (cardId: string) => void;
  onClose: () => void;
}

export interface PlayerSelectData {
  title: string;
  players: Player[];           // 選択肢となるプレイヤー一覧
  onSelect: (playerId: string) => void;
  onCancel: () => void;
}

export interface PropertySelectData {
  title: string;
  properties: Property[];      // 選択肢となる物件一覧
  onSelect: (propertyId: string) => void;
  onCancel: () => void;
}

export interface CitySelectData {
  title: string;
  cities: { id: string; name: string }[];  // 選択肢となる都市一覧
  onSelect: (cityId: string) => void;
  onCancel: () => void;
}

export interface CardSelectData {
  title: string;
  cards: Card[];                    // 対象プレイヤーの手札カード
  onSelect: (cardId: string) => void;
  onCancel: () => void;
}

export interface BankruptcyData {
  player: Player;
  debtAmount: number;               // 支払いが必要な金額
  properties: Property[];           // 売却可能な物件一覧
  onSell: (propertyId: string) => void;
  onConfirm: () => void;            // 物件なし or 負債を受け入れる
}

export interface CityPropertyInfo {
  property: Property;
  ownerName: string | null;         // 所有者名（null = 未所有）
  ownerColor: number | null;        // 所有者コマ色（null = 未所有）
}

export interface CityInfoData {
  cityName: string;
  regionName: string;
  properties: CityPropertyInfo[];   // 都市内の物件情報
  onClose: () => void;
}

export class OverlayScene extends Phaser.Scene {
  private overlayObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: SCENE_KEYS.OVERLAY });
  }

  create(): void {
    // シーン再起動時のリスナー二重登録を防ぐため、登録前に既存リスナーをクリア
    this.events.removeAllListeners();
    // GameSceneからのイベントを受け取る
    this.events.on('show_property_purchase', (data: PropertyPurchaseData) => {
      this.showPropertyPurchase(data);
    });
    this.events.on('show_year_end', (data: YearEndData) => {
      this.showYearEnd(data);
    });
    this.events.on('show_destination_bonus', (data: DestinationBonusData) => {
      this.showDestinationBonus(data);
    });
    this.events.on('show_event', (data: EventData) => {
      this.showEvent(data);
    });
    this.events.on('show_card_hand', (data: CardHandData) => {
      this.showCardHand(data);
    });
    this.events.on('show_property_upgrade', (data: PropertyUpgradeData) => {
      this.showPropertyUpgrade(data);
    });
    this.events.on('show_card_shop', (data: CardShopData) => {
      this.showCardShop(data);
    });
    this.events.on('show_player_select', (data: PlayerSelectData) => {
      this.showPlayerSelect(data);
    });
    this.events.on('show_property_select', (data: PropertySelectData) => {
      this.showPropertySelect(data);
    });
    this.events.on('show_city_select', (data: CitySelectData) => {
      this.showCitySelect(data);
    });
    this.events.on('show_card_select', (data: CardSelectData) => {
      this.showCardSelect(data);
    });
    this.events.on('show_bankruptcy', (data: BankruptcyData) => {
      this.showBankruptcy(data);
    });
    this.events.on('show_city_info', (data: CityInfoData) => {
      this.showCityInfo(data);
    });
  }

  // ──────────────────────────────────────
  // 物件購入ダイアログ
  // ──────────────────────────────────────

  showPropertyPurchase(data: PropertyPurchaseData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // 半透明背景
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0);
    this.overlayObjects.push(bg);

    // ダイアログ本体
    const panel = this.add.rectangle(cx, cy, 500, 340, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, COLORS.PRIMARY);
    this.overlayObjects.push(panel);

    // タイトル
    const title = this.add.text(cx, cy - 140, '物件購入', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#' + COLORS.PRIMARY.toString(16).padStart(6, '0'),
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);
    this.overlayObjects.push(title);

    // 物件名
    const propName = this.add.text(cx, cy - 80, data.property.name, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayObjects.push(propName);

    // 物件情報
    const infoLines = [
      `購入価格：${formatManEn(data.property.price)}`,
      `年間収益：${formatManEn(data.property.income)}`,
      `所持金：${formatManEn(data.player.money)}`,
    ];
    infoLines.forEach((line, i) => {
      const t = this.add.text(cx, cy - 30 + i * 28, line, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#555555',
      }).setOrigin(0.5);
      this.overlayObjects.push(t);
    });

    // 購入後所持金
    const afterMoney = data.player.money - data.property.price;
    const afterText = this.add.text(cx, cy + 60, `購入後：${formatManEn(afterMoney)}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: afterMoney >= 0 ? '#27ae60' : '#e74c3c',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayObjects.push(afterText);

    // 購入ボタン
    const buyBg = this.add.rectangle(cx - 90, cy + 120, 160, 48, COLORS.SUCCESS)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const buyLabel = this.add.text(cx - 90, cy + 120, '購入する', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    buyBg.on('pointerover', () => buyBg.setFillStyle(0x229954));
    buyBg.on('pointerout', () => buyBg.setFillStyle(COLORS.SUCCESS));
    buyBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onBuy();
    });
    this.overlayObjects.push(buyBg, buyLabel);

    // スキップボタン
    const skipBg = this.add.rectangle(cx + 90, cy + 120, 160, 48, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(cx + 90, cy + 120, 'スキップ', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    skipBg.on('pointerover', () => skipBg.setFillStyle(0x666666));
    skipBg.on('pointerout', () => skipBg.setFillStyle(0x888888));
    skipBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onSkip();
    });
    this.overlayObjects.push(skipBg, skipLabel);
  }

  // ──────────────────────────────────────
  // 年末決算ダイアログ
  // ──────────────────────────────────────

  showYearEnd(data: YearEndData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panelH = Math.min(120 + data.results.length * 80, 500);

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 560, panelH, 0xfff9f0).setOrigin(0.5);
    panel.setStrokeStyle(3, 0xf39c12);
    this.overlayObjects.push(panel);

    const title = this.add.text(cx, cy - panelH / 2 + 30, `${data.year}年目 年末決算`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#f39c12',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);
    this.overlayObjects.push(title);

    data.results.forEach((result, i) => {
      const player = data.players.find((p) => p.id === result.playerId);
      if (!player) return;

      const rowY = cy - panelH / 2 + 90 + i * 80;

      const nameText = this.add.text(cx - 220, rowY, player.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#333333',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(nameText);

      const incomeLines = [
        `物件収益：${formatManEn(result.propertyIncome)}`,
        result.monopolyBonus > 0 ? `独占ボーナス：+${formatManEn(result.monopolyBonus)}` : null,
        `合計：${formatManEn(result.totalIncome)}`,
      ].filter(Boolean) as string[];

      incomeLines.forEach((line, li) => {
        const isBold = li === incomeLines.length - 1;
        const t = this.add.text(cx + 20, rowY - 18 + li * 22, line, {
          fontFamily: FONTS.PRIMARY,
          fontSize: 12,
          color: isBold ? '#e74c3c' : '#555555',
          fontStyle: isBold ? 'bold' : 'normal',
        }).setOrigin(0, 0.5);
        this.overlayObjects.push(t);
      });
    });

    // 閉じるボタン
    const closeBg = this.add.rectangle(cx, cy + panelH / 2 - 30, 180, 44, COLORS.PRIMARY)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(cx, cy + panelH / 2 - 30, '次のターンへ', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    closeBg.on('pointerover', () => closeBg.setFillStyle(0xe65a2a));
    closeBg.on('pointerout', () => closeBg.setFillStyle(COLORS.PRIMARY));
    closeBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onClose();
    });
    this.overlayObjects.push(closeBg, closeLabel);
  }

  // ──────────────────────────────────────
  // 目的地ボーナスダイアログ
  // ──────────────────────────────────────

  showDestinationBonus(data: DestinationBonusData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 460, 280, 0xfff9f0).setOrigin(0.5);
    panel.setStrokeStyle(3, 0xf1c40f);
    this.overlayObjects.push(panel);

    const star = this.add.text(cx, cy - 100, '🎉', {
      fontSize: 48,
    }).setOrigin(0.5);
    this.overlayObjects.push(star);

    const destText = this.add.text(cx, cy - 40, `${data.player.name} が\n「${data.destinationName}」に到着！`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#333333',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.overlayObjects.push(destText);

    const bonusText = this.add.text(cx, cy + 30, `ボーナス：${formatManEn(data.bonus)}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#e74c3c',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayObjects.push(bonusText);

    const closeBg = this.add.rectangle(cx, cy + 100, 160, 44, 0xf1c40f)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(cx, cy + 100, '続ける', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    closeBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onClose();
    });
    this.overlayObjects.push(closeBg, closeLabel);
  }

  // ──────────────────────────────────────
  // イベント通知ダイアログ
  // ──────────────────────────────────────

  showEvent(data: EventData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 480, 240, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, COLORS.SECONDARY);
    this.overlayObjects.push(panel);

    const titleText = this.add.text(cx, cy - 80, data.title, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#' + COLORS.SECONDARY.toString(16).padStart(6, '0'),
      padding: { x: 16, y: 6 },
    }).setOrigin(0.5);
    this.overlayObjects.push(titleText);

    const descText = this.add.text(cx, cy - 10, data.description, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#333333',
      align: 'center',
      wordWrap: { width: 400 },
    }).setOrigin(0.5);
    this.overlayObjects.push(descText);

    const closeBg = this.add.rectangle(cx, cy + 80, 140, 44, COLORS.PRIMARY)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(cx, cy + 80, 'OK', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    closeBg.on('pointerover', () => closeBg.setFillStyle(0xe65a2a));
    closeBg.on('pointerout', () => closeBg.setFillStyle(COLORS.PRIMARY));
    closeBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onClose();
    });
    this.overlayObjects.push(closeBg, closeLabel);
  }

  // ──────────────────────────────────────
  // 手札カード表示ダイアログ
  // ──────────────────────────────────────

  showCardHand(data: CardHandData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const panelH = data.cards.length === 0 ? 200 : Math.min(140 + data.cards.length * 58, 520);

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 520, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, 0x8e44ad);
    this.overlayObjects.push(panel);

    // タイトル
    const titleText = this.add
      .text(cx, cy - panelH / 2 + 26, `${data.player.name}の手札`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.LG,
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#8e44ad',
        padding: { x: 20, y: 6 },
      })
      .setOrigin(0.5);
    this.overlayObjects.push(titleText);

    if (data.cards.length === 0) {
      // 手札なし
      const emptyText = this.add
        .text(cx, cy - 10, '手札がありません\n移動中にカードマスを通ると引けます', {
          fontFamily: FONTS.PRIMARY,
          fontSize: FONTS.SIZE.SM,
          color: '#555555',
          align: 'center',
        })
        .setOrigin(0.5);
      this.overlayObjects.push(emptyText);
    } else {
      // カード一覧
      data.cards.forEach((card, i) => {
        const rowY = cy - panelH / 2 + 70 + i * 58;

        // カード背景
        const cardBg = this.add
          .rectangle(cx - 20, rowY, 440, 50, 0xf8f0ff)
          .setOrigin(0.5);
        this.overlayObjects.push(cardBg);

        // カード名
        const cardName = this.add
          .text(cx - 220, rowY - 6, card.name, {
            fontFamily: FONTS.PRIMARY,
            fontSize: FONTS.SIZE.SM,
            color: '#333333',
            fontStyle: 'bold',
          })
          .setOrigin(0, 0.5);
        this.overlayObjects.push(cardName);

        // 説明
        const cardDesc = this.add
          .text(cx - 220, rowY + 11, card.description, {
            fontFamily: FONTS.PRIMARY,
            fontSize: 10,
            color: '#666666',
          })
          .setOrigin(0, 0.5);
        this.overlayObjects.push(cardDesc);

        // 使うボタン
        const useBg = this.add
          .rectangle(cx + 155, rowY, 70, 34, COLORS.SUCCESS)
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        const useLabel = this.add
          .text(cx + 155, rowY, '使う', {
            fontFamily: FONTS.PRIMARY,
            fontSize: FONTS.SIZE.SM,
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(1);

        useBg.on('pointerover', () => useBg.setFillStyle(0x229954));
        useBg.on('pointerout', () => useBg.setFillStyle(COLORS.SUCCESS));
        useBg.on('pointerdown', () => {
          this.hideOverlay();
          data.onUseCard(card.id);
        });
        this.overlayObjects.push(useBg, useLabel);

        // 捨てるボタン
        const discardBg = this.add
          .rectangle(cx + 230, rowY, 56, 34, 0x95a5a6)
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        const discardLabel = this.add
          .text(cx + 230, rowY, '捨', {
            fontFamily: FONTS.PRIMARY,
            fontSize: FONTS.SIZE.SM,
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(1);

        discardBg.on('pointerover', () => discardBg.setFillStyle(0x7f8c8d));
        discardBg.on('pointerout', () => discardBg.setFillStyle(0x95a5a6));
        discardBg.on('pointerdown', () => {
          this.hideOverlay();
          data.onDiscardCard(card.id);
        });
        this.overlayObjects.push(discardBg, discardLabel);
      });
    }

    // 閉じるボタン
    const closeBg = this.add
      .rectangle(cx, cy + panelH / 2 - 26, 140, 38, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.add
      .text(cx, cy + panelH / 2 - 26, '閉じる', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1);
    closeBg.on('pointerover', () => closeBg.setFillStyle(0x666666));
    closeBg.on('pointerout', () => closeBg.setFillStyle(0x888888));
    closeBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onClose();
    });
    this.overlayObjects.push(closeBg, closeLabel);
  }

  // ──────────────────────────────────────
  // カード売り場ダイアログ
  // ──────────────────────────────────────

  showCardShop(data: CardShopData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panelH = Math.min(160 + data.lineup.length * 62, 540);

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 540, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, 0x16a085);
    this.overlayObjects.push(panel);

    const title = this.add.text(cx, cy - panelH / 2 + 26, '🏪 カード売り場', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#16a085',
      padding: { x: 20, y: 6 },
    }).setOrigin(0.5);
    this.overlayObjects.push(title);

    const moneyText = this.add.text(cx, cy - panelH / 2 + 58, `所持金：${formatManEn(data.player.money)}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#333333',
    }).setOrigin(0.5);
    this.overlayObjects.push(moneyText);

    data.lineup.forEach((card, i) => {
      const rowY = cy - panelH / 2 + 90 + i * 62;
      const price = data.getPrice(card);
      const canAfford = data.player.money >= price;

      const cardBg = this.add.rectangle(cx - 10, rowY, 480, 54, canAfford ? 0xf0fff8 : 0xf8f8f8)
        .setOrigin(0.5);
      this.overlayObjects.push(cardBg);

      const rarityColor: Record<string, string> = {
        common: '#888888', uncommon: '#3498db', rare: '#e74c3c',
      };
      const rarityLabel: Record<string, string> = {
        common: '普通', uncommon: '珍しい', rare: 'レア',
      };

      const rarityText = this.add.text(cx - 240, rowY - 8, rarityLabel[card.rarity] ?? card.rarity, {
        fontFamily: FONTS.PRIMARY,
        fontSize: 10,
        color: rarityColor[card.rarity] ?? '#888888',
        fontStyle: 'bold',
        backgroundColor: '#eeeeee',
        padding: { x: 4, y: 2 },
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(rarityText);

      const cardName = this.add.text(cx - 185, rowY - 8, card.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#333333',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(cardName);

      const cardDesc = this.add.text(cx - 240, rowY + 11, card.description, {
        fontFamily: FONTS.PRIMARY,
        fontSize: 10,
        color: '#666666',
        wordWrap: { width: 300 },
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(cardDesc);

      const buyBg = this.add.rectangle(cx + 200, rowY, 90, 36, canAfford ? 0x16a085 : 0xaaaaaa)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: canAfford });
      const buyLabel = this.add.text(cx + 200, rowY, `${price}万`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);

      if (canAfford) {
        buyBg.on('pointerover', () => buyBg.setFillStyle(0x0e8070));
        buyBg.on('pointerout', () => buyBg.setFillStyle(0x16a085));
        buyBg.on('pointerdown', () => {
          this.hideOverlay();
          data.onBuy(card.id);
        });
      }
      this.overlayObjects.push(buyBg, buyLabel);
    });

    const closeBg = this.add.rectangle(cx, cy + panelH / 2 - 28, 140, 38, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(cx, cy + panelH / 2 - 28, '閉じる', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    closeBg.on('pointerover', () => closeBg.setFillStyle(0x666666));
    closeBg.on('pointerout', () => closeBg.setFillStyle(0x888888));
    closeBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onClose();
    });
    this.overlayObjects.push(closeBg, closeLabel);
  }

  // ──────────────────────────────────────
  // 物件アップグレードダイアログ
  // ──────────────────────────────────────

  showPropertyUpgrade(data: PropertyUpgradeData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const property = data.property;
    const upgradeCost = property.upgradePrices[property.upgradeLevel];
    const currentIncome = property.upgradeLevel === 0
      ? property.income
      : property.upgradeIncomes[property.upgradeLevel - 1] ?? property.income;
    const nextIncome = property.upgradeIncomes[property.upgradeLevel] ?? currentIncome;

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 500, 360, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, 0xe67e22);
    this.overlayObjects.push(panel);

    const title = this.add.text(cx, cy - 150, '物件アップグレード', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#e67e22',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);
    this.overlayObjects.push(title);

    const propName = this.add.text(cx, cy - 90, property.name, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.MD,
      color: '#333333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayObjects.push(propName);

    const levelText = this.add.text(cx, cy - 55, `現在 Lv.${property.upgradeLevel} → Lv.${property.upgradeLevel + 1}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#e67e22',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayObjects.push(levelText);

    const infoLines = [
      `アップグレード費用：${formatManEn(upgradeCost)}`,
      `現在の年収：${formatManEn(currentIncome)} → ${formatManEn(nextIncome)}`,
      `所持金：${formatManEn(data.player.money)}`,
    ];
    infoLines.forEach((line, i) => {
      const t = this.add.text(cx, cy - 10 + i * 28, line, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#555555',
      }).setOrigin(0.5);
      this.overlayObjects.push(t);
    });

    const afterMoney = data.player.money - upgradeCost;
    const afterText = this.add.text(cx, cy + 80, `購入後：${formatManEn(afterMoney)}`, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: afterMoney >= 0 ? '#27ae60' : '#e74c3c',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayObjects.push(afterText);

    const upgBg = this.add.rectangle(cx - 90, cy + 135, 160, 48, 0xe67e22)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const upgLabel = this.add.text(cx - 90, cy + 135, 'アップグレード', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    upgBg.on('pointerover', () => upgBg.setFillStyle(0xca6f1e));
    upgBg.on('pointerout', () => upgBg.setFillStyle(0xe67e22));
    upgBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onUpgrade();
    });
    this.overlayObjects.push(upgBg, upgLabel);

    const skipBg = this.add.rectangle(cx + 90, cy + 135, 160, 48, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(cx + 90, cy + 135, 'スキップ', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    skipBg.on('pointerover', () => skipBg.setFillStyle(0x666666));
    skipBg.on('pointerout', () => skipBg.setFillStyle(0x888888));
    skipBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onSkip();
    });
    this.overlayObjects.push(skipBg, skipLabel);
  }

  // ──────────────────────────────────────
  // 物件選択ダイアログ（sell_property self_choice 用）
  // ──────────────────────────────────────

  showPropertySelect(data: PropertySelectData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panelH = Math.min(180 + data.properties.length * 62, 500);

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 500, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, COLORS.PRIMARY);
    this.overlayObjects.push(panel);

    const title = this.add.text(cx, cy - panelH / 2 + 28, data.title, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#' + COLORS.PRIMARY.toString(16).padStart(6, '0'),
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);
    this.overlayObjects.push(title);

    data.properties.forEach((prop, i) => {
      const rowY = cy - panelH / 2 + 86 + i * 62;

      const rowBg = this.add.rectangle(cx, rowY, 450, 52, 0xfff5ee).setOrigin(0.5);
      this.overlayObjects.push(rowBg);

      const propName = this.add.text(cx - 200, rowY - 8, prop.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#333333',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(propName);

      const priceText = this.add.text(cx - 200, rowY + 12, `価格：${formatManEn(prop.price)}  収益：${formatManEn(prop.income)}`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: 11,
        color: '#777777',
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(priceText);

      const selBg = this.add.rectangle(cx + 180, rowY, 90, 36, COLORS.DANGER)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const selLabel = this.add.text(cx + 180, rowY, '売却', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);

      selBg.on('pointerover', () => selBg.setFillStyle(0xc0392b));
      selBg.on('pointerout', () => selBg.setFillStyle(COLORS.DANGER));
      selBg.on('pointerdown', () => {
        this.hideOverlay();
        data.onSelect(prop.id);
      });
      this.overlayObjects.push(selBg, selLabel);
    });

    const cancelBg = this.add.rectangle(cx, cy + panelH / 2 - 28, 140, 38, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const cancelLabel = this.add.text(cx, cy + panelH / 2 - 28, 'キャンセル', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    cancelBg.on('pointerover', () => cancelBg.setFillStyle(0x666666));
    cancelBg.on('pointerout', () => cancelBg.setFillStyle(0x888888));
    cancelBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onCancel();
    });
    this.overlayObjects.push(cancelBg, cancelLabel);
  }

  // ──────────────────────────────────────
  // プレイヤー選択ダイアログ（bombee_transfer / card_steal 用）
  // ──────────────────────────────────────

  showPlayerSelect(data: PlayerSelectData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panelH = Math.min(180 + data.players.length * 66, 480);

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 480, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, 0x8e44ad);
    this.overlayObjects.push(panel);

    const title = this.add.text(cx, cy - panelH / 2 + 28, data.title, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#8e44ad',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);
    this.overlayObjects.push(title);

    data.players.forEach((target, i) => {
      const rowY = cy - panelH / 2 + 90 + i * 66;

      const rowBg = this.add.rectangle(cx, rowY, 420, 54, 0xf8f0ff).setOrigin(0.5);
      this.overlayObjects.push(rowBg);

      const nameText = this.add.text(cx - 170, rowY - 8, target.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#333333',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(nameText);

      const assetText = this.add.text(cx - 170, rowY + 12, `総資産：${formatManEn(target.totalAssets)}`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: 11,
        color: '#777777',
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(assetText);

      const selBg = this.add.rectangle(cx + 160, rowY, 90, 36, 0x8e44ad)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const selLabel = this.add.text(cx + 160, rowY, '選択', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);

      selBg.on('pointerover', () => selBg.setFillStyle(0x7d3c98));
      selBg.on('pointerout', () => selBg.setFillStyle(0x8e44ad));
      selBg.on('pointerdown', () => {
        this.hideOverlay();
        data.onSelect(target.id);
      });
      this.overlayObjects.push(selBg, selLabel);
    });

    // キャンセルボタン
    const cancelBg = this.add.rectangle(cx, cy + panelH / 2 - 28, 140, 38, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const cancelLabel = this.add.text(cx, cy + panelH / 2 - 28, 'キャンセル', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    cancelBg.on('pointerover', () => cancelBg.setFillStyle(0x666666));
    cancelBg.on('pointerout', () => cancelBg.setFillStyle(0x888888));
    cancelBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onCancel();
    });
    this.overlayObjects.push(cancelBg, cancelLabel);
  }

  // ──────────────────────────────────────
  // カード選択ダイアログ（card_steal / selected_card 用）
  // ──────────────────────────────────────

  showCardSelect(data: CardSelectData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panelH = Math.min(180 + data.cards.length * 70, 500);

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, 520, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, 0xe74c3c);
    this.overlayObjects.push(panel);

    const titleObj = this.add.text(cx, cy - panelH / 2 + 28, data.title, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#e74c3c',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);
    this.overlayObjects.push(titleObj);

    const rarityLabel: Record<string, string> = {
      common: '普通', uncommon: '珍しい', rare: 'レア',
    };
    const rarityColor: Record<string, string> = {
      common: '#888888', uncommon: '#3498db', rare: '#e74c3c',
    };

    data.cards.forEach((card, i) => {
      const rowY = cy - panelH / 2 + 82 + i * 70;

      const rowBg = this.add.rectangle(cx, rowY, 470, 58, 0xfff0f0).setOrigin(0.5);
      this.overlayObjects.push(rowBg);

      const rarityText = this.add.text(cx - 215, rowY - 10, rarityLabel[card.rarity] ?? card.rarity, {
        fontFamily: FONTS.PRIMARY,
        fontSize: 10,
        color: rarityColor[card.rarity] ?? '#888888',
        fontStyle: 'bold',
        backgroundColor: '#eeeeee',
        padding: { x: 4, y: 2 },
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(rarityText);

      const cardName = this.add.text(cx - 155, rowY - 10, card.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#333333',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(cardName);

      const cardDesc = this.add.text(cx - 215, rowY + 12, card.description, {
        fontFamily: FONTS.PRIMARY,
        fontSize: 10,
        color: '#666666',
        wordWrap: { width: 310 },
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(cardDesc);

      const stealBg = this.add.rectangle(cx + 190, rowY, 90, 38, 0xe74c3c)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const stealLabel = this.add.text(cx + 190, rowY, '奪う', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);

      stealBg.on('pointerover', () => stealBg.setFillStyle(0xc0392b));
      stealBg.on('pointerout', () => stealBg.setFillStyle(0xe74c3c));
      stealBg.on('pointerdown', () => {
        this.hideOverlay();
        data.onSelect(card.id);
      });
      this.overlayObjects.push(stealBg, stealLabel);
    });

    const cancelBg = this.add.rectangle(cx, cy + panelH / 2 - 28, 140, 38, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const cancelLabel = this.add.text(cx, cy + panelH / 2 - 28, 'キャンセル', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    cancelBg.on('pointerover', () => cancelBg.setFillStyle(0x666666));
    cancelBg.on('pointerout', () => cancelBg.setFillStyle(0x888888));
    cancelBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onCancel();
    });
    this.overlayObjects.push(cancelBg, cancelLabel);
  }

  // ──────────────────────────────────────
  // 都市選択ダイアログ（move_steps / any_station テレポート用）
  // ──────────────────────────────────────

  showCitySelect(data: CitySelectData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panelW = 640;
    const panelH = 480;
    const cols = 3;
    const btnW = 180;
    const btnH = 38;
    const gapX = 15;
    const gapY = 10;

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);
    this.overlayObjects.push(bg);

    const panel = this.add.rectangle(cx, cy, panelW, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, 0x1abc9c);
    this.overlayObjects.push(panel);

    const titleBg = this.add.text(cx, cy - panelH / 2 + 28, data.title, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#1abc9c',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);
    this.overlayObjects.push(titleBg);

    // 都市ボタン（グリッドレイアウト）
    const startX = cx - panelW / 2 + 40 + btnW / 2;
    const startY = cy - panelH / 2 + 80;

    data.cities.forEach((city, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * (btnW + gapX);
      const by = startY + row * (btnH + gapY);

      const cityBg = this.add.rectangle(bx, by, btnW, btnH, 0x1abc9c)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const cityLabel = this.add.text(bx, by, city.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);

      cityBg.on('pointerover', () => cityBg.setFillStyle(0x16a085));
      cityBg.on('pointerout', () => cityBg.setFillStyle(0x1abc9c));
      cityBg.on('pointerdown', () => {
        this.hideOverlay();
        data.onSelect(city.id);
      });
      this.overlayObjects.push(cityBg, cityLabel);
    });

    const cancelBg = this.add.rectangle(cx, cy + panelH / 2 - 28, 140, 38, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const cancelLabel = this.add.text(cx, cy + panelH / 2 - 28, 'キャンセル', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    cancelBg.on('pointerover', () => cancelBg.setFillStyle(0x666666));
    cancelBg.on('pointerout', () => cancelBg.setFillStyle(0x888888));
    cancelBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onCancel();
    });
    this.overlayObjects.push(cancelBg, cancelLabel);
  }

  // ──────────────────────────────────────
  // 破産ダイアログ（所持金不足時の物件強制売却）
  // ──────────────────────────────────────

  showBankruptcy(data: BankruptcyData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const rowCount = data.properties.length;
    const panelH = rowCount > 0
      ? Math.min(240 + rowCount * 62, 520)
      : 240;

    // 半透明背景
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0);
    this.overlayObjects.push(bg);

    // ダイアログ本体（オレンジ枠）
    const panel = this.add.rectangle(cx, cy, 520, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(4, 0xe67e22);
    this.overlayObjects.push(panel);

    // タイトル
    const titleBg = this.add.rectangle(cx, cy - panelH / 2 + 28, 520, 56, 0xe67e22).setOrigin(0.5);
    this.overlayObjects.push(titleBg);
    const titleText = this.add.text(cx, cy - panelH / 2 + 28, '⚠ 所持金不足', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayObjects.push(titleText);

    // 説明
    const shortage = Math.max(0, data.debtAmount - data.player.money);
    const descY = cy - panelH / 2 + 80;
    const desc = this.add.text(
      cx,
      descY,
      `${data.player.name} の所持金が不足しています\n必要額：${formatManEn(data.debtAmount)}  所持：${formatManEn(data.player.money)}\n不足額：${formatManEn(shortage)}`,
      {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#c0392b',
        fontStyle: 'bold',
        align: 'center',
      },
    ).setOrigin(0.5, 0);
    this.overlayObjects.push(desc);

    if (rowCount === 0) {
      // 物件なし → 負債を受け入れるボタンのみ
      const noProps = this.add.text(cx, cy, '売却できる物件がありません\nこのまま続けます（負債確定）', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#777777',
        align: 'center',
      }).setOrigin(0.5);
      this.overlayObjects.push(noProps);

      const confirmBg = this.add.rectangle(cx, cy + panelH / 2 - 36, 180, 42, 0xe67e22)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const confirmLabel = this.add.text(cx, cy + panelH / 2 - 36, '続ける', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.MD,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);
      confirmBg.on('pointerover', () => confirmBg.setFillStyle(0xd35400));
      confirmBg.on('pointerout', () => confirmBg.setFillStyle(0xe67e22));
      confirmBg.on('pointerdown', () => {
        this.hideOverlay();
        data.onConfirm();
      });
      this.overlayObjects.push(confirmBg, confirmLabel);
      return;
    }

    // 物件リスト（売る半額ボタン付き）
    const listStartY = cy - panelH / 2 + 148;
    data.properties.forEach((prop, i) => {
      const rowY = listStartY + i * 62;

      const rowBg = this.add.rectangle(cx, rowY, 480, 52, 0xfff3e0).setOrigin(0.5);
      this.overlayObjects.push(rowBg);

      const propName = this.add.text(cx - 215, rowY - 8, prop.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#333333',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.overlayObjects.push(propName);

      const sellVal = Math.floor(prop.price * 0.5);
      const infoText = this.add.text(
        cx - 215,
        rowY + 12,
        `価格 ${formatManEn(prop.price)} → 売却額 ${formatManEn(sellVal)}（半額）`,
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: 11,
          color: '#888888',
        },
      ).setOrigin(0, 0.5);
      this.overlayObjects.push(infoText);

      const sellBg = this.add.rectangle(cx + 195, rowY, 100, 38, 0xe67e22)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const sellLabel = this.add.text(cx + 195, rowY, '売る', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);
      sellBg.on('pointerover', () => sellBg.setFillStyle(0xd35400));
      sellBg.on('pointerout', () => sellBg.setFillStyle(0xe67e22));
      sellBg.on('pointerdown', () => {
        this.hideOverlay();
        data.onSell(prop.id);
      });
      this.overlayObjects.push(sellBg, sellLabel);
    });

    // 「このまま続ける（負債）」ボタン
    const confirmBg = this.add.rectangle(cx, cy + panelH / 2 - 28, 200, 38, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const confirmLabel = this.add.text(cx, cy + panelH / 2 - 28, 'このまま続ける（負債）', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(1);
    confirmBg.on('pointerover', () => confirmBg.setFillStyle(0x666666));
    confirmBg.on('pointerout', () => confirmBg.setFillStyle(0x888888));
    confirmBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onConfirm();
    });
    this.overlayObjects.push(confirmBg, confirmLabel);
  }

  // ──────────────────────────────────────
  // 都市情報ポップアップ（マップ都市クリック時）
  // ──────────────────────────────────────

  showCityInfo(data: CityInfoData): void {
    this.beginOverlay();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const rowCount = data.properties.length;
    const panelH = rowCount === 0 ? 200 : Math.min(180 + rowCount * 52, 500);

    // 半透明背景（クリックで閉じる）
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0)
      .setInteractive();
    bg.on('pointerdown', () => {
      this.hideOverlay();
      data.onClose();
    });
    this.overlayObjects.push(bg);

    // ダイアログ本体
    const panel = this.add.rectangle(cx, cy, 480, panelH, 0xffffff).setOrigin(0.5);
    panel.setStrokeStyle(3, COLORS.PRIMARY);
    this.overlayObjects.push(panel);

    // タイトル帯
    const titleBg = this.add.rectangle(cx, cy - panelH / 2 + 26, 480, 52, COLORS.PRIMARY).setOrigin(0.5);
    this.overlayObjects.push(titleBg);

    const titleText = this.add.text(cx, cy - panelH / 2 + 22, data.cityName, {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.LG,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.overlayObjects.push(titleText);

    const regionText = this.add.text(cx, cy - panelH / 2 + 40, data.regionName, {
      fontFamily: FONTS.PRIMARY,
      fontSize: 11,
      color: '#ffe0cc',
    }).setOrigin(0.5, 0.5);
    this.overlayObjects.push(regionText);

    if (rowCount === 0) {
      const noProps = this.add.text(cx, cy, 'この都市に物件はありません', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#888888',
      }).setOrigin(0.5);
      this.overlayObjects.push(noProps);
    } else {
      const listStartY = cy - panelH / 2 + 76;

      data.properties.forEach((info, i) => {
        const rowY = listStartY + i * 52;
        const prop = info.property;

        // 行背景
        const rowBg = this.add.rectangle(cx, rowY, 450, 44, i % 2 === 0 ? 0xfff8f0 : 0xfff0e0).setOrigin(0.5);
        this.overlayObjects.push(rowBg);

        // 所有者カラードット
        const dotColor = info.ownerColor ?? 0xcccccc;
        const dot = this.add.circle(cx - 205, rowY, 8, dotColor, info.ownerColor ? 1 : 0.3);
        this.overlayObjects.push(dot);

        // 物件名
        const propName = this.add.text(cx - 190, rowY - 7, prop.name, {
          fontFamily: FONTS.PRIMARY,
          fontSize: FONTS.SIZE.SM,
          color: '#333333',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.overlayObjects.push(propName);

        // 所有者名
        const ownerStr = info.ownerName ? `所有: ${info.ownerName}` : '未所有';
        const ownerColor = info.ownerName ? '#' + (info.ownerColor ?? 0x888888).toString(16).padStart(6, '0') : '#999999';
        const ownerText = this.add.text(cx - 190, rowY + 8, ownerStr, {
          fontFamily: FONTS.PRIMARY,
          fontSize: 11,
          color: ownerColor,
        }).setOrigin(0, 0.5);
        this.overlayObjects.push(ownerText);

        // 価格・収益
        const lvStr = prop.upgradeLevel > 0 ? ` Lv${prop.upgradeLevel}` : '';
        const incomeNow = prop.upgradeLevel > 0
          ? (prop.upgradeIncomes[prop.upgradeLevel - 1] ?? prop.income)
          : prop.income;
        const statsText = this.add.text(
          cx + 220,
          rowY,
          `${formatManEn(prop.price)}${lvStr} / 収益${formatManEn(incomeNow)}`,
          { fontFamily: FONTS.PRIMARY, fontSize: 11, color: '#555555' },
        ).setOrigin(1, 0.5);
        this.overlayObjects.push(statsText);
      });
    }

    // 「閉じる」ボタン
    const closeBg = this.add.rectangle(cx, cy + panelH / 2 - 26, 140, 38, 0x888888)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(cx, cy + panelH / 2 - 26, '閉じる', {
      fontFamily: FONTS.PRIMARY,
      fontSize: FONTS.SIZE.SM,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    closeBg.on('pointerover', () => closeBg.setFillStyle(0x666666));
    closeBg.on('pointerout', () => closeBg.setFillStyle(0x888888));
    closeBg.on('pointerdown', () => {
      this.hideOverlay();
      data.onClose();
    });
    this.overlayObjects.push(closeBg, closeLabel);
  }

  // ──────────────────────────────────────
  // オーバーレイを閉じる
  // ──────────────────────────────────────

  // ダイアログ表示開始：GameScene入力を無効化してからオーバーレイをリセット
  private beginOverlay(): void {
    this.hideOverlay();
    const game = this.scene.get(SCENE_KEYS.GAME);
    if (game) game.input.enabled = false;
  }

  hideOverlay(): void {
    this.overlayObjects.forEach((o) => o.destroy());
    this.overlayObjects = [];
    // GameSceneの入力を再有効化
    const game = this.scene.get(SCENE_KEYS.GAME);
    if (game) game.input.enabled = true;
  }
}
